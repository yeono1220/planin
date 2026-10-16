import * as THREE from 'three';
import { RouteSpec } from '../types';
import { projectGeoToSphere, GeoCoord } from './geoMath';

export class RouteVisualizer {
  public group: THREE.Group;
  public curve: THREE.CatmullRomCurve3 | null = null;
  public points3D: THREE.Vector3[] = [];
  public roadRadius: number;

  constructor(
    route: RouteSpec,
    centroid: GeoCoord,
    planetRadius: number,
    colorHex: string = '#F8FAFC',
    maxAngularRad: number = (84 * Math.PI) / 180,
    maxGeoDistanceKm: number = 2.0
  ) {
    this.group = new THREE.Group();
    this.group.name = `Route_Day_${route.day}`;
    this.roadRadius = planetRadius + 0.18;

    if (route.points.length < 2) return;

    // 1. Subdivide and project densely onto spherical radius so curve NEVER sinks into the planet!
    this.points3D = this.buildDenseSphericalPoints(
      route.points,
      centroid,
      this.roadRadius,
      maxAngularRad,
      maxGeoDistanceKm
    );

    if (this.points3D.length < 2) return;

    // 2. Smooth curve through dense spherical surface points
    this.curve = new THREE.CatmullRomCurve3(this.points3D, false, 'centripetal', 0.1);

    // 3. Create Road Ribbon Geometry (flat road on sphere)
    const tubeSegments = Math.max(48, this.points3D.length * 2);
    const tubeGeom = new THREE.TubeGeometry(this.curve, tubeSegments, 0.28, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });
    const roadMesh = new THREE.Mesh(tubeGeom, tubeMat);
    roadMesh.receiveShadow = true;
    this.group.add(roadMesh);

    // 4. White / Cream Center Dashed Walking Line
    const lineCurvePoints = this.curve.getPoints(tubeSegments * 2);
    const dashedPoints = lineCurvePoints.map((p) => {
      const normal = p.clone().normalize();
      return p.clone().add(normal.multiplyScalar(0.08));
    });

    const lineGeom = new THREE.BufferGeometry().setFromPoints(dashedPoints);
    const lineMat = new THREE.LineDashedMaterial({
      color: new THREE.Color(colorHex),
      dashSize: 0.5,
      gapSize: 0.28,
      linewidth: 3,
    });
    const dashedLine = new THREE.Line(lineGeom, lineMat);
    dashedLine.computeLineDistances();
    this.group.add(dashedLine);

    // 5. Build Start and End Plazas (so the road never terminates in thin air!)
    this.addTerminalPlazas(this.points3D[0], this.points3D[this.points3D.length - 1], planetRadius);

