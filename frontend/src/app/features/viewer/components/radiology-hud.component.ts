import { Component, input } from '@angular/core';

@Component({
  selector: 'app-radiology-hud',
  standalone: true,
  template: `
    <!-- Top-Left Overlay: Patient Info -->
    <div class="absolute top-3 left-4 pointer-events-none text-[11px] font-mono text-sky-400/90 leading-tight drop-shadow-md">
      <div class="font-bold text-sky-300">{{ patientName() }}</div>
      <div class="text-slate-400">ID: {{ patientId() }}</div>
    </div>

    <!-- Top-Right Overlay: Institution & Study Info -->
    <div class="absolute top-3 right-4 pointer-events-none text-[11px] font-mono text-right text-sky-400/90 leading-tight drop-shadow-md">
      <div class="font-bold text-sky-300">{{ institution() }}</div>
      <div class="text-slate-400">{{ studyDescription() }}</div>
      <div class="text-slate-400">{{ studyDate() }}</div>
    </div>

    <!-- Bottom-Left Overlay: Technical Parameters & Slice Position -->
    <div class="absolute bottom-12 left-4 pointer-events-none text-[11px] font-mono text-sky-400/90 leading-tight drop-shadow-md">
      <div>Modality: {{ modality() }}</div>
      <div>Zoom: {{ (zoomLevel() * 100).toFixed(0) }}%</div>
      <div class="font-bold text-sky-300">
        Slice: {{ currentSlice() }} / {{ totalSlices() }}
      </div>
    </div>

    <!-- Bottom-Right Overlay: VOI Window / Level -->
    <div class="absolute bottom-12 right-4 pointer-events-none text-[11px] font-mono text-right text-sky-400/90 leading-tight drop-shadow-md">
      <div class="font-bold text-sky-300">
        W: {{ windowWidth() }} C: {{ windowCenter() }}
      </div>
      <div class="text-slate-400">Rendering: WebGL2 Canvas</div>
      <div class="text-emerald-400 text-[10px]">GPU Accel: Active</div>
    </div>
  `
})
export class RadiologyHudComponent {
  readonly patientName = input<string>('—');
  readonly patientId = input<string>('—');
  readonly institution = input<string>('DICOM Medical Imaging');
  readonly studyDescription = input<string>('—');
  readonly studyDate = input<string>('—');
  readonly modality = input<string>('—');
  readonly zoomLevel = input<number>(1.0);
  readonly currentSlice = input<number>(1);
  readonly totalSlices = input<number>(1);
  readonly windowWidth = input<number>(400);
  readonly windowCenter = input<number>(40);
}

