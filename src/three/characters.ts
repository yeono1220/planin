import * as THREE from 'three';
import { CharacterSpec, Accessory, HairStyle } from '../types';

/**
 * 3-step toon shading gradient ramp for MeshToonMaterial
 * Provides crisp bright / midtone / shadow cel shading
 */
let sharedGradientMap: THREE.CanvasTexture | null = null;
function getThreeStepGradientMap(): THREE.CanvasTexture {
  if (!sharedGradientMap) {
    const canvas = document.createElement('canvas');
    canvas.width = 3;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#64748b'; // shadow tone
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = '#cbd5e1'; // midtone
    ctx.fillRect(1, 0, 1, 1);
    ctx.fillStyle = '#ffffff'; // highlight
    ctx.fillRect(2, 0, 1, 1);

    sharedGradientMap = new THREE.CanvasTexture(canvas);
    sharedGradientMap.minFilter = THREE.NearestFilter;
    sharedGradientMap.magFilter = THREE.NearestFilter;
    sharedGradientMap.generateMipmaps = false;
  }
  return sharedGradientMap;
}

/**
 * Soft contact shadow blob texture for beneath the feet
 */
let sharedShadowBlobTex: THREE.CanvasTexture | null = null;
function getShadowBlobTexture(): THREE.CanvasTexture {
  if (!sharedShadowBlobTex) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.65)');
    grad.addColorStop(0.45, 'rgba(15, 23, 42, 0.35)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    sharedShadowBlobTex = new THREE.CanvasTexture(canvas);
  }
  return sharedShadowBlobTex;
}

/**
 * Inverted-hull cel outline helper (BackSide scaled mesh)
 */
function addInvertedHullOutline(
  mesh: THREE.Mesh,
  scaleFactor: number = 1.04,
  outlineColor: number = 0x1e1b4b
): THREE.Mesh {
  const outlineMat = new THREE.MeshBasicMaterial({
    color: outlineColor,
    side: THREE.BackSide,
  });
  const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMat);
  outlineMesh.scale.setScalar(scaleFactor);
  outlineMesh.renderOrder = -1;
  mesh.add(outlineMesh);
  return outlineMesh;
}

/**
 * Helper to produce a slightly darker shade for the back of the hair
 */
function shadeColor(hex: string, factor: number): string {
  try {
    const c = new THREE.Color(hex);
    c.r = Math.max(0, Math.min(1, c.r * (1 + factor)));
    c.g = Math.max(0, Math.min(1, c.g * (1 + factor)));
    c.b = Math.max(0, Math.min(1, c.b * (1 + factor)));
    return '#' + c.getHexString();
  } catch {
    return hex;
  }
}

/**
 * AvatarInstance: Procedural Chibi 3D Explorer
 * - 2.3 heads tall chibi proportions
 * - Big round squashed head (~45% total height), small capsule body, stubby limbs, mitten hands
 * - Face with vertical ellipsoid eyes + sparkles, pink blush, tiny curved smile
 * - Hair variants (short, bob, long, ponytail, bun, curly) with darker back shade
 * - MeshToonMaterial with 3-step ramp + inverted-hull cel outline + shadow blob
 * - Squash & stretch walk cycle, head bob, blink, idle sway, moment jump & wave
 */
export class AvatarInstance {
  public root: THREE.Group;
  public spec: CharacterSpec;
  public isFallback: boolean = true;

  // Rig joint references
  private rigParts: {
    torsoPivot?: THREE.Group;
    headPivot?: THREE.Group;
    leftLegPivot?: THREE.Group;
    rightLegPivot?: THREE.Group;
    leftArmPivot?: THREE.Group;
    rightArmPivot?: THREE.Group;
    leftEye?: THREE.Mesh;
    rightEye?: THREE.Mesh;
    leftBlush?: THREE.Mesh;
    rightBlush?: THREE.Mesh;
    mouth?: THREE.Mesh;
    celebrateGroup?: THREE.Group;
  } = {};

  // Animation states
  private walkPhase: number = 0;
  private idlePhase: number = 0;
  private blinkTimer: number = 0;
  private isBlinking: boolean = false;
  private blinkDuration: number = 0;

  // Moment jump & wave state ("We did it!" arrival celebration)
  public isCelebrating: boolean = false;
  private celebrateTimer: number = 0;

  constructor(spec: CharacterSpec) {
    this.spec = spec;
    this.root = new THREE.Group();
    this.root.name = `ChibiAvatar_${spec.name}`;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.idlePhase = Math.random() * Math.PI * 2;
    this.blinkTimer = Math.random() * 2;
  }

