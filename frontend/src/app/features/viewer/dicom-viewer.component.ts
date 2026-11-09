import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CornerstoneService } from '../../core/services/cornerstone.service';
import { DicomApiService } from '../../core/services/dicom-api.service';
import {
  ActiveTool,
  COMMON_WL_PRESETS,
  WindowLevelPreset,
  SeriesMetadata
} from '../../core/models/dicom.models';
import { ViewerToolbarComponent } from './components/viewer-toolbar.component';
import { RadiologyHudComponent } from './components/radiology-hud.component';
import { SeriesSidebarComponent } from './components/series-sidebar.component';

@Component({
  selector: 'app-dicom-viewer',
  standalone: true,
  imports: [
    CommonModule,
    ViewerToolbarComponent,
    RadiologyHudComponent,
    SeriesSidebarComponent
  ],
  template: `
    <div class="h-[calc(100vh-3.5rem)] flex flex-col bg-dicom-bg select-none overflow-hidden">
      
      <!-- Top Clinical Toolbar Component -->
      <app-viewer-toolbar
        [activeTool]="cornerstone.activeTool()"
        [presets]="presets"
        [windowWidth]="cornerstone.windowWidth()"
        [windowCenter]="cornerstone.windowCenter()"
        (toolChange)="selectTool($event)"
        (presetSelect)="applyPreset($event)"
        (reset)="resetViewport()"
        (filesSelected)="loadLocalFiles($event)" />

      <!-- Main Body: Series Sidebar + Viewport -->
      <div class="flex-1 flex overflow-hidden relative">
        
        <!-- Left Sidebar: Series List Drawer (Collapsible Component) -->
        <app-series-sidebar
          [seriesList]="seriesList()"
          [selectedSeriesUid]="selectedSeriesUid()"
          [isOpen]="isSidebarOpen()"
          (toggleOpen)="isSidebarOpen.set(!isSidebarOpen())"
          (seriesSelect)="loadSeries($event)" />

        <!-- Viewport Canvas Container -->
        <main
          class="flex-1 relative bg-black flex items-center justify-center overflow-hidden"
          (dragover)="onDragOver($event)"
          (drop)="onDrop($event)">
          
          <!-- Cornerstone WebGL2 Mount Element -->
          <div
            #viewportElement
            class="w-full h-full relative cursor-crosshair">
          </div>

          <!-- Clinical HUD Quadrant Overlays Component -->
          @if (cornerstone.isWebGLReady()) {
            <app-radiology-hud
              [patientName]="activePatientName()"
              [patientId]="activePatientId()"
              [institution]="activeInstitution()"
              [studyDescription]="activeStudyDescription()"
              [studyDate]="activeStudyDate()"
              [modality]="activeModality()"
              [zoomLevel]="cornerstone.zoomLevel()"
              [currentSlice]="cornerstone.currentSlice()"
              [totalSlices]="cornerstone.totalSlices()"
              [windowWidth]="cornerstone.windowWidth()"
              [windowCenter]="cornerstone.windowCenter()" />
          }

          <!-- GPU Context Lost Warning Banner -->
          @if (cornerstone.webGLContextLost()) {
            <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 z-20">
              <div class="bg-rose-950/40 border border-rose-600 rounded-xl p-6 max-w-md text-center text-rose-200">
                <div class="w-10 h-10 mx-auto rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                  !
                </div>
                <h3 class="text-sm font-bold text-rose-300">WebGL Context Lost</h3>
                <p class="text-xs text-rose-400/80 mt-1">High GPU memory usage reclaimed context. Restoring pipeline automatically...</p>
              </div>
            </div>
          }

          <!-- Loading Indicator -->
          @if (isLoading()) {
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <div class="flex items-center space-x-3 bg-slate-900/90 border border-slate-700 px-4 py-3 rounded-lg shadow-2xl">
                <div class="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                <span class="text-xs font-mono text-slate-200">Streaming DICOM Slices via Web Workers...</span>
              </div>
            </div>
          }

          <!-- Slice Loading Error Banner -->
          @if (loadError()) {
            <div class="absolute inset-0 bg-black/75 flex items-center justify-center p-6 z-20">
              <div class="bg-rose-950/80 border border-rose-600 rounded-xl p-6 max-w-md text-center text-rose-200">
                <div class="w-10 h-10 mx-auto rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                  !
                </div>
                <h3 class="text-sm font-bold text-rose-300">Slice Loading Notice</h3>
                <p class="text-xs text-rose-300/80 mt-1">{{ loadError() }}</p>
                <button
                  (click)="loadError.set(null)"
                  class="mt-4 px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500 rounded text-xs text-white transition-colors">
                  Dismiss
                </button>
              </div>
            </div>
          }
        </main>
      </div>

      <!-- Bottom Slice Scrub Slider Bar -->
      <div class="bg-dicom-panel border-t border-dicom-border px-4 py-2 flex items-center justify-between gap-4 h-11 flex-shrink-0 z-10">
        <div class="text-[11px] font-mono text-slate-400 flex items-center gap-2">
          <span>Scrub Volume:</span>
          <span class="text-sky-400 font-semibold">{{ cornerstone.currentSlice() }} / {{ cornerstone.totalSlices() }}</span>
        </div>

        <div class="flex-1 max-w-2xl mx-auto flex items-center gap-3">
          <input
            type="range"
            [min]="1"
            [max]="cornerstone.totalSlices()"
            [value]="cornerstone.currentSlice()"
            (input)="onSliceSliderChange($event)"
            class="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400" />
        </div>

        <div class="text-[10px] font-mono text-slate-500">
          Scroll: Mouse Wheel &bull; Drag: W/L &bull; Keys: ↑/↓ Slices
        </div>
      </div>
    </div>
  `
})
export class DicomViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('viewportElement') viewportElement!: ElementRef<HTMLDivElement>;

  readonly cornerstone = inject(CornerstoneService);
  private readonly apiService = inject(DicomApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly viewportId = 'primaryStackViewport';

  readonly isSidebarOpen = signal<boolean>(true);
  readonly isLoading = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);
  readonly presets = COMMON_WL_PRESETS;

  readonly seriesList = signal<SeriesMetadata[]>([]);
  readonly selectedSeriesUid = signal<string>('');

  readonly activePatientName = signal<string>('—');
  readonly activePatientId = signal<string>('—');
  readonly activeStudyDescription = signal<string>('—');
  readonly activeStudyDate = signal<string>('—');
  readonly activeModality = signal<string>('—');
  readonly activeInstitution = signal<string>('DICOM Medical Imaging');

  async ngAfterViewInit(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.loadError.set(null);
      await this.cornerstone.initialize();
      this.cornerstone.setupViewport(this.viewportElement.nativeElement, this.viewportId);

      // Check route query params
      this.route.queryParams.subscribe((params) => {
        const studyUid = params['study'];
        const seriesUid = params['series'];

        if (!studyUid) {
          // If no study selected, return to directory
          this.router.navigate(['/studies']);
          return;
        }

        // Ensure studies are available to populate metadata
        if (this.apiService.studies().length === 0) {
          this.apiService.fetchStudies().subscribe((studies) => {
            const found = studies.find((s) => s.studyInstanceUid === studyUid);
            if (found) {
              this.populateStudyMetadata(found);
            }
          });
        } else {
          const currentStudy = this.apiService.studies().find((s) => s.studyInstanceUid === studyUid);
          if (currentStudy) {
            this.populateStudyMetadata(currentStudy);
          }
        }

        this.loadStudySeries(studyUid, seriesUid);
      });
    } catch (err: any) {
      console.error('Initialization error in viewer:', err);
      this.loadError.set(`WebGL / Engine initialization failed: ${err?.message || 'Unknown'}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  private populateStudyMetadata(study: any): void {
    this.activePatientName.set(study.patientName || 'Anonymous');
    this.activePatientId.set(study.patientId || '—');
    this.activeStudyDescription.set(study.studyDescription || '—');
    this.activeStudyDate.set(study.studyDate || '—');
  }

  private loadStudySeries(studyUid: string, preferredSeriesUid?: string): void {
    this.isLoading.set(true);
    this.apiService.fetchSeries(studyUid).subscribe({
      next: (series) => {
        this.seriesList.set(series);
        if (series.length > 0) {
          const targetSeries = preferredSeriesUid
            ? series.find((s) => s.seriesInstanceUid === preferredSeriesUid) || series[0]
            : series[0];
          this.loadSeries(targetSeries);
        } else {
          this.isLoading.set(false);
          this.loadError.set('No series found for this study.');
        }
      },
      error: (err) => {
        console.error('Failed to fetch series for study:', err);
        this.loadError.set('Failed to fetch series from server.');
        this.isLoading.set(false);
      }
    });
  }

  loadSeries(ser: SeriesMetadata): void {
    this.selectedSeriesUid.set(ser.seriesInstanceUid);
    this.activeModality.set(ser.modality);
    this.isLoading.set(true);
    this.loadError.set(null);

    console.info(`[Viewer] Loading series ${ser.seriesInstanceUid}...`);
    this.apiService.fetchInstances(ser.studyInstanceUid, ser.seriesInstanceUid).subscribe({
      next: async (instances) => {
        console.info(`[Viewer] Received ${instances.length} instance(s) from API:`, instances);
        try {
          // Build imageIds list from S3 Pre-signed streaming URLs
          const imageIds = instances
            .filter((inst) => !!inst.downloadUrl)
            .map((inst) => (inst.downloadUrl!.startsWith('wadouri:') ? inst.downloadUrl! : `wadouri:${inst.downloadUrl}`));

          console.info(`[Viewer] Prepared imageIds:`, imageIds);

          if (imageIds.length > 0) {
            await this.cornerstone.loadStack(this.viewportId, imageIds, 0);
          } else {
            console.warn('[Viewer] No instances found with valid downloadUrl for series:', ser.seriesInstanceUid);
            this.loadError.set('No DICOM slice files found for this series.');
          }
        } catch (err: any) {
          console.error('[Viewer] Failed to load DICOM series stack:', err);
          this.loadError.set(`Failed to render slices: ${err?.message || 'Decode error'}`);
        } finally {
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        console.error('[Viewer] Failed to fetch instances for series:', err);
        this.loadError.set('Failed to fetch slices from server.');
        this.isLoading.set(false);
      }
    });
  }

  selectTool(tool: ActiveTool): void {
    this.cornerstone.setActiveTool(tool);
  }

  applyPreset(preset: WindowLevelPreset): void {
    this.cornerstone.applyPreset(this.viewportId, preset);
  }

  resetViewport(): void {
    this.cornerstone.resetViewport(this.viewportId);
  }

  onSliceSliderChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const sliceIndex = parseInt(input.value, 10) - 1;
    this.cornerstone.scrollToIndex(this.viewportId, sliceIndex);
  }

  loadLocalFiles(files: FileList): void {
    this.isLoading.set(true);
    const imageIds: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageId = this.cornerstone.addLocalFile(file);
      imageIds.push(imageId);
    }

    if (imageIds.length > 0) {
      this.activePatientName.set('Local Uploaded Series');
      this.activeStudyDescription.set(`${files.length} DICOM Slices Loaded`);
      this.cornerstone.loadStack(this.viewportId, imageIds, 0).finally(() => {
        this.isLoading.set(false);
      });
    } else {
      this.isLoading.set(false);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.loadLocalFiles(event.dataTransfer.files);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // Standard radiology workstation hotkeys
    if (event.key === 'ArrowUp') {
      const prev = Math.max(0, this.cornerstone.currentSlice() - 2);
      this.cornerstone.scrollToIndex(this.viewportId, prev);
    } else if (event.key === 'ArrowDown') {
      const next = Math.min(this.cornerstone.totalSlices() - 1, this.cornerstone.currentSlice());
      this.cornerstone.scrollToIndex(this.viewportId, next);
    } else if (event.key === 'w' || event.key === 'W') {
      this.selectTool('WindowLevel');
    } else if (event.key === 'p' || event.key === 'P') {
      this.selectTool('Pan');
    } else if (event.key === 'z' || event.key === 'Z') {
      this.selectTool('Zoom');
    } else if (event.key === 'r' || event.key === 'R') {
      this.resetViewport();
    }
  }

  ngOnDestroy(): void {
    this.cornerstone.destroy();
  }
}
