import { Injectable, signal } from '@angular/core';
import {
  init as csRenderInit,
  RenderingEngine,
  Enums as csCoreEnums,
  Types,
  eventTarget
} from '@cornerstonejs/core';
import {
  init as csToolsInit,
  addTool,
  ToolGroupManager,
  WindowLevelTool,
  PanTool,
  ZoomTool,
  LengthTool,
  StackScrollTool,
  Enums as csToolsEnums
} from '@cornerstonejs/tools';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import { ActiveTool, WindowLevelPreset } from '../models/dicom.models';

@Injectable({
  providedIn: 'root'
})
export class CornerstoneService {
  private isInitialized = false;
  private renderingEngine: RenderingEngine | null = null;
  private readonly renderingEngineId = 'MedicalRenderingEngine';
  private readonly toolGroupId = 'MedicalToolGroup';

  private readonly toolMap = new Map<ActiveTool, string>([
    ['WindowLevel', WindowLevelTool.toolName],
    ['Pan', PanTool.toolName],
    ['Zoom', ZoomTool.toolName],
    ['Length', LengthTool.toolName]
  ]);

  // Signals for state
  readonly activeTool = signal<ActiveTool>('WindowLevel');
  readonly currentSlice = signal<number>(1);
  readonly totalSlices = signal<number>(1);
  readonly windowWidth = signal<number>(400);
  readonly windowCenter = signal<number>(40);
  readonly zoomLevel = signal<number>(1.0);
  readonly isWebGLReady = signal<boolean>(false);
  readonly webGLContextLost = signal<boolean>(false);

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 1. Initialize Cornerstone3D Core
      await csRenderInit();

      // 2. Initialize Cornerstone3D Tools
      await csToolsInit();

      // 3. Configure DICOM Image Loader with codecs base path & stable metadata provider
      cornerstoneDICOMImageLoader.init({
        maxWebWorkers: navigator.hardwareConcurrency || 4,
        useLegacyMetadataProvider: true,
        wasmBasePath: '/cornerstone-codecs',
        decodeConfig: {
          wasmBasePath: '/cornerstone-codecs'
        },
        errorInterceptor: (err) => {
          console.error('[Cornerstone errorInterceptor]:', err);
        }
      });

      // 4. Register Tools
      addTool(WindowLevelTool);
      addTool(PanTool);
      addTool(ZoomTool);
      addTool(LengthTool);
      addTool(StackScrollTool);

      // 5. Create or retrieve Tool Group
      let toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
      if (!toolGroup) {
        toolGroup = ToolGroupManager.createToolGroup(this.toolGroupId);
      }

      if (toolGroup) {
        toolGroup.addTool(WindowLevelTool.toolName);
        toolGroup.addTool(PanTool.toolName);
        toolGroup.addTool(ZoomTool.toolName);
        toolGroup.addTool(LengthTool.toolName);
        toolGroup.addTool(StackScrollTool.toolName);

        // Set default primary tool bindings
        this.setActiveTool('WindowLevel');
      }

