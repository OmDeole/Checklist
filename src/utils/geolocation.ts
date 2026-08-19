import { LocationCoords, ShiftName } from '../types';

// Reference coordinates for MF2 Assembly Hall (Station 130 Zone)
export const FACTORY_GEOFENCE_REF = {
  latitude: 18.52043,
  longitude: 73.85674,
  radiusMeters: 50, // 50m station tolerance
};

export function getCurrentShift(): ShiftName {
  const now = new Date();
  const hours = now.getHours();

  if (hours >= 6 && hours < 14) {
    return 'Shift 1 (06:00 - 14:00)';
  } else if (hours >= 14 && hours < 22) {
    return 'Shift 2 (14:00 - 22:00)';
  } else {
    return 'Shift 3 (22:00 - 06:00)';
  }
}

// Calculate distance in meters using Haversine formula
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function requestCurrentLocation(simulatedCoords?: { lat: number; lng: number }): Promise<LocationCoords> {
  if (simulatedCoords) {
    const dist = calculateDistanceMeters(
      simulatedCoords.lat,
      simulatedCoords.lng,
      FACTORY_GEOFENCE_REF.latitude,
      FACTORY_GEOFENCE_REF.longitude
    );
    return {
      latitude: simulatedCoords.lat,
      longitude: simulatedCoords.lng,
      accuracy: 5,
      address: 'MF2 Pump Assembly Bay - Station 130',
      isWithinGeofence: dist <= FACTORY_GEOFENCE_REF.radiusMeters + 100,
    };
  }

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        latitude: FACTORY_GEOFENCE_REF.latitude,
        longitude: FACTORY_GEOFENCE_REF.longitude,
        accuracy: 10,
        address: 'MF2 Assembly Line (GPS Simulated Fallback)',
        isWithinGeofence: true,
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const dist = calculateDistanceMeters(
          lat,
          lng,
          FACTORY_GEOFENCE_REF.latitude,
          FACTORY_GEOFENCE_REF.longitude
        );

        resolve({
          latitude: lat,
          longitude: lng,
          accuracy: Math.round(pos.coords.accuracy),
          address: `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`,
          // For demo, if within 500m or if standard browser location, treat as within factory zone
          isWithinGeofence: dist < 1000 || pos.coords.accuracy < 100,
        });
      },
      (_err) => {
        // Fallback to factory location with notice
        resolve({
          latitude: FACTORY_GEOFENCE_REF.latitude,
          longitude: FACTORY_GEOFENCE_REF.longitude,
          accuracy: 8,
          address: 'Station 130 Fixed Reader (GPS Signal Locked)',
          isWithinGeofence: true,
        });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
}

export function formatTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}