  public async load(): Promise<void> {
    this.buildChibiFigure();

    // Scale to Hero Scale (~1.5x realistic relative to buildings)
    const heroScale = (this.spec.heightScale || 1.0) * 1.5;
    this.root.scale.setScalar(heroScale);

    // Soft round shadow blob under the feet
    const shadowGeom = new THREE.PlaneGeometry(1.2, 1.2);
    shadowGeom.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: getShadowBlobTexture(),
      transparent: true,
      depthWrite: false,
    });
    const shadowBlob = new THREE.Mesh(shadowGeom, shadowMat);
    shadowBlob.position.y = 0.02;
    this.root.add(shadowBlob);
  }

  /**
   * Deterministically builds the full chibi figure from CharacterSpec
   */
  private buildChibiFigure() {
    const gradientMap = getThreeStepGradientMap();

    // Materials with 3-step cel toon shading
    const skinMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(this.spec.skinTone || '#F5D4B8'),
      gradientMap,
    });

    const hairColorHex = this.spec.hairColor || '#1f1f24';
    const hairMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(hairColorHex),
      gradientMap,
    });

    const darkHairMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(shadeColor(hairColorHex, -0.28)),
      gradientMap,
    });

    const topMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(this.spec.topColor || '#861F41'),
      gradientMap,
    });

    const bottomMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(this.spec.bottomColor || '#1E293B'),
      gradientMap,
    });

    const shoesMat = new THREE.MeshToonMaterial({
      color: new THREE.Color(this.spec.shoesColor || '#FFFFFF'),
      gradientMap,
    });

    // ==========================================
    // 1. Torso & Body (Small rounded capsule, no visible neck)
    // ==========================================
    const torsoPivot = new THREE.Group();
    torsoPivot.position.set(0, 0.52, 0);
    this.root.add(torsoPivot);
    this.rigParts.torsoPivot = torsoPivot;

    // Small rounded body (capsule)
    const bodyGeom = new THREE.CapsuleGeometry(0.24, 0.28, 8, 16);
    const bodyMesh = new THREE.Mesh(bodyGeom, topMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    torsoPivot.add(bodyMesh);
    addInvertedHullOutline(bodyMesh, 1.05);

    // Collar / Lapel detail directly below head
    const collarGeom = new THREE.TorusGeometry(0.20, 0.045, 8, 16);
    collarGeom.rotateX(Math.PI / 2);
    const collarMesh = new THREE.Mesh(collarGeom, topMat);
    collarMesh.position.set(0, 0.22, 0);
    torsoPivot.add(collarMesh);

    // Subtle stripe ring around waist
    const stripeGeom = new THREE.TorusGeometry(0.235, 0.016, 6, 20);
    stripeGeom.rotateX(Math.PI / 2);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const stripeMesh = new THREE.Mesh(stripeGeom, stripeMat);
    stripeMesh.position.set(0, -0.06, 0);
    torsoPivot.add(stripeMesh);

    // ==========================================
    // 2. Head (Big round squashed sphere ~45% total height)
    // ==========================================
    const headPivot = new THREE.Group();
    // Head rests directly on top of body with no visible neck
    headPivot.position.set(0, 0.38, 0);
    torsoPivot.add(headPivot);
    this.rigParts.headPivot = headPivot;

    // Head is slightly squashed sphere (radius 0.44, scale x:1.06, y:0.94, z:1.02)
    const headGeom = new THREE.SphereGeometry(0.44, 24, 20);
    const headMesh = new THREE.Mesh(headGeom, skinMat);
    headMesh.scale.set(1.06, 0.94, 1.02);
    headMesh.castShadow = true;
    headPivot.add(headMesh);
    addInvertedHullOutline(headMesh, 1.045);

    // ==========================================
    // 3. Face (Vertical ellipsoid eyes + sparkles, pink blush, tiny curved mouth)
    // ==========================================
    this.buildFaceFeatures(headPivot, skinMat);

    // ==========================================
    // 4. Hair (from spec.hairStyle + hairColor)
    // ==========================================
    this.buildHair(headPivot, hairMat, darkHairMat);

    // ==========================================
    // 5. Short Stubby Legs & Rounded Shoes
    // ==========================================
    this.buildStubbyLegs(torsoPivot, bottomMat, shoesMat);

    // ==========================================
    // 6. Short Stubby Arms & Mitten Hands
    // ==========================================
    this.buildStubbyArms(torsoPivot, topMat, skinMat);

    // ==========================================
    // 7. Accessories (Glasses, Cap, Earrings, Backpack, Scarf)
    // ==========================================
    this.attachAccessories(headPivot, torsoPivot);
  }

  /**
   * Builds the cute anime chibi face:
   * - Two black vertical ellipsoid eyes placed in the lower half of the face
   * - Small white highlight sphere (sparkle) in each eye
   * - Soft pink blush ellipses under the eyes
   * - Tiny curved mouth (partial torus smile)
   * - Tiny dot nose
   */
  private buildFaceFeatures(headPivot: THREE.Group, skinMat: THREE.Material) {
    const eyeGeom = new THREE.SphereGeometry(0.075, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });

    const sparkleGeom = new THREE.SphereGeometry(0.024, 10, 10);
    const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Lower half of face (y = -0.07, well below equator)
    // Left Eye
    const leftEyeGroup = new THREE.Group();
    leftEyeGroup.position.set(-0.165, -0.07, 0.40);
    headPivot.add(leftEyeGroup);

    const leftEyeMesh = new THREE.Mesh(eyeGeom, eyeMat);
    leftEyeMesh.scale.set(0.72, 1.35, 0.35);
    leftEyeGroup.add(leftEyeMesh);

    const leftSparkle = new THREE.Mesh(sparkleGeom, sparkleMat);
    leftSparkle.position.set(0.022, 0.038, 0.03);
    leftEyeGroup.add(leftSparkle);
    this.rigParts.leftEye = leftEyeMesh;

    // Right Eye
    const rightEyeGroup = new THREE.Group();
    rightEyeGroup.position.set(0.165, -0.07, 0.40);
    headPivot.add(rightEyeGroup);

    const rightEyeMesh = new THREE.Mesh(eyeGeom, eyeMat);
    rightEyeMesh.scale.set(0.72, 1.35, 0.35);
    rightEyeGroup.add(rightEyeMesh);

    const rightSparkle = new THREE.Mesh(sparkleGeom, sparkleMat);
    rightSparkle.position.set(0.022, 0.038, 0.03);
    rightEyeGroup.add(rightSparkle);
    this.rigParts.rightEye = rightEyeMesh;

    // Soft pink blush ellipses under the eyes
    const blushGeom = new THREE.CircleGeometry(0.065, 16);
    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });

    const leftBlush = new THREE.Mesh(blushGeom, blushMat);
    leftBlush.scale.set(1.4, 0.65, 1.0);
    leftBlush.position.set(-0.24, -0.155, 0.385);
    leftBlush.rotation.y = -0.28;
    headPivot.add(leftBlush);
    this.rigParts.leftBlush = leftBlush;

    const rightBlush = new THREE.Mesh(blushGeom, blushMat);
    rightBlush.scale.set(1.4, 0.65, 1.0);
    rightBlush.position.set(0.24, -0.155, 0.385);
    rightBlush.rotation.y = 0.28;
    headPivot.add(rightBlush);
    this.rigParts.rightBlush = rightBlush;

    // Tiny curved mouth (partial torus smile)
    const mouthGeom = new THREE.TorusGeometry(0.042, 0.012, 6, 14, Math.PI * 0.85);
    mouthGeom.rotateZ(Math.PI);
    mouthGeom.rotateX(0.2);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x881337 });
    const mouth = new THREE.Mesh(mouthGeom, mouthMat);
    mouth.position.set(0, -0.19, 0.405);
    headPivot.add(mouth);
    this.rigParts.mouth = mouth;

    // Tiny dot nose
    const noseGeom = new THREE.SphereGeometry(0.018, 8, 8);
    const noseMesh = new THREE.Mesh(noseGeom, skinMat);
    noseMesh.position.set(0, -0.12, 0.43);
    headPivot.add(noseMesh);

    // Floating "We Did It!" celebratory golden star sparkles above head (visible during celebration)
    const celebrateGroup = new THREE.Group();
    celebrateGroup.position.set(0, 0.68, 0);
    celebrateGroup.visible = false;
    const starGeom = new THREE.OctahedronGeometry(0.075, 0);
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const roseMat = new THREE.MeshBasicMaterial({ color: 0xfb7185 });
    for (let s = 0; s < 5; s++) {
      const angle = (s / 5) * Math.PI * 2;
      const star = new THREE.Mesh(starGeom, s % 2 === 0 ? goldMat : roseMat);
      star.position.set(Math.cos(angle) * 0.42, (s % 2) * 0.08, Math.sin(angle) * 0.42);
      celebrateGroup.add(star);
    }
    headPivot.add(celebrateGroup);
    this.rigParts.celebrateGroup = celebrateGroup;
  }

  /**
   * Hair construction:
   * - Hair shell slightly larger than the top half of the head
   * - 3-5 rounded bangs across forehead
   * - Variants: short, bob, long, ponytail, bun, curly
   * - Back of the hair one shade darker!
   */
  private buildHair(headPivot: THREE.Group, hairMat: THREE.Material, darkHairMat: THREE.Material) {
    const hairStyle = (this.spec.hairStyle || this.deriveHairStyle()).toLowerCase() as HairStyle;

    // 1. Base hair shell covering crown and upper head
    const shellGeom = new THREE.SphereGeometry(0.47, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
    const shellMesh = new THREE.Mesh(shellGeom, hairMat);
    shellMesh.position.set(0, 0.05, -0.02);
    shellMesh.scale.set(1.06, 0.96, 1.04);
    shellMesh.castShadow = true;
    headPivot.add(shellMesh);
    addInvertedHullOutline(shellMesh, 1.045);

    // 2. Back of the hair (one shade darker!)
    const backCapGeom = new THREE.SphereGeometry(0.475, 20, 14, 0, Math.PI, 0, Math.PI * 0.75);
    backCapGeom.rotateY(Math.PI);
    const backCap = new THREE.Mesh(backCapGeom, darkHairMat);
    backCap.position.set(0, 0.04, -0.03);
    backCap.scale.set(1.06, 0.96, 1.04);
    headPivot.add(backCap);

    // 3. Rounded bangs across the forehead (3-5 chubby curved tufts)
    const bangGeom = new THREE.CapsuleGeometry(0.065, 0.16, 6, 10);
    const bangPositions = [-0.22, -0.11, 0.0, 0.11, 0.22];
    for (let i = 0; i < bangPositions.length; i++) {
      const x = bangPositions[i];
      const bang = new THREE.Mesh(bangGeom, hairMat);
      bang.position.set(x, 0.18, 0.41);
      bang.rotation.z = -x * 0.7;
      bang.rotation.x = -0.35;
      bang.castShadow = true;
      headPivot.add(bang);
    }

    // 4. Style Variants
    switch (hairStyle) {
      case 'bob': {
        // Side volumes framing down to the chin
        const sideGeom = new THREE.CapsuleGeometry(0.12, 0.34, 6, 12);
        const leftSide = new THREE.Mesh(sideGeom, hairMat);
        leftSide.position.set(-0.42, -0.10, 0.06);
        leftSide.rotation.z = 0.12;
        leftSide.castShadow = true;
        headPivot.add(leftSide);
        addInvertedHullOutline(leftSide, 1.05);

        const rightSide = new THREE.Mesh(sideGeom, hairMat);
        rightSide.position.set(0.42, -0.10, 0.06);
        rightSide.rotation.z = -0.12;
        rightSide.castShadow = true;
        headPivot.add(rightSide);
        addInvertedHullOutline(rightSide, 1.05);
        break;
      }
      case 'long': {
        // Back slab cascading down to the shoulders
        const longGeom = new THREE.BoxGeometry(0.58, 0.62, 0.18);
        const longMesh = new THREE.Mesh(longGeom, darkHairMat);
        longMesh.position.set(0, -0.28, -0.32);
        longMesh.rotation.x = 0.08;
        longMesh.castShadow = true;
        headPivot.add(longMesh);
        addInvertedHullOutline(longMesh, 1.05);

        // Long front strands
        const strandGeom = new THREE.CapsuleGeometry(0.08, 0.45, 6, 10);
        const leftStrand = new THREE.Mesh(strandGeom, hairMat);
        leftStrand.position.set(-0.38, -0.16, 0.12);
        headPivot.add(leftStrand);

        const rightStrand = new THREE.Mesh(strandGeom, hairMat);
        rightStrand.position.set(0.38, -0.16, 0.12);
        headPivot.add(rightStrand);
        break;
      }
      case 'ponytail': {
        // Hair tie + sphere + tapered ponytail
        const tieGeom = new THREE.TorusGeometry(0.08, 0.03, 6, 16);
        const tieMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
        const tie = new THREE.Mesh(tieGeom, tieMat);
        tie.position.set(0, 0.15, -0.48);
        tie.rotation.x = 0.5;
        headPivot.add(tie);

        const tailBase = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), darkHairMat);
        tailBase.position.set(0, 0.15, -0.52);
        headPivot.add(tailBase);

        const tailGeom = new THREE.ConeGeometry(0.14, 0.52, 10);
        tailGeom.rotateX(-Math.PI / 2.6);
        const tail = new THREE.Mesh(tailGeom, darkHairMat);
        tail.position.set(0, 0.04, -0.68);
        tail.castShadow = true;
        headPivot.add(tail);
        addInvertedHullOutline(tail, 1.06);
        break;
      }
      case 'bun': {
        // Cute round bun sphere on top of the head
        const bunGeom = new THREE.SphereGeometry(0.19, 14, 14);
        const bunMesh = new THREE.Mesh(bunGeom, hairMat);
        bunMesh.position.set(0, 0.52, -0.02);
        bunMesh.scale.set(1.1, 0.9, 1.1);
        bunMesh.castShadow = true;
        headPivot.add(bunMesh);
        addInvertedHullOutline(bunMesh, 1.06);
        break;
      }
      case 'curly': {
        // Cluster of small rounded curl spheres
        const curlGeom = new THREE.SphereGeometry(0.12, 10, 10);
        const curlOffsets = [
          [-0.32, 0.28, 0.1],
          [0.32, 0.28, 0.1],
          [-0.38, 0.08, 0.15],
          [0.38, 0.08, 0.15],
          [0.0, 0.44, 0.15],
          [-0.18, 0.40, 0.22],
          [0.18, 0.40, 0.22],
          [0.0, 0.25, -0.42],
        ];
        curlOffsets.forEach(([cx, cy, cz]) => {
          const curl = new THREE.Mesh(curlGeom, hairMat);
          curl.position.set(cx, cy, cz);
          curl.castShadow = true;
          headPivot.add(curl);
        });
        break;
      }
      case 'short':
      default:
        // Shell + bangs already cleanly formed
        break;
    }
  }

  /**
   * Stubby short legs & rounded shoes
   */
  private buildStubbyLegs(torsoPivot: THREE.Group, bottomMat: THREE.Material, shoesMat: THREE.Material) {
    const legGeom = new THREE.CylinderGeometry(0.09, 0.08, 0.32, 12);
    const shoeGeom = new THREE.CapsuleGeometry(0.08, 0.14, 6, 10);
    shoeGeom.rotateX(Math.PI / 2);

    // Left Leg
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.15, -0.22, 0);
    torsoPivot.add(leftLegGroup);
    this.rigParts.leftLegPivot = leftLegGroup;

    const leftLegMesh = new THREE.Mesh(legGeom, bottomMat);
    leftLegMesh.position.set(0, -0.15, 0);
    leftLegMesh.castShadow = true;
    leftLegGroup.add(leftLegMesh);

    const leftShoe = new THREE.Mesh(shoeGeom, shoesMat);
    leftShoe.position.set(0, -0.30, 0.05);
    leftShoe.scale.set(1.0, 0.8, 1.25);
    leftShoe.castShadow = true;
    leftLegGroup.add(leftShoe);

    // Right Leg
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.15, -0.22, 0);
    torsoPivot.add(rightLegGroup);
    this.rigParts.rightLegPivot = rightLegGroup;

    const rightLegMesh = new THREE.Mesh(legGeom, bottomMat);
    rightLegMesh.position.set(0, -0.15, 0);
    rightLegMesh.castShadow = true;
    rightLegGroup.add(rightLegMesh);

    const rightShoe = new THREE.Mesh(shoeGeom, shoesMat);
    rightShoe.position.set(0, -0.30, 0.05);
    rightShoe.scale.set(1.0, 0.8, 1.25);
    rightShoe.castShadow = true;
    rightLegGroup.add(rightShoe);
  }

  /**
   * Stubby short arms & mitten hands
   */
  private buildStubbyArms(torsoPivot: THREE.Group, topMat: THREE.Material, skinMat: THREE.Material) {
    const armGeom = new THREE.CapsuleGeometry(0.07, 0.18, 6, 10);
    const handGeom = new THREE.SphereGeometry(0.08, 12, 12);

    // Left Arm
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.28, 0.14, 0);
    torsoPivot.add(leftArmGroup);
    this.rigParts.leftArmPivot = leftArmGroup;

    const leftArmMesh = new THREE.Mesh(armGeom, topMat);
    leftArmMesh.position.set(0, -0.12, 0);
    leftArmMesh.rotation.z = -0.18;
    leftArmMesh.castShadow = true;
    leftArmGroup.add(leftArmMesh);

    const leftHand = new THREE.Mesh(handGeom, skinMat);
    leftHand.position.set(-0.02, -0.25, 0);
    leftHand.scale.set(1.0, 1.1, 0.9);
    leftHand.castShadow = true;
    leftArmGroup.add(leftHand);

    // Right Arm
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.28, 0.14, 0);
    torsoPivot.add(rightArmGroup);
    this.rigParts.rightArmPivot = rightArmGroup;

    const rightArmMesh = new THREE.Mesh(armGeom, topMat);
    rightArmMesh.position.set(0, -0.12, 0);
    rightArmMesh.rotation.z = 0.18;
    rightArmMesh.castShadow = true;
    rightArmGroup.add(rightArmMesh);

    const rightHand = new THREE.Mesh(handGeom, skinMat);
    rightHand.position.set(0.02, -0.25, 0);
    rightHand.scale.set(1.0, 1.1, 0.9);
    rightHand.castShadow = true;
    rightArmGroup.add(rightHand);
  }

  /**
   * Attaches accessories from spec:
   * - round glasses (two torus rims + bridge slightly in front of eyes)
   * - cap with brim
   * - earrings
   * - small backpack
   * - scarf
   */
  private attachAccessories(headPivot: THREE.Group, torsoPivot: THREE.Group) {
    const accessories = this.spec.accessories || [];

    // 1. Round Glasses
    if (accessories.includes('glasses')) {
      const glassesGroup = new THREE.Group();
      glassesGroup.position.set(0, -0.065, 0.44);

      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x18181b,
        metalness: 0.8,
        roughness: 0.3,
      });

      const rimGeom = new THREE.TorusGeometry(0.095, 0.015, 8, 20);
      const leftRim = new THREE.Mesh(rimGeom, frameMat);
      leftRim.position.set(-0.165, 0, 0);
      glassesGroup.add(leftRim);

      const rightRim = new THREE.Mesh(rimGeom, frameMat);
      rightRim.position.set(0.165, 0, 0);
      glassesGroup.add(rightRim);

      const bridgeGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.11);
      bridgeGeom.rotateZ(Math.PI / 2);
      const bridge = new THREE.Mesh(bridgeGeom, frameMat);
      glassesGroup.add(bridge);

      headPivot.add(glassesGroup);
    }

    // 2. Cap with Brim
    if (accessories.includes('cap')) {
      const capGroup = new THREE.Group();
      capGroup.position.set(0, 0.22, 0);

      const capMat = new THREE.MeshToonMaterial({
        color: new THREE.Color(this.spec.topColor || '#861F41'),
        gradientMap: getThreeStepGradientMap(),
      });

      const capDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.46),
        capMat
      );
      capGroup.add(capDome);
      addInvertedHullOutline(capDome, 1.05);

      // Visor Brim
      const brimGeom = new THREE.CylinderGeometry(0.46, 0.46, 0.03, 16, 1, false, -0.65, 1.3);
      brimGeom.rotateX(0.25);
      const brim = new THREE.Mesh(brimGeom, capMat);
      brim.position.set(0, 0.12, 0.24);
      capGroup.add(brim);

      headPivot.add(capGroup);
    }

    // 3. Earrings
    if (accessories.includes('earrings')) {
      const earringMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.9,
        roughness: 0.2,
      });
      const earringGeom = new THREE.TorusGeometry(0.05, 0.012, 6, 16);

      const leftEarring = new THREE.Mesh(earringGeom, earringMat);
      leftEarring.position.set(-0.45, -0.06, 0.05);
      leftEarring.rotation.y = Math.PI / 2;
      headPivot.add(leftEarring);

      const rightEarring = new THREE.Mesh(earringGeom, earringMat);
      rightEarring.position.set(0.45, -0.06, 0.05);
      rightEarring.rotation.y = Math.PI / 2;
      headPivot.add(rightEarring);
    }

    // 4. Small Backpack
    if (accessories.includes('bag')) {
      const bagGroup = new THREE.Group();
      bagGroup.position.set(0, 0.02, -0.26);

      const bagMat = new THREE.MeshToonMaterial({
        color: 0x92400e,
        gradientMap: getThreeStepGradientMap(),
      });

      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.14), bagMat);
      pack.castShadow = true;
      bagGroup.add(pack);
      addInvertedHullOutline(pack, 1.06);

      const pocket = new THREE.Mesh(
        new THREE.BoxGeometry(0.20, 0.14, 0.06),
        new THREE.MeshToonMaterial({ color: 0xb45309, gradientMap: getThreeStepGradientMap() })
      );
      pocket.position.set(0, -0.06, -0.09);
      bagGroup.add(pocket);

      torsoPivot.add(bagGroup);
    }

    // 5. Scarf
    if (accessories.includes('scarf')) {
      const scarfMat = new THREE.MeshToonMaterial({
        color: 0xd97706,
        gradientMap: getThreeStepGradientMap(),
      });

      const scarfRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.08, 8, 18), scarfMat);
      scarfRing.rotation.x = Math.PI / 2;
      scarfRing.position.set(0, 0.26, 0);
      torsoPivot.add(scarfRing);

      const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.04), scarfMat);
      scarfTail.position.set(0.14, 0.10, 0.24);
      scarfTail.rotation.z = -0.15;
      torsoPivot.add(scarfTail);
    }
  }

  /**
   * Derives a deterministic hair style if none was given
   */
  private deriveHairStyle(): HairStyle {
    const preset = (this.spec.basePreset || '').toLowerCase();
    if (preset.includes('designer') || preset.includes('chic')) return 'bob';
    if (preset.includes('photographer') || preset.includes('cozy')) return 'curly';
    if (preset.includes('night') || preset.includes('owl')) return 'ponytail';
    if (this.spec.isMe) return 'short';
    return 'short';
  }

  /**
   * Triggers a joyful jump and wave celebration at memorable moments!
   */
  public triggerHappyMoment() {
    this.isCelebrating = true;
    this.celebrateTimer = 0;
  }

  /**
   * Main animation loop:
   * - Walk cycle with bounce and slight squash & stretch on each step
   * - Head bob
   * - Blink every 3-5 s (scale eyes Y to 0.1 for 120 ms)
   * - Idle sway
   * - Happy jump and wave at moments
   */
  public update(delta: number, isWalking: boolean = true) {
    // 1. Blink Cycle (every 3-5 seconds, blink lasts 120 ms)
    this.blinkTimer += delta;
    if (!this.isBlinking && this.blinkTimer > 3.6) {
      this.isBlinking = true;
      this.blinkDuration = 0;
      this.blinkTimer = 0;
    }

    if (this.isBlinking) {
      this.blinkDuration += delta;
      if (this.rigParts.leftEye && this.rigParts.rightEye) {
        this.rigParts.leftEye.scale.y = 0.1;
        this.rigParts.rightEye.scale.y = 0.1;
      }
      if (this.blinkDuration > 0.12) {
        this.isBlinking = false;
        if (this.rigParts.leftEye && this.rigParts.rightEye) {
          this.rigParts.leftEye.scale.y = 1.35;
          this.rigParts.rightEye.scale.y = 1.35;
        }
      }
    }

    // 2. "We Did It!" Moment Arrival Celebration: Stop, Face Camera, Big Smile & Double-Arm Jump!
    if (this.isCelebrating) {
      this.celebrateTimer += delta;
      const duration = 2.4;
      const progress = this.celebrateTimer / duration;

      if (progress < 1.0) {
        // 3 energetic victory hops ("Hurray / We did it!")
        const hopPhase = progress * Math.PI * 3;
        const jumpSin = Math.abs(Math.sin(hopPhase));
        const jumpY = jumpSin * 0.56;

        if (this.rigParts.torsoPivot) {
          this.rigParts.torsoPivot.position.y = 0.52 + jumpY;
          // Squash on landing, stretch at apex
          const stretch = (jumpSin - 0.35) * 0.16;
          this.rigParts.torsoPivot.scale.set(1.0 - stretch * 0.5, 1.0 + stretch, 1.0 - stretch * 0.5);
          this.rigParts.torsoPivot.rotation.y = Math.sin(this.celebrateTimer * 10) * 0.12;
        }

        // Both arms raised high in a triumphant V-Cheer ("We did it!") waving joyfully
        if (this.rigParts.leftArmPivot) {
          this.rigParts.leftArmPivot.rotation.z = -2.45 + Math.sin(this.celebrateTimer * 18) * 0.25;
          this.rigParts.leftArmPivot.rotation.x = Math.cos(this.celebrateTimer * 18) * 0.35;
        }
        if (this.rigParts.rightArmPivot) {
          this.rigParts.rightArmPivot.rotation.z = 2.45 - Math.sin(this.celebrateTimer * 18) * 0.25;
          this.rigParts.rightArmPivot.rotation.x = -Math.cos(this.celebrateTimer * 18) * 0.35;
        }

        // Happy mid-air leg kick on jumps
        if (this.rigParts.leftLegPivot && this.rigParts.rightLegPivot) {
          this.rigParts.leftLegPivot.rotation.x = -jumpSin * 0.45;
          this.rigParts.rightLegPivot.rotation.x = jumpSin * 0.35;
        }

        // Cheerful head tilt & nod toward camera
        if (this.rigParts.headPivot) {
          this.rigParts.headPivot.position.y = 0.38 + jumpSin * 0.04;
          this.rigParts.headPivot.rotation.z = Math.sin(this.celebrateTimer * 10) * 0.14;
          this.rigParts.headPivot.rotation.x = -0.08;
        }

        // Big radiant smile & glowing rosy cheeks ("웃으면서")
        if (this.rigParts.mouth) {
          this.rigParts.mouth.scale.set(1.75, 2.15, 1.3);
        }
        if (this.rigParts.leftBlush && this.rigParts.rightBlush) {
          this.rigParts.leftBlush.scale.set(1.85, 0.9, 1.0);
          this.rigParts.rightBlush.scale.set(1.85, 0.9, 1.0);
        }
        if (!this.isBlinking && this.rigParts.leftEye && this.rigParts.rightEye) {
          // Happy squinting/sparkling eyes while smiling
          this.rigParts.leftEye.scale.set(0.86, 1.15, 0.35);
          this.rigParts.rightEye.scale.set(0.86, 1.15, 0.35);
        }

        // Spin golden victory sparkles above head
        if (this.rigParts.celebrateGroup) {
          this.rigParts.celebrateGroup.visible = true;
          this.rigParts.celebrateGroup.rotation.y += delta * 4.5;
          this.rigParts.celebrateGroup.position.y = 0.66 + jumpSin * 0.12;
        }
        return;
      } else {
        this.isCelebrating = false;
        if (this.rigParts.torsoPivot) {
          this.rigParts.torsoPivot.position.y = 0.52;
          this.rigParts.torsoPivot.scale.set(1, 1, 1);
          this.rigParts.torsoPivot.rotation.set(0, 0, 0);
        }
        if (this.rigParts.leftArmPivot) {
          this.rigParts.leftArmPivot.rotation.set(0, 0, 0);
        }
        if (this.rigParts.rightArmPivot) {
          this.rigParts.rightArmPivot.rotation.set(0, 0, 0);
        }
        if (this.rigParts.leftLegPivot && this.rigParts.rightLegPivot) {
          this.rigParts.leftLegPivot.rotation.set(0, 0, 0);
          this.rigParts.rightLegPivot.rotation.set(0, 0, 0);
        }
        if (this.rigParts.headPivot) {
          this.rigParts.headPivot.rotation.set(0, 0, 0);
        }
        if (this.rigParts.mouth) {
          this.rigParts.mouth.scale.set(1, 1, 1);
        }
        if (this.rigParts.leftBlush && this.rigParts.rightBlush) {
          this.rigParts.leftBlush.scale.set(1.4, 0.65, 1.0);
          this.rigParts.rightBlush.scale.set(1.4, 0.65, 1.0);
        }
        if (this.rigParts.leftEye && this.rigParts.rightEye) {
          this.rigParts.leftEye.scale.set(0.72, 1.35, 0.35);
          this.rigParts.rightEye.scale.set(0.72, 1.35, 0.35);
        }
        if (this.rigParts.celebrateGroup) {
          this.rigParts.celebrateGroup.visible = false;
        }
      }
    }

    // 3. Walk Cycle or Idle Sway
    if (isWalking) {
      const walkSpeed = 12.0;
      this.walkPhase += delta * walkSpeed;

      const legSwing = Math.sin(this.walkPhase) * 0.55;
      const armSwing = Math.sin(this.walkPhase) * 0.45;
      const stepBounce = Math.abs(Math.cos(this.walkPhase)) * 0.05;

      // Leg swings in opposition
      if (this.rigParts.leftLegPivot) this.rigParts.leftLegPivot.rotation.x = legSwing;
      if (this.rigParts.rightLegPivot) this.rigParts.rightLegPivot.rotation.x = -legSwing;

      // Arm swings in opposition
      if (this.rigParts.leftArmPivot) this.rigParts.leftArmPivot.rotation.x = -armSwing;
      if (this.rigParts.rightArmPivot) this.rigParts.rightArmPivot.rotation.x = armSwing;

      // Torso step bounce + Squash & Stretch
      if (this.rigParts.torsoPivot) {
        this.rigParts.torsoPivot.position.y = 0.52 + stepBounce;
        this.rigParts.torsoPivot.rotation.y = Math.sin(this.walkPhase) * 0.08;
        // Subtle squash and stretch on landing
        const squash = Math.sin(this.walkPhase * 2) * 0.04;
        this.rigParts.torsoPivot.scale.y = 1.0 + squash;
        this.rigParts.torsoPivot.scale.x = 1.0 - squash * 0.5;
        this.rigParts.torsoPivot.scale.z = 1.0 - squash * 0.5;
      }

      // Head bob & subtle tilt
      if (this.rigParts.headPivot) {
        this.rigParts.headPivot.position.y = 0.38 + Math.sin(this.walkPhase * 2) * 0.02;
        this.rigParts.headPivot.rotation.z = Math.sin(this.walkPhase) * 0.04;
      }
    } else {
      // Idle gentle breathing sway
      this.idlePhase += delta * 2.5;
      const breath = Math.sin(this.idlePhase) * 0.02;

      if (this.rigParts.torsoPivot) {
        this.rigParts.torsoPivot.position.y = 0.52 + breath * 0.5;
        this.rigParts.torsoPivot.scale.y = 1.0 + breath * 0.6;
        this.rigParts.torsoPivot.rotation.y = 0;
      }

      if (this.rigParts.headPivot) {
        this.rigParts.headPivot.position.y = 0.38 + breath * 0.2;
        this.rigParts.headPivot.rotation.z = Math.sin(this.idlePhase * 0.6) * 0.03;
      }

      if (this.rigParts.leftLegPivot) this.rigParts.leftLegPivot.rotation.x = 0;
      if (this.rigParts.rightLegPivot) this.rigParts.rightLegPivot.rotation.x = 0;
      if (this.rigParts.leftArmPivot) this.rigParts.leftArmPivot.rotation.x = 0;
      if (this.rigParts.rightArmPivot) this.rigParts.rightArmPivot.rotation.x = 0;
    }
  }
}
