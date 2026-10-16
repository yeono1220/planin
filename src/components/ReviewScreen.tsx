import React, { useState, useRef, useEffect } from 'react';
import { DayGraph, Moment, Person, Mood, Photo, CropBox } from '../types';
import {
  Quote,
  Users,
  Shield,
  ArrowRight,
  Sparkles,
  Check,
  UserCheck,
  UserX,
  AlertTriangle,
  Scan,
  Crop,
  X,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface ReviewScreenProps {
  dayGraph: DayGraph;
  photos?: Photo[];
  onUpdateDayGraph: (updated: DayGraph) => void;
  onConfirm: () => void;
}

/**
 * Renders an exact HTML5 Canvas crop of a bounding box [x, y, w, h] from a photo URL
 */
const CroppedPersonCanvas: React.FC<{
  photoUrl: string;
  box: CropBox;
  alt: string;
}> = ({ photoUrl, box, alt }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const sx = Math.max(0, Math.min(1, box.x)) * img.width;
      const sy = Math.max(0, Math.min(1, box.y)) * img.height;
      const sw = Math.max(0.05, Math.min(1 - box.x, box.w)) * img.width;
      const sh = Math.max(0.05, Math.min(1 - box.y, box.h)) * img.height;

      canvas.width = 128;
      canvas.height = 128;
      ctx.clearRect(0, 0, 128, 128);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 128, 128);
    };
    img.onerror = () => setFailed(true);
    img.src = photoUrl;
  }, [photoUrl, box.x, box.y, box.w, box.h]);

  if (failed) {
    return (
      <img
        src={photoUrl}
        alt={alt}
        className="w-full h-full object-cover"
      />
    );
  }

  return <canvas ref={canvasRef} className="w-full h-full object-cover" />;
};

