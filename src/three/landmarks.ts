import * as THREE from 'three';
import { LandmarkSpec, PlaceArchetype, ArchetypeParams } from '../types';
import { alignToSurface } from './geoMath';
import { ArchetypeBuilders } from './archetypes';

export class LandmarkInstance {
  public root: THREE.Group;
  public spec: LandmarkSpec;
  public targetPosition: THREE.Vector3;
  public normal: THREE.Vector3;

  private dropProgress: number = 0;
  private hasLanded: boolean = false;
  private dustPuff: THREE.Points | null = null;
  private waterMesh: THREE.Mesh | null = null;
  private waterTime: number = 0;

  private forwardDir: THREE.Vector3 | undefined;

  constructor(spec: LandmarkSpec, targetPosition: THREE.Vector3, lookAtPos?: THREE.Vector3) {
    this.spec = spec;
    this.normal = targetPosition.clone().normalize();
    // Slightly embed into the sphere surface (-0.06 units) so the curved terrain skirt has zero gap
    this.targetPosition = targetPosition.clone().addScaledVector(this.normal, -0.06);
    if (lookAtPos) {
      const toRoad = lookAtPos.clone().sub(this.targetPosition).projectOnPlane(this.normal);
      if (toRoad.lengthSq() > 0.001) {
        this.forwardDir = toRoad.normalize();
      }
    }
    this.root = new THREE.Group();
    this.root.name = `Landmark_${spec.name}`;

    this.buildModel();

    // Start high above for drop animation
    const spawnPos = this.targetPosition.clone().add(this.normal.clone().multiplyScalar(15.0));
    alignToSurface(this.root, spawnPos, this.forwardDir);
  }

  private detectArchetype(): PlaceArchetype {
    const combined = `${this.spec.name} ${this.spec.nameKr || ''}`.toLowerCase();
    // Always prioritize explicit stream/bridge keywords even if spec.archetype was generic
    if (
      combined.includes('cheonggyecheon') ||
      combined.includes('beodeul') ||
      combined.includes('willow') ||
      combined.includes('bridge') ||
      combined.includes('stream') ||
      combined.includes('river') ||
      combined.includes('creek') ||
      combined.includes('청계천') ||
      combined.includes('버들') ||
      combined.includes('다리') ||
      combined.includes('습지') ||
      combined.includes('산책로')
    ) {
      return 'stream';
    }
    if (this.spec.archetype && this.spec.archetype !== 'generic') {
      return this.spec.archetype;
    }
    if (
      combined.includes('본관') ||
      combined.includes('고려대') ||
      combined.includes('korea univ') ||
      combined.includes('ku ') ||
      combined.includes('library') ||
      combined.includes('plaza') ||
      combined.includes('campus') ||
      combined.includes('clock') ||
      combined.includes('시계탑') ||
      combined.includes('대학')
    ) {
      return 'campusBuilding';
    }
    if (
      combined.includes('한옥') ||
      combined.includes('전통') ||
      combined.includes('찻집') ||
      combined.includes('hanok') ||
      combined.includes('tea') ||
      combined.includes('temple')
    ) {
      return 'hanokTemple';
    }
    if (
      combined.includes('포차') ||
      combined.includes('오거리') ||
      combined.includes('시장') ||
      combined.includes('market') ||
      combined.includes('pocha') ||
      combined.includes('stall') ||
      combined.includes('lantern')
    ) {
      return 'market';
    }
    if (
      combined.includes('공원') ||
      combined.includes('park') ||
      combined.includes('성곽') ||
      combined.includes('fortress') ||
      combined.includes('wall') ||
      combined.includes('낙산') ||
      combined.includes('마로니에')
    ) {
      return 'park';
    }
    return 'campusBuilding';
  }

  private buildModel() {
    const archetype = this.detectArchetype();
    const params: ArchetypeParams = this.spec.archetypeParams || {
      archetype,
      length: 5.4,
      width: 5.4,
      bridges: 1,
      trees: 4,
      steppingStones: 5,
      palette: {
        primary: this.spec.palette.wall,
        secondary: this.spec.palette.roof,
        accent: this.spec.palette.accent || '#F59E0B',
        ground: '#CBD5E1',
      },
      signText: this.spec.name,
    };

    const container = new THREE.Group();

    // 1. Add Spherical-Conforming Terrain Blend Skirt & Natural Stone/Bush Seam ("마감선")
    const skirtRadius = archetype === 'stream' ? 3.5 : archetype === 'market' ? 2.7 : 3.2;
    const skirt = ArchetypeBuilders.buildSphericalTerrainSkirt(
      skirtRadius,
      24,
      archetype === 'stream' ? '#4ADE80' : '#86EFAC',
      this.spec.palette?.wall || '#94A3B8'
    );
    container.add(skirt);

    // 2. Build Archetype Diorama Model atop the blended terrain mound
    let archetypeModel: THREE.Group;

    switch (archetype) {
      case 'stream':
        archetypeModel = ArchetypeBuilders.buildStream(params);
        this.waterMesh = (archetypeModel.getObjectByName('AnimatedWaterPlane') as THREE.Mesh) || null;
        break;
      case 'campusBuilding':
        archetypeModel = ArchetypeBuilders.buildCampusBuilding(params);
        break;
      case 'hanokTemple':
        archetypeModel = ArchetypeBuilders.buildHanokTemple(params);
        break;
      case 'market':
        archetypeModel = ArchetypeBuilders.buildMarket(params);
        break;
      case 'park':
      case 'riverPark':
        archetypeModel = ArchetypeBuilders.buildPark(params);
        break;
      default:
        archetypeModel = ArchetypeBuilders.buildCampusBuilding(params);
        break;
    }

    container.add(archetypeModel);
    // Harmonious diorama scale so landmarks never overwhelm the hero-scale characters
    container.scale.setScalar(0.76);
    this.root.add(container);
  }

  /**
   * Spawns dust puff particle burst on landing
   */
  private spawnDustPuff() {
    const count = 16;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 1.0 + Math.random() * 1.5;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = 0.2 + Math.random() * 0.5;
      positions[i * 3 + 2] = Math.sin(angle) * r;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfde68a,
      size: 0.4,
      transparent: true,
      opacity: 0.8,
    });
    this.dustPuff = new THREE.Points(geom, mat);
    this.root.add(this.dustPuff);
  }

  public update(delta: number) {
    if (!this.hasLanded) {
      this.dropProgress += delta * 2.2;
      if (this.dropProgress >= 1.0) {
        this.dropProgress = 1.0;
        this.hasLanded = true;
        this.spawnDustPuff();
        alignToSurface(this.root, this.targetPosition, this.forwardDir);
      } else {
        // Spring bounce easing
        const t = this.dropProgress;
        const bounce = Math.sin(t * Math.PI * 1.5) * Math.exp(-t * 3.0);
        const height = (1.0 - t) * 15.0 + Math.max(0, bounce * 2.0);
        const curPos = this.targetPosition.clone().add(this.normal.clone().multiplyScalar(height));
        alignToSurface(this.root, curPos, this.forwardDir);
      }
    }

    // Water ripple animation for streams
    if (this.waterMesh) {
      this.waterTime += delta * 2.0;
      this.waterMesh.position.y = 0.08 + Math.sin(this.waterTime) * 0.015;
    }

    // Fade out dust puff
    if (this.dustPuff) {
      const mat = this.dustPuff.material as THREE.PointsMaterial;
      mat.opacity -= delta * 0.9;
      if (mat.opacity <= 0) {
        this.root.remove(this.dustPuff);
        this.dustPuff = null;
      }
    }
  }
}
