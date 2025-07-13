import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Mesh,
  InstancedMesh,
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

  constructor(scene: Scene) {
    this.scene = scene;
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
  }

  private createGrid(): void {
    // Create grid material
    const gridMaterial = new GridMaterial('gridMaterial', this.scene);
    gridMaterial.majorUnitFrequency = 5;
    gridMaterial.minorUnitVisibility = 0.45;
    gridMaterial.gridRatio = 1;
    gridMaterial.backFaceCulling = false;
    gridMaterial.mainColor = new Color3(0.5, 0.5, 0.5);
    gridMaterial.lineColor = new Color3(0.3, 0.3, 0.3);
    gridMaterial.opacity = 0.8;

    // Create grid plane
    this.gridMesh = MeshBuilder.CreateGround(
      'grid',
      {
        width: this.mapWidth,
        height: this.mapHeight,
        subdivisions: Math.max(this.mapWidth, this.mapHeight),
      },
      this.scene
    );
    
    this.gridMesh.material = gridMaterial;
    this.gridMesh.position.y = 0.01;
    this.gridMesh.position.x = this.mapWidth / 2 - 0.5;
    this.gridMesh.position.z = this.mapHeight / 2 - 0.5;
  }

  private createTiles(): void {
    // Create tile materials
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
    
    // Grass
    const grassMat = new StandardMaterial('grassMat', this.scene);
    grassMat.diffuseColor = new Color3(0.2, 0.5, 0.2);
    grassMat.specularColor = new Color3(0, 0, 0);
    materials.set(TileType.GRASS, grassMat);
    
    // Forest
    const forestMat = new StandardMaterial('forestMat', this.scene);
    forestMat.diffuseColor = new Color3(0.1, 0.3, 0.1);
    forestMat.specularColor = new Color3(0, 0, 0);
    materials.set(TileType.FOREST, forestMat);
    
    // Mountain
    const mountainMat = new StandardMaterial('mountainMat', this.scene);
    mountainMat.diffuseColor = new Color3(0.5, 0.4, 0.3);
    mountainMat.specularColor = new Color3(0.1, 0.1, 0.1);
    materials.set(TileType.MOUNTAIN, mountainMat);
    
    // Water
    const waterMat = new StandardMaterial('waterMat', this.scene);
    waterMat.diffuseColor = new Color3(0.1, 0.3, 0.6);
    waterMat.specularColor = new Color3(0.3, 0.3, 0.3);
    materials.set(TileType.WATER, waterMat);
    
    // Road
    const roadMat = new StandardMaterial('roadMat', this.scene);
    roadMat.diffuseColor = new Color3(0.4, 0.3, 0.2);
    roadMat.specularColor = new Color3(0, 0, 0);
    materials.set(TileType.ROAD, roadMat);
    
    // Castle
    const castleMat = new StandardMaterial('castleMat', this.scene);
    castleMat.diffuseColor = new Color3(0.6, 0.6, 0.6);
    castleMat.specularColor = new Color3(0.2, 0.2, 0.2);
    materials.set(TileType.CASTLE, castleMat);
    
    return materials;
  }

  private createTile(
    x: number,
    z: number,
    type: TileType,
    materials: Map<TileType, StandardMaterial>
  ): TileMesh {
    const tile = MeshBuilder.CreateBox(
      `tile_${x}_${z}`,
      { width: 0.95, height: 0.1, depth: 0.95 },
      this.scene
    );
    
    tile.position = new Vector3(x, 0, z);
    tile.material = materials.get(type)!;
    
    // Add different heights for different tile types
    switch (type) {
      case TileType.MOUNTAIN:
        tile.scaling.y = 3;
        tile.position.y = 0.15;
        break;
      case TileType.FOREST:
        tile.scaling.y = 1.5;
        tile.position.y = 0.075;
        break;
      case TileType.WATER:
        tile.position.y = -0.05;
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