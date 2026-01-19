/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/set-state-in-effect */
import { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from 'react';

const LoadingContext = createContext(null);

export function LoadingProvider({ children }) {
  const [activeIds, setActiveIds] = useState(() => new Set());
  const [overlayMounted, setOverlayMounted] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [landingP5Ready, setLandingP5Ready] = useState(true);

  const shownAtRef = useRef(0);
  const hideTimerRef = useRef(null);
  const unmountTimerRef = useRef(null);
  const landingP5TimerRef = useRef(null);

  const MIN_VISIBLE_MS = 1000;
  const FADE_MS = 450;
  const LANDING_P5_DELAY_MS = 950;

  const start = useCallback((id) => {
    if (!id) return;
    setActiveIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const stop = useCallback((id) => {
    if (!id) return;
    setActiveIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const activeCount = activeIds.size;
  const active = activeCount > 0;

  // Drive overlay visibility with "min 1s + fade" behavior in one place,
  // so other components (like p5) can wait until the overlay is fully gone.
  useEffect(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);

    if (active) {
      setOverlayMounted(true);
      setOverlayVisible(true);
      setLandingP5Ready(false);
      shownAtRef.current = Date.now();
      return undefined;
    }

    if (!overlayMounted) return undefined;

    const elapsed = Date.now() - (shownAtRef.current || 0);
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

    hideTimerRef.current = setTimeout(() => {
      setOverlayVisible(false);
      unmountTimerRef.current = setTimeout(() => {
        setOverlayMounted(false);
      }, FADE_MS);
    }, wait);

    return undefined;
  }, [active, overlayMounted]);

  // Allow Landing p5 to start slightly before the overlay fade fully completes.
  // If loading takes longer than LANDING_P5_DELAY_MS, it starts immediately when loading ends.
  useEffect(() => {
    if (landingP5TimerRef.current) clearTimeout(landingP5TimerRef.current);

    if (active) {
      setLandingP5Ready(false);
      return undefined;
    }

    // If the overlay never showed, start immediately.
    if (!shownAtRef.current) {
      setLandingP5Ready(true);
      return undefined;
    }

    const elapsed = Date.now() - shownAtRef.current;
    const wait = Math.max(0, LANDING_P5_DELAY_MS - elapsed);
    if (wait === 0) {
      setLandingP5Ready(true);
      return undefined;
    }

    landingP5TimerRef.current = setTimeout(() => {
      setLandingP5Ready(true);
    }, wait);

    return undefined;
  }, [active]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
      if (landingP5TimerRef.current) clearTimeout(landingP5TimerRef.current);
    };
  }, []);

  const value = useMemo(
    () => ({
      activeCount,
      activeIds,
      overlayMounted,
      overlayVisible,
      landingP5Ready,
      start,
      stop,
    }),
    [activeCount, activeIds, overlayMounted, overlayVisible, landingP5Ready, start, stop]
  );

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useLoadingContext() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error('useLoadingContext must be used within LoadingProvider');
  }
  return ctx;
}

/**
 * Register a boolean loading flag into the global loader.
 * - When isLoading is true, the id is added.
 * - When isLoading becomes false or the component unmounts, the id is removed.
 */
export function useRegisterLoading(id, isLoading) {
  const { start, stop } = useLoadingContext();
  const lastIdRef = useRef(id);

  // Keep the set clean if the id prop changes.
  useEffect(() => {
    const last = lastIdRef.current;
    if (last && last !== id) stop(last);
    lastIdRef.current = id;
  }, [id, stop]);

  useEffect(() => {
    if (!id) return;
    if (isLoading) {
      start(id);
      return () => stop(id);
    }
    stop(id);
    return undefined;
  }, [id, isLoading, start, stop]);
}

