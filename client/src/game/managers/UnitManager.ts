import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  Animation,
  ShadowGenerator,
} from '@babylonjs/core';
import { Unit as UnitSchema } from '../../../../game-server/src/schemas/GameState';
import { UnitType } from '@tbs/shared';

interface UnitMesh {
  id: string;
  mesh: Mesh;
  healthBar: Mesh;
  schema: UnitSchema;
}

export class UnitManager {
  private scene: Scene;
  private units: Map<string, UnitMesh> = new Map();
  private selectedUnit: string | null = null;
  private shadowGenerator: ShadowGenerator | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  setShadowGenerator(shadowGenerator: ShadowGenerator): void {
    this.shadowGenerator = shadowGenerator;
  }

  updateUnits(unitsData: Map<string, UnitSchema>): void {
    // Guard against undefined/null unitsData
    if (!unitsData) {
      console.warn('⚠️ UnitManager: unitsData is undefined/null, skipping update');
      return;
    }

    // Remove units that no longer exist
    for (const [id] of this.units) {
      if (!unitsData.has(id)) {
        this.removeUnit(id);
      }
    }

    // Update or create units
    unitsData.forEach((unitData, id) => {
      if (this.units.has(id)) {
        this.updateUnit(id, unitData);
      } else {
        this.createUnit(id, unitData);
      }
    });
  }

  private createUnit(id: string, unitData: UnitSchema): void {
    // Create unit mesh based on type
    const mesh = this.createUnitMesh(unitData);
    mesh.name = `unit_${id}`;
    
    // Enable shadow casting and receiving
    mesh.receiveShadows = true;
    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(mesh);
    }
    
    // Create health bar
    const healthBar = this.createHealthBar(mesh);
    
    // Position unit
    mesh.position = new Vector3(
      unitData.position.x,
      0.5,
      unitData.position.z
    );
    
    const unitMesh: UnitMesh = {
      id,
      mesh,
      healthBar,
      schema: unitData,
    };
    
