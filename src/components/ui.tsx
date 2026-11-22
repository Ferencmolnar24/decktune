import { useState, type ReactNode } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, ArrowRightLeft, BatteryFull, BatteryMedium, BookOpen, BookmarkCheck, BookmarkPlus,
  Calculator, CalendarRange, Check, CircleAlert, CircleCheck, CircleHelp, CircleX, Copy, Cpu, ExternalLink, Fan, Flame,
  Gamepad2, Gauge, GraduationCap, Grid2x2, HardDrive, Info, Library, Lightbulb, ListChecks, Map as MapIcon, MemoryStick,
  MessageSquareText, Microchip, Minus, Monitor, Package, Plus, RefreshCw, RotateCcw, Scaling, ScanEye, Search, SearchX,
  ShieldCheck, SlidersHorizontal, Sparkles, Split, ThumbsUp, Timer, Trash2, TriangleAlert, Users, WifiOff, Wrench, Zap,
  PenLine, MessageCircle, X, Send, LoaderCircle, UserRound, Clock, type LucideIcon,
} from 'lucide-react';
import { artUrls, type GameFacts } from '../lib/data';

const ICONS: Record<string, LucideIcon> = {
  activity: Activity, 'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, 'arrow-right-left': ArrowRightLeft,
  'battery-full': BatteryFull, 'battery-medium': BatteryMedium, 'book-open': BookOpen, 'bookmark-check': BookmarkCheck,
  'bookmark-plus': BookmarkPlus, calculator: Calculator, 'calendar-range': CalendarRange, check: Check,
  'circle-alert': CircleAlert, 'circle-check': CircleCheck, 'circle-help': CircleHelp, 'circle-x': CircleX, copy: Copy,
  cpu: Cpu, 'external-link': ExternalLink, fan: Fan, flame: Flame, 'gamepad-2': Gamepad2, gauge: Gauge,
  'graduation-cap': GraduationCap, 'grid-2x2': Grid2x2, 'hard-drive': HardDrive, info: Info, library: Library,
  lightbulb: Lightbulb, 'list-checks': ListChecks, map: MapIcon, 'memory-stick': MemoryStick, 'message-square-text': MessageSquareText,
  'message-circle': MessageCircle, microchip: Microchip, minus: Minus, monitor: Monitor, package: Package, plus: Plus,
  'refresh-cw': RefreshCw, 'rotate-ccw': RotateCcw, scaling: Scaling, 'scan-eye': ScanEye, search: Search, 'search-x': SearchX,
  'shield-check': ShieldCheck, 'sliders-horizontal': SlidersHorizontal, sparkles: Sparkles, split: Split, 'thumbs-up': ThumbsUp,
  timer: Timer, 'trash-2': Trash2, 'triangle-alert': TriangleAlert, users: Users, 'wifi-off': WifiOff, wrench: Wrench, zap: Zap,
  'pen-line': PenLine, x: X, send: Send, 'loader-circle': LoaderCircle, 'user-round': UserRound, clock: Clock,
};

export function Icon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  const C = ICONS[name] ?? Info;
  return <C className={className} aria-hidden="true" />;
}

export function GitHubMark({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function SectionHeader({ icon, title, subtitle, action }: { icon: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
        <Icon name={icon} className="w-4 h-4 text-brand-text" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-heading text-xl font-semibold leading-tight">{title}</h2>
        {subtitle && <p className="caption">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// Game art: the best Steam image that loads, over the title's initials on a tinted gradient, so a
// game Steam serves no art for still gets a designed tile instead of a broken image.
export function GameArt({ appId, name, image, className = '' }: { appId: number; name: string; image?: string; className?: string }) {
  const urls = artUrls(appId, image);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const initials = name.split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w[0] ?? '')).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

  return (
    <div className={`relative overflow-hidden bg-muted ${className}`}>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1a2b4a] via-[#14203a] to-[#0d1424]" aria-hidden="true">
        <span className="font-heading text-3xl font-bold tracking-wider text-brand-text/70">{initials}</span>
      </div>
      {index < urls.length && (
        <img
          key={urls[index]}
          src={urls[index]}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setIndex((i) => i + 1)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

const TIER_TONES: Record<string, string> = {
  platinum: 'bg-[#b4c7dc]/15 text-[#c9d8ea] border-[#b4c7dc]/40',
  gold: 'bg-[#cfb53b]/15 text-[#e3cc5c] border-[#cfb53b]/40',
  silver: 'bg-[#a6a6a6]/15 text-[#c4c4c4] border-[#a6a6a6]/40',
  bronze: 'bg-[#cd7f32]/15 text-[#e09a55] border-[#cd7f32]/40',
  borked: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
};

export const normalizeTier = (t?: string) => (t?.trim().toLowerCase() || 'unrated');
export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ProtonDB's own tier colours: a fixed, recognisable scale.
export function TierBadge({ tier, large = false }: { tier?: string; large?: boolean }) {
  const t = normalizeTier(tier);
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-wider ${TIER_TONES[t] ?? 'bg-muted text-muted-foreground border-border'} ${large ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'}`}>
      {capitalize(t)}
    </span>
  );
}

export function DeckVerifiedLine({ facts }: { facts?: GameFacts }) {
  const [icon, label, tone] = facts?.deck === 3 ? ['circle-check', 'Steam Deck Verified', 'text-emerald-400']
    : facts?.deck === 2 ? ['circle-alert', 'Steam Deck Playable', 'text-amber-300']
      : facts?.deck === 1 ? ['circle-x', 'Unsupported on Steam Deck', 'text-rose-400']
        : ['circle-help', facts ? 'Not yet reviewed by Valve' : 'Steam Deck rating not tracked yet', 'text-muted-foreground'];
  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${tone}`}>
      <Icon name={icon} />
      <span>{label}</span>
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost btn-icon"
      aria-label={label}
      title={copied ? 'Copied' : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard blocked: the text is selectable beside the button
        }
      }}
    >
      <Icon name={copied ? 'check' : 'copy'} className={`w-4 h-4 ${copied ? 'text-emerald-400' : ''}`} />
    </button>
  );
}

export function EmptyState({ icon, title, body, children }: { icon: string; title: string; body?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
      <Icon name={icon} className="w-7 h-7 text-muted-foreground" />
      <p className="font-semibold">{title}</p>
      {body && <p className="caption max-w-sm">{body}</p>}
      {children}
    </div>
  );
}

export function ErrorRow({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 card rounded-xl p-4">
      <Icon name="wifi-off" className="w-4 h-4 text-amber-400 shrink-0" />
      <p className="flex-1 text-sm">{text}</p>
      <button type="button" className="btn-outline" onClick={onRetry}>Try again</button>
    </div>
  );
}

export function BackLink({ label = 'All games' }: { label?: string }) {
  return (
    <a href="#/" className="btn-ghost self-start -ml-3">
      <Icon name="arrow-left" />
      {label}
    </a>
  );
}

export function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-background/60 flex items-center justify-center shrink-0">
        <Icon name={icon} className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="caption">{label}</p>
        <p className="text-sm font-semibold break-words">{value}</p>
      </div>
    </div>
  );
}
