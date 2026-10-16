import React from 'react';
import { VerificationCheck } from '../types';
import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';

interface VerificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  checks: VerificationCheck[];
}

export const VerificationPanel: React.FC<VerificationPanelProps> = ({
  isOpen,
  onClose,
  checks,
}) => {
  if (!isOpen) return null;

  const passedCount = checks.filter((c) => c.status === 'passed').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">System Verification Panel</h3>
              <p className="text-xs text-slate-400 font-mono">
                Judging Criteria & Runtime Contract Audits ({passedCount}/{checks.length} Passed)
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

        {/* Checks List */}
        <div className="space-y-3">
          {checks.map((chk) => (
            <div
              key={chk.id}
              className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">{chk.name}</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                    chk.status === 'passed'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : chk.status === 'warning'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {chk.status === 'passed' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : chk.status === 'warning' ? (
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                  ) : (
                    <XCircle className="w-3 h-3 text-rose-400" />
                  )}
                  {chk.status.toUpperCase()} (Attempts: {chk.attempts})
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                {chk.details}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
