import React from 'react';
import { AgentLogEntry } from '../types';
import { Terminal, X, Clock, Cpu, CheckCircle2 } from 'lucide-react';

interface AgentLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AgentLogEntry[];
}

export const AgentLogModal: React.FC<AgentLogModalProps> = ({
  isOpen,
  onClose,
  logs,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 text-slate-100 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-white">Agent Orchestration Logs</h3>
              <p className="text-xs text-slate-400 font-mono">
                Multimodal pipeline telemetry • Models, thinking levels, & tokens
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

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-mono text-xs">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-indigo-300">{log.step}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.durationMs}ms
                  </span>
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded font-bold ${
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
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                <span>Model: <strong className="text-slate-200">{log.model}</strong></span>
                <span>Thinking: <strong className="text-slate-200">{log.thinkingLevel}</strong></span>
                <span>Attempt: <strong className="text-slate-200">{log.attempt}</strong></span>
                {log.tokensUsed && (
                  <span>Tokens: <strong className="text-slate-200">{log.tokensUsed}</strong></span>
                )}
                <span className="text-slate-500">[{log.timestamp}]</span>
              </div>

              {log.details && (
                <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-800/60 leading-relaxed">
                  &gt; {log.details}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
