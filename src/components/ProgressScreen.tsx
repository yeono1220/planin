import React from 'react';
import { AgentLogEntry } from '../types';
import { Loader2, CheckCircle2, ShieldCheck, Cpu, Terminal, Sparkles, AlertCircle } from 'lucide-react';

interface ProgressScreenProps {
  currentStage: string;
  agentLogs: AgentLogEntry[];
}

export const ProgressScreen: React.FC<ProgressScreenProps> = ({
  currentStage,
  agentLogs,
}) => {
  const stages = [
    { id: 'guardrail', name: 'Guardrail Safety Audit', model: 'gemini-3.5-flash-lite' },
    { id: 'planner', name: 'Multimodal Day Planner', model: 'gemini-4-argon' },
    { id: 'validation', name: 'Zod Contract Validation', model: 'zod-engine-v4' },
    { id: 'routes', name: 'Routes API Snapping', model: 'routes-api' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 pointer-events-none" />

      <div className="relative z-10 max-w-2xl w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Synthesizing Your 3D Planet</h2>
            <p className="text-xs text-slate-400 font-mono">Orchestrating Gemini 4 Argon & Multimodal Perception</p>
          </div>
        </div>

        {/* Pipeline Stage Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
          {stages.map((st, i) => {
            const isCompleted = agentLogs.some(
              (l) => l.step.toLowerCase().includes(st.id) && (l.status === 'pass' || l.status === 'repaired')
            );
            const isCurrent = currentStage.toLowerCase().includes(st.id);

            return (
              <div
                key={st.id}
                className={`p-3 rounded-xl border transition-all ${
                  isCompleted
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                    : isCurrent
                    ? 'bg-indigo-950/40 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold">0{i + 1}</span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-700" />
                  )}
                </div>
                <div className="text-xs font-semibold leading-tight">{st.name}</div>
                <div className="text-[9px] font-mono text-slate-400 mt-1 truncate">{st.model}</div>
              </div>
            );
          })}
        </div>

        {/* Live Streaming Agent Log Console */}
        <div className="border border-slate-800 rounded-xl bg-slate-950 p-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800/80">
            <span className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              Live Agent Telemetry Log
            </span>
            <span className="text-[10px] text-indigo-400/80 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Streaming Active
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {agentLogs.length === 0 ? (
              <div className="text-slate-500 py-4 text-center text-xs">
                Initializing Gemini inference pipeline...
              </div>
            ) : (
              agentLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-indigo-300 font-bold">{log.step}</span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-mono font-semibold ${
                        log.status === 'pass'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : log.status === 'repaired'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {log.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span>Model: <strong className="text-slate-200">{log.model}</strong></span>
                    <span>Thinking: <strong className="text-slate-200">{log.thinkingLevel}</strong></span>
                    <span>{log.durationMs}ms</span>
                    {log.tokensUsed && <span>{log.tokensUsed} tokens</span>}
                  </div>
                  {log.details && (
                    <div className="text-[10px] text-slate-400 pt-0.5 border-t border-slate-800/40">
                      &gt; {log.details}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
