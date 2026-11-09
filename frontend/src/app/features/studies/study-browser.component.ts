import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DicomApiService } from '../../core/services/dicom-api.service';
import { SeriesMetadata } from '../../core/models/dicom.models';

@Component({
  selector: 'app-study-browser',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-7xl mx-auto space-y-6">
      
      <!-- Top Bar: Title & Ingestion Dropzone -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-white tracking-wide">PACS Studies Directory</h1>
          <p class="text-xs text-slate-400 mt-0.5">Clinical Studies &bull; S3 Ingestion Pipeline &bull; DynamoDB Catalog</p>
        </div>

        <!-- Ingestion Upload Button & Drag Trigger -->
        <div class="flex items-center gap-3">
          <label class="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs rounded-lg shadow-lg shadow-sky-500/20 transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
            <span>Upload DICOM (.dcm)</span>
            <input type="file" multiple accept=".dcm,application/dicom" (change)="onFileSelected($event)" class="hidden" />
          </label>
        </div>
      </div>

      <!-- Drag & Drop Zone -->
      <div
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
        [class]="isDragging() ? 'border-sky-400 bg-sky-500/10' : 'border-slate-800 bg-dicom-panel/60'"
        class="border-2 border-dashed rounded-xl p-6 text-center transition-all">
        <div class="max-w-md mx-auto space-y-2">
          <div class="w-10 h-10 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-sky-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
          </div>
          <div class="text-sm font-medium text-slate-200">
            Drag and drop DICOM files or series here
          </div>
          <p class="text-xs text-slate-500">
            Supports raw DICOM (.dcm), multi-slice CT/MR series. Directly parsed in-browser or streamed to S3.
          </p>
          @if (apiService.uploading()) {
            <div class="space-y-1.5 pt-2 max-w-xs mx-auto">
              <div class="flex justify-between text-xs font-mono text-sky-400">
                <span>Direct S3 Upload...</span>
                <span>{{ apiService.uploadProgress() }}%</span>
              </div>
              <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div class="bg-sky-500 h-1.5 rounded-full transition-all duration-200" [style.width.%]="apiService.uploadProgress()"></div>
              </div>
            </div>
          }
          @if (apiService.error()) {
            <div class="mt-2 p-2.5 bg-red-950/60 border border-red-500/50 rounded-lg text-xs text-red-200 flex items-center justify-between">
              <span>{{ apiService.error() }}</span>
              <button (click)="apiService.error.set(null)" class="text-red-400 hover:text-white font-bold ml-2">&times;</button>
            </div>
          }
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="bg-dicom-panel border border-dicom-border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <!-- Search bar -->
        <div class="relative w-full sm:w-96">
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search by Patient Name, ID, or Study Description..."
            class="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500" />
          <svg class="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>

        <!-- Modality Filter Chips -->
        <div class="flex items-center gap-1.5 self-start sm:self-auto">
          @for (m of modalities; track m) {
            <button
              (click)="selectedModality.set(m)"
              [class]="selectedModality() === m ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400 hover:text-slate-200'"
              class="px-2.5 py-1 text-xs rounded transition-all">
              {{ m }}
            </button>
          }
        </div>
      </div>

      <!-- Studies Table -->
      <div class="bg-dicom-panel border border-dicom-border rounded-xl overflow-hidden shadow-xl">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-900/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-dicom-border">
              <tr>
                <th class="py-3 px-4">Patient</th>
                <th class="py-3 px-4">Modality</th>
                <th class="py-3 px-4">Study Description</th>
                <th class="py-3 px-4">Study Date</th>
                <th class="py-3 px-4 text-center">Series</th>
                <th class="py-3 px-4 text-center">Slices</th>
                <th class="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dicom-border">
              @for (study of filteredStudies(); track study.studyInstanceUid) {
                <tr
                  class="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                  (click)="toggleStudy(study.studyInstanceUid)">
                  
                  <!-- Patient info -->
                  <td class="py-3.5 px-4">
                    <div class="font-medium text-slate-100">{{ study.patientName }}</div>
                    <div class="text-[11px] font-mono text-slate-500">{{ study.patientId }}</div>
                  </td>

                  <!-- Modality Badges -->
                  <td class="py-3.5 px-4">
                    <div class="flex gap-1">
                      @for (mod of study.modalities; track mod) {
                        <span
                          [class]="mod === 'CT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'"
                          class="px-2 py-0.5 rounded text-[10px] font-mono border font-semibold">
                          {{ mod }}
                        </span>
                      }
                    </div>
                  </td>

                  <!-- Study Description -->
                  <td class="py-3.5 px-4 text-slate-300 font-medium">
                    {{ study.studyDescription }}
                  </td>

                  <!-- Study Date -->
                  <td class="py-3.5 px-4 text-slate-400 font-mono">
                    {{ study.studyDate }}
                  </td>

                  <!-- Series Count -->
                  <td class="py-3.5 px-4 text-center font-mono text-slate-300">
                    {{ study.seriesCount }}
                  </td>

                  <!-- Total Slices -->
                  <td class="py-3.5 px-4 text-center font-mono text-sky-400 font-semibold">
                    {{ study.totalInstances }}
                  </td>

                  <!-- Action button -->
                  <td class="py-3.5 px-4 text-right" (click)="$event.stopPropagation()">
                    <button
                      (click)="openInViewer(study.studyInstanceUid)"
                      class="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-slate-950 font-medium rounded border border-sky-500/30 transition-all flex items-center gap-1.5 ml-auto">
                      <span>View</span>
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                      </svg>
                    </button>
                  </td>
                </tr>

                <!-- Expanded Series Row -->
                @if (expandedStudyUid() === study.studyInstanceUid) {
                  <tr class="bg-slate-950/60 border-t border-b border-sky-500/20">
                    <td colspan="7" class="p-4">
                      <div class="space-y-3">
                        <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <span class="w-2 h-2 rounded-full bg-sky-400"></span>
                          Available Series for Study: {{ study.studyDescription }}
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          @for (ser of activeSeries(); track ser.seriesInstanceUid) {
                            <div
                              (click)="openInViewer(study.studyInstanceUid, ser.seriesInstanceUid)"
                              class="bg-slate-900 border border-slate-800 hover:border-sky-500/60 rounded-lg p-3 cursor-pointer transition-all hover:shadow-lg hover:shadow-sky-500/5 group">
                              <div class="flex items-center justify-between mb-1">
                                <span class="font-mono text-xs text-sky-400 font-semibold">Series #{{ ser.seriesNumber }} ({{ ser.modality }})</span>
                                <span class="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-mono">{{ ser.numberOfInstances }} slices</span>
                              </div>
                              <div class="text-xs font-medium text-slate-200 group-hover:text-sky-300 transition-colors">
                                {{ ser.seriesDescription }}
                              </div>
                              <div class="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                                <span>{{ ser.bodyPartExamined || 'WHOLE BODY' }}</span>
                                <span class="text-sky-400 group-hover:translate-x-0.5 transition-transform">&rarr; Load in Workstation</span>
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              } @empty {
                <tr>
                  <td colspan="7" class="py-8 text-center text-slate-500 text-xs">
                    No studies found matching current query.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class StudyBrowserComponent implements OnInit {
  apiService = inject(DicomApiService);
  private router = inject(Router);

  isDragging = signal<boolean>(false);
  searchQuery = '';
  modalities = ['ALL', 'CT', 'MR', 'CR'];
  selectedModality = signal<string>('ALL');

  expandedStudyUid = signal<string | null>(null);
  activeSeries = signal<SeriesMetadata[]>([]);

  // Computed filtered list
  filteredStudies = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    const mod = this.selectedModality();

    return this.apiService.studies().filter(s => {
      const matchMod = mod === 'ALL' || s.modalities.includes(mod);
      const matchQuery =
        !q ||
        s.patientName.toLowerCase().includes(q) ||
        s.patientId.toLowerCase().includes(q) ||
        s.studyDescription.toLowerCase().includes(q);

      return matchMod && matchQuery;
    });
  });

  ngOnInit(): void {
    this.apiService.fetchStudies().subscribe();
  }

  toggleStudy(studyUid: string): void {
    if (this.expandedStudyUid() === studyUid) {
      this.expandedStudyUid.set(null);
      this.activeSeries.set([]);
    } else {
      this.expandedStudyUid.set(studyUid);
      this.apiService.fetchSeries(studyUid).subscribe(series => {
        this.activeSeries.set(series);
      });
    }
  }

  openInViewer(studyUid: string, seriesUid?: string): void {
    this.router.navigate(['/viewer'], {
      queryParams: {
        study: studyUid,
        series: seriesUid
      }
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFiles(event.dataTransfer.files);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFiles(input.files);
    }
  }

  private handleFiles(files: FileList): void {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.apiService.uploadDicomFile(file).subscribe();
    }
  }
}

