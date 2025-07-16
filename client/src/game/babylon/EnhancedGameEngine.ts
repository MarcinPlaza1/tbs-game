import {
  Engine,
  Scene,
  UniversalCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  Color3,
  WebGPUEngine,
  KeyboardEventTypes,
  EngineOptions,
  ShadowGenerator,
  PBRMaterial,
  CubeTexture,
  Texture,
  DefaultRenderingPipeline,
  SSAORenderingPipeline,
  FxaaPostProcess,
  ToneMappingPostProcess,
  Constants,
  PostProcess,
  SceneLoader,
  Environment,
  HDRCubeTexture,
  ParticleSystem,
  Sound,
  Tools
} from '@babylonjs/core';

import { GameEngine } from './GameEngine';
import { AdvancedMapManager } from '../managers/AdvancedMapManager';
import { AdvancedUnitManager } from '../managers/AdvancedUnitManager';
import { WeatherSystem } from '../systems/WeatherSystem';
import { EnvironmentManager } from '../managers/EnvironmentManager';
import { ParticleManager } from '../managers/ParticleManager';

export class EnhancedGameEngine extends GameEngine {
  private renderPipeline!: DefaultRenderingPipeline;
  private ssaoRenderingPipeline!: SSAORenderingPipeline;
  private environmentManager!: EnvironmentManager;
  private weatherSystem!: WeatherSystem;
  private particleManager!: ParticleManager;
  private timeOfDay: number = 12.0; // 12:00 noon
  private season: 'spring' | 'summer' | 'autumn' | 'winter' = 'summer';
  private hdriTexture!: HDRCubeTexture;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
  }

  async initAdvancedGraphics(): Promise<void> {
    await this.createAdvancedEngine();
    await this.setupAdvancedScene();
    await this.setupPBREnvironment();
    await this.setupAdvancedRenderPipeline();
    await this.initializeAdvancedSystems();
    
    console.log('🎮 Enhanced Game Engine initialized with cutting-edge graphics');
  }

  private async createAdvancedEngine(): Promise<void> {
    try {
      // Try WebGPU first for best performance
      if (await WebGPUEngine.IsSupportedAsync) {
        this.engine = new WebGPUEngine(this.canvas, {
          antialias: true,
          stencil: true,
          powerPreference: "high-performance",
          adaptToDeviceRatio: true
        });
        await (this.engine as WebGPUEngine).initAsync();
        console.log('🚀 WebGPU Engine initialized');
      } else {
        // Fallback to WebGL2 with advanced options
        const engineOptions: EngineOptions = {
          antialias: true,
          stencil: true,
          preserveDrawingBuffer: false,
          premultipliedAlpha: false,
          powerPreference: "high-performance",
          doNotHandleContextLost: true,
          audioEngine: true
        };
        
        this.engine = new Engine(this.canvas, true, engineOptions, true);
        console.log('⚡ Enhanced WebGL2 Engine initialized');
      }

      // Enable advanced features
      this.engine.enableOfflineSupport = false;
      this.engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
      
    } catch (error) {
      console.error('Failed to initialize advanced engine:', error);
      // Fallback to basic engine
      super.init();
    }
  }

  private async setupAdvancedScene(): Promise<void> {
    this.scene = new Scene(this.engine);
    
    // Enhanced scene settings
    this.scene.useRightHandedSystem = false;
    this.scene.shadowsEnabled = true;
    this.scene.particlesEnabled = true;
    this.scene.audioEnabled = true;
    
    // Advanced physics (if needed)
    // await this.scene.enablePhysics(new Vector3(0, -9.81, 0), new CannonJSPlugin());
    
    // Setup performance optimizations
    this.scene.skipPointerMovePicking = true;
    this.scene.autoClear = false;
    this.scene.blockMaterialDirtyMechanism = false;
  }

  private async setupPBREnvironment(): Promise<void> {
    try {
      // Load HDR environment texture
      this.hdriTexture = new HDRCubeTexture(
        "/assets/environment/studio_country_hall_1k.hdr",
        this.scene,
        128,
        false,
        true,
        false,
        true
      );

      // Set environment texture
      this.scene.environmentTexture = this.hdriTexture;
      this.scene.createDefaultSkybox(this.hdriTexture, true, 1000);

      // Configure environment intensity based on time of day
      this.updateEnvironmentIntensity();

      console.log('🌅 HDR Environment loaded successfully');
    } catch (error) {
      console.warn('HDR environment failed to load, using fallback:', error);
      this.setupFallbackEnvironment();
    }
  }

  private setupFallbackEnvironment(): void {
    // Create procedural skybox as fallback
    const skybox = this.scene.createDefaultSkybox(
      this.scene.environmentTexture,
      true,
      1000
    );
    
    if (skybox) {
      skybox.material!.disableLighting = true;
    }
  }

  private async setupAdvancedRenderPipeline(): Promise<void> {
    // Main rendering pipeline with all advanced features
    this.renderPipeline = new DefaultRenderingPipeline(
      "defaultPipeline",
      true, // HDR enabled
      this.scene,
      [this.camera]
    );

    // Configure advanced features
    this.renderPipeline.samples = 4; // MSAA
    
    // Tone mapping for HDR
    this.renderPipeline.toneMappingEnabled = true;
    this.renderPipeline.toneMappingType = ToneMappingPostProcess.ACES;
    
    // Bloom effects
    this.renderPipeline.bloomEnabled = true;
    this.renderPipeline.bloomThreshold = 0.8;
    this.renderPipeline.bloomWeight = 0.3;
    this.renderPipeline.bloomKernel = 64;
    this.renderPipeline.bloomScale = 0.5;

    // Screen Space Reflections (if supported)
    if (this.renderPipeline.screenSpaceReflectionsEnabled !== undefined) {
      this.renderPipeline.screenSpaceReflectionsEnabled = true;
    }

    // Depth of Field
    this.renderPipeline.depthOfFieldEnabled = false; // Enable for cinematic moments
    
    // Motion Blur (for animations)
    if (this.renderPipeline.motionBlurEnabled !== undefined) {
      this.renderPipeline.motionBlurEnabled = false; // Enable during combat
    }

    // FXAA Anti-aliasing
    this.renderPipeline.fxaaEnabled = true;

    // Setup SSAO for better depth perception
    this.setupSSAO();

    console.log('🎨 Advanced rendering pipeline configured');
  }

  private setupSSAO(): void {
    this.ssaoRenderingPipeline = new SSAORenderingPipeline(
      "ssao",
      this.scene,
      0.75 // Ratio
    );

    this.ssaoRenderingPipeline.fallOff = 0.000001;
    this.ssaoRenderingPipeline.area = 0.0075;
    this.ssaoRenderingPipeline.radius = 0.0001;
    this.ssaoRenderingPipeline.totalStrength = 1.0;
    this.ssaoRenderingPipeline.base = 0.5;

    // Attach to camera
    this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(
      "ssao",
      [this.camera]
    );
  }

  private async initializeAdvancedSystems(): Promise<void> {
    // Initialize advanced managers
    this.environmentManager = new EnvironmentManager(this.scene, this.hdriTexture);
    this.weatherSystem = new WeatherSystem(this.scene);
    this.particleManager = new ParticleManager(this.scene);

    // Replace basic managers with advanced versions
    this.mapManager = new AdvancedMapManager(this.scene, this.environmentManager);
    this.unitManager = new AdvancedUnitManager(this.scene, this.particleManager);

    // Setup advanced lighting
    await this.setupAdvancedLighting();

    // Initialize time/weather systems
    this.weatherSystem.setSeason(this.season);
    this.startTimeOfDaySystem();

    console.log('🌟 Advanced systems initialized');
  }

  private async setupAdvancedLighting(): Promise<void> {
    // Remove basic lights if they exist
    this.scene.lights.forEach(light => light.dispose());

    // Main directional light (sun)
    const sunLight = new DirectionalLight(
      "sunLight",
      this.calculateSunDirection(),
      this.scene
    );
    
    sunLight.intensity = this.calculateSunIntensity();
    sunLight.diffuse = this.calculateSunColor();
    sunLight.specular = sunLight.diffuse.clone();

    // Enhanced shadow mapping
    this.shadowGenerator = new ShadowGenerator(2048, sunLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
    this.shadowGenerator.bias = 0.00001;

    // Ambient lighting
    const ambientLight = new HemisphericLight(
      "ambientLight",
      new Vector3(0, 1, 0),
      this.scene
    );
    
    ambientLight.intensity = 0.2;
    ambientLight.diffuse = new Color3(0.7, 0.8, 1.0);
    ambientLight.groundColor = new Color3(0.3, 0.3, 0.2);

    console.log('☀️ Advanced lighting system configured');
  }

  // Time of Day System
  private startTimeOfDaySystem(): void {
    this.scene.registerBeforeRender(() => {
      this.updateTimeOfDay();
    });
  }

  private updateTimeOfDay(): void {
    // Increment time (1 real second = 1 minute in game)
    this.timeOfDay += this.engine.getDeltaTime() / 60000;
    if (this.timeOfDay >= 24) this.timeOfDay = 0;

    // Update sun position and lighting
    this.updateSunPosition();
    this.updateEnvironmentIntensity();
  }

  private calculateSunDirection(): Vector3 {
    const angle = (this.timeOfDay / 24) * Math.PI * 2 - Math.PI / 2;
    return new Vector3(
      Math.cos(angle),
      Math.sin(angle),
      0.3
    ).normalize();
  }

  private calculateSunIntensity(): number {
    const dayProgress = Math.sin((this.timeOfDay / 24) * Math.PI * 2);
    return Math.max(0.1, dayProgress * 1.2);
  }

  private calculateSunColor(): Color3 {
    const dayProgress = (this.timeOfDay - 6) / 12; // 0 at 6am, 1 at 6pm
    
    if (dayProgress < 0 || dayProgress > 1) {
      // Night time - blue tint
      return new Color3(0.2, 0.3, 0.8);
    } else if (dayProgress < 0.1 || dayProgress > 0.9) {
      // Dawn/Dusk - orange/red tint
      return new Color3(1.0, 0.6, 0.3);
    } else {
      // Day time - white/yellow
      return new Color3(1.0, 0.95, 0.8);
    }
  }

  private updateSunPosition(): void {
    if (this.scene.lights.length > 0) {
      const sunLight = this.scene.lights[0] as DirectionalLight;
      sunLight.direction = this.calculateSunDirection();
      sunLight.intensity = this.calculateSunIntensity();
      sunLight.diffuse = this.calculateSunColor();
    }
  }

  private updateEnvironmentIntensity(): void {
    if (this.scene.environmentTexture) {
      const intensity = this.calculateSunIntensity() * 0.5 + 0.2;
      this.scene.environmentIntensity = intensity;
    }
  }

  // Enhanced Material Creation
  createPBRMaterial(name: string, options: {
    baseColor?: Color3;
    metallicFactor?: number;
    roughnessFactor?: number;
    normalTexture?: string;
    emissiveColor?: Color3;
    emissiveIntensity?: number;
  } = {}): PBRMaterial {
    const material = new PBRMaterial(name, this.scene);
    
    // Configure PBR properties
    material.baseColor = options.baseColor || new Color3(0.8, 0.8, 0.8);
    material.metallicFactor = options.metallicFactor || 0.0;
    material.roughnessFactor = options.roughnessFactor || 0.8;
    
    // Environment reflections
    material.environmentIntensity = 1.0;
    material.useRadianceOverAlpha = false;
    
    // Emissive properties
    if (options.emissiveColor) {
      material.emissiveColor = options.emissiveColor;
      material.emissiveIntensity = options.emissiveIntensity || 1.0;
    }
    
    // Normal mapping
    if (options.normalTexture) {
      material.bumpTexture = new Texture(options.normalTexture, this.scene);
      material.invertNormalMapX = false;
      material.invertNormalMapY = false;
    }
    
    // Enable image processing for tone mapping
    material.imageProcessingConfiguration = this.scene.imageProcessingConfiguration;
    
    return material;
  }

  // Public methods for controlling advanced features
  public setTimeOfDay(hour: number): void {
    this.timeOfDay = Math.max(0, Math.min(24, hour));
    this.updateSunPosition();
  }

  public setSeason(season: 'spring' | 'summer' | 'autumn' | 'winter'): void {
    this.season = season;
    this.weatherSystem?.setSeason(season);
    this.environmentManager?.updateSeasonalEnvironment(season);
  }

  public enableCinematicMode(): void {
    if (this.renderPipeline) {
      this.renderPipeline.depthOfFieldEnabled = true;
      this.renderPipeline.depthOfFieldBlurLevel = 0.5;
    }
  }

  public disableCinematicMode(): void {
    if (this.renderPipeline) {
      this.renderPipeline.depthOfFieldEnabled = false;
    }
  }

  public enableMotionBlur(): void {
    if (this.renderPipeline && this.renderPipeline.motionBlurEnabled !== undefined) {
      this.renderPipeline.motionBlurEnabled = true;
    }
  }

  public disableMotionBlur(): void {
    if (this.renderPipeline && this.renderPipeline.motionBlurEnabled !== undefined) {
      this.renderPipeline.motionBlurEnabled = false;
    }
  }

  // Performance scaling
  public setQualityLevel(level: 'low' | 'medium' | 'high' | 'ultra'): void {
    switch (level) {
      case 'low':
        this.renderPipeline.samples = 1;
        this.shadowGenerator.mapSize = 512;
        this.renderPipeline.bloomEnabled = false;
        this.scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline("ssao", [this.camera]);
        break;
      
      case 'medium':
        this.renderPipeline.samples = 2;
        this.shadowGenerator.mapSize = 1024;
        this.renderPipeline.bloomEnabled = true;
        this.renderPipeline.bloomWeight = 0.2;
        break;
      
      case 'high':
        this.renderPipeline.samples = 4;
        this.shadowGenerator.mapSize = 2048;
        this.renderPipeline.bloomEnabled = true;
        this.renderPipeline.bloomWeight = 0.3;
        this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", [this.camera]);
        break;
      
      case 'ultra':
        this.renderPipeline.samples = 8;
        this.shadowGenerator.mapSize = 4096;
        this.renderPipeline.bloomEnabled = true;
        this.renderPipeline.bloomWeight = 0.4;
        if (this.renderPipeline.screenSpaceReflectionsEnabled !== undefined) {
          this.renderPipeline.screenSpaceReflectionsEnabled = true;
        }
        break;
    }
    
    console.log(`🎛️ Quality level set to: ${level}`);
  }

  // Cleanup
  public dispose(): void {
    this.weatherSystem?.dispose();
    this.environmentManager?.dispose();
    this.particleManager?.dispose();
    this.renderPipeline?.dispose();
    this.ssaoRenderingPipeline?.dispose();
    this.hdriTexture?.dispose();
    
    super.dispose();
  }
}