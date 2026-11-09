import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { tap, catchError, map, filter, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  StudyMetadata,
  SeriesMetadata,
  InstanceMetadata,
  PresignedUploadResponse
} from '../models/dicom.models';

@Injectable({
  providedIn: 'root'
})
export class DicomApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  // Reactive state signals
  readonly studies = signal<StudyMetadata[]>([]);
  readonly loading = signal<boolean>(false);
  readonly uploading = signal<boolean>(false);
  readonly uploadProgress = signal<number>(0);
  readonly error = signal<string | null>(null);

  /**
   * Retrieves all indexed DICOM studies, optionally filtered by patient ID.
   */
  fetchStudies(patientId?: string): Observable<StudyMetadata[]> {
    this.loading.set(true);
    this.error.set(null);

    const options = patientId
      ? { params: new HttpParams().set('patientId', patientId) }
      : {};

    return this.http.get<StudyMetadata[]>(`${this.baseUrl}/studies`, options).pipe(
      tap((data: StudyMetadata[]) => {
        this.studies.set(data ?? []);
        this.loading.set(false);
      }),
      catchError((err: HttpErrorResponse) => {
        this.loading.set(false);
        const message = err.error?.error || err.statusText || err.message;
        this.error.set(`Failed to load studies: ${message}`);
        return throwError(() => err);
      })
    );
  }

  /**
   * Retrieves all series belonging to a study.
   */
  fetchSeries(studyUid: string): Observable<SeriesMetadata[]> {
    return this.http.get<SeriesMetadata[]>(`${this.baseUrl}/studies/${studyUid}/series`).pipe(
      catchError((err: HttpErrorResponse) => {
        const message = err.error?.error || err.statusText || err.message;
        this.error.set(`Failed to load series for study ${studyUid}: ${message}`);
        return throwError(() => err);
      })
    );
  }

  /**
   * Retrieves instances (slices) belonging to a series, enriched with S3 Pre-signed streaming URLs.
   */
  fetchInstances(studyUid: string, seriesUid: string): Observable<InstanceMetadata[]> {
    return this.http.get<InstanceMetadata[]>(
      `${this.baseUrl}/studies/${studyUid}/series/${seriesUid}/instances`
    ).pipe(
      catchError((err: HttpErrorResponse) => {
        const message = err.error?.error || err.statusText || err.message;
        this.error.set(`Failed to load instances for series ${seriesUid}: ${message}`);
        return throwError(() => err);
      })
    );
  }

  /**
   * Step 1 of S3 Direct Ingestion:
   * Requests a secure AWS SigV4 Pre-signed PUT URL from the backend.
   */
  requestUploadUrl(filename: string, contentType: string = 'application/dicom'): Observable<PresignedUploadResponse> {
    return this.http.post<PresignedUploadResponse>(`${this.baseUrl}/upload-url`, {
      filename,
      contentType
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        const message = err.error?.error || err.statusText || err.message;
        this.error.set(`Failed to request pre-signed upload URL: ${message}`);
        return throwError(() => err);
      })
    );
  }

  /**
   * Step 2 of S3 Direct Ingestion:
   * Streams the binary DICOM payload directly to Amazon S3 via the Pre-signed URL.
   * Emits live upload progress (0% - 100%).
   */
  uploadDirectToS3(uploadUrl: string, file: File): Observable<HttpEvent<unknown>> {
    return this.http.put(uploadUrl, file, {
      reportProgress: true,
      observe: 'events',
      headers: {
        'Content-Type': 'application/dicom'
      }
    });
  }

  /**
   * Orchestrator:
   * Executes the full two-step S3 Pre-signed upload workflow:
   * 1. Obtains Pre-signed PUT URL from API Gateway / Lambda
   * 2. Direct HTTP PUT of raw binary payload into S3 Bucket
   * 3. Triggers study list refresh upon completion
   */
  uploadDicomFile(file: File): Observable<PresignedUploadResponse> {
    this.uploading.set(true);
    this.uploadProgress.set(0);
    this.error.set(null);

    return this.requestUploadUrl(file.name).pipe(
      switchMap((presigned: PresignedUploadResponse) => {
        return this.uploadDirectToS3(presigned.uploadUrl, file).pipe(
          tap((event: HttpEvent<unknown>) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              const progress = Math.round((100 * event.loaded) / event.total);
              this.uploadProgress.set(progress);
            }
          }),
          filter((event: HttpEvent<unknown>) => event.type === HttpEventType.Response),
          switchMap(() => {
            // Trigger metadata extraction and DynamoDB indexing on uploaded object
            return this.http.post(`${this.baseUrl}/ingest`, { key: presigned.s3Key }).pipe(
              catchError((err) => {
                console.warn('Ingest indexing notification returned:', err);
                return of(null);
              })
            );
          }),
          map(() => presigned),
          tap(() => {
            this.uploading.set(false);
            this.uploadProgress.set(100);
            this.fetchStudies().subscribe({ error: () => { } });
          }),
          catchError((err: HttpErrorResponse) => {
            this.uploading.set(false);
            const message = err.error?.error || err.statusText || err.message;
            this.error.set(`Direct S3 upload failed: ${message}`);
            return throwError(() => err);
          })
        );
      }),
      catchError((err: HttpErrorResponse) => {
        this.uploading.set(false);
        return throwError(() => err);
      })
    );
  }
}
