import React from 'react';
import { Layers, X, ArrowRight, GitFork, CheckCircle, Database } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-white">System Architecture & Multi-Agent Flow</h3>
              <p className="text-xs text-slate-400 font-mono">
                Multimodal Perception • Reasoning • Human-in-the-Loop • 3D Procedural Synthesis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visual Architecture Diagram */}
        <div className="space-y-4">
          {/* Phase 1: Ingestion & Safety */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-xs font-mono font-bold text-amber-400">01. Multimodal Input</div>
              <p className="text-xs text-slate-300">
                Story Text + Photos with EXIF timestamps &amp; GPS coordinates (via exifr).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-2">
              <div className="text-xs font-mono font-bold text-indigo-300">02. Guardrail Safety</div>
              <p className="text-xs text-slate-300">
                <strong className="text-white">gemini-3.5-flash-lite</strong> screens celebrities, copyright, explicit items, and harassment.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/40 space-y-2">
              <div className="text-xs font-mono font-bold text-rose-300">03. Lead World Planner</div>
              <p className="text-xs text-slate-300">
                <strong className="text-white">gemini-4-argon</strong> (thinking_level: medium) synthesizes moments, places, quotes, and mood into DayGraph.
              </p>
            </div>
          </div>

          <div className="flex justify-center my-1 text-slate-600">
            <ArrowRight className="w-4 h-4 rotate-90" />
          </div>

          {/* Phase 2: Human-in-the-Loop Review */}
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 text-center space-y-1">
            <span className="text-xs font-mono font-bold text-indigo-300">04. Human-in-the-Loop Review Gate</span>
            <p className="text-xs text-slate-300 max-w-xl mx-auto">
              User fine-tunes places, verifies mood tags, and toggles privacy consent per friend (no consent = silhouette fallback).
            </p>
          </div>

          <div className="flex justify-center my-1 text-slate-600">
            <GitFork className="w-4 h-4 rotate-180" />
          </div>

          {/* Phase 3: Parallel Generation Engines */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Character Forge */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-xs font-mono font-bold text-rose-400">Parallel A: Character Forge & Critic</div>
              <p className="text-xs text-slate-300">
                Argon extracts colors & accessories. Turntable renders front & 3/4 views for Critic review. SHA-256 locks spec.
              </p>
            </div>

            {/* Landmark Kit */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-xs font-mono font-bold text-emerald-400">Parallel B: Landmark Kit Sandbox</div>
              <p className="text-xs text-slate-300">
                Argon outputs LandmarkSpec restricted to kit API (roundedBox, roof, spire, arch). Executed in secure sandbox.
              </p>
            </div>

            {/* Routes API */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-xs font-mono font-bold text-sky-400">Parallel C: Real Alley Routes</div>
              <p className="text-xs text-slate-300">
                Google Routes API computeRoutes (WALK mode) decodes real Seoul alley polyline; falls back to grid snapping.
              </p>
            </div>
          </div>

          <div className="flex justify-center my-1 text-slate-600">
            <ArrowRight className="w-4 h-4 rotate-90" />
          </div>

          {/* Phase 4: Planet Spec & 3D Execution */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-1">
            <span className="text-xs font-mono font-bold text-emerald-300">
              05. PlanetSpec Compilation & Three.js Low-Poly Diorama
            </span>
            <p className="text-xs text-slate-300 max-w-2xl mx-auto">
              Azimuthal projection from centroid, territory face coloring, dashed road tubes, procedural walking characters, sky drop landmarks, and cinematic tour camera.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
