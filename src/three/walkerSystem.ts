import * as THREE from 'three';
import { AvatarInstance } from './characters';
import { CharacterSpec } from '../types';

export interface Obstacle {
  dir: THREE.Vector3;
  radius: number; // angular radius in radians
}

export class SphericalWalker {
  public id: string;
  public dir: THREE.Vector3; // unit vector on sphere
  public avatar: AvatarInstance;
  public role: 'player' | 'friend' | 'ambient';
  public speed: number = 0.28; // radians per second
  public currentYaw: number = 0;

  // Waypoints & Navigation
  public waypoints: THREE.Vector3[] = [];
  public currentWaypointIdx: number = 0;
  public isPaused: boolean = false;
  public pauseTimer: number = 0;
  public stallTimer: number = 0;
  public lastDir: THREE.Vector3;
  public steerSign: number = 1;

  // Breadcrumb tracking for friends
  public breadcrumbs: Array<{ dir: THREE.Vector3; time: number }> = [];

  // Animation cycle
  public walkPhase: number = 0;
  public isWalking: boolean = false;
  public isWaving: boolean = false;

  private _normal: THREE.Vector3 = new THREE.Vector3();
  private _tangent: THREE.Vector3 = new THREE.Vector3();
  private _steer: THREE.Vector3 = new THREE.Vector3();

  constructor(
    id: string,
    initialDir: THREE.Vector3,
    avatar: AvatarInstance,
    role: 'player' | 'friend' | 'ambient' = 'ambient'
  ) {
    this.id = id;
    this.dir = initialDir.clone().normalize();
    this.lastDir = this.dir.clone();
    this.avatar = avatar;
    this.role = role;
    this.walkPhase = Math.random() * Math.PI * 2;
  }

  public setWaypoints(points: THREE.Vector3[]) {
    this.waypoints = points.map((p) => p.clone().normalize());
    this.currentWaypointIdx = 0;
  }

