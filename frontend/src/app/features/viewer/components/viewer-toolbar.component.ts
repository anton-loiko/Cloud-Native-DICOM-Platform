import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActiveTool, WindowLevelPreset } from '../../../core/models/dicom.models';

@Component({
  selector: 'app-viewer-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-dicom-panel border-b border-dicom-border px-4 py-2 flex items-center justify-between gap-4 h-12 flex-shrink-0 z-10">
      
      <!-- Primary Tool Selectors -->
      <div class="flex items-center space-x-1">
        <!-- Window/Level -->
        <button
          (click)="toolChange.emit('WindowLevel')"
          [class]="activeTool() === 'WindowLevel' ? 'bg-sky-500 text-slate-950 font-bold shadow-sm' : 'text-slate-300 hover:bg-slate-800'"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
          title="Adjust Window / Level (Contrast)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span class="hidden sm:inline">W/L</span>
        </button>

        <!-- Pan -->
        <button
          (click)="toolChange.emit('Pan')"
          [class]="activeTool() === 'Pan' ? 'bg-sky-500 text-slate-950 font-bold shadow-sm' : 'text-slate-300 hover:bg-slate-800'"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
          title="Pan Viewport (Middle Click or Drag)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
          </svg>
          <span class="hidden sm:inline">Pan</span>
        </button>

        <!-- Zoom -->
        <button
          (click)="toolChange.emit('Zoom')"
          [class]="activeTool() === 'Zoom' ? 'bg-sky-500 text-slate-950 font-bold shadow-sm' : 'text-slate-300 hover:bg-slate-800'"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
          title="Zoom Viewport (Right Click Drag or Select)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
          <span class="hidden sm:inline">Zoom</span>
        </button>

        <!-- Calibrated Length Measurement -->
        <button
          (click)="toolChange.emit('Length')"
          [class]="activeTool() === 'Length' ? 'bg-sky-500 text-slate-950 font-bold shadow-sm' : 'text-slate-300 hover:bg-slate-800'"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
          title="Calibrated Measurement (mm)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span class="hidden sm:inline">Length</span>
        </button>

        <div class="h-5 w-px bg-slate-700 mx-1"></div>

        <!-- Reset Button -->
        <button
          (click)="reset.emit()"
          class="text-slate-400 hover:text-white hover:bg-slate-800 px-2.5 py-1.5 rounded text-xs transition-all"
          title="Reset Camera & Window/Level">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <!-- Window/Level HU Presets -->
      <div class="flex items-center space-x-2">
        <label class="text-[11px] font-mono text-slate-400 hidden md:inline">Preset:</label>
        <div class="flex items-center gap-1">
          @for (preset of presets(); track preset.name) {
            <button
              (click)="presetSelect.emit(preset)"
              [class]="windowWidth() === preset.window && windowCenter() === preset.level ? 'bg-slate-700 text-sky-400 border-sky-400 font-bold' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'"
              class="px-2 py-1 text-[11px] font-mono rounded border transition-all">
              {{ preset.name }}
            </button>
          }
        </div>
      </div>

      <!-- Quick Actions (Local file import) -->
      <div class="flex items-center space-x-2">
        <label class="cursor-pointer text-xs text-sky-400 hover:text-sky-300 bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded border border-slate-700 flex items-center gap-1 transition-all">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
          </svg>
          <span>Open .dcm</span>
          <input type="file" multiple accept=".dcm" (change)="onFileInput($event)" class="hidden" />
        </label>
      </div>
    </div>
  `
})
export class ViewerToolbarComponent {
  readonly activeTool = input.required<ActiveTool>();
  readonly presets = input.required<WindowLevelPreset[]>();
  readonly windowWidth = input.required<number>();
  readonly windowCenter = input.required<number>();

  readonly toolChange = output<ActiveTool>();
  readonly presetSelect = output<WindowLevelPreset>();
  readonly reset = output<void>();
  readonly filesSelected = output<FileList>();

  onFileInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    if (inputEl.files && inputEl.files.length > 0) {
      this.filesSelected.emit(inputEl.files);
    }
  }
}

