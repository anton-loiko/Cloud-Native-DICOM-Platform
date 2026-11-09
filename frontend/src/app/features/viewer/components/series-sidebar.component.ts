import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SeriesMetadata } from '../../../core/models/dicom.models';

@Component({
  selector: 'app-series-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside
      [class]="isOpen() ? 'w-64' : 'w-10'"
      class="bg-dicom-panel border-r border-dicom-border flex flex-col transition-all duration-200 z-10 flex-shrink-0">
      
      <!-- Drawer Header / Toggle Button -->
      <div class="p-2 border-b border-dicom-border flex items-center justify-between">
        @if (isOpen()) {
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Series Navigator</span>
        }
        <button
          (click)="toggleOpen.emit()"
          class="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mx-auto"
          [title]="isOpen() ? 'Collapse Series Panel' : 'Expand Series Panel'">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="isOpen() ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'"/>
          </svg>
        </button>
      </div>

      <!-- Series List -->
      @if (isOpen()) {
        <div class="flex-1 overflow-y-auto p-2 space-y-2">
          @for (ser of seriesList(); track ser.seriesInstanceUid) {
            <div
              (click)="seriesSelect.emit(ser)"
              [class]="selectedSeriesUid() === ser.seriesInstanceUid ? 'border-sky-500 bg-sky-500/10' : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'"
              class="border rounded-lg p-2.5 cursor-pointer transition-all">
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="font-mono text-sky-400 font-semibold">Series #{{ ser.seriesNumber }}</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 font-mono text-slate-300">{{ ser.modality }}</span>
              </div>
              <div class="text-[11px] text-slate-200 font-medium truncate">{{ ser.seriesDescription }}</div>
              <div class="text-[10px] text-slate-500 mt-1 font-mono">{{ ser.numberOfInstances }} slices</div>
            </div>
          } @empty {
            <div class="text-center py-6 text-slate-500 text-xs">
              No series available.
            </div>
          }
        </div>
      }
    </aside>
  `
})
export class SeriesSidebarComponent {
  readonly seriesList = input.required<SeriesMetadata[]>();
  readonly selectedSeriesUid = input<string>('');
  readonly isOpen = input<boolean>(true);

  readonly toggleOpen = output<void>();
  readonly seriesSelect = output<SeriesMetadata>();
}

