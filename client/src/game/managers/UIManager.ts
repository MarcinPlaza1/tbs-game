
import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  Button,
  StackPanel,
  Control,
} from '@babylonjs/gui';
interface GameInfo {
  currentPlayer: number;
  turnNumber: number;
  phase: string;
}

export class UIManager {
  private advancedTexture: AdvancedDynamicTexture;
  private actionPanel!: StackPanel;

  constructor() {
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI('UI');
    
    this.createActionPanel();
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

  updateGameInfo(_info: GameInfo): void {
    // Turn and phase info panel has been removed
    // This method is kept for compatibility but does nothing
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