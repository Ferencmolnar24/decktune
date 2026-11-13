// Per-visitor state kept in the browser (no accounts): the handheld, its model and battery health,
// and the library. Also the hash router, so the site works on GitHub Pages with no server.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

const listeners = new Map<string, Set<() => void>>();

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`decktune:${key}`);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

const memory = new Map<string, unknown>();

// A value shared by every component that reads the same key, saved across visits when the browser
// allows it (a private window may not; the value then lasts for the visit).
export function useStored<T>(key: string, fallback: T): [T, (v: T | ((old: T) => T)) => void] {
  if (!memory.has(key)) memory.set(key, readStored(key, fallback));
  const subscribe = useCallback((cb: () => void) => {
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(cb);
    return () => set!.delete(cb);
  }, [key]);
  const value = useSyncExternalStore(subscribe, () => memory.get(key) as T);
  const setValue = useCallback((v: T | ((old: T) => T)) => {
    const next = typeof v === 'function' ? (v as (old: T) => T)(memory.get(key) as T) : v;
    memory.set(key, next);
    try {
      localStorage.setItem(`decktune:${key}`, JSON.stringify(next));
    } catch {
      // storage unavailable: keep it in memory for this visit
    }
    listeners.get(key)?.forEach((cb) => cb());
  }, [key]);
  return [value, setValue];
}

// ───────────────────────── Routing ─────────────────────────

export type Route =
  | { page: 'home' }
  | { page: 'game'; appId: number }
  | { page: 'guide' }
  | { page: 'repair' }
  | { page: 'community' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  const [first, second] = path.split('/');
  if (first === 'game' && /^\d+$/.test(second ?? '')) return { page: 'game', appId: Number(second) };
  if (first === 'guide') return { page: 'guide' };
  if (first === 'repair') return { page: 'repair' };
  if (first === 'community') return { page: 'community' };
  return { page: 'home' };
}

export const hrefFor = (route: Route) =>
  route.page === 'game' ? `#/game/${route.appId}` : route.page === 'home' ? '#/' : `#/${route.page}`;

export function navigate(route: Route) {
  window.location.hash = hrefFor(route);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

// A promise's result as state: [value, error, retry].
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): [T | undefined, boolean, () => void] {
  const [state, setState] = useState<{ value?: T; failed: boolean }>({ failed: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState({ failed: false });
    fn().then((value) => live && setState({ value, failed: false }), () => live && setState({ failed: true }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  return [state.value, state.failed, () => setAttempt((a) => a + 1)];
}
