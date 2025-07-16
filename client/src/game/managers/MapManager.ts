import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  ShadowGenerator,
} from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials';
import { TileType } from '@tbs/shared';

interface TileMesh {
  mesh: Mesh;
  position: Vector3;
  type: TileType;
}

export class MapManager {
  private scene: Scene;
  private tiles: Map<string, TileMesh> = new Map();
  private gridMesh: Mesh | null = null;
  private mapWidth: number = 0;
  private mapHeight: number = 0;
  private initialized: boolean = false;
  private shadowGenerator: ShadowGenerator | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  setShadowGenerator(shadowGenerator: ShadowGenerator): void {
    this.shadowGenerator = shadowGenerator;
  }

  createMap(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
    
    // Clear existing tiles
    this.clearMap();
    
    // Create grid overlay
    this.createGrid();
    
    // Create base tiles
    this.createTiles();
    
    this.initialized = true;
    console.log(`🗺️ Map created: ${width}x${height} with enhanced materials`);
  }

  private createGrid(): void {
    // Create enhanced grid material
    const gridMaterial = new GridMaterial('gridMaterial', this.scene);
    gridMaterial.majorUnitFrequency = 5;
    gridMaterial.minorUnitVisibility = 0.3; // Reduced for cleaner look
    gridMaterial.gridRatio = 1;
    gridMaterial.backFaceCulling = false;
    gridMaterial.mainColor = new Color3(0.4, 0.4, 0.5); // Slightly more blue
    gridMaterial.lineColor = new Color3(0.2, 0.2, 0.3); // Darker lines
    gridMaterial.opacity = 0.6; // More transparent for cleaner look

    // Create grid plane with better subdivision for smoother appearance
    this.gridMesh = MeshBuilder.CreateGround(
      'grid',
      {
        width: this.mapWidth,
        height: this.mapHeight,
        subdivisions: Math.max(this.mapWidth, this.mapHeight) * 2, // More subdivisions for smoother grid
      },
      this.scene
    );
    
    this.gridMesh.material = gridMaterial;
    this.gridMesh.position.y = 0.01;
    this.gridMesh.position.x = this.mapWidth / 2 - 0.5;
    this.gridMesh.position.z = this.mapHeight / 2 - 0.5;
    
    // Enable shadow receiving for the grid
    this.gridMesh.receiveShadows = true;
  }

  private createTiles(): void {
    // Create enhanced tile materials
    const materials = this.createTileMaterials();
    
    for (let x = 0; x < this.mapWidth; x++) {
      for (let z = 0; z < this.mapHeight; z++) {
        const tileType = this.generateTileType(x, z);
        const tile = this.createTile(x, z, tileType, materials);
        
        const key = `${x},${z}`;
        this.tiles.set(key, tile);
      }
    }
  }

  private createTileMaterials(): Map<TileType, StandardMaterial> {
    const materials = new Map<TileType, StandardMaterial>();
    
    // Enhanced Grass material
    const grassMat = new StandardMaterial('grassMat', this.scene);
    grassMat.diffuseColor = new Color3(0.3, 0.6, 0.3);
    grassMat.specularColor = new Color3(0.1, 0.1, 0.1);
    grassMat.specularPower = 32;
    grassMat.roughness = 0.8;
    grassMat.ambientColor = new Color3(0.1, 0.2, 0.1);
    materials.set(TileType.GRASS, grassMat);
    
    // Enhanced Forest material
    const forestMat = new StandardMaterial('forestMat', this.scene);
    forestMat.diffuseColor = new Color3(0.15, 0.4, 0.15);
    forestMat.specularColor = new Color3(0.05, 0.1, 0.05);
    forestMat.specularPower = 16;
    forestMat.roughness = 0.9;
    forestMat.ambientColor = new Color3(0.05, 0.15, 0.05);
    materials.set(TileType.FOREST, forestMat);
    
    // Enhanced Mountain material
    const mountainMat = new StandardMaterial('mountainMat', this.scene);
    mountainMat.diffuseColor = new Color3(0.6, 0.5, 0.4);
    mountainMat.specularColor = new Color3(0.3, 0.3, 0.3);
    mountainMat.specularPower = 64;
    mountainMat.roughness = 0.6;
    mountainMat.ambientColor = new Color3(0.2, 0.15, 0.1);
    materials.set(TileType.MOUNTAIN, mountainMat);
    
    // Enhanced Water material
    const waterMat = new StandardMaterial('waterMat', this.scene);
    waterMat.diffuseColor = new Color3(0.1, 0.4, 0.7);
    waterMat.specularColor = new Color3(0.8, 0.9, 1.0);
    waterMat.specularPower = 128;
    waterMat.roughness = 0.1;
    waterMat.ambientColor = new Color3(0.05, 0.1, 0.2);
    waterMat.alpha = 0.8; // Semi-transparent
    materials.set(TileType.WATER, waterMat);
    
    // Enhanced Road material
    const roadMat = new StandardMaterial('roadMat', this.scene);
    roadMat.diffuseColor = new Color3(0.5, 0.4, 0.3);
    roadMat.specularColor = new Color3(0.1, 0.1, 0.1);
    roadMat.specularPower = 8;
    roadMat.roughness = 0.9;
    roadMat.ambientColor = new Color3(0.15, 0.1, 0.05);
    materials.set(TileType.ROAD, roadMat);
    
    // Enhanced Castle material
    const castleMat = new StandardMaterial('castleMat', this.scene);
    castleMat.diffuseColor = new Color3(0.7, 0.7, 0.7);
    castleMat.specularColor = new Color3(0.4, 0.4, 0.4);
    castleMat.specularPower = 64;
    castleMat.roughness = 0.5;
    castleMat.ambientColor = new Color3(0.2, 0.2, 0.2);
    materials.set(TileType.CASTLE, castleMat);
    
    return materials;
  }

