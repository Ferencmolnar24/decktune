import { useStored } from './state';
import { resolveModel, type DeviceId } from './handhelds';

export interface LibraryEntry { appId: number; name: string; image?: string; added: string }

export function useLibrary() {
  const [library, setLibrary] = useStored<LibraryEntry[]>('library', []);
  const [lastRemoved, setLastRemoved] = useStored<LibraryEntry | null>('library-last-removed', null);

  const has = (appId: number) => library.some((e) => e.appId === appId);
  const remove = (appId: number) => {
    const entry = library.find((e) => e.appId === appId);
    if (!entry) return;
    setLibrary((l) => l.filter((e) => e.appId !== appId));
    setLastRemoved(entry);
  };
  const add = (game: { appId: number; name: string; image?: string }) => {
    if (has(game.appId)) return;
    setLibrary((l) => [...l, { appId: game.appId, name: game.name, image: game.image, added: new Date().toISOString() }]);
    setLastRemoved(null);
  };
  const undo = () => {
    if (lastRemoved && !has(lastRemoved.appId)) setLibrary((l) => [...l, lastRemoved]);
    setLastRemoved(null);
  };
  const toggle = (game: { appId: number; name: string; image?: string }) => (has(game.appId) ? remove(game.appId) : add(game));
  return { library, has, add, remove, toggle, undo, lastRemoved };
}

export function useBatteryHealth() {
  return useStored<number>('battery-health', 100);
}

export function useModel(device: DeviceId) {
  const [modelId, setModelId] = useStored<string>('model', '');
  return [resolveModel(modelId, device), setModelId] as const;
}
