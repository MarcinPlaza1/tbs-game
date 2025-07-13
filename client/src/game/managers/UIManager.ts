import {
  Scene,
} from '@babylonjs/core';
import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  Button,
  StackPanel,
  Control,
} from '@babylonjs/gui';
import { GamePhase } from '@tbs/shared';

interface GameInfo {
  currentPlayer: number;
  turnNumber: number;
  phase: string;
}

export class UIManager {
  private scene: Scene;
  private advancedTexture: AdvancedDynamicTexture;
  private gameInfoPanel: Rectangle;
  private turnText: TextBlock;
  private phaseText: TextBlock;
  private actionPanel: StackPanel;

  constructor(scene: Scene) {
    this.scene = scene;
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('UI');
    
    this.createGameInfoPanel();
    this.createActionPanel();
  }

  private createGameInfoPanel(): void {
    // Create main panel
    this.gameInfoPanel = new Rectangle('gameInfoPanel');
    this.gameInfoPanel.width = '300px';
    this.gameInfoPanel.height = '100px';
    this.gameInfoPanel.cornerRadius = 10;
    this.gameInfoPanel.color = 'white';
    this.gameInfoPanel.thickness = 2;
    this.gameInfoPanel.background = 'rgba(0, 0, 0, 0.7)';
    this.gameInfoPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.gameInfoPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.gameInfoPanel.left = 20;
    this.gameInfoPanel.top = 20;
    
    this.advancedTexture.addControl(this.gameInfoPanel);
    
    // Create stack panel for text
    const stackPanel = new StackPanel();
    stackPanel.isVertical = true;
    stackPanel.paddingTop = '10px';
    this.gameInfoPanel.addControl(stackPanel);
    
    // Turn text
    this.turnText = new TextBlock();
    this.turnText.text = 'Turn: 1';
    this.turnText.color = 'white';
    this.turnText.fontSize = 20;
    this.turnText.height = '30px';
    stackPanel.addControl(this.turnText);
    
    // Phase text
    this.phaseText = new TextBlock();
    this.phaseText.text = 'Phase: Deployment';
    this.phaseText.color = 'white';
    this.phaseText.fontSize = 16;
    this.phaseText.height = '25px';
    stackPanel.addControl(this.phaseText);
  }

  private createActionPanel(): void {
    // Create action panel on the right
    this.actionPanel = new StackPanel();
    this.actionPanel.width = '200px';
    this.actionPanel.isVertical = true;
    this.actionPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.actionPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.actionPanel.paddingRight = '20px';
    this.actionPanel.spacing = 10;
    
    this.advancedTexture.addControl(this.actionPanel);
  }

  updateGameInfo(info: GameInfo): void {
    this.turnText.text = `Turn: ${info.turnNumber}`;
    this.phaseText.text = `Phase: ${this.formatPhase(info.phase)}`;
  }

  private formatPhase(phase: string): string {
    switch (phase) {
      case GamePhase.DEPLOYMENT:
        return 'Deployment';
      case GamePhase.BATTLE:
        return 'Battle';
      default:
        return phase;
    }
  }

  showUnitActions(unitId: string, actions: string[]): void {
    // Clear existing buttons
    this.actionPanel.clearControls();
    
    // Create action buttons
    actions.forEach((action) => {
      const button = Button.CreateSimpleButton(`${action}_btn`, action);
      button.width = '180px';
      button.height = '40px';
      button.color = 'white';
      button.cornerRadius = 5;
      button.background = 'rgba(59, 130, 246, 0.8)';
      button.fontSize = 16;
      
      button.onPointerEnterObservable.add(() => {
        button.background = 'rgba(59, 130, 246, 1)';
      });
      
      button.onPointerOutObservable.add(() => {
        button.background = 'rgba(59, 130, 246, 0.8)';
      });
      
      button.onPointerClickObservable.add(() => {
        this.handleAction(unitId, action);
      });
      
      this.actionPanel.addControl(button);
    });
  }

  hideUnitActions(): void {
    this.actionPanel.clearControls();
  }

  private handleAction(unitId: string, action: string): void {
    console.log(`Action ${action} for unit ${unitId}`);
    // This would emit an event or call a callback
  }

  showMessage(message: string, duration: number = 3000): void {
    const messageText = new TextBlock();
    messageText.text = message;
    messageText.color = 'white';
    messageText.fontSize = 24;
    messageText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    messageText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    messageText.width = '400px';
    messageText.height = '60px';
    
    const messageRect = new Rectangle();
    messageRect.width = '400px';
    messageRect.height = '60px';
    messageRect.cornerRadius = 10;
    messageRect.color = 'white';
    messageRect.thickness = 2;
    messageRect.background = 'rgba(0, 0, 0, 0.8)';
    messageRect.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    messageRect.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    
    messageRect.addControl(messageText);
    this.advancedTexture.addControl(messageRect);
    
    // Remove after duration
    setTimeout(() => {
      this.advancedTexture.removeControl(messageRect);
    }, duration);
  }

  showTurnIndicator(playerName: string, color: string): void {
    const indicator = new Rectangle();
    indicator.width = '300px';
    indicator.height = '80px';
    indicator.cornerRadius = 10;
    indicator.color = color;
    indicator.thickness = 3;
    indicator.background = 'rgba(0, 0, 0, 0.8)';
    indicator.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    indicator.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    indicator.top = 100;
    
    const text = new TextBlock();
    text.text = `${playerName}'s Turn`;
    text.color = 'white';
    text.fontSize = 28;
    
    indicator.addControl(text);
    this.advancedTexture.addControl(indicator);
    
    // Fade out animation
    let alpha = 1;
    const fadeInterval = setInterval(() => {
      alpha -= 0.02;
      if (alpha <= 0) {
        clearInterval(fadeInterval);
        this.advancedTexture.removeControl(indicator);
      } else {
        indicator.alpha = alpha;
      }
    }, 30);
  }
} 