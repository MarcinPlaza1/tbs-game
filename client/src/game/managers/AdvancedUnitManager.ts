import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  Color3,
  Vector3,
  Mesh,
  Animation,
  ShadowGenerator,
  AnimationGroup,
  SkinnedMesh,
  Skeleton,
  Bone,
  TransformNode,
  InstancedMesh,
  ParticleSystem,
  Texture,
  Tools,
  SceneLoader,
  AssetContainer,
  AbstractMesh,
  Matrix,
  Quaternion,
  CubeTexture
} from '@babylonjs/core';

import { Unit as UnitSchema } from '../../../../game-server/src/schemas/GameState';
import { UnitType } from '@tbs/shared';
import { ParticleManager } from './ParticleManager';

interface AdvancedUnitMesh {
  id: string;
  rootNode: TransformNode;
  bodyMesh: AbstractMesh;
  equipmentMeshes: Map<string, AbstractMesh>;
  skeleton?: Skeleton;
  animations: Map<string, AnimationGroup>;
  healthBar: Mesh;
  schema: UnitSchema;
  experience: number;
  level: number;
  customizations: UnitCustomization;
  battleEffects: BattleEffect[];
}

interface UnitCustomization {
  skinTone: Color3;
  armorColor: Color3;
  weaponType: string;
  accessories: string[];
  scars: BattleScar[];
  decorations: Decoration[];
}

interface BattleScar {
  position: Vector3;
  size: number;
  type: 'cut' | 'burn' | 'arrow';
  age: number; // battles since received
}

interface Decoration {
  type: 'medal' | 'insignia' | 'trophy';
  position: Vector3;
  modelPath: string;
}

interface BattleEffect {
  type: 'poison' | 'fire' | 'ice' | 'blessing' | 'curse';
  duration: number;
  intensity: number;
  particleSystem?: ParticleSystem;
}

interface UnitModelPaths {
  body: string;
  armor: Record<string, string>;
  weapons: Record<string, string>;
  animations: Record<string, string>;
}

export class AdvancedUnitManager {
  private scene: Scene;
  private units: Map<string, AdvancedUnitMesh> = new Map();
  private selectedUnit: string | null = null;
  private shadowGenerator: ShadowGenerator | null = null;
  private particleManager: ParticleManager;
  
  // Asset management
  private unitModels: Map<UnitType, UnitModelPaths> = new Map();
  private loadedAssets: Map<string, AssetContainer> = new Map();
  private materialLibrary: Map<string, PBRMaterial> = new Map();
  
  // Animation system
  private combatAnimations: Map<string, AnimationGroup> = new Map();
  private idleAnimations: Map<string, AnimationGroup> = new Map();
  
  constructor(scene: Scene, particleManager: ParticleManager) {
    this.scene = scene;
    this.particleManager = particleManager;
    this.initializeUnitModels();
    this.preloadCommonAssets();
  }

  setShadowGenerator(shadowGenerator: ShadowGenerator): void {
    this.shadowGenerator = shadowGenerator;
  }

  private initializeUnitModels(): void {
    // Define model paths for each unit type
    this.unitModels.set(UnitType.WARRIOR, {
      body: '/assets/units/warrior/body.babylon',
      armor: {
        light: '/assets/units/warrior/armor_light.babylon',
        medium: '/assets/units/warrior/armor_medium.babylon',
        heavy: '/assets/units/warrior/armor_heavy.babylon'
      },
      weapons: {
        sword: '/assets/units/warrior/sword.babylon',
        axe: '/assets/units/warrior/axe.babylon',
        mace: '/assets/units/warrior/mace.babylon'
      },
      animations: {
        idle: '/assets/units/warrior/animations/idle.babylon',
        walk: '/assets/units/warrior/animations/walk.babylon',
        attack: '/assets/units/warrior/animations/attack.babylon',
        death: '/assets/units/warrior/animations/death.babylon'
      }
    });

    this.unitModels.set(UnitType.MAGE, {
      body: '/assets/units/mage/body.babylon',
      armor: {
        robes: '/assets/units/mage/robes.babylon',
        enchanted: '/assets/units/mage/enchanted_robes.babylon'
      },
      weapons: {
        staff: '/assets/units/mage/staff.babylon',
        wand: '/assets/units/mage/wand.babylon',
        orb: '/assets/units/mage/orb.babylon'
      },
      animations: {
        idle: '/assets/units/mage/animations/idle.babylon',
        walk: '/assets/units/mage/animations/walk.babylon',
        cast: '/assets/units/mage/animations/cast.babylon',
        channel: '/assets/units/mage/animations/channel.babylon'
      }
    });

    // Add other unit types...
  }