    this.units.set(id, unitMesh);
    console.log(`🛡️ Created unit: ${unitData.type} (${id}) with enhanced materials`);
  }

  private createUnitMesh(unitData: UnitSchema): Mesh {
    let mesh: Mesh;
    const material = new StandardMaterial(`unitMat_${unitData.id}`, this.scene);
    
    // Enhanced material properties for all units
    material.specularPower = 32;
    material.roughness = 0.7;
    
    switch (unitData.type) {
      case UnitType.WARRIOR:
        mesh = MeshBuilder.CreateBox(
          'warrior',
          { width: 0.4, height: 0.6, depth: 0.4 },
          this.scene
        );
        material.diffuseColor = new Color3(0.9, 0.3, 0.3);
        material.specularColor = new Color3(0.3, 0.1, 0.1);
        material.ambientColor = new Color3(0.2, 0.05, 0.05);
        material.emissiveColor = new Color3(0.1, 0, 0);
        break;
        
      case UnitType.ARCHER:
        mesh = MeshBuilder.CreateCylinder(
          'archer',
          { height: 0.6, diameterTop: 0.2, diameterBottom: 0.4 },
          this.scene
        );
        material.diffuseColor = new Color3(0.3, 0.7, 0.3);
        material.specularColor = new Color3(0.1, 0.3, 0.1);
        material.ambientColor = new Color3(0.05, 0.15, 0.05);
        material.emissiveColor = new Color3(0, 0.1, 0);
        break;
        
      case UnitType.MAGE:
        mesh = MeshBuilder.CreateSphere(
          'mage',
          { diameter: 0.5 },
          this.scene
        );
        material.diffuseColor = new Color3(0.3, 0.3, 0.9);
        material.specularColor = new Color3(0.4, 0.4, 0.6);
        material.ambientColor = new Color3(0.05, 0.05, 0.2);
        material.emissiveColor = new Color3(0, 0, 0.2);
        material.specularPower = 64; // More reflective for magical units
        break;
        
      case UnitType.CAVALRY:
        mesh = MeshBuilder.CreateBox(
          'cavalry',
          { width: 0.4, height: 0.5, depth: 0.7 },
          this.scene
        );
        material.diffuseColor = new Color3(0.7, 0.5, 0.3);
        material.specularColor = new Color3(0.2, 0.15, 0.1);
        material.ambientColor = new Color3(0.15, 0.1, 0.05);
        material.emissiveColor = new Color3(0.05, 0.02, 0);
        break;
        
      case UnitType.SIEGE:
        mesh = MeshBuilder.CreateBox(
          'siege',
          { width: 0.6, height: 0.4, depth: 0.8 },
          this.scene
        );
        material.diffuseColor = new Color3(0.5, 0.5, 0.5);
        material.specularColor = new Color3(0.3, 0.3, 0.3);
        material.ambientColor = new Color3(0.1, 0.1, 0.1);
        material.emissiveColor = new Color3(0.02, 0.02, 0.02);
        material.specularPower = 128; // Metallic siege units
        material.roughness = 0.3;
        break;
        
      default:
        mesh = MeshBuilder.CreateBox(
          'unit',
          { width: 0.4, height: 0.5, depth: 0.4 },
          this.scene
        );
        material.diffuseColor = new Color3(0.6, 0.6, 0.6);
        material.specularColor = new Color3(0.2, 0.2, 0.2);
        material.ambientColor = new Color3(0.1, 0.1, 0.1);
    }
    
    mesh.material = material;
    return mesh;
  }

  private createHealthBar(parentMesh: Mesh): Mesh {
    const healthBar = MeshBuilder.CreatePlane(
      'healthBar',
      { width: 0.6, height: 0.1 },
      this.scene
    );
    
    const healthMat = new StandardMaterial('healthMat', this.scene);
    healthMat.diffuseColor = new Color3(0, 1, 0);
    healthMat.emissiveColor = new Color3(0, 0.3, 0); // Glowing health bars
    healthMat.specularColor = new Color3(0, 0, 0); // No specular reflection
    healthMat.backFaceCulling = false; // Visible from both sides
    healthBar.material = healthMat;
    
    healthBar.parent = parentMesh;
    healthBar.position.y = 0.8;
    healthBar.billboardMode = Mesh.BILLBOARDMODE_ALL;
    
    return healthBar;
  }

  private updateUnit(id: string, unitData: UnitSchema): void {
    const unit = this.units.get(id);
    if (!unit) return;
    
    // Update position with animation
    this.animateUnitMovement(
      unit.mesh,
      new Vector3(unitData.position.x, 0.5, unitData.position.z)
    );
    
    // Update health bar
    this.updateHealthBar(unit, unitData);
    
    // Update unit data
    unit.schema = unitData;
    
    // Update appearance based on state with better visual feedback
    if (!unitData.isAlive) {
      this.removeUnit(id);
    } else if (unitData.hasMoved && unitData.hasAttacked) {
      // Unit has used all actions - fade and desaturate
      const material = unit.mesh.material as StandardMaterial;
      material.alpha = 0.6;
      material.emissiveColor = material.emissiveColor.scale(0.3);
    } else if (unitData.hasMoved || unitData.hasAttacked) {
      // Unit has used some actions - slight fade
      const material = unit.mesh.material as StandardMaterial;
      material.alpha = 0.8;
      material.emissiveColor = material.emissiveColor.scale(0.7);
    } else {
      // Unit is fresh - full brightness
      const material = unit.mesh.material as StandardMaterial;
      material.alpha = 1.0;
      // Restore original emissive based on unit type
      this.restoreOriginalEmissive(material, unitData.type);
    }
  }

  private restoreOriginalEmissive(material: StandardMaterial, unitType: UnitType): void {
    switch (unitType) {
      case UnitType.WARRIOR:
        material.emissiveColor = new Color3(0.1, 0, 0);
        break;
      case UnitType.ARCHER:
        material.emissiveColor = new Color3(0, 0.1, 0);
        break;
      case UnitType.MAGE:
        material.emissiveColor = new Color3(0, 0, 0.2);
        break;
      case UnitType.CAVALRY:
        material.emissiveColor = new Color3(0.05, 0.02, 0);
        break;
      case UnitType.SIEGE:
        material.emissiveColor = new Color3(0.02, 0.02, 0.02);
        break;
      default:
        material.emissiveColor = Color3.Black();
    }
  }

  private updateHealthBar(unit: UnitMesh, unitData: UnitSchema): void {
    const healthPercent = unitData.health / unitData.maxHealth;
    unit.healthBar.scaling.x = healthPercent;
    
    // Enhanced color changes based on health with emissive glow
    const healthMat = unit.healthBar.material as StandardMaterial;
    if (healthPercent > 0.6) {
      healthMat.diffuseColor = new Color3(0, 1, 0);
      healthMat.emissiveColor = new Color3(0, 0.3, 0);
    } else if (healthPercent > 0.3) {
      healthMat.diffuseColor = new Color3(1, 1, 0);
      healthMat.emissiveColor = new Color3(0.3, 0.3, 0);
    } else {
      healthMat.diffuseColor = new Color3(1, 0, 0);
      healthMat.emissiveColor = new Color3(0.4, 0, 0);
    }
  }

  private animateUnitMovement(mesh: Mesh, targetPosition: Vector3): void {
    const animationMove = new Animation(
      'moveAnimation',
      'position',
      30,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    const keys = [
      { frame: 0, value: mesh.position.clone() },
      { frame: 30, value: targetPosition },
    ];
    
    animationMove.setKeys(keys);
    mesh.animations = [animationMove];
    
    this.scene.beginAnimation(mesh, 0, 30, false);
  }

  private removeUnit(id: string): void {
    const unit = this.units.get(id);
    if (unit) {
      unit.mesh.dispose();
      unit.healthBar.dispose();
      this.units.delete(id);
      
      if (this.selectedUnit === id) {
        this.selectedUnit = null;
      }
    }
  }

  selectUnit(id: string): void {
    // Clear previous selection
    if (this.selectedUnit) {
      const prevUnit = this.units.get(this.selectedUnit);
      if (prevUnit && prevUnit.mesh.material instanceof StandardMaterial) {
        prevUnit.mesh.material.emissiveColor = Color3.Black();
      }
    }
    
    // Select new unit
    const unit = this.units.get(id);
    if (unit && unit.mesh.material instanceof StandardMaterial) {
      unit.mesh.material.emissiveColor = new Color3(0.3, 0.3, 0);
      this.selectedUnit = id;
    }
  }

  getSelectedUnit(): UnitMesh | null {
    return this.selectedUnit ? this.units.get(this.selectedUnit) || null : null;
  }

  getUnitAt(x: number, z: number): UnitMesh | null {
    for (const unit of this.units.values()) {
      const pos = unit.mesh.position;
      if (Math.abs(pos.x - x) < 0.5 && Math.abs(pos.z - z) < 0.5) {
        return unit;
      }
    }
    return null;
  }

  getAllUnits(): UnitMesh[] {
    return Array.from(this.units.values());
  }

  getUnitById(id: string): UnitMesh | null {
    return this.units.get(id) || null;
  }
} 