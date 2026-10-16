import * as THREE from 'three';
import { PlaceArchetype, ArchetypeParams } from '../types';

/**
 * Creates bevelled box geometry with soft edges
 */
export function createBevelBox(
  w: number,
  h: number,
  d: number,
  bevel: number = 0.04
): THREE.BufferGeometry {
  const geom = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
  return geom;
}

/**
 * Material palette helpers with authentic PBR properties (roughness 0.6-0.9)
 */
export class ArchetypeMaterials {
  public static stone(colorHex: string = '#78716C'): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });
  }

  public static water(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#38BDF8'),
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
    });
  }

  public static wood(colorHex: string = '#854D0E'): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: 0.75,
      metalness: 0.02,
    });
  }

  public static foliage(colorHex: string = '#15803D'): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: 0.88,
      metalness: 0.0,
      flatShading: true,
    });
  }

  public static ceramicRoof(colorHex: string = '#1E293B'): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: 0.65,
      metalness: 0.15,
      flatShading: true,
    });
  }

  public static glass(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#E0F2FE'),
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.65,
    });
  }

  public static contactShadow(): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
  }
}

/**
 * Procedural Architetural & Landscape Generators
 * Proportions calibrated: 1 unit = character height (~1.8m)
 * Trees: 2.5 - 3.5 units
 * 1 building floor: 1.5 - 2.0 units
 * Lamps: 2.0 - 2.2 units
 */
export class ArchetypeBuilders {
  /**
   * Builds a spherical-conforming terrain foundation skirt & organic border rim
   * so landmarks blend seamlessly into the curved planet surface with ZERO gap!
   */
  public static buildSphericalTerrainSkirt(
    baseRadius: number = 3.4,
    planetRadius: number = 24,
    grassHex: string = '#86EFAC',
    stoneHex: string = '#94A3B8'
  ): THREE.Group {
    const skirtGroup = new THREE.Group();
    skirtGroup.name = 'SphericalTerrainBlendSkirt';

    // 1. Spherical-curved earth/grass mound that dips down at the perimeter
    // following deltaY = -(r^2) / (2 * R) - 0.32 so outer edges sink into the globe
    const radialSegments = 28;
    const rings = 5;
    const geom = new THREE.CylinderGeometry(baseRadius * 0.78, baseRadius * 1.18, 0.85, radialSegments, rings);
    const pos = geom.getAttribute('position');
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const r = Math.sqrt(v.x * v.x + v.z * v.z);
      const sphereDrop = (r * r) / (2 * planetRadius);
      // Organic gentle undulation along perimeter
      const angle = Math.atan2(v.z, v.x);
      const wave = Math.sin(angle * 5) * 0.05 + Math.cos(angle * 3) * 0.04;
      if (v.y > 0) {
        // Top of the foundation tapers smoothly toward the sphere surface
        const edgeFactor = Math.max(0, (r - baseRadius * 0.65) / (baseRadius * 0.55));
        v.y = 0.06 - edgeFactor * (sphereDrop + 0.14) + wave * 0.4;
      } else {
        // Bottom extends deep below the curved sphere surface to prevent any gap
        v.y = -0.58 - sphereDrop;
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geom.computeVertexNormals();

    const moundMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(grassHex).lerp(new THREE.Color('#4ADE80'), 0.35),
      roughness: 0.9,
      flatShading: true,
    });
    const moundMesh = new THREE.Mesh(geom, moundMat);
    moundMesh.receiveShadow = true;
    skirtGroup.add(moundMesh);

    // 2. Natural stone & moss border ring ("마감선") feathering the transition
    const rockGeom = new THREE.DodecahedronGeometry(0.28, 0);
    const bushGeom = new THREE.DodecahedronGeometry(0.32, 1);
    const rockMat = ArchetypeMaterials.stone(stoneHex);
    const mossMat = ArchetypeMaterials.foliage('#22C55E');
    const autumnBushMat = ArchetypeMaterials.foliage('#F59E0B');

