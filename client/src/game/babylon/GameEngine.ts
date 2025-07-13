import {
  Engine,
  Scene,
  UniversalCamera,
  Vector3,
  HemisphericLight,
  Color3,
  WebGPUEngine,
  KeyboardEventTypes,
} from '@babylonjs/core';
import { MapManager } from '../managers/MapManager';
import { UnitManager } from '../managers/UnitManager';
import { InputManager } from '../managers/InputManager';
import { UIManager } from '../managers/UIManager';
import type { GameState } from '../../../../game-server/src/schemas/GameState';
import type { Room } from 'colyseus.js';
import { ClientMessageType, UnitAction } from '@tbs/shared';

export class GameEngine {
  private engine!: Engine | WebGPUEngine;
  private scene!: Scene;
  private camera!: UniversalCamera;
  private mapManager!: MapManager;
  private unitManager!: UnitManager;
  private inputManager!: InputManager;
  private uiManager!: UIManager;
  private canvas: HTMLCanvasElement;
  private room: Room | null = null;
  private selectedUnitId: string | null = null;
  private currentPlayerId: string | null = null;
  private lastGameState: GameState | null = null;
  private currentTurn: number = 0;
  private currentPlayerIndex: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  setRoom(room: Room): void {
    this.room = room;
  }

  setCurrentPlayerId(playerId: string): void {
    this.currentPlayerId = playerId;
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
    
    // Set up UI action callback
    this.uiManager.setActionCallback((unitId: string, action: string) => {
      this.handleUnitAction(unitId, action);
    });

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
      this.handleTileClick(position);
    };

    this.inputManager.onUnitClick = (unitId) => {
      console.log('Unit clicked:', unitId);
      this.handleUnitClick(unitId);
    };

    this.inputManager.onCameraMove = (delta) => {
      // Update camera position
      const speed = 0.5;
      this.camera.position.x += delta.x * speed;
      this.camera.position.z += delta.y * speed;
    };

