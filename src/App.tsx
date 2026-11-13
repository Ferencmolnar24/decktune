import { lazy, Suspense } from 'react';
import { HANDHELDS, isDevice, type DeviceId } from './lib/handhelds';
import { useRoute, useStored, type Route } from './lib/state';
import { REPO } from './lib/community';
import { GitHubMark, Icon } from './components/ui';
import { Home } from './pages/Home';
import { GamePage } from './pages/Game';
import { GuidePage } from './pages/Guide';
import { CommunityPage } from './pages/Community';

// The repair page pulls in three.js, so it loads only when opened.
const RepairPage = lazy(() => import('./pages/Repair'));

export function useDevice(): [DeviceId, (d: DeviceId) => void] {
  const [device, setDevice] = useStored<string>('device', 'oled');
  return [isDevice(device) ? device : 'oled', setDevice];
}

export function App() {
  const route = useRoute();
  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-b from-[#0f1a2e] via-background to-background">
      <TopBar route={route} />
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-8 pb-16 flex-1 flex flex-col gap-10">
        {route.page === 'game' ? <GamePage key={route.appId} appId={route.appId} />
          : route.page === 'guide' ? <GuidePage />
            : route.page === 'community' ? <CommunityPage />
              : route.page === 'repair' ? (
                <Suspense fallback={<div className="skeleton h-96 rounded-2xl mt-6" />}>
                  <RepairPage />
                </Suspense>
              ) : <Home />}
      </main>
      <Footer />
    </div>
  );
}

function NavLink({ href, icon, label, active }: { href: string; icon: string; label: string; active: boolean }) {
  return (
    <a href={href} className={`${active ? 'btn-secondary' : 'btn-ghost'} rounded-full`} aria-current={active ? 'page' : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
    </a>
  );
}

function TopBar({ route }: { route: Route }) {
  const [device, setDevice] = useDevice();
  return (
    <header className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-5 flex items-center justify-between gap-4 flex-wrap">
      <a href="#/" className="flex items-center gap-3" aria-label="DeckTune home">
        <div className="w-10 h-10 rounded-xl bg-brand/15 border border-brand flex items-center justify-center">
          <Icon name="gamepad-2" className="w-5 h-5 text-brand-text" />
        </div>
        <div>
          <p className="font-heading text-xl font-bold tracking-wide leading-none">DECKTUNE</p>
          <p className="caption">Steam Deck & ROG Ally settings for every game</p>
        </div>
      </a>

      <nav className="flex items-center gap-1 sm:gap-2 flex-wrap">
        <NavLink href="#/community" icon="users" label="Community" active={route.page === 'community'} />
        <NavLink href="#/repair" icon="wrench" label="Repair & upgrade" active={route.page === 'repair'} />
        <NavLink href="#/guide" icon="graduation-cap" label="Tune it yourself" active={route.page === 'guide'} />
        <label className="sr-only" htmlFor="device-select">Your handheld</label>
        <select
          id="device-select"
          className="field rounded-full min-w-[14rem] cursor-pointer"
          value={device}
          onChange={(e) => isDevice(e.target.value) && setDevice(e.target.value)}
        >
          <optgroup label="Steam Deck">
            {HANDHELDS.filter((h) => h.family === 'deck').map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </optgroup>
          <optgroup label="ROG Ally">
            {HANDHELDS.filter((h) => h.family === 'ally').map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </optgroup>
        </select>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row gap-4 justify-between text-xs text-muted-foreground">
        <div className="flex flex-col gap-1 max-w-2xl">
          <p>DeckTune is free and community-run. Not affiliated with Valve, ASUS, Microsoft or ProtonDB.</p>
          <p>Game data from the Steam store and ProtonDB, refreshed daily. Player reports are posted publicly on GitHub. The 3D Steam Deck is built from Valve's official CAD (CC BY-NC-SA 4.0).</p>
        </div>
        {REPO && (
          <a className="flex items-center gap-2 hover:text-foreground self-start" href={`https://github.com/${REPO}`} target="_blank" rel="noreferrer">
            <GitHubMark /> Source on GitHub
          </a>
        )}
      </div>
    </footer>
  );
}