  private async preloadCommonAssets(): Promise<void> {
    try {
      // Preload commonly used assets
      const commonAssets = [
        '/assets/units/common/health_bar.babylon',
        '/assets/units/common/selection_ring.babylon',
        '/assets/effects/common/level_up.babylon'
      ];

      for (const assetPath of commonAssets) {
        const container = await SceneLoader.LoadAssetContainerAsync(assetPath, '', this.scene);
        this.loadedAssets.set(assetPath, container);
      }

      console.log('🎮 Common unit assets preloaded');
    } catch (error) {
      console.warn('Failed to preload some assets:', error);
    }
  }

  async updateUnits(unitsData: Map<string, UnitSchema>): Promise<void> {
    if (!unitsData) {
      console.warn('⚠️ AdvancedUnitManager: unitsData is undefined/null, skipping update');
      return;
    }

    // Remove units that no longer exist
    for (const [id] of this.units) {
      if (!unitsData.has(id)) {
        await this.removeUnit(id);
      }
    }

    // Update or create units
    for (const [id, unitData] of unitsData) {
      if (this.units.has(id)) {
        await this.updateExistingUnit(id, unitData);
      } else {
        await this.createAdvancedUnit(id, unitData);
      }
    }
  }

  private async createAdvancedUnit(id: string, unitData: UnitSchema): Promise<void> {
    try {
      // Create root node for the unit
      const rootNode = new TransformNode(`unit_${id}`, this.scene);
      rootNode.position = new Vector3(unitData.position.x, unitData.position.y, unitData.position.z);

      // Load and setup unit body
      const bodyMesh = await this.loadUnitBody(unitData.type, rootNode);
      
      // Create PBR materials
      const materials = await this.createUnitMaterials(unitData);
      this.applyMaterialsToMesh(bodyMesh, materials);

      // Load equipment
      const equipmentMeshes = await this.loadUnitEquipment(unitData, rootNode);

      // Setup animations
      const animations = await this.loadUnitAnimations(unitData.type);

      // Create UI elements
      const healthBar = this.createAdvancedHealthBar(rootNode);

      // Initialize customization
      const customizations = this.generateUnitCustomization(unitData);

      // Create unit record
      const advancedUnit: AdvancedUnitMesh = {
        id,
        rootNode,
        bodyMesh,
        equipmentMeshes,
        animations,
        healthBar,
        schema: unitData,
        experience: 0,
        level: 1,
        customizations,
        battleEffects: []
      };

      // Apply customizations
      this.applyUnitCustomizations(advancedUnit);

      // Setup shadows
      if (this.shadowGenerator) {
        this.shadowGenerator.getShadowMap()!.renderList!.push(bodyMesh);
        equipmentMeshes.forEach(mesh => {
          this.shadowGenerator!.getShadowMap()!.renderList!.push(mesh);
        });
      }

      this.units.set(id, advancedUnit);
      
      // Play spawn animation
      await this.playSpawnAnimation(advancedUnit);

      console.log(`🛡️ Advanced unit created: ${unitData.type} (${id})`);
    } catch (error) {
      console.error(`Failed to create advanced unit ${id}:`, error);
    }
  }

  private async loadUnitBody(unitType: UnitType, parent: TransformNode): Promise<AbstractMesh> {
    const modelPaths = this.unitModels.get(unitType);
    if (!modelPaths) {
      throw new Error(`No model paths defined for unit type: ${unitType}`);
    }

    const container = await SceneLoader.LoadAssetContainerAsync(modelPaths.body, '', this.scene);
    const bodyMesh = container.meshes[0];
    
    bodyMesh.parent = parent;
    bodyMesh.name = `${unitType}_body`;
    
    // Add to scene
    container.addAllToScene();
    
    return bodyMesh;
  }