  public update(
    delta: number,
    planetRadius: number,
    obstacles: Obstacle[],
    otherWalkers: SphericalWalker[],
    targetBreadcrumb?: THREE.Vector3
  ) {
    const dt = Math.min(delta, 0.08);

    // Record breadcrumb if player
    if (this.role === 'player') {
      const now = performance.now();
      this.breadcrumbs.push({ dir: this.dir.clone(), time: now });
      // Keep only last 3 seconds
      if (this.breadcrumbs.length > 120) {
        this.breadcrumbs.shift();
      }
    }

    // 1. Handling Pause state at moments (look around, wave)
    if (this.isPaused) {
      this.pauseTimer -= dt;
      this.isWalking = false;
      if (this.pauseTimer <= 0) {
        this.isPaused = false;
        this.isWaving = false;
        this.currentWaypointIdx = (this.currentWaypointIdx + 1) % Math.max(1, this.waypoints.length);
      }
      this.animate(dt, false);
      this.alignMesh(planetRadius);
      return;
    }

    // 2. Determine Desired Target Direction
    let targetDir: THREE.Vector3 | null = null;

    if (this.role === 'friend' && targetBreadcrumb) {
      targetDir = targetBreadcrumb;
    } else if (this.waypoints.length > 0) {
      targetDir = this.waypoints[this.currentWaypointIdx];
    }

    if (!targetDir) {
      this.animate(dt, false);
      this.alignMesh(planetRadius);
      return;
    }

    // Distance to current waypoint
    const angularDist = this.dir.angleTo(targetDir);
    if (angularDist < 0.06) {
      // Reached waypoint: pause 1.5s with happy wave
      this.isPaused = true;
      this.pauseTimer = 1.2 + Math.random() * 0.8;
      this.isWaving = true;
      this.animate(dt, false);
      this.alignMesh(planetRadius);
      return;
    }

    this.isWalking = true;

    // 3. Tangent steering toward target
    this._normal.copy(this.dir); // normal on sphere is dir
    this._tangent.subVectors(targetDir, this.dir).projectOnPlane(this._normal).normalize();

    this._steer.copy(this._tangent);

    // 4. Obstacle Avoidance (retaining walls, landmarks, curbs)
    for (const obs of obstacles) {
      const dist = this.dir.angleTo(obs.dir);
      if (dist < obs.radius + 0.14) {
        // Lateral avoidance vector
        const away = new THREE.Vector3().subVectors(this.dir, obs.dir).projectOnPlane(this._normal).normalize();
        const lateral = new THREE.Vector3().crossVectors(this._normal, away).normalize().multiplyScalar(this.steerSign);
        const weight = Math.max(0, 1.0 - dist / (obs.radius + 0.14));
        this._steer.add(away.multiplyScalar(weight * 1.5));
        this._steer.add(lateral.multiplyScalar(weight * 1.2));
      }
    }

    // 5. Personal Space Separation from Other Walkers
    for (const other of otherWalkers) {
      if (other === this) continue;
      const dist = this.dir.angleTo(other.dir);
      if (dist < 0.09) {
        const repulse = new THREE.Vector3().subVectors(this.dir, other.dir).projectOnPlane(this._normal).normalize();
        this._steer.add(repulse.multiplyScalar((0.09 - dist) * 18.0));
      }
    }

    // 6. Check for Stalled Progress (anti-stuck logic)
    const movement = this.dir.distanceTo(this.lastDir);
    if (movement < 0.0005) {
      this.stallTimer += dt;
      if (this.stallTimer > 0.9) {
        this.steerSign *= -1; // flip avoidance side
        this.stallTimer = 0;
      }
    } else {
      this.stallTimer = 0;
    }
    this.lastDir.copy(this.dir);

    // 7. Integrate Position on Sphere
    this._steer.normalize();
    const moveStep = this.speed * dt;
    this.dir.addScaledVector(this._steer, moveStep).normalize();

    // 8. Update Orientation (Smooth yaw toward movement)
    this.alignMesh(planetRadius);

    // 9. Drive Articulated Walk Cycle
    this.animate(dt, true);
  }

  private alignMesh(planetRadius: number) {
    const surfacePos = this.dir.clone().multiplyScalar(planetRadius + 0.12);
    const up = this.dir.clone();

    // Smooth forward heading
    let forward = this._steer.clone().projectOnPlane(up).normalize();
    if (forward.lengthSq() < 0.001) {
      forward = new THREE.Vector3(0, 0, 1).projectOnPlane(up).normalize();
    }

    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    forward.crossVectors(right, up).normalize();

    const rotMatrix = new THREE.Matrix4().makeBasis(right, up, forward);
    this.avatar.root.setRotationFromMatrix(rotMatrix);
    this.avatar.root.position.copy(surfacePos);
  }

