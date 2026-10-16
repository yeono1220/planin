import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PlanetSpec, DayGraph, Moment } from '../types';
import { calculateCentroid, projectGeoToSphere, alignToSurface, calculateJourneyBounds, GeoCoord } from './geoMath';
import { PlanetWorld } from './planet';
import { RouteVisualizer } from './routes';
import { AvatarInstance } from './characters';
import { LandmarkInstance } from './landmarks';
import { MomentMarker } from './moments';
import { WalkerSystem, SphericalWalker } from './walkerSystem';
import { MemoryTerrarium } from './terrarium';

export interface WorldCallbacks {
  onMomentSelect?: (moment: Moment) => void;
  onStarCollected?: (count: number) => void;
  onTourProgress?: (currentMomentIndex: number, totalMoments: number) => void;
}

export class MiniWorldEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;

  public planetWorld: PlanetWorld | null = null;
  public terrarium: MemoryTerrarium | null = null;
  public walkerSystem: WalkerSystem;
  public routes: RouteVisualizer[] = [];
  public avatars: AvatarInstance[] = [];
  public landmarks: LandmarkInstance[] = [];
  public markers: MomentMarker[] = [];

  public isTouring: boolean = false;
  public tourSpeed: number = 0.045;
  public tourProgress: number = 0; // 0 to 1
  public ambientProgress: number = 0; // Gentle stroll when tour is paused
  public collectedStars: number = 0;
  private momentPauseTimer: number = 0;
  private celebratedMomentsInLoop: Set<string> = new Set();

  private container: HTMLElement;
  private animFrameId: number = 0;
  private clock: THREE.Clock;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private callbacks: WorldCallbacks;

  private currentSpec: PlanetSpec | null = null;
  private activeDay: number = 1;
  private journeyBounds: { maxDistKm: number; maxAngularRad: number } = {
    maxDistKm: 1.5,
    maxAngularRad: (84 * Math.PI) / 180,
  };

  constructor(container: HTMLElement, callbacks: WorldCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // 1. Scene & Environment
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a); // Deep twilight diorama tone

    // 2. Camera Setup
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 36, 42);

    // 3. Renderer with PBR standards & ACES filmic
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 4. Studio Environment Reflection (RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 5. Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x1e293b, 1.2);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.0); // Warm sunlight
    keyLight.position.set(30, 45, 30);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 120;
    keyLight.shadow.camera.left = -35;
    keyLight.shadow.camera.right = 35;
    keyLight.shadow.camera.top = 35;
    keyLight.shadow.camera.bottom = -35;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x818cf8, 1.0); // Cool purple backlight
    rimLight.position.set(-30, 20, -30);
    this.scene.add(rimLight);

    // 6. Starfield Dome
    this.createStarfield();

    // 7. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 10, 0);
    this.controls.minDistance = 24;
    this.controls.maxDistance = 110;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.5;

    // 8. Walker System
    this.walkerSystem = new WalkerSystem();

    // Events
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);

    this.startLoop();
  }

  private createStarfield() {
    const count = 600;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 220 + Math.random() * 40;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Pastel twinkle stars
      const starCol = new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.4, 0.8 + Math.random() * 0.2);
      colors[i * 3] = starCol.r;
      colors[i * 3 + 1] = starCol.g;
      colors[i * 3 + 2] = starCol.b;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 1.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
    });
    const stars = new THREE.Points(geom, mat);
    this.scene.add(stars);
  }

  public async loadPlanet(spec: PlanetSpec, dayGraph?: DayGraph, photoMap?: Map<string, string>) {
    this.currentSpec = spec;
    this.clearWorld();

    const planetRadius = spec.radius || 24;
    const allCoords = spec.routes.flatMap((r) => r.points);
    const centroid = spec.center || calculateCentroid(allCoords);

    // Compute dynamic journey scale across the globe so the route fills the sphere
    const allJourneyPoints: GeoCoord[] = [
      ...allCoords,
      ...(dayGraph?.days.flatMap((d) => d.moments.map((m) => ({ lat: m.lat, lng: m.lng }))) || []),
    ];
    this.journeyBounds = calculateJourneyBounds(allJourneyPoints, centroid);
    const { maxDistKm, maxAngularRad } = this.journeyBounds;

    // 1. Build Low-Poly Planet with rich biomes & ambient props
    const territories = spec.territories.map((t) => {
      const dayMoments = dayGraph?.days.find((d) => d.dayNumber === t.day)?.moments || [];
      const momentCoords = dayMoments.map((m) => ({ lat: m.lat, lng: m.lng }));
      return {
        day: t.day,
        color: t.color,
        momentCoords,
      };
    });

    this.planetWorld = new PlanetWorld(
      planetRadius,
      centroid,
      territories,
      spec.theme.palette,
      maxAngularRad,
      maxDistKm
    );
    this.scene.add(this.planetWorld.group);

    // 2. Build Routes with dynamic spherical scale
    for (const routeSpec of spec.routes) {
      const vis = new RouteVisualizer(
        routeSpec,
        centroid,
        planetRadius,
        spec.theme.palette[1],
        maxAngularRad,
        maxDistKm
      );
      this.routes.push(vis);
      this.scene.add(vis.group);
    }

    // 3. Build Moment Markers
    if (dayGraph) {
      for (const day of dayGraph.days) {
        for (const moment of day.moments) {
          const surfacePos = projectGeoToSphere(
            { lat: moment.lat, lng: moment.lng },
            centroid,
            planetRadius + 0.1,
            maxAngularRad,
            maxDistKm
          );
          const photoUrl = moment.photoIds[0] ? photoMap?.get(moment.photoIds[0]) : undefined;
          const marker = new MomentMarker(moment, surfacePos, photoUrl);
          this.markers.push(marker);
          this.scene.add(marker.group);
        }
      }
    }

    // 4. Build Landmarks (tucked to the side of the path and facing the moment marker)
    for (const lmSpec of spec.landmarks) {
      const linkedMoment = dayGraph?.days.flatMap((d) => d.moments).find((m) => m.id === lmSpec.momentId);
      const coord = linkedMoment ? { lat: linkedMoment.lat, lng: linkedMoment.lng } : centroid;
      const basePos = projectGeoToSphere(coord, centroid, planetRadius, maxAngularRad, maxDistKm);
      const normal = basePos.clone().normalize();
      // Orthogonal lateral offset along the sphere so it frames the moment without blocking the road
      const arbitrary = Math.abs(normal.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const offsetDir = arbitrary.projectOnPlane(normal).normalize();
      const backdropPos = basePos.clone().add(offsetDir.multiplyScalar(3.9)).normalize().multiplyScalar(planetRadius);
      const lmInstance = new LandmarkInstance(lmSpec, backdropPos, basePos);
      this.landmarks.push(lmInstance);
      this.scene.add(lmInstance.root);
    }

    // 5. Build Characters (Me + Friends)
    for (const charSpec of spec.characters) {
      const avatar = new AvatarInstance(charSpec);
      await avatar.load();
      this.avatars.push(avatar);
      this.scene.add(avatar.root);
    }

    // Place avatars at start of active day's route
    this.updateAvatarPositions(0);
    // Initialize in a beautiful panoramic isometric overview
    this.setCameraPreset('isometric');
  }

  private clearWorld() {
    if (this.planetWorld) {
      this.scene.remove(this.planetWorld.group);
      this.planetWorld.dispose();
      this.planetWorld = null;
    }
    this.routes.forEach((r) => this.scene.remove(r.group));
    this.routes = [];
    this.avatars.forEach((a) => this.scene.remove(a.root));
    this.avatars = [];
    this.landmarks.forEach((l) => this.scene.remove(l.root));
    this.landmarks = [];
    this.markers.forEach((m) => this.scene.remove(m.group));
    this.markers = [];
  }

  public setActiveDay(dayNumber: number) {
    this.activeDay = dayNumber;
    this.tourProgress = 0;
    this.ambientProgress = 0;
    this.momentPauseTimer = 0;
    this.celebratedMomentsInLoop.clear();
    this.updateAvatarPositions(0);
  }

  public toggleTour(play?: boolean) {
    this.isTouring = play !== undefined ? play : !this.isTouring;
    this.controls.enabled = !this.isTouring;
    this.controls.autoRotate = false;
    if (!this.isTouring) {
      // Keep ambient walk synced so avatars continue strolling smoothly without skipping!
      this.ambientProgress = this.tourProgress;
      // Seamlessly frame the planet diorama with current character in view
      const leadAvatar = this.avatars.find((a) => a.spec.isMe) || this.avatars[0];
      if (leadAvatar) {
        const charPos = leadAvatar.root.position;
        const normal = charPos.clone().normalize();
        const overviewPos = charPos.clone()
          .addScaledVector(normal, 22.0)
          .add(new THREE.Vector3(12, 14, 12).projectOnPlane(normal).normalize().multiplyScalar(14.0));
        this.camera.position.copy(overviewPos);
        this.controls.target.copy(charPos.clone().addScaledVector(normal, 1.5));
      } else {
        this.camera.position.set(30, 36, 32);
        this.controls.target.set(0, 4, 0);
      }
      this.controls.update();
    }
  }

  private updateAvatarPositions(progress: number) {
    const activeRoute = this.routes.find((r) => r.group.name === `Route_Day_${this.activeDay}`) || this.routes[0];
    if (!activeRoute || !activeRoute.curve) return;

    const leadAvatar = this.avatars.find((a) => a.spec.isMe) || this.avatars[0];
    if (!leadAvatar) return;

    const leadInfo = activeRoute.getPositionAt(progress);
    if (!leadInfo) return;

    alignToSurface(leadAvatar.root, leadInfo.position, leadInfo.tangent);

    // Friends walk beside with slight offset & delay
    let friendIndex = 0;
    for (const avatar of this.avatars) {
      if (avatar === leadAvatar) continue;
      friendIndex++;
      const friendProgress = (progress - 0.025 * friendIndex + 1.0) % 1.0;
      const friendInfo = activeRoute.getPositionAt(friendProgress);
      if (friendInfo) {
        // Offset laterally along binormal
        const normal = friendInfo.position.clone().normalize();
        const binormal = new THREE.Vector3().crossVectors(normal, friendInfo.tangent).normalize();
        const sideOffset = (friendIndex % 2 === 1 ? 0.8 : -0.8) * (0.8 + friendIndex * 0.2);
        const offsetPos = friendInfo.position.clone().add(binormal.multiplyScalar(sideOffset));
        alignToSurface(avatar.root, offsetPos, friendInfo.tangent);
      }
    }
  }

  private onPointerDown = (event: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    for (const hit of intersects) {
      let cur: THREE.Object3D | null = hit.object;
      while (cur && cur !== this.scene) {
        if (cur.userData?.isMomentMarker) {
          const marker = this.markers.find((m) => m.moment.id === cur?.userData?.momentId);
          if (marker) {
            this.callbacks.onMomentSelect?.(marker.moment);
            if (marker.collectStar()) {
              this.collectedStars++;
              this.callbacks.onStarCollected?.(this.collectedStars);
            }
            this.momentPauseTimer = 2.4;
            this.avatars.forEach((a) => a.triggerHappyMoment());
            return;
          }
        }
        cur = cur.parent;
      }
    }
  };

  private startLoop() {
    const tick = () => {
      this.animFrameId = requestAnimationFrame(tick);
      const delta = Math.min(this.clock.getDelta(), 0.08);

      // 1. Update Planet & Clouds
      this.planetWorld?.update(delta);

      // 2. Update Landmarks
      this.landmarks.forEach((l) => l.update(delta));

      // 3. Update Markers
      this.markers.forEach((m) => m.update(delta, this.camera));

      // 4. Update Characters & Camera
      if (this.isTouring) {
        const leadAvatar = this.avatars.find((a) => a.spec.isMe) || this.avatars[0];

        if (this.momentPauseTimer > 0) {
          // "We Did It!" Moment Arrival Pause:
          // Characters STOP walking, turn to face the camera directly, smile wide, and jump!
          this.momentPauseTimer = Math.max(0, this.momentPauseTimer - delta);

          this.avatars.forEach((a) => {
            const aPos = a.root.position.clone();
            const aNorm = aPos.clone().normalize();
            const toCam = this.camera.position.clone().sub(aPos).projectOnPlane(aNorm);
            if (toCam.lengthSq() > 0.001) {
              alignToSurface(a.root, aPos, toCam.normalize());
            }
            a.update(delta, false);
          });

          if (leadAvatar) {
            const charPos = leadAvatar.root.position;
            const normal = charPos.clone().normalize();
            const activeRoute =
              this.routes.find((r) => r.group.name === `Route_Day_${this.activeDay}`) || this.routes[0];
            const leadInfo = activeRoute?.getPositionAt(this.tourProgress);
            const forward = (leadInfo?.tangent || new THREE.Vector3(0, 0, 1))
              .clone()
              .projectOnPlane(normal)
              .normalize();
            const side = new THREE.Vector3().crossVectors(normal, forward).normalize();

            // Close-up celebratory camera framing the cheering characters looking at the viewer
            const momentCamPos = charPos
              .clone()
              .addScaledVector(normal, 7.2)
              .addScaledVector(forward, -8.5)
              .addScaledVector(side, 1.4);
            this.camera.position.lerp(momentCamPos, 0.12);
            this.camera.up.lerp(normal, 0.12);
            const lookTarget = charPos.clone().addScaledVector(normal, 1.8);
            this.camera.lookAt(lookTarget);
            this.controls.target.copy(lookTarget);
          }
        } else {
          // Normal walking along the great-circle route
          const prevProgress = this.tourProgress;
          this.tourProgress = (this.tourProgress + delta * this.tourSpeed) % 1.0;
          if (this.tourProgress < prevProgress) {
            // Completed a full loop around the day's route: reset moment celebrations for the next lap!
            this.celebratedMomentsInLoop.clear();
          }

          this.updateAvatarPositions(this.tourProgress);
          this.avatars.forEach((a) => a.update(delta, true));

          if (leadAvatar) {
            const charPos = leadAvatar.root.position;
            const normal = charPos.clone().normalize();
            const activeRoute =
              this.routes.find((r) => r.group.name === `Route_Day_${this.activeDay}`) || this.routes[0];
            const leadInfo = activeRoute?.getPositionAt(this.tourProgress);
            const forward = (leadInfo?.tangent || new THREE.Vector3(0, 0, 1))
              .clone()
              .projectOnPlane(normal)
              .normalize();
            const side = new THREE.Vector3().crossVectors(normal, forward).normalize();

            // Camera placement: 12.5 units above surface normal, 13.5 units behind along path
            const camTargetPos = charPos
              .clone()
              .addScaledVector(normal, 12.5)
              .addScaledVector(forward, -13.5)
              .addScaledVector(side, 1.2);

            this.camera.position.lerp(camTargetPos, 0.08);
            this.camera.up.lerp(normal, 0.08);

            // Look ahead along the route ahead of the avatar
            const lookTarget = charPos
              .clone()
              .addScaledVector(normal, 2.5)
              .addScaledVector(forward, 4.2);

            this.camera.lookAt(lookTarget);
            this.controls.target.copy(lookTarget);

            // Check if arriving at any moment marker to trigger "We Did It!" Stop + Smile + Jump!
            for (let idx = 0; idx < this.markers.length; idx++) {
              const m = this.markers[idx];
              if (m.position.distanceTo(charPos) < 2.5) {
                this.callbacks.onTourProgress?.(idx + 1, this.markers.length);
                if (m.collectStar()) {
                  this.collectedStars++;
                  this.callbacks.onStarCollected?.(this.collectedStars);
                }
                if (!this.celebratedMomentsInLoop.has(m.moment.id)) {
                  this.celebratedMomentsInLoop.add(m.moment.id);
                  this.momentPauseTimer = 2.4;
                  this.avatars.forEach((a) => a.triggerHappyMoment());
                  break;
                }
              }
            }
          }
        }
      } else {
        // Free Orbit Mode: pause if celebrating a clicked marker, otherwise gentle ambient stroll
        if (this.momentPauseTimer > 0) {
          this.momentPauseTimer = Math.max(0, this.momentPauseTimer - delta);
          this.avatars.forEach((a) => {
            const aPos = a.root.position.clone();
            const aNorm = aPos.clone().normalize();
            const toCam = this.camera.position.clone().sub(aPos).projectOnPlane(aNorm);
            if (toCam.lengthSq() > 0.001) {
              alignToSurface(a.root, aPos, toCam.normalize());
            }
            a.update(delta, false);
          });
        } else {
          this.ambientProgress = (this.ambientProgress + delta * 0.015) % 1.0;
          this.updateAvatarPositions(this.ambientProgress);
          this.avatars.forEach((a) => a.update(delta, true));
        }
        this.controls.update();
      }

      this.renderer.render(this.scene, this.camera);
    };

    tick();
  }

  private onResize = () => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public setCameraPreset(preset: 'top' | 'isometric' | 'close' | 'cinematic') {
    this.isTouring = false;
    this.controls.enabled = true;
    this.controls.autoRotate = false;

    const lead = this.avatars.find((a) => a.spec.isMe) || this.avatars[0];
    const charPos = lead ? lead.root.position : new THREE.Vector3(0, 24, 0);
    const normal = charPos.clone().normalize();

    switch (preset) {
      case 'top': {
        // High polar diorama directly looking down on the active region
        const topPos = normal.clone().multiplyScalar(58);
        this.camera.position.copy(topPos);
        this.controls.target.copy(charPos.clone().multiplyScalar(0.2));
        break;
      }
      case 'isometric': {
        // Classic elevated diorama framing the whole vibrant globe
        this.camera.position.set(30, 36, 32);
        this.controls.target.set(0, 4, 0);
        break;
      }
      case 'close': {
        // Forward third-person street follow view:
        // Positioned behind character facing forward with normal as up
        const activeRoute = this.routes.find((r) => r.group.name === `Route_Day_${this.activeDay}`) || this.routes[0];
        const leadInfo = activeRoute?.getPositionAt(this.ambientProgress || 0);
        const forward = (leadInfo?.tangent || new THREE.Vector3(0, 0, 1)).clone().projectOnPlane(normal).normalize();
        const side = new THREE.Vector3().crossVectors(normal, forward).normalize();

        const closePos = charPos.clone()
          .addScaledVector(normal, 12.0)
          .addScaledVector(forward, -13.0)
          .addScaledVector(side, 1.2);
        const lookTarget = charPos.clone()
          .addScaledVector(normal, 2.5)
          .addScaledVector(forward, 4.0);

        this.camera.up.copy(normal);
        this.camera.position.copy(closePos);
        this.camera.lookAt(lookTarget);
        this.controls.target.copy(lookTarget);
        break;
      }
      case 'cinematic': {
        // Scenic orbital angle with slow auto-rotation
        this.camera.position.set(-32, 28, 28);
        this.controls.target.set(0, 4, 0);
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.8;
        break;
      }
    }
    this.controls.update();
  }

  public dispose() {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.controls.dispose();
    this.clearWorld();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
