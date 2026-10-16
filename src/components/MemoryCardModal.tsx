import React from 'react';
import { Moment } from '../types';
import { X, Clock, MapPin, Quote, Volume2, Sparkles } from 'lucide-react';

interface MemoryCardModalProps {
  moment: Moment | null;
  photoUrl?: string;
  onClose: () => void;
  onNarrate?: (text: string) => void;
}

export const MemoryCardModal: React.FC<MemoryCardModalProps> = ({
  moment,
  photoUrl,
  onClose,
  onNarrate,
}) => {
  if (!moment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Photo Header */}
        {photoUrl && (
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950">
            <img src={photoUrl} alt={moment.place} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/30" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white/80 hover:text-white hover:bg-black/90 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-5 space-y-4">
          {!photoUrl && (
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Place & Time */}
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 mb-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{moment.time}</span>
              <span>•</span>
              <span className="capitalize">{moment.mood} vibe</span>
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight flex items-baseline gap-2">
              <span>{moment.place}</span>
            </h3>
          </div>

          {/* Activity Description */}
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 font-mono block text-[10px] mb-1">ACTIVITY</span>
            {moment.activity}
          </div>

          {/* Exact Quote */}
          <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 italic flex items-start gap-2">
            <Quote className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>"{moment.quote}"</span>
          </div>

          {/* Narration Button */}
          {onNarrate && (
            <button
              onClick={() => onNarrate(moment.narrative || moment.quote)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-2 transition border border-slate-700"
            >
              <Volume2 className="w-4 h-4 text-indigo-400" />
              Play Audio Narration
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