export const ReviewScreen: React.FC<ReviewScreenProps> = ({
  dayGraph,
  photos = [],
  onUpdateDayGraph,
  onConfirm,
}) => {
  const [isScanningPeople, setIsScanningPeople] = useState(false);
  const [manualModalPersonId, setManualModalPersonId] = useState<string | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>(photos[0]?.id || '');
  const [draftBox, setDraftBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0.28,
    y: 0.15,
    w: 0.42,
    h: 0.62,
  });
  const [isDraggingBox, setIsDraggingBox] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handleMomentChange = (
    dayIndex: number,
    momentIndex: number,
    field: keyof Moment,
    value: any
  ) => {
    const updated = JSON.parse(JSON.stringify(dayGraph)) as DayGraph;
    updated.days[dayIndex].moments[momentIndex] = {
      ...updated.days[dayIndex].moments[momentIndex],
      [field]: value,
    };
    onUpdateDayGraph(updated);
  };

  const handleSetPersonRole = (personId: string, role: 'me' | 'friend' | 'exclude') => {
    const updated = JSON.parse(JSON.stringify(dayGraph)) as DayGraph;
    updated.people.forEach((person) => {
      if (person.id === personId) {
        if (role === 'me') {
          person.isMe = true;
          person.consent = true;
        } else if (role === 'friend') {
          person.isMe = false;
          person.consent = true;
        } else {
          person.isMe = false;
          person.consent = false;
        }
      } else if (role === 'me' && person.isMe) {
        person.isMe = false;
      }
    });
    onUpdateDayGraph(updated);
  };

  // Manual Verify: Confirm borderline detection as a real human figure
  const handleApproveBorderline = (personId: string) => {
    const updated = JSON.parse(JSON.stringify(dayGraph)) as DayGraph;
    const person = updated.people.find((p) => p.id === personId);
    if (person) {
      person.detectionStatus = 'verified_human';
      person.detectionReason = 'Manually verified by user as an authentic human figure.';
      person.cropBoxes = (person.cropBoxes || []).map((b) => ({
        ...b,
        isBorderline: false,
        manuallyVerified: true,
        confidence: Math.max(b.confidence ?? 0.85, 0.9),
      }));
      onUpdateDayGraph(updated);
    }
  };

  // Manual Verify: Reject false positive / non-human scenery detection
  const handleRejectNonHuman = (personId: string) => {
    const updated = JSON.parse(JSON.stringify(dayGraph)) as DayGraph;
    const person = updated.people.find((p) => p.id === personId);
    if (person) {
      person.photoIds = [];
      person.cropBoxes = [];
      person.detectionConfidence = 0;
      person.detectionStatus = 'rejected_non_human';
      person.detectionReason =
        'Rejected non-human / landscape element during manual verification → switched to 3D Chibi Avatar.';
      onUpdateDayGraph(updated);
    }
  };

  // Trigger a borderline candidate simulation so the user can test manual verify anytime
  const handleSimulateBorderline = (personId: string) => {
    const targetPhoto = photos[0];
    if (!targetPhoto) return;
    const updated = JSON.parse(JSON.stringify(dayGraph)) as DayGraph;
    const person = updated.people.find((p) => p.id === personId);
    if (person) {
      person.photoIds = [targetPhoto.id];
      person.detectionConfidence = 0.66;
      person.detectionStatus = 'borderline_needs_verify';
      person.detectionReason =
        'Borderline candidate (confidence 66%, aspect ratio H/W 1.42) — requires manual verification to confirm human figure vs background object.';
      person.cropBoxes = [
        {
          photoId: targetPhoto.id,
          x: 0.26,
          y: 0.18,
          w: 0.36,
          h: 0.51,
          confidence: 0.66,
          aspectRatio: 1.42,
          isBorderline: true,
          manuallyVerified: false,
          reason: 'Borderline confidence (66%) — verify if human figure',
        },
      ];
      onUpdateDayGraph(updated);
    }
  };

  // Run Argon Strict Human Detector API
  const handleRunStrictArgonScan = async () => {
    if (photos.length === 0) return;
    setIsScanningPeople(true);
    try {
      const sampledPhotos = photos.slice(0, 6).map((p) => ({
        id: p.id,
        name: p.name,
        thumbUrl: p.thumbUrl,
      }));
      const res = await fetch('/api/pipeline/detect-people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos: sampledPhotos,
          people: dayGraph.people,
        }),
      }).then((r) => r.json());

      if (res.people) {
        onUpdateDayGraph({
          ...dayGraph,
          people: res.people,
        });
      }
    } catch (err) {
      console.error('Strict Argon scan failed:', err);
    } finally {
      setIsScanningPeople(false);
    }
  };

  // Open manual bounding-box drawer modal
  const openManualCropModal = (person: Person) => {
    const existingBox = person.cropBoxes?.[0];
    setManualModalPersonId(person.id);
    setSelectedPhotoId(existingBox?.photoId || photos[0]?.id || '');
    if (existingBox) {
      setDraftBox({
        x: existingBox.x,
        y: existingBox.y,
        w: existingBox.w,
        h: existingBox.h,
      });
    } else {
      setDraftBox({ x: 0.25, y: 0.15, w: 0.45, h: 0.65 });
    }
  };

  const handleMouseDownOnPhoto = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setIsDraggingBox(true);
    setDragStart({ x, y });
    setDraftBox({ x, y, w: 0.05, h: 0.05 });
  };

  const handleMouseMoveOnPhoto = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingBox || !dragStart) return;
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const curX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const curY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const x = Math.min(dragStart.x, curX);
    const y = Math.min(dragStart.y, curY);
    const w = Math.max(0.05, Math.abs(curX - dragStart.x));
    const h = Math.max(0.05, Math.abs(curY - dragStart.y));
    setDraftBox({ x, y, w, h });
  };

  const handleMouseUpOnPhoto = () => {
    setIsDraggingBox(false);
    setDragStart(null);
  };

  const handleSaveManualBox = () => {
    if (!manualModalPersonId || !selectedPhotoId) return;
    const aspectRatio = Number((draftBox.h / Math.max(draftBox.w, 0.001)).toFixed(2));
    const updated = JSON.parse(JSON.stringify(dayGraph)) as DayGraph;
    const person = updated.people.find((p) => p.id === manualModalPersonId);
    if (person) {
      person.photoIds = [selectedPhotoId];
      person.detectionConfidence = 0.98;
      person.detectionStatus = 'verified_human';
      person.detectionReason = `Manually cropped & verified human figure (H/W aspect ratio ${aspectRatio}).`;
      person.cropBoxes = [
        {
          photoId: selectedPhotoId,
          x: Number(draftBox.x.toFixed(3)),
          y: Number(draftBox.y.toFixed(3)),
          w: Number(draftBox.w.toFixed(3)),
          h: Number(draftBox.h.toFixed(3)),
          confidence: 0.98,
          aspectRatio,
          isBorderline: false,
          manuallyVerified: true,
          reason: 'User manually verified human bounding box',
        },
      ];
      onUpdateDayGraph(updated);
    }
    setManualModalPersonId(null);
  };

  const moods: Mood[] = ['happy', 'relaxed', 'excited', 'calm', 'sad', 'surprised'];
  const unverifiedBorderlineCount = dayGraph.people.filter(
    (p) =>
      p.detectionStatus === 'borderline_needs_verify' ||
      p.cropBoxes?.some((b) => b.isBorderline && !b.manuallyVerified)
  ).length;

  const draftAspectRatio = Number((draftBox.h / Math.max(draftBox.w, 0.001)).toFixed(2));
  const draftArea = Number((draftBox.w * draftBox.h * 100).toFixed(1));
  const isDraftRatioValid = draftAspectRatio >= 0.55 && draftAspectRatio <= 3.5;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col justify-between">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                Human-in-the-Loop Review
              </span>
              <span className="text-xs text-slate-400 font-mono">Step 3 of 5</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Review Your Moments &amp; People
            </h2>
            <p className="text-xs text-slate-400">
              Strict human bounding-box filters (aspect ratio &amp; confidence gate) and manual verification before 3D chibi synthesis.
            </p>
          </div>

          <button
            onClick={onConfirm}
            className="py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:via-rose-400 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-rose-500/20 flex items-center gap-2 transition"
          >
            Looks right → Character Studio
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Is This You? (Strict Argon Human Detection + Manual Verify Pipeline) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                Is This You? &amp; Strict Human Verification Pipeline
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Argon automatically rejects non-human objects (desks, ceilings, scenery) and boxes failing confidence (&lt;55%) or aspect ratio (H/W outside 0.55–3.50).
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {photos.length > 0 && (
                <button
                  type="button"
                  onClick={handleRunStrictArgonScan}
                  disabled={isScanningPeople}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Scan className="w-3.5 h-3.5" />
                  {isScanningPeople ? 'Scanning with Argon...' : 'Run Argon Human Scan'}
                </button>
              )}
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Excluded = Grey Silhouette
              </span>
            </div>
          </div>

          {/* Filter Rule Status Banner */}
          <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start sm:items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
              <span>
                <strong>Strict Argon Bounding-Box Gate Active:</strong> Aspect Ratio{' '}
                <code className="text-indigo-300">0.55 ≤ H/W ≤ 3.50</code> • Confidence{' '}
                <code className="text-emerald-300">≥ 0.55</code> required; landscape &amp; inanimate objects are automatically excluded.
              </span>
            </div>
            {unverifiedBorderlineCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-bold shrink-0">
                ⚠️ {unverifiedBorderlineCount} Manual Verify Needed
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dayGraph.people.map((p) => {
              const primaryBox = p.cropBoxes?.[0];
              const matchedPhoto = primaryBox
                ? photos.find((ph) => ph.id === primaryBox.photoId)
                : undefined;

              const isBorderline =
                p.detectionStatus === 'borderline_needs_verify' ||
                Boolean(primaryBox?.isBorderline && !primaryBox?.manuallyVerified);
              const isVerifiedHuman =
                Boolean(primaryBox && matchedPhoto) && !isBorderline;

              const role = p.isMe ? 'me' : p.consent ? 'friend' : 'exclude';

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    isBorderline
                      ? 'bg-gradient-to-b from-amber-950/40 to-slate-900/90 border-amber-500/60 shadow-lg shadow-amber-500/10'
                      : role === 'me'
                      ? 'bg-gradient-to-b from-indigo-950/60 to-slate-900/90 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                      : role === 'friend'
                      ? 'bg-slate-950/80 border-slate-700/80'
                      : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-start gap-3">
                      {/* Strict Thumbnail: ONLY shows cropped human bounding box if verified/borderline; NEVER raw scenery */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 flex-shrink-0 relative flex items-center justify-center">
                        {primaryBox && matchedPhoto?.thumbUrl ? (
                          <CroppedPersonCanvas
                            photoUrl={matchedPhoto.thumbUrl}
                            box={primaryBox}
                            alt={p.label}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-indigo-950 via-slate-900 to-slate-800 text-indigo-300">
                            <span className="text-2xl">{p.isMe ? '🧑‍🎨' : '🧑‍🤝‍🧑'}</span>
                            <span className="text-[8px] font-mono text-slate-400 mt-0.5">
                              3D CHIBI
                            </span>
                          </div>
                        )}

                        {p.isMe && (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-indigo-600/90 text-white text-[9px] font-bold">
                            ME
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-sm font-bold text-white truncate">
                            {p.label}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {role === 'me'
                              ? '👑 Protagonist'
                              : role === 'friend'
                              ? '👥 Companion'
                              : '🚫 Silhouette'}
                          </span>
                        </div>

                        {/* Detection Filter Status Badge */}
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          {isBorderline ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-semibold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Borderline: Manual Verify Needed (
                              {Math.round((primaryBox?.confidence ?? 0.66) * 100)}% • H/W{' '}
                              {primaryBox?.aspectRatio ??
                                Number(
                                  ((primaryBox?.h || 0.5) / (primaryBox?.w || 0.35)).toFixed(2)
                                )}
                              )
                            </span>
                          ) : isVerifiedHuman ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Verified Human ({Math.round((primaryBox?.confidence ?? 0.92) * 100)}% • H/W{' '}
                              {primaryBox?.aspectRatio ??
                                Number(
                                  ((primaryBox?.h || 0.5) / (primaryBox?.w || 0.35)).toFixed(2)
                                )}
                              )
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                              🛡️ Scenery/Objects Excluded → 3D Chibi Avatar
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {p.detectionReason ||
                            (p.isMe
                              ? 'Designated as You: Synthesizing custom 3D Chibi Explorer'
                              : 'Walking alongside you as a 3D companion')}
                        </p>
                      </div>
                    </div>

                    {/* MANUAL VERIFY STEP FOR BORDERLINE DETECTIONS */}
                    {isBorderline && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-amber-200 font-semibold">
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            Manual Verify: Is this region an actual human figure?
                          </span>
                          <span className="font-mono text-[10px] text-amber-300/80">
                            Confidence 0.55–0.80
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleApproveBorderline(p.id)}
                            className="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition shadow"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Confirm Human
                          </button>
                          <button
                            type="button"
                            onClick={() => openManualCropModal(p)}
                            className="px-2 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition shadow"
                          >
                            <Crop className="w-3.5 h-3.5" />
                            Adjust Box
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectNonHuman(p.id)}
                            className="px-2 py-1.5 rounded-lg bg-rose-700/80 hover:bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject Object
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Quick Manual Crop & Borderline Test Actions */}
                    {!isBorderline && photos.length > 0 && (
                      <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-slate-800/50">
                        <button
                          type="button"
                          onClick={() => openManualCropModal(p)}
                          className="text-[11px] text-indigo-300 hover:text-indigo-200 font-mono flex items-center gap-1 transition"
                        >
                          <Crop className="w-3 h-3" />
                          🎯 Draw Manual Person Box on Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSimulateBorderline(p.id)}
                          className="text-[10px] text-amber-400/80 hover:text-amber-300 font-mono transition"
                        >
                          Test Borderline Verify
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 3 Interactive Buttons: "This is me", "My friend", "Don't include" */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => handleSetPersonRole(p.id, 'me')}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                        role === 'me'
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      This is me
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPersonRole(p.id, 'friend')}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                        role === 'friend'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      My friend
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPersonRole(p.id, 'exclude')}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 ${
                        role === 'exclude'
                          ? 'bg-rose-900/60 text-rose-300 border border-rose-700/60'
                          : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Don't include
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Moments Timeline */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Lived Moments Timeline
          </h3>

          {dayGraph.days.map((day, dIdx) => (
            <div key={day.dayNumber} className="space-y-3">
              <div className="text-xs font-mono font-bold text-indigo-400 px-1">
                Day {day.dayNumber} • {day.title || day.date}
              </div>

              {day.moments.map((m, mIdx) => (
                <div
                  key={m.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono text-xs flex items-center justify-center font-bold">
                        {mIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={m.time}
                        onChange={(e) => handleMomentChange(dIdx, mIdx, 'time', e.target.value)}
                        className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono w-24 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <input
                        type="text"
                        value={m.place}
                        onChange={(e) => handleMomentChange(dIdx, mIdx, 'place', e.target.value)}
                        className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                          m.latLngSource === 'gps'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {m.latLngSource === 'gps' ? 'EXIF GPS' : 'AI Estimate'}
                      </span>
                      <select
                        value={m.mood}
                        onChange={(e) => handleMomentChange(dIdx, mIdx, 'mood', e.target.value as Mood)}
                        className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none font-mono"
                      >
                        {moods.map((mood) => (
                          <option key={mood} value={mood}>
                            Mood: {mood}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Activity Input */}
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Activity</label>
                    <input
                      type="text"
                      value={m.activity}
                      onChange={(e) => handleMomentChange(dIdx, mIdx, 'activity', e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Exact Quote from User Text */}
                  <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 flex items-start gap-2 text-xs text-slate-300 italic">
                    <Quote className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span>"{m.quote}"</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* MANUAL BOUNDING BOX VERIFIER & CROP MODAL */}
      {manualModalPersonId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Crop className="w-4 h-4 text-indigo-400" />
                  Manual Human Bounding-Box Verifier &amp; Crop
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Drag across the photo to frame the actual human figure (face or upper body).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManualModalPersonId(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Photo Selector */}
            {photos.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {photos.map((ph, i) => (
                  <button
                    key={ph.id}
                    type="button"
                    onClick={() => setSelectedPhotoId(ph.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono shrink-0 border transition ${
                      selectedPhotoId === ph.id
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    Photo #{i + 1}: {ph.name || ph.id}
                  </button>
                ))}
              </div>
            )}

            {/* Interactive Image Drag Canvas */}
            {(() => {
              const activePhoto = photos.find((p) => p.id === selectedPhotoId) || photos[0];
              if (!activePhoto) return null;
              return (
                <div className="space-y-3">
                  <div
                    ref={imageContainerRef}
                    onMouseDown={handleMouseDownOnPhoto}
                    onMouseMove={handleMouseMoveOnPhoto}
                    onMouseUp={handleMouseUpOnPhoto}
                    className="relative w-full aspect-[4/3] bg-slate-950 rounded-xl overflow-hidden border border-slate-700 cursor-crosshair select-none"
                  >
                    <img
                      src={activePhoto.thumbUrl}
                      alt={activePhoto.name}
                      draggable={false}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    {/* Bounding Box Overlay */}
                    <div
                      style={{
                        left: `${draftBox.x * 100}%`,
                        top: `${draftBox.y * 100}%`,
                        width: `${draftBox.w * 100}%`,
                        height: `${draftBox.h * 100}%`,
                      }}
                      className={`absolute border-2 pointer-events-none ${
                        isDraftRatioValid
                          ? 'border-emerald-400 bg-emerald-500/15'
                          : 'border-amber-400 bg-amber-500/15'
                      }`}
                    >
                      <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-slate-900/90 text-[10px] font-mono text-white whitespace-nowrap">
                        H/W: {draftAspectRatio} • Area: {draftArea}%
                      </span>
                    </div>
                  </div>

                  {/* Live Crop Preview + Aspect Ratio Gate Status */}
                  <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shrink-0">
                        <CroppedPersonCanvas
                          photoUrl={activePhoto.thumbUrl}
                          box={{
                            photoId: activePhoto.id,
                            ...draftBox,
                          }}
                          alt="Crop preview"
                        />
                      </div>
                      <div className="text-xs">
                        <div className="font-bold text-slate-200">
                          Aspect Ratio (H/W): {draftAspectRatio} / Area: {draftArea}%
                        </div>
                        <div
                          className={`text-[11px] font-mono ${
                            isDraftRatioValid ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {isDraftRatioValid
                            ? '✓ Valid human aspect ratio (0.55 ≤ H/W ≤ 3.50)'
                            : '⚠️ Extreme ratio warning (recommended H/W: 0.55–3.50)'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRejectNonHuman(manualModalPersonId)}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 text-xs font-semibold transition"
                      >
                        No Person (Reject)
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveManualBox}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30"
                      >
                        ✓ Confirm Human Box
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
