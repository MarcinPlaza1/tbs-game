import {
  Scene,
  Camera,
  Vector3,
  Ray,
  PointerEventTypes,
  PointerInfo,
  KeyboardEventTypes,
  KeyboardInfo,
} from '@babylonjs/core';

export class InputManager {
  private scene: Scene;
  private camera: Camera;
  
  // Callbacks
  public onTileClick?: (position: { x: number; z: number }) => void;
  public onUnitClick?: (unitId: string) => void;
  public onCameraMove?: (delta: { x: number; y: number }) => void;
  
  // Input state
  private isRightMouseDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  
  // Camera control keys
  private keysPressed = new Set<string>();

  constructor(scene: Scene, camera: Camera) {
    this.scene = scene;
    this.camera = camera;
    
    this.setupPointerObservables();
    this.setupKeyboardObservables();
    this.setupCameraControls();
  }

  private setupPointerObservables(): void {
    this.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          this.handlePointerDown(pointerInfo);
          break;
        case PointerEventTypes.POINTERUP:
          this.handlePointerUp(pointerInfo);
          break;
        case PointerEventTypes.POINTERMOVE:
          this.handlePointerMove(pointerInfo);
          break;
      }
    });
  }

  private setupKeyboardObservables(): void {
    this.scene.onKeyboardObservable.add((kbInfo) => {
      switch (kbInfo.type) {
        case KeyboardEventTypes.KEYDOWN:
          this.keysPressed.add(kbInfo.event.key.toLowerCase());
          break;
        case KeyboardEventTypes.KEYUP:
          this.keysPressed.delete(kbInfo.event.key.toLowerCase());
          break;
      }
    });
  }

  private setupCameraControls(): void {
    this.scene.registerBeforeRender(() => {
      const cameraSpeed = 0.3;
      let deltaX = 0;
      let deltaY = 0;
      
      // WASD or Arrow keys for camera movement
      if (this.keysPressed.has('w') || this.keysPressed.has('arrowup')) {
        deltaY = cameraSpeed;
      }
      if (this.keysPressed.has('s') || this.keysPressed.has('arrowdown')) {
        deltaY = -cameraSpeed;
      }
      if (this.keysPressed.has('a') || this.keysPressed.has('arrowleft')) {
        deltaX = -cameraSpeed;
      }
      if (this.keysPressed.has('d') || this.keysPressed.has('arrowright')) {
        deltaX = cameraSpeed;
      }
      
      if (deltaX !== 0 || deltaY !== 0) {
        this.onCameraMove?.({ x: deltaX, y: deltaY });
      }
    });
  }

  private handlePointerDown(pointerInfo: PointerInfo): void {
    if (pointerInfo.event.button === 0) {
      // Left click - selection
      const pickResult = this.scene.pick(
        this.scene.pointerX,
        this.scene.pointerY
      );
      
      if (pickResult && pickResult.hit && pickResult.pickedMesh) {
        const mesh = pickResult.pickedMesh;
        
        if (mesh.name.startsWith('unit_')) {
          // Unit clicked
          const unitId = mesh.name.replace('unit_', '');
          this.onUnitClick?.(unitId);
        } else if (mesh.name.startsWith('tile_')) {
          // Tile clicked
          const [x, z] = mesh.name
            .replace('tile_', '')
            .split('_')
            .map(Number);
          this.onTileClick?.({ x, z });
        }
      }
    } else if (pointerInfo.event.button === 2) {
      // Right click - camera drag
      this.isRightMouseDown = true;
      this.lastPointerX = this.scene.pointerX;
      this.lastPointerY = this.scene.pointerY;
    }
  }

  private handlePointerUp(pointerInfo: PointerInfo): void {
    if (pointerInfo.event.button === 2) {
      this.isRightMouseDown = false;
    }
  }

  private handlePointerMove(pointerInfo: PointerInfo): void {
    if (this.isRightMouseDown) {
      const deltaX = this.scene.pointerX - this.lastPointerX;
      const deltaY = this.scene.pointerY - this.lastPointerY;
      
      // Invert and scale the movement
      this.onCameraMove?.({ x: -deltaX * 0.01, y: deltaY * 0.01 });
      
      this.lastPointerX = this.scene.pointerX;
      this.lastPointerY = this.scene.pointerY;
    }
  }

  getWorldPositionFromScreen(screenX: number, screenY: number): Vector3 | null {
    const ray = this.scene.createPickingRay(
      screenX,
      screenY,
      null,
      this.camera
    );
    
    const pickResult = this.scene.pickWithRay(ray);
    
    if (pickResult && pickResult.hit && pickResult.pickedPoint) {
      return pickResult.pickedPoint;
    }
    
    return null;
  }

  getTileCoordinatesFromScreen(screenX: number, screenY: number): { x: number; z: number } | null {
    const worldPos = this.getWorldPositionFromScreen(screenX, screenY);
    
    if (worldPos) {
      return {
        x: Math.floor(worldPos.x + 0.5),
        z: Math.floor(worldPos.z + 0.5),
      };
    }
    
    return null;
  }
} 