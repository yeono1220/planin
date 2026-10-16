import React, { useState } from 'react';
import { PlanetSpec, Moment, Achievement } from '../types';
import {
  Play,
  Pause,
  Compass,
  ShieldCheck,
  Terminal,
  Layers,
  Save,
  ChevronDown,
  ChevronUp,
  Star,
  Award,
  Volume2,
  Camera,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface PlanetHUDProps {
  planetSpec: PlanetSpec;
  isTouring: boolean;
  onToggleTour: () => void;
  activeDay: number;
  onSelectDay: (day: number) => void;
  onOpenVerification: () => void;
  onOpenAgentLogs: () => void;
  onOpenArchitecture: () => void;
  onSavePlanet: () => void;
  onResetView: (preset: 'top' | 'isometric' | 'close' | 'cinematic') => void;
  collectedStars: number;
  totalMoments: number;
  currentMoment?: Moment | null;
  currentMomentPhotoUrl?: string;
  onPlayTTS?: (text: string) => void;
  newAchievement?: Achievement | null;
}

export const PlanetHUD: React.FC<PlanetHUDProps> = ({
  planetSpec,
  isTouring,
  onToggleTour,
  activeDay,
  onSelectDay,
  onOpenVerification,
  onOpenAgentLogs,
  onOpenArchitecture,
  onSavePlanet,
  onResetView,
  collectedStars,
  totalMoments,
  currentMoment,
  currentMomentPhotoUrl,
  onPlayTTS,
  newAchievement,
}) => {
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const totalDays = planetSpec.territories.length || 1;
  const planetLevel = Math.max(1, totalMoments);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between p-4 sm:p-6 overflow-hidden">
      {/* Top Bar: Minimal title & Stars / Planet Level */}
      <div className="flex items-start justify-between w-full pointer-events-auto">
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-2xl px-4 py-2.5 shadow-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-rose-500/20">
            Lv.{planetLevel}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight leading-tight">
              {planetSpec.name || 'My Seoul Planet'}
            </h2>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
              <span className="flex items-center gap-1 text-amber-300">
                <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                {collectedStars} / {totalMoments} Stars
              </span>
              <span>•</span>
              <span>{planetSpec.characters.length} Walkers</span>
              <span>•</span>
              <span>{planetSpec.landmarks.length} Landmarks</span>
            </div>
          </div>
        </div>

        {/* Camera Preset Quick Buttons (100% English) */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1 shadow-xl">
          <button
            onClick={() => onResetView('isometric')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1"
            title="Full planet diorama overview"
          >
            <span>🌍</span>
            <span>Full Globe</span>
          </button>
          <button
            onClick={() => onResetView('close')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1"
            title="Third-person street walker follow view"
          >
            <span>🚶</span>
            <span>Walker View</span>
          </button>
          <button
            onClick={() => onResetView('top')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1"
            title="Top-down polar view"
          >
            <span>🧭</span>
            <span>Top View</span>
          </button>
          <button
            onClick={() => onResetView('cinematic')}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition flex items-center gap-1"
            title="Slow orbital cinematic camera"
          >
            <span>🎬</span>
            <span>Cinematic</span>
          </button>
        </div>
      </div>

      {/* Achievement Pop Toast */}
      {newAchievement && (
        <div className="pointer-events-auto self-center bg-gradient-to-r from-amber-500 to-rose-600 text-white rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 animate-bounce">
          <div className="text-2xl">{newAchievement.icon || '🏆'}</div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-mono font-extrabold text-amber-100">
              Achievement Unlocked!
            </div>
            <div className="text-sm font-bold">{newAchievement.title}</div>
            <div className="text-xs text-amber-50">{newAchievement.description}</div>
          </div>
        </div>
      )}

      {/* Side Square Place Card (Docked to Bottom-Left so center character & globe stay 100% unobstructed) */}
      {isTouring && currentMoment && (
        <div className="pointer-events-auto fixed left-4 sm:left-6 bottom-24 z-40 w-56 sm:w-60 aspect-square bg-slate-900/92 backdrop-blur-md border border-indigo-500/40 rounded-2xl p-3.5 shadow-2xl flex flex-col justify-between animate-in fade-in slide-in-from-left-4 duration-300">
          {/* Top Row: Photo or Badge + Audio Button */}
          <div className="flex items-start justify-between gap-2">
            {currentMomentPhotoUrl ? (
              <img
                src={currentMomentPhotoUrl}
                alt={currentMoment.place}
                className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0 shadow-md"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
            )}

            <div className="flex flex-col items-end gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-[10px] text-indigo-300 font-mono capitalize">
                {currentMoment.mood}
              </span>
              {onPlayTTS && (
                <button
                  onClick={() => onPlayTTS(currentMoment.narrative || currentMoment.quote)}
                  className="p-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 transition"
                  title="Narrate moment"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Middle & Bottom: Time, English Place Name, and Lived Quote */}
          <div className="space-y-1 mt-2">
            <div className="text-[10px] text-indigo-400 font-mono font-semibold tracking-wide">
              {currentMoment.time} • Day {currentMoment.day}
            </div>
            <div className="text-sm font-bold text-white leading-snug line-clamp-2">
              {currentMoment.place}
            </div>
            <p className="text-[11px] text-amber-200/90 italic leading-relaxed line-clamp-3 pt-0.5">
              "{currentMoment.quote}"
            </p>
          </div>
        </div>
      )}

      {/* Unified Bottom Control Dock (Pinned to Bottom-Center) */}
      <div className="pointer-events-auto self-center max-w-3xl w-full flex flex-col items-center">

        {/* Collapse Toggle Tab */}
        <button
          onClick={() => setIsDockCollapsed(!isDockCollapsed)}
          className="mb-1.5 px-3 py-1 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 shadow-lg transition"
        >
          {isDockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {isDockCollapsed ? 'Show Controls' : 'Hide Controls'}
        </button>

        {!isDockCollapsed && (
          <div className="w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-3 shadow-2xl flex flex-wrap items-center justify-between gap-3 transition-all duration-300">
            {/* Tour Play/Pause & Day Selector */}
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleTour}
                className={`py-2 px-4 rounded-xl font-bold text-xs font-mono flex items-center gap-2 transition shadow-md ${
                  isTouring
                    ? 'bg-amber-500 text-slate-950 shadow-amber-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                }`}
              >
                {isTouring ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isTouring ? 'Pause Tour' : 'Play Tour'}
              </button>

              {totalDays > 1 && (
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {planetSpec.territories.map((t) => (
                    <button
                      key={t.day}
                      onClick={() => onSelectDay(t.day)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition ${
                        activeDay === t.day
                          ? 'bg-slate-800 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Day {t.day}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Diagnostic and Utility Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenVerification}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold font-mono border border-slate-700 flex items-center gap-1.5 transition"
                title="Open judging verification audits"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Verification</span>
              </button>

              <button
                onClick={onOpenAgentLogs}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold font-mono border border-slate-700 flex items-center gap-1.5 transition"
                title="Open Agent telemetry log"
              >
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Agent Log</span>
              </button>

              <button
                onClick={onOpenArchitecture}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold font-mono border border-slate-700 flex items-center gap-1.5 transition"
                title="Open multi-agent architecture diagram"
              >
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Architecture</span>
              </button>

              <button
                onClick={onSavePlanet}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold font-mono border border-slate-700 flex items-center gap-1.5 transition"
                title="Save planet memory"
              >
                <Save className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Save</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
