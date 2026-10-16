import * as THREE from 'three';

export interface GeoCoord {
  lat: number;
  lng: number;
}

/**
 * Calculates geographic centroid of an array of coordinates
 */
export function calculateCentroid(points: GeoCoord[]): GeoCoord {
  if (points.length === 0) {
    return { lat: 37.585, lng: 127.029 }; // Default: Anam, Seoul
  }
  let sumLat = 0;
  let sumLng = 0;
  for (const p of points) {
    sumLat += p.lat;
    sumLng += p.lng;
  }
  return {
    lat: sumLat / points.length,
    lng: sumLng / points.length,
  };
}

/**
 * Calculates the bounding geographic distance and optimal angular coverage (typically ~82°-88°)
 * so any user journey (whether 800m or 15km) maps across the full explorable globe!
 */
export function calculateJourneyBounds(
  points: GeoCoord[],
  centroid: GeoCoord
): { maxDistKm: number; maxAngularRad: number } {
  if (points.length === 0) {
    return { maxDistKm: 1.5, maxAngularRad: (82 * Math.PI) / 180 };
  }
  let maxD = 0;
  for (const p of points) {
    const dLat = (p.lat - centroid.lat) * 111.0;
    const dLng = (p.lng - centroid.lng) * 88.0;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist > maxD) maxD = dist;
  }
  // Soft padding and minimum scale so even a tight cluster spreads across the planet
  const scaleDistKm = Math.max(maxD * 1.08, 0.45);
  // Default span: ~82 degrees (1.43 rad), wrapping across the entire upper-to-equatorial hemisphere
  const maxAngularRad = (84 * Math.PI) / 180;
  return { maxDistKm: scaleDistKm, maxAngularRad };
}

/**
 * Maps lat/lng onto the 3D planet using an azimuthal equidistant projection from the centroid.
 * Scaled dynamically so the user's route and moments naturally wrap across the globe.
 */
export function projectGeoToSphere(
  coord: GeoCoord,
  centroid: GeoCoord,
  planetRadius: number,
  maxAngularDistanceRad: number = (84 * Math.PI) / 180,
  maxGeoDistanceKm: number = 2.0
): THREE.Vector3 {
  // Approximate distance in km using equirectangular approximation for Seoul area
  const dLat = (coord.lat - centroid.lat) * 111.0;
  const dLng = (coord.lng - centroid.lng) * 88.0;
  const distKm = Math.sqrt(dLat * dLat + dLng * dLng);

  // Bearing angle from centroid (-PI to +PI around sphere Y axis)
  const bearing = Math.atan2(dLng, dLat);

  // Soft power curve to space out moments pleasantly across the spherical surface
  const normDist = Math.min(1.25, distKm / Math.max(maxGeoDistanceKm, 0.3));
  const spreadDist = Math.pow(normDist, 0.88);
  const theta = spreadDist * maxAngularDistanceRad;

  // Convert spherical coords (theta from +Y axis, phi = bearing) to 3D Cartesian
  const r = planetRadius;
  const x = r * Math.sin(theta) * Math.sin(bearing);
  const y = r * Math.cos(theta);
  const z = r * Math.sin(theta) * Math.cos(bearing);

  return new THREE.Vector3(x, y, z);
}

/**
 * Calculates surface normal on sphere at position
 */
export function getSurfaceNormal(position: THREE.Vector3): THREE.Vector3 {
  return position.clone().normalize();
}

/**
 * Creates rotation matrix aligning an object's +Y with the surface normal
 * and object's +Z with the tangent direction
 */
export function alignToSurface(
  object: THREE.Object3D,
  position: THREE.Vector3,
  tangent?: THREE.Vector3
) {
  const normal = position.clone().normalize();
  const up = normal.clone();

  let forward: THREE.Vector3;
  if (tangent && tangent.lengthSq() > 0.0001) {
    forward = tangent.clone().projectOnPlane(normal).normalize();
  } else {
    // Pick an arbitrary orthogonal vector
    const arbitrary = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    forward = arbitrary.clone().projectOnPlane(normal).normalize();
  }

  const right = new THREE.Vector3().crossVectors(up, forward).normalize();
  forward.crossVectors(right, up).normalize();

  const rotMatrix = new THREE.Matrix4().makeBasis(right, up, forward);
  object.setRotationFromMatrix(rotMatrix);
  object.position.copy(position);
}