  private createTile(
    x: number,
    z: number,
    type: TileType,
    materials: Map<TileType, StandardMaterial>
  ): TileMesh {
    // Create tile with better geometry
    const tile = MeshBuilder.CreateBox(
      `tile_${x}_${z}`,
      { 
        width: 0.95, 
        height: 0.1, 
        depth: 0.95
      },
      this.scene
    );
    
    tile.position = new Vector3(x, 0, z);
    tile.material = materials.get(type)!;
    
    // Enable shadow receiving
    tile.receiveShadows = true;
    
    // Add different heights for different tile types with better proportions
    switch (type) {
      case TileType.MOUNTAIN:
        tile.scaling.y = 4;
        tile.position.y = 0.2;
        // Mountains cast shadows
        if (this.shadowGenerator) {
          this.shadowGenerator.addShadowCaster(tile);
        }
        break;
      case TileType.FOREST:
        tile.scaling.y = 2;
        tile.position.y = 0.1;
        // Forests cast shadows
        if (this.shadowGenerator) {
          this.shadowGenerator.addShadowCaster(tile);
        }
        break;
      case TileType.WATER:
        tile.position.y = -0.05;
        tile.scaling.y = 0.8;
        break;
      case TileType.CASTLE:
        tile.scaling.y = 3;
        tile.position.y = 0.15;
        // Castles cast shadows
        if (this.shadowGenerator) {
          this.shadowGenerator.addShadowCaster(tile);
        }
        break;
    }
    
    return {
      mesh: tile,
      position: tile.position.clone(),
      type,
    };
  }



  private generateTileType(x: number, z: number): TileType {
    // Simple terrain generation
    const noise = Math.sin(x * 0.3) * Math.cos(z * 0.3) + Math.random() * 0.5;
    
    if (noise > 0.6) return TileType.MOUNTAIN;
    if (noise > 0.3) return TileType.FOREST;
    if (noise < -0.3) return TileType.WATER;
    
    // Add some roads
    if ((x % 5 === 2 || z % 5 === 2) && Math.random() > 0.7) {
      return TileType.ROAD;
    }
    
    return TileType.GRASS;
  }

  getTileAt(x: number, z: number): TileMesh | undefined {
    return this.tiles.get(`${x},${z}`);
  }

  highlightTile(x: number, z: number, color: Color3): void {
    const tile = this.getTileAt(x, z);
    if (tile && tile.mesh.material instanceof StandardMaterial) {
      tile.mesh.material.emissiveColor = color;
    }
  }

  clearHighlights(): void {
    this.tiles.forEach((tile) => {
      if (tile.mesh.material instanceof StandardMaterial) {
        tile.mesh.material.emissiveColor = Color3.Black();
      }
    });
  }

  private clearMap(): void {
    this.tiles.forEach((tile) => {
      tile.mesh.dispose();
    });
    this.tiles.clear();
    
    if (this.gridMesh) {
      this.gridMesh.dispose();
      this.gridMesh = null;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getMapDimensions(): { width: number; height: number } {
    return { width: this.mapWidth, height: this.mapHeight };
  }
} 