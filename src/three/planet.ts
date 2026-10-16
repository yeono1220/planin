import * as THREE from 'three';
import { projectGeoToSphere, GeoCoord } from './geoMath';

export interface TerritoryConfig {
  day: number;
  color: string;
  momentCoords: GeoCoord[];
}

export class PlanetWorld {
  public group: THREE.Group;
  public planetMesh: THREE.Mesh;
  public atmosphereMesh: THREE.Mesh;
  public cloudsGroup: THREE.Group;
  public radius: number;

  private clouds: Array<{ mesh: THREE.Group; orbitSpeed: number; tilt: number }>;

  constructor(
    radius: number = 24,
    centroid: GeoCoord,
    territories: TerritoryConfig[],
    themeColors: string[] = ['#F4C077', '#84C7B8', '#4A8FE7'],
    maxAngularRad: number = (84 * Math.PI) / 180,
    maxGeoDistanceKm: number = 2.0
  ) {
    this.radius = radius;
    this.group = new THREE.Group();
    this.group.name = 'PlanetGroup';
    this.clouds = [];

    // 1. Create Low-Poly Planet Geometry (Icosahedron detail 4, non-indexed)
    const baseGeom = new THREE.IcosahedronGeometry(radius, 4).toNonIndexed();
    const posAttr = baseGeom.getAttribute('position');
    const vertexCount = posAttr.count;

    // Convert moment coords to 3D spherical positions for territory face painting
    const territoryCenters: Array<{ pos: THREE.Vector3; color: THREE.Color }> = [];
    territories.forEach((t) => {
      const col = new THREE.Color(t.color);
      t.momentCoords.forEach((coord) => {
        const p3d = projectGeoToSphere(coord, centroid, radius, maxAngularRad, maxGeoDistanceKm);
        territoryCenters.push({ pos: p3d, color: col });
      });
    });

    const oceanColor = new THREE.Color('#38BDF8').lerp(new THREE.Color('#0284C7'), 0.35);
    const sandColor = new THREE.Color('#FED7AA');
    const lawnColor = new THREE.Color('#86EFAC');
    const autumnGrassColor = new THREE.Color('#FDE047');
    const cobblestoneColor = new THREE.Color('#E2E8F0');

    const colors = new Float32Array(vertexCount * 3);
    const pos = new THREE.Vector3();

    // Noise displacement per vertex & triangle coloring
    for (let i = 0; i < vertexCount; i += 3) {
      // Calculate face center
      const v0 = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i + 1);
      const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i + 2);
      const faceCenter = new THREE.Vector3().add(v0).add(v1).add(v2).divideScalar(3);

      // Simple 3D pseudo-noise hash
      const nx = Math.sin(faceCenter.x * 0.28) * Math.cos(faceCenter.y * 0.28);
      const ny = Math.sin(faceCenter.y * 0.36) * Math.cos(faceCenter.z * 0.36);
      const noise = (nx + ny) * 0.5;

      // Check distance to nearest moment territory
      let minDistance = Infinity;
      let matchedColor: THREE.Color | null = null;

      for (const tc of territoryCenters) {
        const d = faceCenter.distanceTo(tc.pos);
        if (d < minDistance) {
          minDistance = d;
          matchedColor = tc.color;
        }
      }

      // Territory coloring with wide reach (radius ~ 20 units across sphere)
      let faceColor: THREE.Color;
      const territoryRadius = 20.0 + noise * 4.5;

      if (matchedColor && minDistance < territoryRadius) {
        // Populated territory face
        const blend = minDistance / territoryRadius;
        if (blend < 0.45) {
          faceColor = matchedColor.clone().lerp(cobblestoneColor, blend * 0.5);
        } else {
          faceColor = matchedColor.clone().lerp(lawnColor, (blend - 0.45) * 1.4);
        }
      } else {
        // Surrounding lively Seoul biomes (parks, hills, autumn lawns, water ribbon)
        const heightFromEquator = faceCenter.y / radius;
        if (heightFromEquator > 0.4) {
          // Northern park plateau
          faceColor = noise > 0.1 ? lawnColor : autumnGrassColor;
        } else if (heightFromEquator > -0.2) {
          // Mid-latitude town and streams
          faceColor = noise > 0.2 ? cobblestoneColor : (noise < -0.25 ? oceanColor : lawnColor);
        } else if (heightFromEquator > -0.6) {
          // Southern coastal fringe
          faceColor = sandColor.clone().lerp(oceanColor, (noise + 0.5) * 0.4);
        } else {
          // South polar sea
          faceColor = oceanColor.clone().lerp(new THREE.Color('#0369A1'), 0.3);
        }
      }

