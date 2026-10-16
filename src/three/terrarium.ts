import * as THREE from 'three';

export class MemoryTerrarium {
  public group: THREE.Group;
  public glassDome: THREE.Mesh;
  public woodenStand: THREE.Group;

  constructor(planetRadius: number = 24) {
    this.group = new THREE.Group();
    this.group.name = 'MemoryTerrarium';

    // 1. Turned Walnut Wooden Stand Base beneath planet
    this.woodenStand = new THREE.Group();
    this.woodenStand.name = 'WalnutStand';

    const walnutMat = new THREE.MeshStandardMaterial({
      color: 0x3E2723, // Deep rich walnut wood
      roughness: 0.7,
      metalness: 0.05,
    });
    const brassTrimMat = new THREE.MeshStandardMaterial({
      color: 0xD4AF37, // Polished brass accent ring
      roughness: 0.25,
      metalness: 0.8,
    });

    // Tier 1: Wide round table base
    const baseGeom = new THREE.CylinderGeometry(planetRadius * 0.7, planetRadius * 0.75, 1.6, 32);
    const baseMesh = new THREE.Mesh(baseGeom, walnutMat);
    baseMesh.position.y = -planetRadius - 2.0;
    baseMesh.receiveShadow = true;
    this.woodenStand.add(baseMesh);

    // Tier 2: Turned neck
    const neckGeom = new THREE.CylinderGeometry(planetRadius * 0.5, planetRadius * 0.65, 1.2, 32);
    const neckMesh = new THREE.Mesh(neckGeom, walnutMat);
    neckMesh.position.y = -planetRadius - 0.7;
    this.woodenStand.add(neckMesh);

    // Tier 3: Polished brass rim cradle
    const rimGeom = new THREE.TorusGeometry(planetRadius * 0.52, 0.45, 12, 32);
    rimGeom.rotateX(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeom, brassTrimMat);
    rimMesh.position.y = -planetRadius + 0.1;
    this.woodenStand.add(rimMesh);

    this.group.add(this.woodenStand);

    // 2. Optical Glass Terrarium Shell Dome (MeshPhysicalMaterial with transmission)
    const glassGeom = new THREE.SphereGeometry(planetRadius * 1.35, 48, 48);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.75, // Transmissive glass
      opacity: 1.0,
      transparent: true,
      roughness: 0.08,
      ior: 1.48, // Glass refraction
      thickness: 0.8,
      depthWrite: false,
    });

    this.glassDome = new THREE.Mesh(glassGeom, glassMat);
    this.glassDome.name = 'GlassTerrariumDome';
    this.group.add(this.glassDome);
  }

  public setGlassVisible(visible: boolean) {
    this.glassDome.visible = visible;
  }

  public dispose() {
    this.glassDome.geometry.dispose();
    (this.glassDome.material as THREE.Material).dispose();
  }
}