  private async createUnitMaterials(unitData: UnitSchema): Promise<Map<string, PBRMaterial>> {
    const materials = new Map<string, PBRMaterial>();

    // Create body material
    const bodyMaterial = new PBRMaterial(`${unitData.type}_body_material`, this.scene);
    bodyMaterial.baseColor = this.getUnitBaseColor(unitData.type);
    bodyMaterial.metallicFactor = 0.1;
    bodyMaterial.roughnessFactor = 0.8;
    
    // Add skin texture if available
    const skinTexturePath = `/assets/units/${unitData.type}/textures/skin_albedo.jpg`;
    bodyMaterial.baseTexture = new Texture(skinTexturePath, this.scene);
    
    // Normal mapping for detail
    const normalTexturePath = `/assets/units/${unitData.type}/textures/skin_normal.jpg`;
    bodyMaterial.bumpTexture = new Texture(normalTexturePath, this.scene);
    
    materials.set('body', bodyMaterial);

    // Create armor material
    const armorMaterial = new PBRMaterial(`${unitData.type}_armor_material`, this.scene);
    armorMaterial.baseColor = this.getArmorColor(unitData.type);
    armorMaterial.metallicFactor = 0.7;
    armorMaterial.roughnessFactor = 0.3;
    
    // Metallic/roughness textures
    const metallicTexturePath = `/assets/units/${unitData.type}/textures/armor_metallic.jpg`;
    armorMaterial.metallicTexture = new Texture(metallicTexturePath, this.scene);
    
    materials.set('armor', armorMaterial);

    return materials;
  }

  private async loadUnitEquipment(unitData: UnitSchema, parent: TransformNode): Promise<Map<string, AbstractMesh>> {
    const equipment = new Map<string, AbstractMesh>();
    const modelPaths = this.unitModels.get(unitData.type);
    
    if (!modelPaths) return equipment;

    try {
      // Load weapon based on unit level/type
      const weaponType = this.determineWeaponType(unitData);
      if (modelPaths.weapons[weaponType]) {
        const weaponContainer = await SceneLoader.LoadAssetContainerAsync(
          modelPaths.weapons[weaponType], '', this.scene
        );
        const weaponMesh = weaponContainer.meshes[0];
        weaponMesh.parent = parent;
        weaponContainer.addAllToScene();
        equipment.set('weapon', weaponMesh);
      }

      // Load armor
      const armorType = this.determineArmorType(unitData);
      if (modelPaths.armor[armorType]) {
        const armorContainer = await SceneLoader.LoadAssetContainerAsync(
          modelPaths.armor[armorType], '', this.scene
        );
        const armorMesh = armorContainer.meshes[0];
        armorMesh.parent = parent;
        armorContainer.addAllToScene();
        equipment.set('armor', armorMesh);
      }
    } catch (error) {
      console.warn('Failed to load some equipment:', error);
    }

    return equipment;
  }

  private async loadUnitAnimations(unitType: UnitType): Promise<Map<string, AnimationGroup>> {
    const animations = new Map<string, AnimationGroup>();
    const modelPaths = this.unitModels.get(unitType);
    
    if (!modelPaths) return animations;

    try {
      for (const [animName, animPath] of Object.entries(modelPaths.animations)) {
        const container = await SceneLoader.LoadAssetContainerAsync(animPath, '', this.scene);
        if (container.animationGroups.length > 0) {
          const animGroup = container.animationGroups[0];
          animGroup.name = `${unitType}_${animName}`;
          animations.set(animName, animGroup);
        }
      }
    } catch (error) {
      console.warn('Failed to load some animations:', error);
    }

    return animations;
  }

