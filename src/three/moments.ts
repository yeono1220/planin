import * as THREE from 'three';
import { Moment } from '../types';
import { alignToSurface } from './geoMath';

export class MomentMarker {
  public group: THREE.Group;
  public moment: Moment;
  public position: THREE.Vector3;
  public normal: THREE.Vector3;
  public isCollected: boolean = false;

  private crystalMesh: THREE.Mesh;
  private ringMesh: THREE.Mesh;
  private photoCard: THREE.Mesh | null = null;
  private starMesh: THREE.Mesh;
  private animTimer: number = 0;

  constructor(moment: Moment, surfacePos: THREE.Vector3, photoUrl?: string) {
    this.moment = moment;
    this.position = surfacePos.clone();
    this.normal = surfacePos.clone().normalize();
    this.group = new THREE.Group();
    this.group.name = `Marker_${moment.id}`;
    this.group.userData = { momentId: moment.id, isMomentMarker: true };

    // 1. Glowing Crystal Pin
    const crystalGeom = new THREE.OctahedronGeometry(0.55, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: this.getMoodColor(moment.mood),
      emissive: this.getMoodColor(moment.mood),
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.8,
    });
    this.crystalMesh = new THREE.Mesh(crystalGeom, crystalMat);
    this.crystalMesh.position.y = 1.2;
    this.group.add(this.crystalMesh);

    // 2. Base Ground Ring
    const ringGeom = new THREE.RingGeometry(0.3, 0.65, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: this.getMoodColor(moment.mood),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.ringMesh = new THREE.Mesh(ringGeom, ringMat);
    this.ringMesh.rotation.x = Math.PI / 2;
    this.ringMesh.position.y = 0.05;
    this.group.add(this.ringMesh);

    // 3. Collectable Star for Tour Gamification
    const starGeom = new THREE.DodecahedronGeometry(0.3, 0);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 0.8,
      metalness: 0.6,
    });
    this.starMesh = new THREE.Mesh(starGeom, starMat);
    this.starMesh.position.y = 2.4;
    this.group.add(this.starMesh);

    // 4. Floating Photo Card Billboard
    if (photoUrl) {
      this.createPhotoCard(photoUrl);
    }

    // Align marker along planet surface normal
    alignToSurface(this.group, this.position);
  }

  private getMoodColor(mood: string): number {
    switch (mood) {
      case 'happy':
        return 0xf59e0b; // Amber
      case 'excited':
        return 0xef4444; // Rose red
      case 'relaxed':
        return 0x10b981; // Emerald
      case 'calm':
        return 0x06b6d4; // Cyan
      case 'surprised':
        return 0x8b5cf6; // Purple
      default:
        return 0x3b82f6; // Blue
    }
  }

  private createPhotoCard(url: string) {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const geom = new THREE.PlaneGeometry(1.15, 1.15);
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          side: THREE.DoubleSide,
        });
        const card = new THREE.Mesh(geom, mat);
        card.position.set(0.85, 2.8, 0);

        // Square Polaroid border frame
        const borderGeom = new THREE.PlaneGeometry(1.26, 1.26);
        const borderMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const border = new THREE.Mesh(borderGeom, borderMat);
        border.position.z = -0.01;
        card.add(border);

        this.photoCard = card;
        this.group.add(card);
      },
      undefined,
      () => {
        // Fallback photo card
      }
    );
  }

  public collectStar(): boolean {
    if (!this.isCollected) {
      this.isCollected = true;
      this.starMesh.visible = false;
      return true;
    }
    return false;
  }

  public update(delta: number, camera: THREE.Camera) {
    this.animTimer += delta;

    // Bobbing and spinning crystal
    this.crystalMesh.rotation.y += delta * 1.8;
    this.crystalMesh.position.y = 1.2 + Math.sin(this.animTimer * 2.5) * 0.15;

    // Star rotation
    if (!this.isCollected) {
      this.starMesh.rotation.y += delta * 2.2;
      this.starMesh.position.y = 2.4 + Math.cos(this.animTimer * 2.0) * 0.12;
    }

    // Photo card billboard face camera
    if (this.photoCard) {
      this.photoCard.quaternion.copy(camera.quaternion);
    }
  }
}
