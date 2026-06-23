'use client';

/**
 * Outfitting — the between-runs screen of the Deep Run roguelike loop.
 *
 * Shown when `gameState.phase === 'outfitting'` (after a death or an extract).
 * It reports the run that just ended, shows banked salvage, lets the player
 * spend it on permanent upgrades, then relaunch a stronger run.
 *
 * Pure DOM overlay (like ModeSelect). State lives in run-state.ts; this
 * component just reads/writes meta via the passed-in handlers so the canvas
 * stays the single owner of game flow.
 */

import { useState } from 'react';
import {
  UPGRADES,
  nextUpgradeCost,
  canAfford,
  type MetaState,
  type UpgradeId,
} from './run-state';

interface RunSummary {
  extracted: boolean;     // true = clean extract, false = died
  sectorReached: number;  // 0-based depth
  sectorName: string;
  kills: number;
  salvageBanked: number;  // salvage added to the bank from this run
}

export function Outfitting({
  meta,
  summary,
  onBuy,
  onLaunch,
  onQuit,
}: {
  meta: MetaState;
  summary: RunSummary | null;
  onBuy: (id: UpgradeId) => void;
  onLaunch: () => void;
  onQuit: () => void;
}) {
  // local tick to force a re-read after a purchase (meta is mutated upstream)
  const [, setTick] = useState(0);
  const buy = (id: UpgradeId) => {
    onBuy(id);
    setTick((t) => t + 1);
  };

  const died = summary && !summary.extracted;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md pointer-events-auto overflow-y-auto py-8">
      <div className="w-full max-w-4xl px-6 space-y-6">
        {/* Run summary */}
        {summary && (
          <div className="text-center space-y-1.5">
            <div
              className="font-mono text-[10px] tracking-[0.28em] uppercase mb-1"
              style={{ color: died ? '#ff6b5a' : '#7af0c0' }}
            >
              {died ? 'Hull lost' : 'Extraction successful'}
            </div>
            <h2 className="font-serif text-3xl md:text-4xl text-foreground leading-tight italic">
              {died ? 'You didn’t make it back.' : 'You made it out.'}
            </h2>
            <p className="font-mono text-xs text-foreground/60 pt-1">
              Reached {summary.sectorName} · {summary.kills} kills ·{' '}
              {died ? (
                <span className="text-red-400/80">run cargo lost</span>
              ) : (
                <span className="text-emerald-300/90">+{summary.salvageBanked} salvage banked</span>
              )}
            </p>
          </div>
        )}

        {/* Bank */}
        <div className="text-center">
          <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-foreground/50">
            Banked salvage
          </div>
          <div className="font-mono text-3xl text-amber-300 tabular-nums">
            {meta.bankedSalvage.toLocaleString()}
          </div>
        </div>

        {/* Upgrades */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
            const def = UPGRADES[id];
            const lvl = meta.upgrades[id];
            const cost = nextUpgradeCost(meta, id);
            const maxed = cost === null;
            const affordable = canAfford(meta, id);
            return (
              <div
                key={id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex flex-col"
              >
                <div className="font-serif text-xl text-foreground">{def.name}</div>
                <p className="text-xs leading-relaxed text-foreground/60 mt-1.5 flex-1">{def.blurb}</p>

                {/* level pips */}
                <div className="flex gap-1.5 mt-3">
                  {Array.from({ length: def.maxLevel }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${i < lvl ? 'bg-emerald-400' : 'bg-white/12'}`}
                    />
                  ))}
                </div>
                <div className="font-mono text-[10px] tracking-wider uppercase text-emerald-300/80 mt-2">
                  {lvl > 0 ? def.effectLabel(lvl) : 'not installed'}
                </div>

                <button
                  type="button"
                  onClick={() => buy(id)}
                  disabled={maxed || !affordable}
                  className={`mt-4 rounded-lg px-4 py-2.5 font-mono text-[11px] tracking-[0.12em] uppercase transition-colors ${
                    maxed
                      ? 'border border-white/10 text-foreground/40 cursor-default'
                      : affordable
                        ? 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20'
                        : 'border border-white/10 text-foreground/35 cursor-not-allowed'
                  }`}
                >
                  {maxed ? 'Maxed' : `Upgrade · ${cost}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={onLaunch}
            className="rounded-full border border-emerald-400/50 bg-emerald-400/10 px-8 py-3 font-mono text-xs tracking-[0.14em] uppercase text-emerald-100 hover:bg-emerald-400/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Launch run →
          </button>
          <button
            type="button"
            onClick={onQuit}
            className="rounded-full border border-white/15 px-5 py-3 font-mono text-[11px] tracking-[0.12em] uppercase text-foreground/60 hover:text-foreground hover:border-white/30 transition-colors"
          >
            Main menu
          </button>
        </div>
      </div>
    </div>
  );
}

export type { RunSummary };