  private createAdvancedHealthBar(parent: TransformNode): Mesh {
    // Create floating health bar above unit
    const healthBarContainer = MeshBuilder.CreatePlane("healthBarContainer", {size: 2}, this.scene);
    healthBarContainer.position.y = 3;
    healthBarContainer.parent = parent;
    
    // Billboard behavior
    healthBarContainer.billboardMode = Mesh.BILLBOARD_ALL;
    
    // Create health bar material with transparency
    const healthBarMaterial = new StandardMaterial("healthBarMaterial", this.scene);
    healthBarMaterial.diffuseColor = new Color3(1, 0, 0);
    healthBarMaterial.emissiveColor = new Color3(0.2, 0, 0);
    healthBarMaterial.useAlphaFromDiffuseTexture = true;
    
    healthBarContainer.material = healthBarMaterial;
    
    return healthBarContainer;
  }

  private generateUnitCustomization(unitData: UnitSchema): UnitCustomization {
    return {
      skinTone: this.generateRandomSkinTone(),
      armorColor: this.generateArmorColor(unitData.type),
      weaponType: this.determineWeaponType(unitData),
      accessories: [],
      scars: [],
      decorations: []
    };
  }

  private applyUnitCustomizations(unit: AdvancedUnitMesh): void {
    // Apply skin tone
    const bodyMaterial = unit.bodyMesh.material as PBRMaterial;
    if (bodyMaterial) {
      bodyMaterial.baseColor = unit.customizations.skinTone;
    }

    // Apply armor color
    const armorMesh = unit.equipmentMeshes.get('armor');
    if (armorMesh && armorMesh.material) {
      const armorMaterial = armorMesh.material as PBRMaterial;
      armorMaterial.baseColor = unit.customizations.armorColor;
    }

    // Apply battle scars
    this.applyBattleScars(unit);
  }

  private applyBattleScars(unit: AdvancedUnitMesh): void {
    // Add visual battle scars based on unit history
    unit.customizations.scars.forEach(scar => {
      this.createScarDecal(unit.bodyMesh, scar);
    });
  }

  private createScarDecal(mesh: AbstractMesh, scar: BattleScar): void {
    // Create a small decal mesh for the scar
    const scarMesh = MeshBuilder.CreatePlane(`scar_${Math.random()}`, {size: scar.size * 0.1}, this.scene);
    scarMesh.position = scar.position;
    scarMesh.parent = mesh;
    
    // Create scar material
    const scarMaterial = new PBRMaterial("scarMaterial", this.scene);
    scarMaterial.baseColor = new Color3(0.6, 0.4, 0.4);
    scarMaterial.roughnessFactor = 0.9;
    scarMaterial.metallicFactor = 0;
    
    scarMesh.material = scarMaterial;
  }

  async playAttackAnimation(unitId: string, targetPosition: Vector3): Promise<void> {
    const unit = this.units.get(unitId);
    if (!unit || !unit.animations.has('attack')) return;

    // Stop current animations
    this.stopAllAnimations(unit);

    // Face target
    const direction = targetPosition.subtract(unit.rootNode.position).normalize();
    unit.rootNode.lookAt(targetPosition);

    // Play attack animation
    const attackAnim = unit.animations.get('attack')!;
    attackAnim.play(false);

    // Add combat effects
    this.addCombatEffects(unit, 'attack');

    // Wait for animation to complete
    await this.waitForAnimation(attackAnim);
  }

  async playSpellCastAnimation(unitId: string, spellType: string): Promise<void> {
    const unit = this.units.get(unitId);
    if (!unit) return;

    this.stopAllAnimations(unit);

    // Play casting animation if available
    if (unit.animations.has('cast')) {
      const castAnim = unit.animations.get('cast')!;
      castAnim.play(false);
    }

    // Create spell-specific effects
    this.particleManager.createSpellEffect(unit.rootNode.position, spellType);
    
    // Add magical glow to unit
    this.addMagicalGlow(unit);
  }

  private addCombatEffects(unit: AdvancedUnitMesh, effectType: string): void {
    switch (effectType) {
      case 'attack':
        // Weapon trail effect
        this.createWeaponTrail(unit);
        break;
      case 'damage':
        // Blood splatter effect
        this.particleManager.createBloodEffect(unit.rootNode.position);
        break;
      case 'heal':
        // Healing light effect
        this.particleManager.createHealingEffect(unit.rootNode.position);
        break;
    }
  }