      this.isInitialized = true;
      this.isWebGLReady.set(true);
      console.log('Cornerstone3D and WebGL2 initialized successfully');
    } catch (err) {
      console.error('Failed to initialize Cornerstone3D:', err);
      throw err;
    }
  }

  setupViewport(element: HTMLDivElement, viewportId: string): void {
    if (!this.renderingEngine) {
      this.renderingEngine = new RenderingEngine(this.renderingEngineId);
    }

    const viewportInput: Types.PublicViewportInput = {
      viewportId,
      type: csCoreEnums.ViewportType.STACK,
      element,
      defaultOptions: {
        background: [0.04, 0.05, 0.08] as Types.Point3 // #0a0d14 in RGB [0..1]
      }
    };

    this.renderingEngine.enableElement(viewportInput);

    // Bind viewport to ToolGroup
    const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
    if (toolGroup) {
      toolGroup.addViewport(viewportId, this.renderingEngineId);
    }

    // Attach WebGL Context Loss event handlers
    const canvas = element.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        console.warn('WebGL Context Lost! High GPU memory pressure.');
        this.webGLContextLost.set(true);
      });
      canvas.addEventListener('webglcontextrestored', () => {
        console.info('WebGL Context Restored.');
        this.webGLContextLost.set(false);
      });
    }

    // Listen for image rendered to update VOI and zoom state
    element.addEventListener(csCoreEnums.Events.IMAGE_RENDERED, () => {
      const viewport = this.getStackViewport(viewportId);
      if (viewport) {
        const voi = viewport.getProperties()?.voiRange;
        if (voi) {
          const ww = Math.round(voi.upper - voi.lower);
          const wc = Math.round((voi.upper + voi.lower) / 2);
          this.windowWidth.set(ww);
          this.windowCenter.set(wc);
        }
        const camera = viewport.getCamera();
        if (camera && camera.parallelScale) {
          // Camera zoom approximation
          this.zoomLevel.set(Number((100 / camera.parallelScale).toFixed(2)));
        }
      }
    });

    // Listen for stack scroll event
    element.addEventListener(csCoreEnums.Events.STACK_NEW_IMAGE, () => {
      const viewport = this.getStackViewport(viewportId);
      if (viewport) {
        this.currentSlice.set(viewport.getCurrentImageIdIndex() + 1);
      }
    });

    // Listen for image load error/failure events for deep diagnostics
    eventTarget.addEventListener(csCoreEnums.Events.IMAGE_LOAD_ERROR, (e: any) => {
      console.error('[Cornerstone] IMAGE_LOAD_ERROR:', e.detail || e);
    });
    eventTarget.addEventListener(csCoreEnums.Events.IMAGE_LOAD_FAILED, (e: any) => {
      console.error('[Cornerstone] IMAGE_LOAD_FAILED:', e.detail || e);
    });
    eventTarget.addEventListener(csCoreEnums.Events.IMAGE_LOADED, (e: any) => {
      console.info('[Cornerstone] IMAGE_LOADED successfully:', e.detail?.image?.imageId);
    });
  }

  async loadStack(viewportId: string, imageIds: string[], initialIndex: number = 0): Promise<void> {
    const viewport = this.getStackViewport(viewportId);
    if (!viewport) return;

    this.totalSlices.set(imageIds.length);
    this.currentSlice.set(initialIndex + 1);

    await viewport.setStack(imageIds, initialIndex);
    viewport.render();
  }

  addLocalFile(file: File): string {
    return cornerstoneDICOMImageLoader.wadouri.fileManager.add(file);
  }

  setActiveTool(tool: ActiveTool): void {
    const toolGroup = ToolGroupManager.getToolGroup(this.toolGroupId);
    if (!toolGroup) return;

    this.activeTool.set(tool);

    // Deactivate previous primary tools
    for (const toolName of this.toolMap.values()) {
      toolGroup.setToolPassive(toolName);
    }

    // Map selected tool to Primary Mouse Button (Left Click)
    const selectedToolName = this.toolMap.get(tool) ?? WindowLevelTool.toolName;

    toolGroup.setToolActive(selectedToolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }]
    });

    // Middle Mouse is always Pan
    toolGroup.setToolActive(PanTool.toolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Auxiliary }]
    });

    // Right Mouse is always Zoom
    toolGroup.setToolActive(ZoomTool.toolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }]
    });

    // Mouse wheel is always Slice Scroll
    toolGroup.setToolActive(StackScrollTool.toolName, {
      bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }]
    });
  }

  applyPreset(viewportId: string, preset: WindowLevelPreset): void {
    const viewport = this.getStackViewport(viewportId);
    if (!viewport) return;

    const lower = preset.level - preset.window / 2;
    const upper = preset.level + preset.window / 2;

    viewport.setProperties({
      voiRange: { lower, upper }
    });
    viewport.render();

    this.windowWidth.set(preset.window);
    this.windowCenter.set(preset.level);
  }

  resetViewport(viewportId: string): void {
    const viewport = this.getStackViewport(viewportId);
    if (!viewport) return;

    viewport.resetCamera();
    try {
      viewport.resetProperties();
    } catch {
      // Safe no-op if csImage is not yet loaded into the viewport
    }
    viewport.render();
  }

  scrollToIndex(viewportId: string, sliceIndex: number): void {
    const viewport = this.getStackViewport(viewportId);
    if (!viewport) return;
    viewport.setImageIdIndex(sliceIndex);
    this.currentSlice.set(sliceIndex + 1);
  }

  private getStackViewport(viewportId: string): any {
    if (!this.renderingEngine) return null;
    return this.renderingEngine.getViewport(viewportId);
  }

  destroy(): void {
    if (this.renderingEngine) {
      this.renderingEngine.destroy();
      this.renderingEngine = null;
    }
    ToolGroupManager.destroyToolGroup(this.toolGroupId);
    this.isInitialized = false;
  }
}