    const borderCount = 18;
    for (let i = 0; i < borderCount; i++) {
      const a = (i / borderCount) * Math.PI * 2 + (i % 2) * 0.08;
      const dist = baseRadius * (0.92 + Math.sin(i * 3.7) * 0.08);
      const bx = Math.cos(a) * dist;
      const bz = Math.sin(a) * dist;
      const dropY = -(dist * dist) / (2 * planetRadius) - 0.04;

      // Alternate mossy stones and low shrubs along the seam
      if (i % 3 !== 0) {
        const rock = new THREE.Mesh(rockGeom, rockMat);
        rock.position.set(bx, dropY + 0.06, bz);
        rock.scale.set(1.2 + (i % 2) * 0.4, 0.65, 1.0 + (i % 3) * 0.25);
        rock.rotation.set(i * 0.3, a, i * 0.2);
        rock.castShadow = true;
        rock.receiveShadow = true;
        skirtGroup.add(rock);
      } else {
        const bush = new THREE.Mesh(bushGeom, i % 6 === 0 ? autumnBushMat : mossMat);
        bush.position.set(bx, dropY + 0.14, bz);
        bush.scale.set(1.15, 0.78, 1.15);
        bush.castShadow = true;
        skirtGroup.add(bush);
      }
    }

    return skirtGroup;
  }

  /**
   * 1. STREAM & BEODEUL BRIDGE ARCHETYPE (Cheonggyecheon Beodeul Bridge / 청계천 버들다리)
   * Organic stream bed sculpted into curved mossy earth banks (no raw rectangular blocks!),
   * shimmering animated water, picturesque arched wooden & stone Beodeul Bridge (버들다리)
   * with lanterns, natural river boulders, stepping stones, reeds, and weeping willow trees.
   */
  public static buildStream(params: ArchetypeParams): THREE.Group {
    const root = new THREE.Group();
    root.name = 'Archetype_Stream';

    // Compact square-proportioned diorama footprint (~5.4 x 5.4)
    const len = 5.4;
    const channelW = 2.1;

    // A. Organic Sculpted Grassy & Mossy Riverbanks (curved cylinders & mounds, NOT boxy slabs)
    const bankLeafMat = ArchetypeMaterials.foliage('#4ADE80');
    const pebbleMat = ArchetypeMaterials.stone('#94A3B8');
    const darkStoneMat = ArchetypeMaterials.stone('#64748B');

    [-1, 1].forEach((side) => {
      const bankGroup = new THREE.Group();
      bankGroup.position.set(side * (channelW * 0.5 + 1.15), 0, 0);

      // Soft rounded earth embankment
      const bankMoundGeom = new THREE.CapsuleGeometry(0.95, len * 0.58, 8, 14);
      bankMoundGeom.rotateX(Math.PI / 2);
      const bankMound = new THREE.Mesh(bankMoundGeom, bankLeafMat);
      bankMound.scale.set(1.25, 0.32, 1.0);
      bankMound.position.y = 0.06;
      bankMound.receiveShadow = true;
      bankGroup.add(bankMound);

      // Cobblestone riverside promenade strip
      const walkGeom = new THREE.CapsuleGeometry(0.42, len * 0.55, 6, 12);
      walkGeom.rotateX(Math.PI / 2);
      const walkMesh = new THREE.Mesh(walkGeom, pebbleMat);
      walkMesh.scale.set(1.0, 0.15, 1.0);
      walkMesh.position.set(-side * 0.35, 0.24, 0);
      walkMesh.receiveShadow = true;
      bankGroup.add(walkMesh);

      root.add(bankGroup);
    });

    // B. Natural River Boulders lining the stream banks (replaces harsh straight walls)
    const boulderGeom = new THREE.DodecahedronGeometry(0.26, 0);
    for (let i = 0; i < 14; i++) {
      const zPos = -len * 0.44 + (i / 13) * (len * 0.88);
      [-1, 1].forEach((side, sIdx) => {
        const boulder = new THREE.Mesh(boulderGeom, (i + sIdx) % 2 === 0 ? darkStoneMat : pebbleMat);
        const xJitter = Math.sin(i * 2.3 + sIdx) * 0.08;
        boulder.position.set(side * (channelW * 0.52) + xJitter, 0.14, zPos);
        boulder.scale.set(1.15, 0.65 + (i % 3) * 0.15, 1.1);
        boulder.rotation.y = i * 0.8;
        boulder.castShadow = true;
        boulder.receiveShadow = true;
        root.add(boulder);
      });
    }

    // C. Sunken Shimmering Water Stream & Riverbed
    const waterGeom = new THREE.PlaneGeometry(channelW * 1.05, len * 0.92, 16, 16);
    waterGeom.rotateX(-Math.PI / 2);
    const waterMat = ArchetypeMaterials.water();
    const water = new THREE.Mesh(waterGeom, waterMat);
    water.position.set(0, 0.10, 0);
    water.name = 'AnimatedWaterPlane';
    root.add(water);

    const bedGeom = new THREE.CylinderGeometry(channelW * 0.95, channelW * 1.1, 0.25, 20);
    const bedMat = ArchetypeMaterials.stone('#334155');
    const bed = new THREE.Mesh(bedGeom, bedMat);
    bed.scale.set(1.0, 1.0, len / channelW * 0.48);
    bed.position.set(0, -0.08, 0);
    root.add(bed);

    // D. Arched Wooden & Stone "Beodeul Bridge" (청계천 버들다리) across the center
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(0, 0.16, 0.15);

    const woodDeckMat = ArchetypeMaterials.wood('#78350F');
    const railWoodMat = ArchetypeMaterials.wood('#92400E');
    const archStoneMat = ArchetypeMaterials.stone('#CBD5E1');

    // Stone abutment piers on each bank
    [-1, 1].forEach((side) => {
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.32, 8), archStoneMat);
      pier.position.set(side * (channelW * 0.52), 0.08, 0);
      pier.scale.set(0.8, 1.0, 1.8);
      pier.castShadow = true;
      bridgeGroup.add(pier);
    });

    // Arched bridge deck made of 9 curved wooden planks
    const span = channelW + 1.1;
    const bridgeW = 1.35;
    const plankCount = 9;
    for (let p = 0; p < plankCount; p++) {
      const t = p / (plankCount - 1); // 0 to 1
      const x = (t - 0.5) * span;
      const archY = Math.sin(t * Math.PI) * 0.34;
      const tiltZ = Math.cos(t * Math.PI) * 0.24;

      const plank = new THREE.Mesh(new THREE.BoxGeometry(span / plankCount + 0.04, 0.09, bridgeW), woodDeckMat);
      plank.position.set(x, 0.14 + archY, 0);
      plank.rotation.z = tiltZ;
      plank.castShadow = true;
      plank.receiveShadow = true;
      bridgeGroup.add(plank);
    }

    // Bridge Wooden Posts, Arched Handrails & Warm Lanterns
    [-1, 1].forEach((zSide) => {
      const zOff = zSide * (bridgeW * 0.44);
      [-0.45, -0.22, 0, 0.22, 0.45].forEach((normX, idx) => {
        const t = normX + 0.5;
        const x = normX * span;
        const archY = Math.sin(t * Math.PI) * 0.34;

        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.42, 6), railWoodMat);
        post.position.set(x, 0.36 + archY, zOff);
        post.castShadow = true;
        bridgeGroup.add(post);

        // Warm glowing lantern on the central & end bridge posts
        if (idx === 0 || idx === 2 || idx === 4) {
          const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.065, 8, 8),
            new THREE.MeshStandardMaterial({
              color: 0xfef08a,
              emissive: 0xfacc15,
              emissiveIntensity: 0.9,
            })
          );
          bulb.position.set(x, 0.60 + archY, zOff);
          bridgeGroup.add(bulb);
        }
      });

      // Top handrail bar
      const railBar = new THREE.Mesh(new THREE.BoxGeometry(span * 0.96, 0.055, 0.055), railWoodMat);
      railBar.position.set(0, 0.58, zOff);
      bridgeGroup.add(railBar);
    });

    root.add(bridgeGroup);

    // E. Stepping Stones (징검다리) across the stream in the foreground
    const stoneCount = 5;
    const stepStoneGeom = new THREE.CylinderGeometry(0.22, 0.27, 0.16, 7);
    for (let s = 0; s < stoneCount; s++) {
      const stone = new THREE.Mesh(stepStoneGeom, archStoneMat);
      const xRatio = (s / (stoneCount - 1)) * 2 - 1;
      const x = xRatio * (channelW * 0.38);
      const z = -len * 0.28 + (s % 2 === 0 ? 0.1 : -0.1);
      stone.position.set(x, 0.11, z);
      stone.rotation.y = s * 0.7;
      stone.castShadow = true;
      stone.receiveShadow = true;
      root.add(stone);
    }

    // F. Lush Weeping Willow Trees (버들나무) & Waterside Reeds
    const willowPositions = [
      [-channelW * 0.5 - 1.05, -len * 0.28, 2.5],
      [channelW * 0.5 + 1.05, -len * 0.22, 2.7],
      [-channelW * 0.5 - 1.1, len * 0.28, 2.8],
      [channelW * 0.5 + 1.0, len * 0.30, 2.4],
    ];
    willowPositions.forEach(([wx, wz, wh]) => {
      const willow = this.buildWillowTree(wh);
      willow.position.set(wx, 0.18, wz);
      root.add(willow);
    });

    return root;
  }

  /**
   * 2. CAMPUS BUILDING ARCHETYPE (e.g. Korea University Central Plaza / Clock Tower)
   * Compact, square-proportioned collegiate gothic stone hall (~4.8 x 4.4 footprint)
   * with central clock spire, arched portal, terraced stone plaza, and autumn ginkgo trees.
   */
  public static buildCampusBuilding(params: ArchetypeParams): THREE.Group {
    const root = new THREE.Group();
    root.name = 'Archetype_CampusBuilding';

    const stoneMat = ArchetypeMaterials.stone(params.palette?.primary || '#D6D3D1');
    const darkStoneMat = ArchetypeMaterials.stone('#57534E');
    const trimMat = ArchetypeMaterials.stone('#F5F5F4');
    const roofMat = ArchetypeMaterials.ceramicRoof(params.palette?.secondary || '#065F46');
    const glassMat = ArchetypeMaterials.glass();

    // A. Compact Square-Proportioned Stone Hall (width 4.4, height 2.3, depth 3.4)
    const wingGeom = createBevelBox(4.4, 2.3, 3.4);
    const mainWing = new THREE.Mesh(wingGeom, stoneMat);
    mainWing.position.y = 1.25;
    mainWing.castShadow = true;
    mainWing.receiveShadow = true;
    root.add(mainWing);

    // Terraced Stone Plinth (sinks into spherical skirt)
    const plinthGeom = createBevelBox(4.8, 0.5, 3.8);
    const plinth = new THREE.Mesh(plinthGeom, darkStoneMat);
    plinth.position.y = 0.15;
    root.add(plinth);

    // B. Central Gothic Clock Spire Tower (compact width 1.7, depth 2.0, height 4.2)
    const towerGeom = createBevelBox(1.7, 4.2, 2.0);
    const tower = new THREE.Mesh(towerGeom, stoneMat);
    tower.position.set(0, 2.2, 0.45);
    tower.castShadow = true;
    root.add(tower);

    // Corner Stone Buttresses on Tower for authentic Gothic detail (not a flat box!)
    [-0.82, 0.82].forEach((bx) => {
      [-0.95, 0.95].forEach((bz) => {
        const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.3, 0.22), trimMat);
        buttress.position.set(bx, 2.2, 0.45 + bz);
        root.add(buttress);
      });
    });

    // Arched Grand Portal Entrance
    const portalArch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.35, 12, 1, false, 0, Math.PI),
      trimMat
    );
    portalArch.rotation.x = Math.PI / 2;
    portalArch.position.set(0, 1.05, 1.48);
    root.add(portalArch);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.95, 0.1),
      ArchetypeMaterials.wood('#3E2723')
    );
    door.position.set(0, 0.55, 1.48);
    root.add(door);

    // Golden Clock Face Dial
    const clockFace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16),
      ArchetypeMaterials.stone('#FEF3C7')
    );
    clockFace.rotation.x = Math.PI / 2;
    clockFace.position.set(0, 3.45, 1.48);
    root.add(clockFace);

    const clockHands = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.26, 0.04),
      ArchetypeMaterials.stone('#18181B')
    );
    clockHands.position.set(0, 3.45, 1.54);
    root.add(clockHands);

    // Pointed Gothic Spire Roof
    const spireGeom = new THREE.ConeGeometry(1.15, 2.2, 4);
    spireGeom.rotateY(Math.PI / 4);
    const spire = new THREE.Mesh(spireGeom, roofMat);
    spire.position.set(0, 5.4, 0.45);
    spire.castShadow = true;
    root.add(spire);

    // Pitched Gable Roof on Main Hall
    const wingRoofGeom = new THREE.ConeGeometry(3.2, 1.1, 4);
    wingRoofGeom.rotateY(Math.PI / 4);
    const wingRoof = new THREE.Mesh(wingRoofGeom, roofMat);
    wingRoof.scale.set(1.05, 1.0, 0.82);
    wingRoof.position.set(0, 2.95, 0);
    wingRoof.castShadow = true;
    root.add(wingRoof);

    // C. Multi-Pane Window Rows
    const winGeom = new THREE.BoxGeometry(0.38, 0.58, 0.08);
    const winFrameGeom = new THREE.BoxGeometry(0.46, 0.66, 0.06);

    const winPositions = [
      [-1.65, 1.05], [-1.05, 1.05], [1.05, 1.05], [1.65, 1.05],
      [-1.65, 1.85], [-1.05, 1.85], [1.05, 1.85], [1.65, 1.85],
    ];

    winPositions.forEach(([x, y]) => {
      const frame = new THREE.Mesh(winFrameGeom, trimMat);
      frame.position.set(x, y, 1.72);
      root.add(frame);

      const glass = new THREE.Mesh(winGeom, glassMat);
      glass.position.set(x, y, 1.73);
      root.add(glass);
    });

    // D. Front Courtyard Steps & Flanking Golden Ginkgo Trees
    for (let st = 0; st < 3; st++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(2.1 - st * 0.25, 0.12, 0.35),
        darkStoneMat
      );
      step.position.set(0, 0.08 + st * 0.1, 1.65 + (3 - st) * 0.24);
      root.add(step);
    }

    const tree1 = this.buildAutumnTree(2.3);
    tree1.position.set(-2.45, 0.1, 1.1);
    root.add(tree1);

    const tree2 = this.buildAutumnTree(2.1);
    tree2.position.set(2.45, 0.1, 1.1);
    root.add(tree2);

    const lamp1 = this.buildStreetLamp(1.65, '#FBBF24');
    lamp1.position.set(-1.35, 0.1, 2.1);
    root.add(lamp1);

    const lamp2 = this.buildStreetLamp(1.65, '#FBBF24');
    lamp2.position.set(1.35, 0.1, 2.1);
    root.add(lamp2);

    return root;
  }

  /**
   * 3. HANOK TEMPLE ARCHETYPE (e.g. Traditional Tea House / 보문동 한옥)
   * Raised stone base, timber columns, sliding paper latticework,
   * curved Korean giwa roof with upturned eaves (처마), and clay jars.
   */
  public static buildHanokTemple(params: ArchetypeParams): THREE.Group {
    const root = new THREE.Group();
    root.name = 'Archetype_Hanok';

    const stoneMat = ArchetypeMaterials.stone('#78716C');
    const woodMat = ArchetypeMaterials.wood(params.palette?.primary || '#78350F');
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xFDFBF7, roughness: 0.9 });
    const roofMat = ArchetypeMaterials.ceramicRoof(params.palette?.secondary || '#1E293B');

    // A. Raised Stone Base (기단)
    const baseGeom = createBevelBox(6.4, 0.5, 4.8);
    const baseMesh = new THREE.Mesh(baseGeom, stoneMat);
    baseMesh.position.y = 0.25;
    baseMesh.receiveShadow = true;
    root.add(baseMesh);

    // Front steps
    const stepGeom = createBevelBox(1.8, 0.25, 0.6);
    const step = new THREE.Mesh(stepGeom, stoneMat);
    step.position.set(0, 0.125, 2.6);
    root.add(step);

    // B. Cylindrical Wooden Columns (기둥)
    const colGeom = new THREE.CylinderGeometry(0.12, 0.14, 2.2, 8);
    const colPositions = [
      [-2.6, 1.6, -1.8], [0, 1.6, -1.8], [2.6, 1.6, -1.8],
      [-2.6, 1.6, 1.8],  [0, 1.6, 1.8],  [2.6, 1.6, 1.8],
    ];

    colPositions.forEach(([x, y, z]) => {
      const col = new THREE.Mesh(colGeom, woodMat);
      col.position.set(x, y, z);
      col.castShadow = true;
      root.add(col);
    });

    // C. Traditional Paper Sliding Walls & Lattice (창호)
    const wallGeom = new THREE.BoxGeometry(5.0, 1.8, 3.2);
    const innerRoom = new THREE.Mesh(wallGeom, paperMat);
    innerRoom.position.set(0, 1.4, 0);
    root.add(innerRoom);

    // Wooden Cross Lattice Lines
    const latticeBar = new THREE.Mesh(new THREE.BoxGeometry(5.02, 0.08, 0.05), woodMat);
    latticeBar.position.set(0, 1.3, 1.62);
    root.add(latticeBar);

    // D. Curved Korean Giwa Roof with Upturned Flared Eaves (팔작지붕/처마)
    const roofGroup = new THREE.Group();
    roofGroup.position.set(0, 2.7, 0);

    // Main roof core
    const mainRoofGeom = new THREE.ConeGeometry(4.4, 1.4, 4);
    mainRoofGeom.rotateY(Math.PI / 4);
    const mainRoof = new THREE.Mesh(mainRoofGeom, roofMat);
    mainRoof.position.y = 0.7;
    mainRoof.scale.set(1.45, 1.0, 1.15);
    mainRoof.castShadow = true;
    roofGroup.add(mainRoof);

    // Upturned Eave Edge Wings (Flared tips)
    const eaveGeom = createBevelBox(7.2, 0.22, 5.4);
    const eaveMesh = new THREE.Mesh(eaveGeom, roofMat);
    eaveMesh.position.y = 0.1;
    roofGroup.add(eaveMesh);

    // Central Ridge Ornament (용마루)
    const ridgeGeom = createBevelBox(5.6, 0.22, 0.26);
    const ridge = new THREE.Mesh(ridgeGeom, ArchetypeMaterials.stone('#0F172A'));
    ridge.position.y = 1.42;
    roofGroup.add(ridge);

    root.add(roofGroup);

    // E. Traditional Ceramic Jars (장독대) in Courtyard
    const jarGeom = new THREE.SphereGeometry(0.32, 10, 8);
    const jarMat = ArchetypeMaterials.ceramicRoof('#33251E');

    [-1.0, -0.4, 0.4].forEach((offZ, idx) => {
      const jar = new THREE.Mesh(jarGeom, jarMat);
      jar.position.set(3.4, 0.32 + idx * 0.04, offZ);
      jar.scale.set(0.9, 1.15, 0.9);
      jar.castShadow = true;
      root.add(jar);
    });

    // Courtyard pine tree
    const pine = this.buildPineTree(2.6);
    pine.position.set(-3.6, 0, 1.2);
    root.add(pine);

    return root;
  }

  /**
   * 4. MARKET / STREET FOOD POCHA ARCHETYPE (e.g. Anam 5-Way Pocha / 안암 포장마차)
   * Vibrant food stall with glowing orange/red tarp roof, food prep counter,
   * steam details, traditional hanging lanterns (청사초롱), and street stools.
   */
  public static buildMarket(params: ArchetypeParams): THREE.Group {
    const root = new THREE.Group();
    root.name = 'Archetype_Market';

    const tarpMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.palette?.primary || '#DC2626'),
      roughness: 0.6,
      metalness: 0.05,
    });
    const orangeTarpMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#EA580C'),
      roughness: 0.6,
      metalness: 0.05,
    });
    const woodMat = ArchetypeMaterials.wood('#B45309');
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.8, roughness: 0.3 });

    // A. Metal Frame Poles
    const poleGeom = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6);
    [[-1.8, -1.2], [-1.8, 1.2], [1.8, -1.2], [1.8, 1.2]].forEach(([px, pz]) => {
      const pole = new THREE.Mesh(poleGeom, metalMat);
      pole.position.set(px, 1.2, pz);
      root.add(pole);
    });

    // B. Angled Pocha Tent Roof with Scalloped Overhang (height 1.2)
    const roofGeom = new THREE.ConeGeometry(2.8, 1.2, 4);
    roofGeom.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeom, tarpMat);
    roof.position.set(0, 2.7, 0);
    roof.scale.set(1.4, 1.0, 1.0);
    roof.castShadow = true;
    root.add(roof);

    // Front valance fabric flap
    const valance = new THREE.Mesh(createBevelBox(3.8, 0.3, 0.05), orangeTarpMat);
    valance.position.set(0, 2.15, 1.2);
    root.add(valance);

    // C. Food Prep Counter (sizzling tteokbokki & sundae broth pots)
    const counter = new THREE.Mesh(createBevelBox(3.2, 0.9, 1.2), woodMat);
    counter.position.set(0, 0.45, 0);
    counter.castShadow = true;
    root.add(counter);

    // Stainless steel food containers
    const panGeom = new THREE.BoxGeometry(0.8, 0.15, 0.6);
    const redSaucePan = new THREE.Mesh(panGeom, new THREE.MeshStandardMaterial({ color: 0xDC2626, roughness: 0.3 }));
    redSaucePan.position.set(-0.7, 0.95, 0);
    root.add(redSaucePan);

    const brothPan = new THREE.Mesh(panGeom, new THREE.MeshStandardMaterial({ color: 0xD97706, roughness: 0.3 }));
    brothPan.position.set(0.7, 0.95, 0);
    root.add(brothPan);

    // D. Traditional Red and Blue Hanging Lanterns (청사초롱)
    const lanternGeom = new THREE.BoxGeometry(0.3, 0.5, 0.3);
    const lanternRedMat = new THREE.MeshStandardMaterial({ color: 0xEF4444, emissive: 0xEF4444, emissiveIntensity: 0.6 });
    const lanternBlueMat = new THREE.MeshStandardMaterial({ color: 0x3B82F6, emissive: 0x3B82F6, emissiveIntensity: 0.6 });

    const l1 = new THREE.Mesh(lanternGeom, lanternRedMat);
    l1.position.set(-1.6, 2.0, 1.3);
    root.add(l1);

    const l2 = new THREE.Mesh(lanternGeom, lanternBlueMat);
    l2.position.set(1.6, 2.0, 1.3);
    root.add(l2);

    // Round plastic pocha stools
    const stoolGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.48, 12);
    const stoolMat = new THREE.MeshStandardMaterial({ color: 0x2563EB, roughness: 0.4 });
    [-1.0, 0, 1.0].forEach((sx) => {
      const stool = new THREE.Mesh(stoolGeom, stoolMat);
      stool.position.set(sx, 0.24, 1.6);
      stool.castShadow = true;
      root.add(stool);
    });

    return root;
  }

  /**
   * 5. PARK ARCHETYPE (e.g. Marunir Park / 마로니에 공원, Naksan Ridge)
   * Soft rolling lawn mound, curved gravel paths, clustered shade trees,
   * wooden park benches, and stone lanterns.
   */
  public static buildPark(params: ArchetypeParams): THREE.Group {
    const root = new THREE.Group();
    root.name = 'Archetype_Park';

    const grassMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.palette?.secondary || '#16A34A'),
      roughness: 0.9,
      flatShading: true,
    });
    const pathMat = ArchetypeMaterials.stone(params.palette?.ground || '#CBD5E1');

    // Soft rolling mound
    const moundGeom = new THREE.CylinderGeometry(4.2, 4.8, 0.4, 16);
    const mound = new THREE.Mesh(moundGeom, grassMat);
    mound.position.y = 0.2;
    mound.receiveShadow = true;
    root.add(mound);

    // Curved walking path
    const pathGeom = new THREE.TorusGeometry(2.4, 0.35, 4, 24, Math.PI * 1.2);
    pathGeom.rotateX(Math.PI / 2);
    const path = new THREE.Mesh(pathGeom, pathMat);
    path.position.set(0, 0.41, 0);
    path.receiveShadow = true;
    root.add(path);

    // Shade Trees Cluster
    const tree1 = this.buildDeciduousTree(3.2, '#15803D');
    tree1.position.set(-1.8, 0.4, -1.2);
    root.add(tree1);

    const tree2 = this.buildDeciduousTree(2.6, '#16A34A');
    tree2.position.set(1.6, 0.4, -1.6);
    root.add(tree2);

    const tree3 = this.buildAutumnTree(2.4);
    tree3.position.set(2.2, 0.4, 1.2);
    root.add(tree3);

    // Park Benches
    const b1 = this.buildBench();
    b1.position.set(-0.8, 0.4, 1.8);
    b1.rotation.y = -0.3;
    root.add(b1);

    const b2 = this.buildBench();
    b2.position.set(1.4, 0.4, 0.2);
    b2.rotation.y = 1.2;
    root.add(b2);

    // Park Lamp
    const lamp = this.buildStreetLamp(2.2, '#FEF08A');
    lamp.position.set(-1.4, 0.4, 0.8);
    root.add(lamp);

    return root;
  }

  // --- Helper Procedural Sub-Components ---

  public static buildWillowTree(height: number = 3.0): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = ArchetypeMaterials.wood('#543825');
    const leafMat = ArchetypeMaterials.foliage('#4ADE80'); // Soft yellow-green willow

    // Slightly curved trunk
    const trunkGeom = new THREE.CylinderGeometry(0.12, 0.2, height * 0.65, 8);
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.set(0, height * 0.32, 0);
    trunk.rotation.z = 0.08;
    trunk.castShadow = true;
    group.add(trunk);

    // Drooping canopy layers
    for (let c = 0; c < 3; c++) {
      const tierH = height * 0.35;
      const tierGeom = new THREE.ConeGeometry((3 - c * 0.5) * 0.55, tierH, 8);
      const canopy = new THREE.Mesh(tierGeom, leafMat);
      canopy.position.set(0, height * 0.55 + c * (height * 0.16), 0);
      canopy.scale.set(1, 1.2, 1);
      canopy.castShadow = true;
      group.add(canopy);
    }

    return group;
  }

  public static buildDeciduousTree(height: number = 2.8, leafColor: string = '#15803D'): THREE.Group {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, height * 0.45, 6), ArchetypeMaterials.wood('#78350F'));
    trunk.position.y = height * 0.22;
    trunk.castShadow = true;
    group.add(trunk);

    const foliageGeom = new THREE.DodecahedronGeometry(height * 0.38, 1);
    const foliage = new THREE.Mesh(foliageGeom, ArchetypeMaterials.foliage(leafColor));
    foliage.position.y = height * 0.65;
    foliage.scale.set(1, 1.15, 1);
    foliage.castShadow = true;
    group.add(foliage);

    return group;
  }

  public static buildAutumnTree(height: number = 3.0): THREE.Group {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, height * 0.4, 6), ArchetypeMaterials.wood('#5C3317'));
    trunk.position.y = height * 0.2;
    trunk.castShadow = true;
    group.add(trunk);

    const foliageGeom = new THREE.DodecahedronGeometry(height * 0.4, 1);
    const foliage = new THREE.Mesh(foliageGeom, new THREE.MeshStandardMaterial({
      color: 0xD97706, // Amber golden autumn ginkgo
      roughness: 0.85,
      flatShading: true,
    }));
    foliage.position.y = height * 0.66;
    foliage.scale.set(1, 1.2, 1);
    foliage.castShadow = true;
    group.add(foliage);

    return group;
  }

  public static buildPineTree(height: number = 2.8): THREE.Group {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, height * 0.4, 6), ArchetypeMaterials.wood('#3E2723'));
    trunk.position.y = height * 0.2;
    group.add(trunk);

    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry((3 - i) * 0.35, height * 0.32, 7),
        ArchetypeMaterials.foliage('#064E3B')
      );
      cone.position.y = height * 0.45 + i * (height * 0.22);
      cone.castShadow = true;
      group.add(cone);
    }
    return group;
  }

  public static buildStreetLamp(height: number = 2.2, bulbColor: string = '#FEF08A'): THREE.Group {
    const group = new THREE.Group();
    const postGeom = new THREE.CylinderGeometry(0.04, 0.05, height, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.8, roughness: 0.2 });
    const post = new THREE.Mesh(postGeom, postMat);
    post.position.y = height * 0.5;
    post.castShadow = true;
    group.add(post);

    const headGeom = new THREE.BoxGeometry(0.24, 0.28, 0.24);
    const head = new THREE.Mesh(headGeom, postMat);
    head.position.y = height + 0.12;
    group.add(head);

    const bulbGeom = new THREE.SphereGeometry(0.1, 8, 8);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(bulbColor),
      emissive: new THREE.Color(bulbColor),
      emissiveIntensity: 0.9,
    });
    const bulb = new THREE.Mesh(bulbGeom, bulbMat);
    bulb.position.y = height + 0.12;
    group.add(bulb);

    return group;
  }

  public static buildBench(): THREE.Group {
    const group = new THREE.Group();
    const woodMat = ArchetypeMaterials.wood('#78350F');
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.8 });

    // Seat plank
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.4), woodMat);
    seat.position.y = 0.4;
    group.add(seat);

    // Backrest
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.06), woodMat);
    back.position.set(0, 0.65, -0.17);
    group.add(back);

    // Legs
    [-0.45, 0.45].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.36), metalMat);
      leg.position.set(lx, 0.2, 0);
      group.add(leg);
    });

    return group;
  }
}
