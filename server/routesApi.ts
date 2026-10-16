import { RoutePointSchema, RouteSpec } from '../src/types';

/**
 * Decodes Google encoded polyline string to [lat, lng] array
 */
function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }

  return points;
}

/**
 * Builds walking route between consecutive points using Google Routes API
 * or falls back to grid-snapped walking path with realistic alley turns
 */
export async function computeWalkingRoute(
  day: number,
  moments: Array<{ lat: number; lng: number }>
): Promise<RouteSpec> {
  if (moments.length < 2) {
    return {
      day,
      source: 'grid',
      points: moments,
      distanceMeters: 0,
      durationSeconds: 0,
    };
  }

  const apiKey = process.env.MAPS_API_KEY || process.env.VITE_MAPS_API_KEY;

  if (apiKey) {
    try {
      const allPoints: Array<{ lat: number; lng: number }> = [];
      let totalDistance = 0;
      let totalDuration = 0;

      for (let i = 0; i < moments.length - 1; i++) {
        const origin = moments[i];
        const dest = moments[i + 1];

        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration',
          },
          body: JSON.stringify({
            origin: {
              location: {
                latLng: { latitude: origin.lat, longitude: origin.lng },
              },
            },
            destination: {
              location: {
                latLng: { latitude: dest.lat, longitude: dest.lng },
              },
            },
            travelMode: 'WALK',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const route = data.routes?.[0];
          if (route?.polyline?.encodedPolyline) {
            const decoded = decodePolyline(route.polyline.encodedPolyline);
            if (i > 0) {
              allPoints.push(...decoded.slice(1));
            } else {
              allPoints.push(...decoded);
            }
            totalDistance += route.distanceMeters || 1000;
            const dur = route.duration ? parseInt(route.duration.replace('s', ''), 10) : 600;
            totalDuration += dur;
            continue;
          }
        }
      }

      if (allPoints.length >= 2) {
        return {
          day,
          source: 'routes_api',
          points: allPoints,
          distanceMeters: totalDistance,
          durationSeconds: totalDuration,
        };
      }
    } catch (err) {
      console.warn('Google Routes API fetch error, falling back to grid-snapped path:', err);
    }
  }

  // Fallback: Grid-snapped path with right-angle turns & smooth interpolation
  return buildGridSnappedRoute(day, moments);
}

/**
 * Grid-snapped path with right-angle turns mimicking Seoul street alleys
 */
export function buildGridSnappedRoute(
  day: number,
  moments: Array<{ lat: number; lng: number }>
): RouteSpec {
  const points: Array<{ lat: number; lng: number }> = [];
  let totalDist = 0;

  for (let i = 0; i < moments.length - 1; i++) {
    const p1 = moments[i];
    const p2 = moments[i + 1];

    if (i === 0) points.push(p1);

    // Create an intermediate Manhattan right-angle corner with slight Seoul alley jitter
    const mid1 = { lat: p1.lat, lng: p1.lng + (p2.lng - p1.lng) * 0.5 };
    const mid2 = { lat: p2.lat, lng: p1.lng + (p2.lng - p1.lng) * 0.5 };

    // Subdivide segments smoothly
    const segs = [p1, mid1, mid2, p2];
    for (let s = 1; s < segs.length; s++) {
      const a = segs[s - 1];
      const b = segs[s];
      // Insert intermediate step
      points.push({
        lat: a.lat + (b.lat - a.lat) * 0.5,
        lng: a.lng + (b.lng - a.lng) * 0.5,
      });
      points.push(b);

      const dLat = (b.lat - a.lat) * 111000;
      const dLng = (b.lng - a.lng) * 88000;
      totalDist += Math.sqrt(dLat * dLat + dLng * dLng);
    }
  }

  return {
    day,
    source: 'grid',
    points,
    distanceMeters: Math.round(totalDist),
    durationSeconds: Math.round((totalDist / 1.3)), // ~1.3 m/s walking speed
  };
}
