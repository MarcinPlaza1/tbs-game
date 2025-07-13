import {
  Engine,
  Scene,
  UniversalCamera,
  Vector3,
  HemisphericLight,
  Color3,
  WebGPUEngine,
} from '@babylonjs/core';
import { MapManager } from '../managers/MapManager';
import { UnitManager } from '../managers/UnitManager';
import { InputManager } from '../managers/InputManager';
import { UIManager } from '../managers/UIManager';
import type { GameState } from '../../../../game-server/src/schemas/GameState';

export class GameEngine {
  private engine!: Engine | WebGPUEngine;
  private scene!: Scene;
  private camera!: UniversalCamera;
  private mapManager!: MapManager;
  private unitManager!: UnitManager;
  private inputManager!: InputManager;
  private uiManager!: UIManager;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async initialize(): Promise<void> {
    // Try to use WebGPU, fallback to WebGL
    const webGPUSupported = await WebGPUEngine.IsSupportedAsync;
    
    if (webGPUSupported) {
      this.engine = new WebGPUEngine(this.canvas);
      await (this.engine as WebGPUEngine).initAsync();
    } else {
      this.engine = new Engine(this.canvas, true);
    }

    this.createScene();
    this.setupCamera();
    this.setupLighting();
    
    // Initialize managers
    this.mapManager = new MapManager(this.scene);
    this.unitManager = new UnitManager(this.scene);
    this.inputManager = new InputManager(this.scene, this.camera);
    this.uiManager = new UIManager();

    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });

    // Start render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    // Setup input handling
    this.setupInputHandling();
  }

  private createScene(): void {
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color3(0.1, 0.1, 0.15).toColor4();
  }

  private setupCamera(): void {
    this.camera = new UniversalCamera(
      'camera',
      new Vector3(10, 15, -10),
      this.scene
    );
    
    this.camera.setTarget(new Vector3(10, 0, 10));
    this.camera.attachControl(this.canvas, true);
    
    // Camera limits not available for UniversalCamera
    // Use ArcRotateCamera if limits are needed
  }

  private setupLighting(): void {
    const light1 = new HemisphericLight(
      'light1',
      new Vector3(0, 1, 0),
      this.scene
    );
    light1.intensity = 0.8;

    const light2 = new HemisphericLight(
      'light2',
      new Vector3(0, -1, 0),
      this.scene
    );
    light2.intensity = 0.3;
  }

  private setupInputHandling(): void {
    this.inputManager.onTileClick = (position) => {
      console.log('Tile clicked:', position);
      // Handle tile selection
    };

    this.inputManager.onUnitClick = (unitId) => {
      console.log('Unit clicked:', unitId);
      // Handle unit selection
    };

    this.inputManager.onCameraMove = (delta) => {
      // Update camera position
      const speed = 0.5;
      this.camera.position.x += delta.x * speed;
      this.camera.position.z += delta.y * speed;
    };
  }

  updateGameState(state: GameState): void {
    // Guard against invalid state
    if (!state) {
      console.warn('⚠️ GameEngine: state is undefined/null, skipping update');
      return;
    }

    // Update map if needed
    if (!this.mapManager.isInitialized()) {
      this.mapManager.createMap(state.mapWidth, state.mapHeight);
    }

    // Update units with null check
    if (state.units) {
      this.unitManager.updateUnits(state.units);
    } else {
      console.warn('⚠️ GameEngine: state.units is undefined, skipping units update');
    }

    // Update UI
    this.uiManager.updateGameInfo({
      currentPlayer: state.currentPlayerIndex,
      turnNumber: state.turnNumber,
      phase: state.phase,
    });
  }

  dispose(): void {
    this.scene.dispose();
    this.engine.dispose();
    window.removeEventListener('resize', () => {
      this.engine.resize();
    });
  }
} 