    // Add ESC key handler for clearing selection
    this.scene.onKeyboardObservable.add((kbInfo) => {
      if (kbInfo.type === KeyboardEventTypes.KEYDOWN && kbInfo.event.key === 'Escape') {
        this.clearSelection();
      }
    });
  }

  private handleTileClick(position: { x: number; z: number }): void {
    if (!this.isPlayerTurn()) return;

    if (this.selectedUnitId) {
      // Try to move selected unit to clicked tile
      this.moveUnit(this.selectedUnitId, position);
    } else {
      // Clear highlights when clicking empty tile
      this.clearSelection();
    }
  }

  private handleUnitClick(unitId: string): void {
    if (!this.isPlayerTurn()) return;

    // Select the clicked unit
    this.selectUnit(unitId);
  }

  private isPlayerTurn(): boolean {
    if (!this.room || !this.currentPlayerId) return false;
    
    // Check if it's actually this player's turn
    return this.isMyTurn();
  }

  public selectUnit(unitId: string): void {
    console.log('🎯 Selecting unit:', unitId);
    
    // Clear previous selection
    this.clearSelection();
    
    // Select unit in UnitManager
    this.unitManager.selectUnit(unitId);
    this.selectedUnitId = unitId;
    
    // Highlight possible moves (basic implementation)
    this.highlightPossibleMoves(unitId);
    
    // Show unit actions in UI based on unit state
    const availableActions = this.getAvailableActions(unitId);
    this.uiManager.showUnitActions(unitId, availableActions);
    
    // Send selection to server
    const selectAction: UnitAction = {
      unitId: unitId,
      type: 'ability',
      abilityId: 'select'
    };
    
    this.sendUnitAction(selectAction);
  }

  public moveUnit(unitId: string, targetPosition: { x: number; z: number }): void {
    console.log('🚀 Moving unit:', unitId, 'to:', targetPosition);
    
    // Validate move (basic check)
    if (!this.isValidMove(unitId, targetPosition)) {
      console.log('❌ Invalid move');
      this.uiManager.showMessage('Invalid move!', 2000);
      return;
    }
    
    // Send move command to server using proper format
    const moveAction: UnitAction = {
      unitId: unitId,
      type: 'move',
      targetPosition: {
        x: targetPosition.x,
        y: 0, // Ground level
        z: targetPosition.z
      }
    };
    
    this.sendUnitAction(moveAction);
    
    // Clear selection after move
    this.clearSelection();
  }

  private isValidMove(unitId: string, targetPosition: { x: number; z: number }): boolean {
    // Basic validation - check if tile exists and is not occupied
    const tile = this.mapManager.getTileAt(targetPosition.x, targetPosition.z);
    if (!tile) return false;
    
    const unitAtTarget = this.unitManager.getUnitAt(targetPosition.x, targetPosition.z);
    if (unitAtTarget) return false;
    
    // Check unit movement range
    const unit = this.unitManager.getUnitById(unitId);
    if (!unit) return false;
    
    const unitPos = unit.mesh.position;
    const distance = Math.abs(unitPos.x - targetPosition.x) + Math.abs(unitPos.z - targetPosition.z);
    const maxRange = 2; // Basic movement range
    
    return distance <= maxRange;
  }

  private highlightPossibleMoves(unitId: string): void {
    // Clear previous highlights
    this.mapManager.clearHighlights();
    
    // Get unit info
    const unit = this.unitManager.getUnitById(unitId);
    if (!unit) return;
    
    // Highlight tiles in movement range (simplified - 3x3 area)
    const unitPos = unit.mesh.position;
    const range = 2; // movement range
    
    for (let x = Math.max(0, unitPos.x - range); x <= unitPos.x + range; x++) {
      for (let z = Math.max(0, unitPos.z - range); z <= unitPos.z + range; z++) {
        if (x === unitPos.x && z === unitPos.z) continue; // Skip current position
        
        if (this.isValidMove(unitId, { x, z })) {
          this.mapManager.highlightTile(x, z, new Color3(0, 1, 0)); // Green for valid moves
        }
      }
    }
  }

  private clearSelection(): void {
    if (this.selectedUnitId) {
      console.log('🔄 Clearing selection');
      this.selectedUnitId = null;
      this.mapManager.clearHighlights();
      this.uiManager.hideUnitActions();
    }
  }

  private getAvailableActions(unitId: string): string[] {
    const unit = this.unitManager.getUnitById(unitId);
    if (!unit) return [];
    
    const actions: string[] = [];
    
    // Basic actions that are always available
    if (!unit.schema.hasMoved) {
      actions.push('Move');
    }
    
    if (!unit.schema.hasAttacked) {
      actions.push('Attack');
    }
    
    actions.push('Skip');
    
    return actions;
  }

  public getSelectedUnitId(): string | null {
    return this.selectedUnitId;
  }

  private handleUnitAction(unitId: string, action: string): void {
    console.log(`🎮 Handling unit action: ${action} for unit ${unitId}`);
    
    if (!this.room || !this.currentPlayerId) {
      console.warn('⚠️ Cannot perform action: no room or player ID');
      return;
    }

    const unit = this.unitManager.getUnitById(unitId);
    if (!unit) {
      console.warn(`⚠️ Unit ${unitId} not found`);
      return;
    }

    let unitAction: UnitAction;
    
    switch (action.toLowerCase()) {
      case 'move':
        // For move, we need to wait for tile selection
        // This is handled by the existing tile click system
        this.uiManager.showMessage('Click on a tile to move', 3000);
        break;
        
      case 'attack':
        // For attack, we need to wait for target selection
        this.uiManager.showMessage('Click on a target to attack', 3000);
        // Could implement attack targeting here
        break;
        
      case 'skip':
        // Skip turn for this unit
        unitAction = {
          unitId: unitId,
          type: 'ability',
          abilityId: 'skip'
        };
        this.sendUnitAction(unitAction);
        break;
        
      default:
        console.warn(`⚠️ Unknown action: ${action}`);
        return;
    }
    
    // Clear selection for actions that don't require further input
    if (action.toLowerCase() === 'skip') {
      this.clearSelection();
    }
  }

  private sendUnitAction(action: UnitAction): void {
    if (!this.room) {
      console.warn('⚠️ Cannot send action: no room connection');
      return;
    }

    console.log('📤 Sending unit action to server:', action);
    
    this.room.send(ClientMessageType.UNIT_ACTION, {
      action: action,
      playerId: this.currentPlayerId
    });
  }

  updateGameState(state: GameState): void {
    // Guard against invalid state
    if (!state) {
      console.warn('⚠️ GameEngine: state is undefined/null, skipping update');
      return;
    }

    console.log('🔄 Updating game state:', {
      turn: state.turnNumber,
      currentPlayer: state.currentPlayerIndex,
      phase: state.phase,
      unitsCount: state.units ? state.units.size : 0
    });

    // Update map if needed
    if (!this.mapManager.isInitialized()) {
      this.mapManager.createMap(state.mapWidth, state.mapHeight);
    }

    // Check for turn changes
    if (this.lastGameState && 
        (this.lastGameState.turnNumber !== state.turnNumber || 
         this.lastGameState.currentPlayerIndex !== state.currentPlayerIndex)) {
      this.handleTurnChange(state);
    }

    // Update current turn and player info
    this.currentTurn = state.turnNumber;
    this.currentPlayerIndex = state.currentPlayerIndex;

    // Update units with null check
    if (state.units) {
      this.updateUnits(state.units);
    } else {
      console.warn('⚠️ GameEngine: state.units is undefined, skipping units update');
    }

    // Update UI
    this.uiManager.updateGameInfo({
      currentPlayer: state.currentPlayerIndex,
      turnNumber: state.turnNumber,
      phase: state.phase,
    });

    // Store current state for comparison
    this.lastGameState = state;
  }

  private handleTurnChange(newState: GameState): void {
    console.log('🔄 Turn changed:', {
      oldTurn: this.lastGameState?.turnNumber,
      newTurn: newState.turnNumber,
      oldPlayer: this.lastGameState?.currentPlayerIndex,
      newPlayer: newState.currentPlayerIndex
    });

    // Clear selection when turn changes
    this.clearSelection();

    // Show turn indicator if it's a new turn
    if (this.lastGameState && this.lastGameState.turnNumber !== newState.turnNumber) {
      this.uiManager.showMessage(`Turn ${newState.turnNumber}`, 3000);
    }

    // Show current player indicator
    const isMyTurn = newState.currentPlayerIndex.toString() === this.currentPlayerId;
    if (isMyTurn) {
      this.uiManager.showMessage('Your turn!', 2000);
    } else {
      this.uiManager.showMessage(`Player ${newState.currentPlayerIndex}'s turn`, 2000);
    }
  }

  private updateUnits(unitsMap: Map<string, any>): void {
    // Get current unit IDs
    const currentUnitIds = new Set(Array.from(unitsMap.keys()));
    
    // Get existing unit IDs
    const existingUnits = this.unitManager.getAllUnits();
    const existingUnitIds = new Set(existingUnits.map(unit => unit.id));

    // Find units to remove (exist in current state but not in new state)
    const unitsToRemove = new Set([...existingUnitIds].filter(id => !currentUnitIds.has(id)));
    
    if (unitsToRemove.size > 0) {
      console.log('🗑️ Removing units:', Array.from(unitsToRemove));
      unitsToRemove.forEach(unitId => {
        this.removeUnit(unitId);
      });
    }

    // Find new units (exist in new state but not in current state)
    const newUnits = new Set([...currentUnitIds].filter(id => !existingUnitIds.has(id)));
    
    if (newUnits.size > 0) {
      console.log('➕ Adding new units:', Array.from(newUnits));
    }

    // Update all units
    this.unitManager.updateUnits(unitsMap);
  }

  private removeUnit(unitId: string): void {
    console.log('🗑️ Removing unit:', unitId);
    
    // Clear selection if removed unit was selected
    if (this.selectedUnitId === unitId) {
      this.clearSelection();
    }

    // Unit removal is handled by UnitManager.updateUnits when the unit is not in the new state
    // This method is for additional cleanup if needed
  }

  public getCurrentTurn(): number {
    return this.currentTurn;
  }

  public getCurrentPlayerIndex(): number {
    return this.currentPlayerIndex;
  }

  public isMyTurn(): boolean {
    return this.currentPlayerIndex.toString() === this.currentPlayerId;
  }

  public clearUnitSelection(): void {
    this.clearSelection();
  }

  public refreshUnitsForNewTurn(): void {
    console.log('🔄 Refreshing units for new turn');
    
    // Clear any highlights from previous turn
    this.mapManager.clearHighlights();
    
    // Hide UI actions panel
    this.uiManager.hideUnitActions();
    
    // In a real implementation, this would reset unit action points
    // For now, we just log the refresh
    const allUnits = this.unitManager.getAllUnits();
    console.log(`🔄 Refreshed ${allUnits.length} units for new turn`);
    
    // Show turn start message
    this.uiManager.showMessage('New turn started!', 2000);
  }

  dispose(): void {
    this.scene.dispose();
    this.engine.dispose();
    window.removeEventListener('resize', () => {
      this.engine.resize();
    });
  }
} 