  private animate(delta: number, walking: boolean) {
    if (walking) {
      // Natural walking cadence: 13 rad/s
      this.walkPhase += delta * 13.0;
      const stride = Math.sin(this.walkPhase);
      const legSwing = stride * 0.55;
      const armSwing = -stride * 0.45;
      const hop = Math.abs(stride) * 0.08;
      const headNod = Math.sin(this.walkPhase * 2.0) * 0.04;

      const rig: any = (this.avatar as any).rigParts;
      if (rig) {
        if (rig.leftLeg) rig.leftLeg.rotation.x = legSwing;
        if (rig.rightLeg) rig.rightLeg.rotation.x = -legSwing;
        if (rig.leftArm) rig.leftArm.rotation.x = armSwing;
        if (rig.rightArm) rig.rightArm.rotation.x = -armSwing;
        if (rig.torso) {
          rig.torso.position.y = 1.1 + hop;
          rig.torso.rotation.y = stride * 0.06;
        }
        if (rig.head) rig.head.rotation.x = headNod;
      }
    } else {
      // Idle breathing and looking around
      const breath = Math.sin(performance.now() * 0.003) * 0.03;
      const lookAround = Math.sin(performance.now() * 0.0015) * 0.18;

      const rig: any = (this.avatar as any).rigParts;
      if (rig) {
        if (rig.torso) rig.torso.position.y = 1.1 + breath;
        if (rig.leftLeg) rig.leftLeg.rotation.x = 0;
        if (rig.rightLeg) rig.rightLeg.rotation.x = 0;

        if (this.isWaving) {
          // Wave hand
          const wave = Math.sin(performance.now() * 0.01) * 0.4;
          if (rig.rightArm) {
            rig.rightArm.rotation.x = -1.8;
            rig.rightArm.rotation.z = -0.4 + wave;
          }
          if (rig.leftArm) rig.leftArm.rotation.x = 0;
        } else {
          if (rig.leftArm) rig.leftArm.rotation.x = 0;
          if (rig.rightArm) {
            rig.rightArm.rotation.x = 0;
            rig.rightArm.rotation.z = 0;
          }
        }
        if (rig.head) rig.head.rotation.y = lookAround;
      }
    }

    this.avatar.update(delta, false);
  }
}

/**
 * Manages all active walkers on the planet:
 * - Lead player character following route moments
 * - Friends following player's breadcrumb trail
 * - 4-6 ambient city passers-by wandering between plazas
 */
export class WalkerSystem {
  public walkers: SphericalWalker[] = [];
  public obstacles: Obstacle[] = [];
  public playerWalker: SphericalWalker | null = null;
  public friendWalkers: SphericalWalker[] = [];
  public ambientWalkers: SphericalWalker[] = [];

  constructor() {}

  public addObstacle(posOnSphere: THREE.Vector3, radius: number = 0.1) {
    this.obstacles.push({
      dir: posOnSphere.clone().normalize(),
      radius,
    });
  }

  public setPlayer(walker: SphericalWalker) {
    this.playerWalker = walker;
    this.walkers.push(walker);
  }

  public addFriend(walker: SphericalWalker) {
    this.friendWalkers.push(walker);
    this.walkers.push(walker);
  }

  public addAmbient(walker: SphericalWalker) {
    this.ambientWalkers.push(walker);
    this.walkers.push(walker);
  }

  public update(delta: number, planetRadius: number) {
    // 1. Update Player
    if (this.playerWalker) {
      this.playerWalker.update(delta, planetRadius, this.obstacles, this.walkers);
    }

    // 2. Update Friends using Breadcrumb Trail (~0.7s delayed target)
    const trail = this.playerWalker?.breadcrumbs || [];
    const now = performance.now();

    this.friendWalkers.forEach((friend, idx) => {
      // Find historical position ~0.6s - 1.2s earlier
      const targetTime = now - (650 + idx * 350);
      let targetDir = this.playerWalker?.dir;

      for (let i = trail.length - 1; i >= 0; i--) {
        if (trail[i].time <= targetTime) {
          targetDir = trail[i].dir;
          break;
        }
      }

      friend.update(delta, planetRadius, this.obstacles, this.walkers, targetDir);
    });

    // 3. Update Ambient Walkers
    this.ambientWalkers.forEach((amb) => {
      amb.update(delta, planetRadius, this.obstacles, this.walkers);
    });
  }

  public notifyLandmarkLanded(landmarkDir: THREE.Vector3) {
    // Nearby walkers turn toward newly landed landmark and wave!
    for (const w of this.walkers) {
      if (w.dir.angleTo(landmarkDir) < 0.6) {
        w.isPaused = true;
        w.pauseTimer = 2.0;
        w.isWaving = true;
      }
    }
  }

  public clear() {
    this.walkers = [];
    this.obstacles = [];
    this.playerWalker = null;
    this.friendWalkers = [];
    this.ambientWalkers = [];
  }
}