  private createWeaponTrail(unit: AdvancedUnitMesh): void {
    const weapon = unit.equipmentMeshes.get('weapon');
    if (!weapon) return;

    // Create trail particle system
    const trail = this.particleManager.createWeaponTrail(weapon);
    
    // Auto-dispose after short duration
    setTimeout(() => {
      trail?.dispose();
    }, 1000);
  }

  private addMagicalGlow(unit: AdvancedUnitMesh): void {
    // Add emissive glow to unit materials
    const bodyMaterial = unit.bodyMesh.material as PBRMaterial;
    if (bodyMaterial) {
      bodyMaterial.emissiveColor = new Color3(0.3, 0.5, 1.0);
      bodyMaterial.emissiveIntensity = 0.5;
      
      // Remove glow after spell duration
      setTimeout(() => {
        bodyMaterial.emissiveColor = Color3.Black();
        bodyMaterial.emissiveIntensity = 0;
      }, 3000);
    }
  }

  async levelUpUnit(unitId: string): Promise<void> {
    const unit = this.units.get(unitId);
    if (!unit) return;

    unit.level++;
    unit.experience = 0;

    // Play level up effect
    this.particleManager.createLevelUpEffect(unit.rootNode.position);
    
    // Update unit appearance
    this.updateUnitForLevel(unit);
    
    // Add new battle decoration
    this.addLevelUpDecoration(unit);

    console.log(`🎉 Unit ${unitId} leveled up to ${unit.level}`);
  }

  private updateUnitForLevel(unit: AdvancedUnitMesh): void {
    // Enhance materials based on level
    const levelFactor = unit.level / 10;
    
    // Improve armor appearance
    const armorMesh = unit.equipmentMeshes.get('armor');
    if (armorMesh && armorMesh.material) {
      const armorMaterial = armorMesh.material as PBRMaterial;
      armorMaterial.metallicFactor = Math.min(0.9, 0.5 + levelFactor);
      armorMaterial.roughnessFactor = Math.max(0.1, 0.5 - levelFactor);
    }
  }

  private addLevelUpDecoration(unit: AdvancedUnitMesh): void {
    const decoration: Decoration = {
      type: 'medal',
      position: new Vector3(0.2, 1.8, 0.1),
      modelPath: `/assets/decorations/medal_level_${unit.level}.babylon`
    };
    
    unit.customizations.decorations.push(decoration);
    // Load and attach decoration mesh...
  }

  // Helper methods
  private getUnitBaseColor(unitType: UnitType): Color3 {
    switch (unitType) {
      case UnitType.WARRIOR: return new Color3(0.8, 0.7, 0.6);
      case UnitType.MAGE: return new Color3(0.7, 0.7, 0.8);
      case UnitType.ARCHER: return new Color3(0.75, 0.7, 0.65);
      default: return new Color3(0.7, 0.7, 0.7);
    }
  }

  private getArmorColor(unitType: UnitType): Color3 {
    switch (unitType) {
      case UnitType.WARRIOR: return new Color3(0.6, 0.6, 0.7);
      case UnitType.MAGE: return new Color3(0.3, 0.2, 0.8);
      case UnitType.ARCHER: return new Color3(0.4, 0.6, 0.3);
      default: return new Color3(0.5, 0.5, 0.5);
    }
  }

  private determineWeaponType(unitData: UnitSchema): string {
    // Determine weapon based on unit stats, level, etc.
    return 'sword'; // Placeholder
  }

  private determineArmorType(unitData: UnitSchema): string {
    // Determine armor based on unit stats, level, etc.
    return 'medium'; // Placeholder
  }

  private generateRandomSkinTone(): Color3 {
    const tones = [
      new Color3(0.9, 0.8, 0.7),
      new Color3(0.8, 0.7, 0.6),
      new Color3(0.7, 0.6, 0.5),
      new Color3(0.6, 0.5, 0.4),
      new Color3(0.5, 0.4, 0.3)
    ];
    return tones[Math.floor(Math.random() * tones.length)];
  }