      for (let j = 0; j < 3; j++) {
        const idx = i + j;
        pos.fromBufferAttribute(posAttr, idx);
        const dir = pos.clone().normalize();
        const vNoise = (Math.sin(dir.x * 5.0) * Math.cos(dir.y * 5.0) + Math.sin(dir.z * 5.0) * 0.5) * 0.02;
        const dispFactor = minDistance < territoryRadius ? 1.0 + vNoise : 0.995 + vNoise * 0.5;
        pos.multiplyScalar(dispFactor);
        posAttr.setXYZ(idx, pos.x, pos.y, pos.z);

        colors[idx * 3] = faceColor.r;
        colors[idx * 3 + 1] = faceColor.g;
        colors[idx * 3 + 2] = faceColor.b;
      }
    }

    baseGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    baseGeom.computeVertexNormals();

    const planetMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.85,
      metalness: 0.08,
    });

    this.planetMesh = new THREE.Mesh(baseGeom, planetMat);
    this.planetMesh.castShadow = true;
    this.planetMesh.receiveShadow = true;
    this.group.add(this.planetMesh);

    // 2. Add Ambient Seoul Props (Ginkgo Trees, Maple Trees, Stone Walls, Tiny Cottages)
    this.addAmbientProps(radius, territoryCenters);

    // 3. Subtle Atmosphere Glow
    const atmosGeom = new THREE.SphereGeometry(radius * 1.05, 32, 32);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    this.atmosphereMesh = new THREE.Mesh(atmosGeom, atmosMat);
    this.group.add(this.atmosphereMesh);

    // 4. Orbiting Low-Poly Puffy Clouds
    this.cloudsGroup = new THREE.Group();
    this.cloudsGroup.name = 'CloudsGroup';
    this.group.add(this.cloudsGroup);
    this.createClouds(radius * 1.25);
  }

  private addAmbientProps(radius: number, territoryCenters: Array<{ pos: THREE.Vector3; color: THREE.Color }>) {
    const propsGroup = new THREE.Group();
    propsGroup.name = 'AmbientSeoulProps';

    // Materials
    const ginkgoMat = new THREE.MeshStandardMaterial({ color: 0xFACC15, roughness: 0.8, flatShading: true }); // Bright Ginkgo
    const mapleMat = new THREE.MeshStandardMaterial({ color: 0xEF4444, roughness: 0.8, flatShading: true }); // Crimson Maple
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85, flatShading: true }); // Korean Pine
    const cherryMat = new THREE.MeshStandardMaterial({ color: 0xF9A8D4, roughness: 0.8, flatShading: true }); // Cherry blossom
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x582D1D, roughness: 0.9 });
    const stoneWallMat = new THREE.MeshStandardMaterial({ color: 0x78716C, roughness: 0.9, flatShading: true });
    const hanokRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, flatShading: true }); // Korean tiled roof
    const woodBeamMat = new THREE.MeshStandardMaterial({ color: 0x7C2D12, roughness: 0.8 });
    const paperWallMat = new THREE.MeshStandardMaterial({ color: 0xFEF3C7, roughness: 0.7 }); // Hanji warm paper
    const pochaRoofMat = new THREE.MeshStandardMaterial({ color: 0xEA580C, roughness: 0.6, flatShading: true }); // Orange pocha tarp
    const benchWoodMat = new THREE.MeshStandardMaterial({ color: 0xB45309, roughness: 0.8 });
    const lanternBulbMat = new THREE.MeshBasicMaterial({ color: 0xFEF08A });

    // Geometries
    const foliageGeom = new THREE.DodecahedronGeometry(0.48, 1);
    const pineTierGeom = new THREE.ConeGeometry(0.55, 0.45, 6);
    const trunkGeom = new THREE.CylinderGeometry(0.07, 0.1, 0.7, 5);

    // Scatter 72 charming miniature props with organic density
    for (let i = 0; i < 72; i++) {
      // Stratified spherical distribution
      const u = Math.sin(i * 127.1 + 0.3) * 0.5 + 0.5;
      const v = Math.cos(i * 311.7 + 0.7) * 0.5 + 0.5;
      const theta = Math.acos(2.0 * u - 1.0);
      const phi = v * Math.PI * 2.0;

      const x = radius * Math.sin(theta) * Math.cos(phi);
      const y = radius * Math.cos(theta);
      const z = radius * Math.sin(theta) * Math.sin(phi);
      const pos = new THREE.Vector3(x, y, z);
      const normal = pos.clone().normalize();

      // Don't spawn props directly on top of primary moment markers (keep ~2.4 units clearance)
      let tooCloseToMoment = false;
      for (const tc of territoryCenters) {
        if (pos.distanceTo(tc.pos) < 2.4) {
          tooCloseToMoment = true;
          break;
        }
      }
      if (tooCloseToMoment) continue;

      const propObj = new THREE.Group();
      const variant = i % 8;

      if (variant === 0) {
        // Multi-tiered Korean Pine (소나무)
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        trunk.position.y = 0.28;
        trunk.rotation.z = 0.12;
        trunk.castShadow = true;
        propObj.add(trunk);

        for (let t = 0; t < 3; t++) {
          const tier = new THREE.Mesh(pineTierGeom, pineMat);
          tier.position.y = 0.5 + t * 0.32;
          const s = 1.0 - t * 0.22;
          tier.scale.set(s, s * 0.85, s);
          tier.castShadow = true;
          propObj.add(tier);
        }
      } else if (variant === 1) {
        // Golden Ginkgo Tree (은행나무 - layered)
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        trunk.position.y = 0.35;
        trunk.castShadow = true;
        propObj.add(trunk);

        const lower = new THREE.Mesh(foliageGeom, ginkgoMat);
        lower.position.y = 0.75;
        lower.scale.set(1.2, 0.9, 1.2);
        lower.castShadow = true;
        propObj.add(lower);

        const upper = new THREE.Mesh(foliageGeom, ginkgoMat);
        upper.position.y = 1.05;
        upper.scale.set(0.85, 0.85, 0.85);
        upper.castShadow = true;
        propObj.add(upper);
      } else if (variant === 2) {
        // Soft Pink Cherry Blossom Tree (벚나무)
        const trunk = new THREE.Mesh(trunkGeom, trunkMat);
        trunk.position.y = 0.32;
        trunk.castShadow = true;
        propObj.add(trunk);

        const crown = new THREE.Mesh(foliageGeom, cherryMat);
        crown.position.y = 0.85;
        crown.scale.set(1.25, 1.0, 1.25);
        crown.castShadow = true;
        propObj.add(crown);
      } else if (variant === 3) {
        // Traditional Hanok Cottage (한옥 기와집)
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.65, 0.9), paperWallMat);
        body.position.y = 0.32;
        body.castShadow = true;
        propObj.add(body);

        // Wooden corner posts
        [-0.55, 0.55].forEach((px) => {
          [-0.4, 0.4].forEach((pz) => {
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.68, 5), woodBeamMat);
            pillar.position.set(px, 0.34, pz);
            propObj.add(pillar);
          });
        });

        // Curved hipped tiled roof
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.42, 4), hanokRoofMat);
        roof.position.y = 0.84;
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(1.4, 1.0, 1.1);
        roof.castShadow = true;
        propObj.add(roof);
      } else if (variant === 4) {
        // Street Pocha Food Tent (주황색 포장마차)
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.45, 0.65), woodBeamMat);
        frame.position.y = 0.22;
        propObj.add(frame);

        const tarp = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 4), pochaRoofMat);
        tarp.position.y = 0.68;
        tarp.rotation.y = Math.PI / 4;
        tarp.scale.set(1.3, 0.8, 1.0);
        tarp.castShadow = true;
        propObj.add(tarp);

        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), lanternBulbMat);
        lantern.position.set(0.35, 0.5, 0.25);
        propObj.add(lantern);
      } else if (variant === 5) {
        // Korean Stone Wall Section (돌담길)
        const wall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.42, 0.22), stoneWallMat);
        wall.position.y = 0.21;
        wall.castShadow = true;
        propObj.add(wall);

        const wallCap = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.08, 0.26), hanokRoofMat);
        wallCap.position.y = 0.44;
        propObj.add(wallCap);
      } else if (variant === 6) {
        // Park Bench with Warm Lantern Post
        const bench = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3), benchWoodMat);
        bench.position.y = 0.12;
        bench.castShadow = true;
        propObj.add(bench);

        const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 5), woodBeamMat);
        lampPost.position.set(0.5, 0.35, 0);
        propObj.add(lampPost);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), lanternBulbMat);
        bulb.position.set(0.5, 0.72, 0);
        propObj.add(bulb);
      } else {
        // Stepping Stone Garden & Wildflowers (징검다리 화단)
        for (let s = 0; s < 3; s++) {
          const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 6), stoneWallMat);
          stone.position.set((s - 1) * 0.35, 0.04, (s % 2 === 0 ? 0.08 : -0.08));
          propObj.add(stone);
        }
        const bush = new THREE.Mesh(foliageGeom, cherryMat);
        bush.position.set(0.35, 0.16, 0.25);
        bush.scale.set(0.4, 0.4, 0.4);
        propObj.add(bush);
      }

      // Orient strictly along surface normal
      const up = new THREE.Vector3(0, 1, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(up, normal);
      propObj.setRotationFromQuaternion(q);
      propObj.position.copy(pos);

      propsGroup.add(propObj);
    }

    this.group.add(propsGroup);
  }

  private createClouds(cloudRadius: number) {
    const cloudGeom = new THREE.DodecahedronGeometry(1.4, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      flatShading: true,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.88,
    });

    const cloudConfigs = [
      { r: cloudRadius, speed: 0.003, tilt: 0.2, puffs: 4, scale: 1.1 },
      { r: cloudRadius * 1.04, speed: -0.0025, tilt: -0.3, puffs: 5, scale: 0.9 },
      { r: cloudRadius * 0.98, speed: 0.004, tilt: 0.5, puffs: 4, scale: 1.2 },
      { r: cloudRadius * 1.02, speed: -0.0035, tilt: 0.1, puffs: 3, scale: 0.8 },
    ];

    cloudConfigs.forEach((cfg, idx) => {
      const cloudObj = new THREE.Group();
      // Assemble composite fluffy cloud from 3-5 spheres
      for (let p = 0; p < cfg.puffs; p++) {
        const puff = new THREE.Mesh(cloudGeom, cloudMat);
        puff.position.set(
          (p - (cfg.puffs - 1) / 2) * 1.2,
          Math.sin(p * 1.2) * 0.4,
          Math.cos(p * 0.9) * 0.4
        );
        const s = (0.7 + Math.random() * 0.5) * cfg.scale;
        puff.scale.set(s, s * 0.75, s);
        puff.castShadow = true;
        cloudObj.add(puff);
      }

      // Position along orbit
      const angle = (idx / cloudConfigs.length) * Math.PI * 2;
      cloudObj.position.set(
        Math.cos(angle) * cfg.r,
        Math.sin(cfg.tilt) * (cfg.r * 0.5),
        Math.sin(angle) * cfg.r
      );
      cloudObj.lookAt(0, 0, 0);

      this.cloudsGroup.add(cloudObj);
      this.clouds.push({ mesh: cloudObj, orbitSpeed: cfg.speed, tilt: cfg.tilt });
    });
  }

  public update(delta: number) {
    // Smooth orbit rotation for clouds
    for (const c of this.clouds) {
      c.mesh.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), c.orbitSpeed);
      c.mesh.lookAt(0, 0, 0);
    }
  }

  public dispose() {
    this.planetMesh.geometry.dispose();
    (this.planetMesh.material as THREE.Material).dispose();
    this.atmosphereMesh.geometry.dispose();
    (this.atmosphereMesh.material as THREE.Material).dispose();
  }
}