    // 6. Roadside Low-Poly Mini Trees and Street Lamps
    this.addRoadDecorations(this.curve, planetRadius);
  }

  /**
   * Generates dense points strictly constrained to roadRadius above the planet surface.
   * Between every waypoint, interpolates short 0.35-unit increments so the curve NEVER sags underground.
   */
  private buildDenseSphericalPoints(
    baseCoords: Array<{ lat: number; lng: number }>,
    centroid: GeoCoord,
    radius: number,
    maxAngularRad: number,
    maxDistKm: number
  ): THREE.Vector3[] {
    const rawWaypoints = baseCoords.map((pt) =>
      projectGeoToSphere(pt, centroid, radius, maxAngularRad, maxDistKm)
    );

    const dense: THREE.Vector3[] = [];

    for (let i = 0; i < rawWaypoints.length - 1; i++) {
      const p1 = rawWaypoints[i];
      const p2 = rawWaypoints[i + 1];

      const v1 = p1.clone().normalize();
      const v2 = p2.clone().normalize();
      const angle = v1.angleTo(v2);

      // Short steps (~0.35 units) prevent straight-line chord sagging into the planet
      const steps = Math.max(3, Math.ceil((angle * radius) / 0.35));

      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        // Spherical lerp: linearly blend direction and strictly normalize to radius
        const interp = new THREE.Vector3().lerpVectors(v1, v2, t).normalize().multiplyScalar(radius);
        dense.push(interp);
      }
    }

    dense.push(rawWaypoints[rawWaypoints.length - 1].clone().normalize().multiplyScalar(radius));
    return dense;
  }

  /**
   * Adds circular stone plazas at road endpoints
   */
  private addTerminalPlazas(startPos: THREE.Vector3, endPos: THREE.Vector3, planetRadius: number) {
    const plazaGeom = new THREE.CylinderGeometry(1.2, 1.25, 0.16, 16);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.9,
      flatShading: true,
    });
    const innerDiscGeom = new THREE.CylinderGeometry(0.85, 0.85, 0.18, 16);
    const innerDiscMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.8,
      flatShading: true,
    });

    [startPos, endPos].forEach((pos) => {
      const plaza = new THREE.Group();
      const base = new THREE.Mesh(plazaGeom, plazaMat);
      base.castShadow = true;
      base.receiveShadow = true;
      plaza.add(base);

      const inner = new THREE.Mesh(innerDiscGeom, innerDiscMat);
      inner.castShadow = true;
      inner.receiveShadow = true;
      plaza.add(inner);

      const normal = pos.clone().normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      plaza.setRotationFromQuaternion(q);
      plaza.position.copy(normal.clone().multiplyScalar(planetRadius + 0.08));

      this.group.add(plaza);
    });
  }

  private addRoadDecorations(curve: THREE.CatmullRomCurve3, planetRadius: number) {
    const treeTrunkGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.45, 5);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });

    const treeFoliageGeom = new THREE.DodecahedronGeometry(0.32, 1);
    const treeFoliageMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.8,
      flatShading: true,
    });

    const lampPostGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.65, 5);
    const lampPostMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const lampBulbGeom = new THREE.SphereGeometry(0.09, 6, 6);
    const lampBulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const samples = 16;
    for (let i = 2; i < samples - 1; i++) {
      const t = i / samples;
      const rawPoint = curve.getPoint(t);
      const normal = rawPoint.clone().normalize();
      const pointOnCurve = normal.clone().multiplyScalar(this.roadRadius);
      const tangent = curve.getTangent(t).projectOnPlane(normal).normalize();
      const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();

      // Push props clear of the walking lane to the roadside curb
      const side = (i % 2 === 0 ? 1 : -1) * 0.85;
      const propPos = pointOnCurve.clone().add(binormal.clone().multiplyScalar(side));

      if (i % 3 === 0) {
        // Street lamp
        const lampGroup = new THREE.Group();
        const post = new THREE.Mesh(lampPostGeom, lampPostMat);
        post.position.y = 0.32;
        lampGroup.add(post);

        const bulb = new THREE.Mesh(lampBulbGeom, lampBulbMat);
        bulb.position.y = 0.65;
        lampGroup.add(bulb);

        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        lampGroup.setRotationFromQuaternion(q);
        lampGroup.position.copy(propPos);
        this.group.add(lampGroup);
      } else {
        // Roadside Tree with dual tiered foliage
        const treeGroup = new THREE.Group();
        const trunk = new THREE.Mesh(treeTrunkGeom, treeTrunkMat);
        trunk.position.y = 0.22;
        treeGroup.add(trunk);

        const lowerCrown = new THREE.Mesh(treeFoliageGeom, treeFoliageMat);
        lowerCrown.position.y = 0.45;
        lowerCrown.scale.set(1.1, 0.9, 1.1);
        treeGroup.add(lowerCrown);

        const upperCrown = new THREE.Mesh(treeFoliageGeom, treeFoliageMat);
        upperCrown.position.y = 0.72;
        upperCrown.scale.set(0.8, 0.8, 0.8);
        treeGroup.add(upperCrown);

        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
        treeGroup.setRotationFromQuaternion(q);
        treeGroup.position.copy(propPos);
        this.group.add(treeGroup);
      }
    }
  }

  public getPositionAt(t: number): { position: THREE.Vector3; tangent: THREE.Vector3 } | null {
    if (!this.curve) return null;
    const clampedT = Math.max(0, Math.min(1, t));
    const rawPoint = this.curve.getPoint(clampedT);
    const position = rawPoint.clone().normalize().multiplyScalar(this.roadRadius);
    const tangent = this.curve.getTangent(clampedT).normalize();
    return { position, tangent };
  }
}
