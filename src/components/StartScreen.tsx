import React, { useState, useRef } from 'react';
import { Photo } from '../types';
import { processPhotoFile } from '../utils/helpers';
import { Sparkles, Image as ImageIcon, MapPin, Calendar, Compass, ArrowRight, UploadCloud, Play, Globe, Trash2, X } from 'lucide-react';

interface StartScreenProps {
  onStartBuild: (storyText: string, photos: Photo[]) => void;
  onLoadDemo: (demoId: 'anam_day' | 'trip_anam_hyehwa') => void;
  isLoading: boolean;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStartBuild,
  onLoadDemo,
  isLoading,
}) => {
  const [text, setText] = useState<string>(
    'Woke up early for midterms study at Korea University Central Plaza library. Met Minho at 1:30 PM for iced Americano and grilled croffle at Cafe Mignon on Chammeong-gil. In the late afternoon, we walked down to the willow trees along Cheonggyecheon stream to watch the sunset reflect on the water. Ended the day eating warm sundae soup and laughing at Anam 5-way intersection pocha under the red neon glow.'
  );
  const [photos, setPhotos] = useState<Photo[]>([
    {
      id: 'p1',
      name: 'KU_Central_Plaza.jpg',
      takenAt: '2026-10-14T10:15:00Z',
      lat: 37.5894,
      lng: 127.0324,
      thumbUrl: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=500&auto=format&fit=crop&q=80',
    },
    {
      id: 'p2',
      name: 'Cafe_Mignon.jpg',
      takenAt: '2026-10-14T13:30:00Z',
      lat: 37.5852,
      lng: 127.0298,
      thumbUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500&auto=format&fit=crop&q=80',
    },
    {
      id: 'p3',
      name: 'Cheonggyecheon_Sunset.jpg',
      takenAt: '2026-10-14T17:40:00Z',
      lat: 37.5741,
      lng: 127.0382,
      thumbUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80',
    },
    {
      id: 'p4',
      name: 'Anam_Night_Pocha.jpg',
      takenAt: '2026-10-14T20:20:00Z',
      lat: 37.5833,
      lng: 127.0281,
      thumbUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&auto=format&fit=crop&q=80',
    },
  ]);

  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsProcessingFiles(true);
    const newPhotos: Photo[] = [];

    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      try {
        const photo = await processPhotoFile(file);
        newPhotos.push(photo);
      } catch (err) {
        console.error('Error processing photo:', err);
      }
    }

    setPhotos((prev) => [...prev, ...newPhotos]);
    setIsProcessingFiles(false);
  };

  const handleQuickPrompt = (promptText: string) => {
    setText(promptText);
  };

  const handleDeletePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleClearAllPhotos = () => {
    setPhotos([]);
  };

  const handleRestoreSamplePhotos = () => {
    setPhotos([
      {
        id: 'p1',
        name: 'KU_Central_Plaza.jpg',
        takenAt: '2026-10-14T10:15:00Z',
        lat: 37.5894,
        lng: 127.0324,
        thumbUrl: 'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=500&auto=format&fit=crop&q=80',
      },
      {
        id: 'p2',
        name: 'Cafe_Mignon.jpg',
        takenAt: '2026-10-14T13:30:00Z',
        lat: 37.5852,
        lng: 127.0298,
        thumbUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500&auto=format&fit=crop&q=80',
      },
      {
        id: 'p3',
        name: 'Cheonggyecheon_Sunset.jpg',
        takenAt: '2026-10-14T17:40:00Z',
        lat: 37.5741,
        lng: 127.0382,
        thumbUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80',
      },
      {
        id: 'p4',
        name: 'Anam_Night_Pocha.jpg',
        takenAt: '2026-10-14T20:20:00Z',
        lat: 37.5833,
        lng: 127.0281,
        thumbUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&auto=format&fit=crop&q=80',
      },
    ]);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden">
      {/* Background ambient gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <Globe className="w-5 h-5 text-white animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-amber-200 via-rose-200 to-indigo-200 bg-clip-text text-transparent">
              My Planet
            </h1>
            <p className="text-xs text-slate-400 font-mono">Turn 1 day in Seoul into a tiny 3D diorama</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
            Gemini 4 Argon
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
            Procedural 3D
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-4xl w-full mx-auto px-6 py-8 flex-1 flex flex-col justify-center">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Stories disappear in 24 hours. Diaries die in 3 days.
          </h2>
          <p className="text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Turn your photos and words into a tiny 3D planet you can spin, where you and your friends walk the exact route you lived.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-6">
          {/* Text Journal Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Tell me about your day (or trip)
              </label>
              <span className="text-xs text-slate-400 font-mono">English Journal &amp; EXIF GPS</span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="e.g. Started at Korea University Central Plaza, grabbed croffles with Minho at Cafe Mignon, strolled Cheonggyecheon at sunset..."
              className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-sans"
            />

            {/* Quick Inspiration Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              <span className="text-xs text-slate-400">Quick ideas:</span>
              <button
                type="button"
                onClick={() =>
                  handleQuickPrompt(
                    'Campus midterms morning at KU Central Plaza stone tower. Met Minho for drip coffee and waffles at Cafe Mignon. Walked along Cheonggyecheon stream willow trees at golden hour, then ate hot tteokbokki at Anam pocha under red lanterns.'
                  )
                }
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 transition"
              >
                🏫 Anam Campus Day
              </button>
              <button
                type="button"
                onClick={() =>
                  handleQuickPrompt(
                    'Day 1: Explored Science Campus courtyards and drank herbal omija tea in Bomun hanok. Day 2: Daehangno Marunir Park art theater, filter coffee at vintage Hakrim Dabang, and hiked Naksan fortress wall overlooking Seoul city lights.'
                  )
                }
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 transition"
              >
                🎭 2-Day Anam to Hyehwa
              </button>
            </div>
          </div>

          {/* Photo Dropzone & Thumbnails */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-rose-400" />
                  Photos ({photos.length} uploaded)
                </label>
                <span className="text-xs text-slate-400">Auto-reads EXIF GPS & timestamp</span>
              </div>

              {/* Photo Management Buttons */}
              <div className="flex items-center gap-2">
                {photos.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleClearAllPhotos}
                    className="text-xs text-rose-400 hover:text-rose-300 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1.5 transition font-mono font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear All Photos ({photos.length})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRestoreSamplePhotos}
                    className="text-xs text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 flex items-center gap-1.5 transition font-mono"
                  >
                    Restore Sample Photos
                  </button>
                )}
              </div>
            </div>

            {/* Dropzone button */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500/80 rounded-xl p-4 text-center cursor-pointer bg-slate-950/40 hover:bg-indigo-950/10 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                <UploadCloud className="w-6 h-6 text-indigo-400" />
                <p className="text-xs font-medium text-slate-300">
                  Click or drag photos here (1 to 100 photos)
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  EXIF GPS will snap directly to real Seoul coordinates
                </p>
              </div>
            </div>

            {/* Empty state notice */}
            {photos.length === 0 && (
              <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <p className="text-xs text-slate-400">
                  ✨ All sample photos cleared. Upload your own photos above to begin!
                </p>
              </div>
            )}

            {/* Photo Thumbnails Preview */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {photos.map((p, idx) => (
                  <div
                    key={p.id}
                    className="group relative rounded-lg overflow-hidden border border-slate-700 bg-slate-950 aspect-[4/3]"
                  >
                    <img
                      src={p.thumbUrl}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />

                    {/* Single Photo Delete "X" Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(p.id);
                      }}
                      title="Remove photo"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/90 hover:bg-rose-600 text-slate-300 hover:text-white flex items-center justify-center transition shadow-md z-10 border border-slate-700/80"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 text-left pointer-events-none">
                      <span className="text-[10px] font-mono text-slate-200 truncate">
                        {p.name || `Photo ${idx + 1}`}
                      </span>
                      <div className="flex items-center gap-1 text-[9px] text-amber-300 font-mono">
                        <MapPin className="w-2.5 h-2.5" />
                        {p.lat ? `${p.lat.toFixed(2)}, ${p.lng?.toFixed(2)}` : 'Seoul estimate'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              disabled={isLoading || isProcessingFiles || !text.trim()}
              onClick={() => onStartBuild(text, photos)}
              className="w-full sm:flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:via-rose-400 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-rose-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Compass className="w-4 h-4" />
              Build My Planet
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => onLoadDemo('anam_day')}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition"
            >
              <Play className="w-3.5 h-3.5 text-amber-400" />
              Demo: A Day in Anam
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => onLoadDemo('trip_anam_hyehwa')}
              className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition"
            >
              <Play className="w-3.5 h-3.5 text-indigo-400" />
              Demo: 2-Day Trip
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto px-6 py-4 text-center text-xs text-slate-500 font-mono">
        Cozy Low-Poly Diorama Engine • Gemini 4 Argon • Google Routes API • Three.js WebGL
      </footer>
    </div>
  );
};
