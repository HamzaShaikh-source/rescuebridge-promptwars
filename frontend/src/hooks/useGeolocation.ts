/**
 * useGeolocation — high-accuracy position with watch + manual retry.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: number;
}

interface GeoState {
  fix: GeoFix | null;
  error: string | null;
  busy: boolean;
}

const DEFAULT = { fix: null, error: null, busy: false };

export function useGeolocation(options?: PositionOptions) {
  const [state, setState] = useState<GeoState>(DEFAULT);
  const watchId = useRef<number | null>(null);

  const setFix = useCallback((pos: GeolocationPosition) => {
    setState({
      fix: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        timestamp: pos.timestamp,
      },
      error: null,
      busy: false,
    });
  }, []);

  const setError = useCallback((msg: string) => {
    setState((s) => ({ ...s, error: msg, busy: false }));
  }, []);

  const getOnce = useCallback(async (): Promise<GeoFix | null> => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported");
      return null;
    }
    setState((s) => ({ ...s, busy: true }));
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
          ...options,
        });
      });
      setFix(pos);
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
        timestamp: pos.timestamp,
      };
    } catch (e) {
      const code = (e as GeolocationPositionError)?.message ?? "Location unavailable";
      setError(code);
      return null;
    }
  }, [options, setError, setFix]);

  // Optional watch mode
  const startWatch = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    if (watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition(
      setFix,
      (e) => setError(e.message),
      { enableHighAccuracy: true, maximumAge: 5000, ...options },
    );
  }, [options, setError, setFix]);

  const stopWatch = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  useEffect(() => stopWatch, [stopWatch]);

  return { ...state, getOnce, startWatch, stopWatch };
}