  private generateArmorColor(unitType: UnitType): Color3 {
    const baseColor = this.getArmorColor(unitType);
    // Add slight random variation
    return new Color3(
      baseColor.r + (Math.random() - 0.5) * 0.2,
      baseColor.g + (Math.random() - 0.5) * 0.2,
      baseColor.b + (Math.random() - 0.5) * 0.2
    );
  }

  private stopAllAnimations(unit: AdvancedUnitMesh): void {
    unit.animations.forEach(anim => anim.stop());
  }

  private async waitForAnimation(animation: AnimationGroup): Promise<void> {
    return new Promise(resolve => {
      animation.onAnimationEndObservable.addOnce(() => {
        resolve();
      });
    });
  }

  private async updateExistingUnit(id: string, unitData: UnitSchema): Promise<void> {
    const unit = this.units.get(id);
    if (!unit) return;

    // Update position
    unit.rootNode.position = new Vector3(
      unitData.position.x,
      unitData.position.y,
      unitData.position.z
    );

    // Update health bar
    this.updateHealthBar(unit, unitData);

    // Update schema
    unit.schema = unitData;
  }

  private updateHealthBar(unit: AdvancedUnitMesh, unitData: UnitSchema): void {
    const healthPercent = unitData.stats.health / unitData.stats.maxHealth;
    
    // Update health bar color based on health
    const material = unit.healthBar.material as StandardMaterial;
    if (healthPercent > 0.6) {
      material.diffuseColor = new Color3(0, 1, 0); // Green
    } else if (healthPercent > 0.3) {
      material.diffuseColor = new Color3(1, 1, 0); // Yellow
    } else {
      material.diffuseColor = new Color3(1, 0, 0); // Red
    }
    
    // Scale health bar
    unit.healthBar.scaling.x = healthPercent;
  }

  private async removeUnit(id: string): Promise<void> {
    const unit = this.units.get(id);
    if (!unit) return;

    // Play death animation if available
    if (unit.animations.has('death')) {
      const deathAnim = unit.animations.get('death')!;
      deathAnim.play(false);
      await this.waitForAnimation(deathAnim);
    }

    // Dispose all resources
    unit.rootNode.dispose();
    unit.healthBar.dispose();
    unit.animations.forEach(anim => anim.dispose());
    unit.battleEffects.forEach(effect => effect.particleSystem?.dispose());

    this.units.delete(id);
  }

  // Public interface methods
  public selectUnit(unitId: string): void {
    this.selectedUnit = unitId;
    // Add selection indicator
    const unit = this.units.get(unitId);
    if (unit) {
      this.addSelectionRing(unit);
    }
  }

  public deselectUnit(): void {
    if (this.selectedUnit) {
      const unit = this.units.get(this.selectedUnit);
      if (unit) {
        this.removeSelectionRing(unit);
      }
      this.selectedUnit = null;
    }
  }

  private addSelectionRing(unit: AdvancedUnitMesh): void {
    // Create glowing selection ring around unit
    const ring = MeshBuilder.CreateTorus(`selection_${unit.id}`, {
      diameter: 3,
      thickness: 0.1,
      tessellation: 32
    }, this.scene);
    
    ring.position.y = 0.1;
    ring.parent = unit.rootNode;
    
    // Glowing material
    const ringMaterial = new PBRMaterial("selectionRing", this.scene);
    ringMaterial.emissiveColor = new Color3(0, 1, 1);
    ringMaterial.emissiveIntensity = 2;
    ring.material = ringMaterial;
    
    // Pulsing animation
    const pulseAnim = Animation.CreateAndStartAnimation(
      "ringPulse",
      ring,
      "scaling",
      30,
      60,
      new Vector3(1, 1, 1),
      new Vector3(1.2, 1, 1.2),
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
  }

  private removeSelectionRing(unit: AdvancedUnitMesh): void {
    const ring = this.scene.getMeshByName(`selection_${unit.id}`);
    if (ring) {
      ring.dispose();
    }
  }

  public dispose(): void {
    this.units.forEach(unit => this.removeUnit(unit.id));
    this.loadedAssets.forEach(container => container.dispose());
    this.materialLibrary.forEach(material => material.dispose());
  }
}