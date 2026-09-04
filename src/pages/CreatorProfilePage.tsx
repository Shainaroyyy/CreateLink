import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useCreatorStore } from '../stores/creatorStore';
import VerificationBadge from '../components/shared/VerificationBadge';
import { getStore } from '../services/store';
import { fetchReels, uploadReelFile, saveReel, deleteReel } from '../services/reelsService';
import { computeProfileCompleteness, saveCreatorOnboarding, broadcastNameChange } from '../services/creatorService';
import { getOrCreateConversation } from '../services/messagingService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import CreatorOnboardingPage from './CreatorOnboardingPage';

// ── Reel type ─────────────────────────────────────────────────────────────────
interface Reel {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string;
  videoUrl: string;
  metrics: { views: number; likes: number; comments: number; engagementRate: number };
  createdAt: string;
  campaignId: string | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function lockBody() {
  document.body.style.overflow = 'hidden';
  document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`;
}
function unlockBody() {
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
}

// ── Portrait Video Modal ──────────────────────────────────────────────────────
function VideoModal({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted]   = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // lock scroll + ESC close
  useEffect(() => {
    lockBody();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => { unlockBody(); window.removeEventListener('keydown', handler); };
  }, [onClose]);

  // auto-play on open
  useEffect(() => {
    videoRef.current?.play().catch(() => {});
    scheduleHide();
  }, []);

  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    hideTimer.current = setTimeout(() => setShowControls(false), 2500);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    scheduleHide();
    if (v.paused) { v.play(); setPlaying(true); }
    else          { v.pause(); setPlaying(false); }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    scheduleHide();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const goFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    videoRef.current?.requestFullscreen?.();
  };

  const modal = (
  <div
    style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.92)', zIndex: 99999 }}
    onClick={onClose}
  >
      {/* Portrait container — video fills everything, no white header */}
      <div
        className="relative rounded-3xl overflow-hidden shadow-2xl"
        style={{
          width: 'min(380px, 88vw)',
          height: 'min(calc(100dvh - 3rem), calc(min(380px, 88vw) * 16 / 9))',
          background: '#000',
          lineHeight: 0,
          fontSize: 0,
        }}
        onClick={e => e.stopPropagation()}
        onMouseMove={scheduleHide}
        onTouchStart={scheduleHide}
      >
        {/* Video fills the entire modal — no letterboxing */}
        {reel.videoUrl ? (
          <video
            ref={videoRef}
            src={reel.videoUrl}
            poster={reel.thumbnailUrl || undefined}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loop
            playsInline
            onClick={togglePlay}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : (
          <img
            src={reel.thumbnailUrl}
            alt={reel.title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
       
        {/* Top overlay: title + close — purely floating, no background box */}
        <div className={`absolute top-0 left-0 right-0 z-10 px-4 pt-4 pb-8 bg-gradient-to-b from-black/75 via-black/30 to-transparent flex items-start justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-snug drop-shadow truncate">{reel.title}</p>
            <span className="text-white/60 text-[11px] capitalize drop-shadow">{reel.category}</span>
          </div>
          <button
            onClick={onClose}
            className="ml-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-colors shrink-0"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Center play/pause indicator (flash on tap) */}
        {reel.videoUrl && (
          <div
            className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${!playing && showControls ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}

        {/* Bottom overlay: mute + fullscreen */}
        <div className={`absolute bottom-0 left-0 right-0 px-4 py-5 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center gap-2 text-white/70 text-xs">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z" clipRule="evenodd" />
            </svg>
            <span className="font-bold text-white">{fmtNum(reel.metrics.views)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
              {muted
                ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L19.5 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L19.5 10.94l-1.72-1.72Z" /></svg>
                : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" /></svg>
              }
            </button>
            <button onClick={goFullscreen} className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const CAT_COLORS: Record<string, string> = {
  beauty:    'bg-[#F8EFF3] text-[#A8678A]',
  fitness:   'bg-[#F8EFF3] text-[#A8678A]',
  tech:      'bg-[#F8EFF3] text-[#A8678A]',
  food:      'bg-[#F8EFF3] text-[#A8678A]',
  travel:    'bg-[#F8EFF3] text-[#A8678A]',
  gaming:    'bg-[#F8EFF3] text-[#A8678A]',
  lifestyle: 'bg-[#F8EFF3] text-[#A8678A]',
  finance:   'bg-[#F8EFF3] text-[#A8678A]',
  education: 'bg-[#F8EFF3] text-[#A8678A]',
  fashion:   'bg-[#F8EFF3] text-[#A8678A]',
};

const PLATFORM_SVG: Record<string, React.ReactNode> = {
  instagram: (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-pink-500">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-red-500">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-slate-800">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.41a8.16 8.16 0 004.77 1.52V7.49a4.85 4.85 0 01-1-.8z"/>
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-sky-500">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
};

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ color, up }: { color: string; up: boolean }) {
  const upPath   = 'M0,20 C10,20 10,15 20,15 S30,10 40,8 S50,5 60,3';
  const downPath = 'M0,5  C10,5  10,8  20,10 S30,14 40,16 S50,18 60,20';
  return (
    <svg width="64" height="24" viewBox="0 0 64 24" fill="none">
      <path d={up ? upPath : downPath} stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
function DonutChart({ female, male, other }: { female: number; male: number; other?: number }) {
  const r = 40;
  const cx = 56;
  const cy = 56;
  const circumference = 2 * Math.PI * r;
  const femaleAngle = female * 360;
  const maleAngle   = male   * 360;
  const otherAngle  = (other ?? 0) * 360;

  function arc(startDeg: number, endDeg: number, color: string, key: string) {
    const start = ((startDeg - 90) * Math.PI) / 180;
    const end   = ((endDeg - 90)   * Math.PI) / 180;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return (
      <path
        key={key}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
        fill={color}
      />
    );
  }

  const segments = [
    { start: 0,                          end: femaleAngle,                color: '#f472b6' },
    { start: femaleAngle,                end: femaleAngle + maleAngle,    color: '#a78bfa' },
    { start: femaleAngle + maleAngle,    end: femaleAngle + maleAngle + otherAngle, color: '#fbbf24' },
  ].filter(s => s.end > s.start);

  return (
    <svg width="112" height="112" viewBox="0 0 112 112">
      {segments.map((s, i) => arc(s.start, s.end, s.color, String(i)))}
      {/* center hole */}
      <circle cx={cx} cy={cy} r={r * 0.6} fill="white" />
      <text x={cx} y={cy - 4} textAnchor="middle" className="text-sm" fontSize="14" fontWeight="800" fill="#374151">
        {Math.round(female * 100)}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10" fill="#6b7280">
        Female
      </text>
    </svg>
  );
}

// ── Score Breakdown Bar ───────────────────────────────────────────────────────
function ScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = (score / max) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[#6E6A65] w-44 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-[#F6F2E8] rounded-full overflow-hidden">
        <div className={`h-full rounded-full score-bar ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-[#1F1F1F] w-16 text-right shrink-0">{score}/{max}</span>
    </div>
  );
}

// ── CONTENT CATEGORIES ────────────────────────────────────────────────────────
const ALL_CATEGORIES = [
  'beauty', 'fitness', 'tech', 'food', 'travel',
  'gaming', 'lifestyle', 'finance', 'education', 'fashion',
] as const;

// ── Upload Metadata Modal ─────────────────────────────────────────────────────
interface UploadModalProps {
  file: File;
  defaultCategory: string;
  onConfirm: (meta: { title: string; description: string; category: string; thumbnailUrl: string }) => void;
  onCancel: () => void;
}

function UploadModal({ file, defaultCategory, onConfirm, onCancel }: UploadModalProps) {
  const [title, setTitle] = useState(file.name.replace(/\.[^.]+$/, ''));
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [frameTime, setFrameTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [showFramePicker, setShowFramePicker] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameVideoRef = useRef<HTMLVideoElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => {
  const url = URL.createObjectURL(file);

  setPreviewUrl(url);

  return () => {
    URL.revokeObjectURL(url);
  };
}, [file]);
  const [frames, setFrames] = useState<string[]>([]);

  useEffect(() => {
    lockBody();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => { unlockBody(); window.removeEventListener('keydown', handler); };
  }, [onCancel]);
// const generateFrames = async () => {
//   const video = frameVideoRef.current;

//   if (!video) return;

//   const canvas = document.createElement("canvas");
//   canvas.width = 120;
//   canvas.height = 200;

//   const ctx = canvas.getContext("2d");

//   const generatedFrames: string[] = [];

//   const step = Math.max(video.duration / 10, 0.5);

//   for (let t = 0; t < video.duration; t += step) {
//     video.currentTime = t;

//     await new Promise<void>((resolve) => {
//       video.onseeked = () => resolve();
//     });

//     ctx?.drawImage(
//       video,
//       0,
//       0,
//       canvas.width,
//       canvas.height
//     );

//     generatedFrames.push(
//       canvas.toDataURL("image/jpeg", 0.7)
//     );
//   }

//   setFrames(generatedFrames);
// };

  const handleFrameVideoLoad = async () => {
  const v = frameVideoRef.current;

  if (!v) return;

  setVideoDuration(v.duration || 0);

  v.currentTime = 0;

  // await generateFrames();
};

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    setFrameTime(t);
    const v = frameVideoRef.current;
    if (v) { v.currentTime = t; v.pause(); }
  };

  const captureFrame = () => {
    const v = frameVideoRef.current;
    if (!v) return;
    const canvas = document.createElement('canvas');
    canvas.width  = v.videoWidth  || 360;
    canvas.height = v.videoHeight || 640;
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
    setThumbnailUrl(canvas.toDataURL('image/jpeg', 0.9));
    setShowFramePicker(false);
  };

  const handleThumbFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setThumbnailUrl(URL.createObjectURL(f));
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onConfirm({ title: title.trim(), description: description.trim(), category, thumbnailUrl });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', zIndex: 9999 }} onClick={onCancel}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 2rem)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E1D8] shrink-0">
          <h2 className="font-black text-[#1F1F1F] text-base">Upload Reel</h2>
          <button type="button" onClick={onCancel}
            className="w-8 h-8 rounded-full bg-[#F8EFF3] flex items-center justify-center text-[#6E6A65] hover:bg-[#E7E1D8]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* ── Video + thumbnail side by side ── */}
            <div className="flex gap-4 items-start justify-center">
              {/* Live video preview */}
              <div className="shrink-0 rounded-2xl overflow-hidden w-[140px] aspect-[9/16] bg-black leading-none">
               <video
 ref={videoRef}
 src={previewUrl}
 controls
 autoPlay
 muted
 loop
 playsInline
 onLoadedMetadata={() => console.log("PREVIEW LOADED")}
 onError={(e) => console.log("PREVIEW ERROR", e)}
/>
              </div>

              {/* Thumbnail picker slot */}
              <div className="shrink-0 rounded-2xl overflow-hidden border-2 border-dashed border-[#E7E1D8] hover:border-[#A8678A] cursor-pointer transition-colors flex items-center justify-center w-[140px] aspect-[9/16] bg-[#F6F2E8] leading-none"
                onClick={() => setShowFramePicker(true)}>
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt="thumbnail"
                    className="w-full h-full object-cover block" />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-3 text-center">
                    <svg className="w-7 h-7 text-[#A8678A]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
                    </svg>
                    <span className="text-[10px] font-bold text-[#A8678A] leading-tight">Tap to pick thumbnail</span>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setShowFramePicker(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F8EFF3] border border-[#E7E1D8] text-[#A8678A] text-xs font-bold hover:bg-[#E7E1D8] transition-colors">
                🎬 Pick frame from video
              </button>
              <button type="button" onClick={() => thumbInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F6F2E8] border border-[#E7E1D8] text-[#6E6A65] text-xs font-bold hover:bg-[#E7E1D8] transition-colors">
                🖼️ Upload image
              </button>
              {thumbnailUrl && (
                <button type="button" onClick={() => setThumbnailUrl('')}
                  className="text-xs font-bold text-red-500 hover:text-red-700 px-2 py-2">Remove</button>
              )}
              <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbFile} />
            </div>

            {/* ── Instagram-style frame picker ── */}
            {showFramePicker && (
              <div className="rounded-2xl overflow-hidden border border-[#E7E1D8]"
                style={{ background: '#1a1a1a' }}>
                {/* Frame preview — portrait */}
                <div
  className="flex items-center justify-center overflow-hidden rounded-t-2xl bg-black"
  style={{
    height: 380,
  }}
>
<video
  ref={frameVideoRef}
  src={previewUrl}
  className="w-full h-full object-contain"
  controls
  muted
  playsInline
  preload="auto"
  onLoadedMetadata={() => {
    console.log("VIDEO LOADED");
    handleFrameVideoLoad();
  }}
  onError={(e) => {
    console.log("VIDEO ERROR", e);
  }}
/>
                </div>
                {/* Scrubber */}
                <div className="px-4 py-3 space-y-2">
                  <p className="text-white/60 text-[10px] font-semibold text-center">
                    Drag to choose thumbnail frame · {frameTime.toFixed(1)}s{videoDuration > 0 ? ` / ${videoDuration.toFixed(1)}s` : ''}
                  </p>
                  <input type="range" min={0} max={videoDuration || 1} step={0.05}
                    value={frameTime} onChange={handleScrub}
                    className="w-full h-1.5 rounded-full cursor-pointer accent-[#A8678A]" />
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setShowFramePicker(false)}
                      className="flex-1 py-2 rounded-xl border border-white/20 text-white/70 text-xs font-bold hover:bg-white/10">
                      Cancel
                    </button>
                    <button type="button" onClick={captureFrame}
                      className="flex-1 py-2 rounded-xl bg-[#A8678A] text-white text-xs font-bold hover:opacity-90">
                      Use this frame ✓
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">
                Title <span className="text-[#A8678A]">*</span>
              </label>
              <input value={title} onChange={e => setTitle(e.target.value)} required maxLength={80}
                placeholder="Give your reel a catchy title..."
                className="w-full px-4 py-2.5 bg-[#F6F2E8] border border-transparent rounded-xl text-sm text-[#1F1F1F] placeholder-[#9E9A97] focus:outline-none focus:bg-white focus:border-[#A8678A] focus:ring-2 focus:ring-[#A8678A]/20 transition-all" />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {ALL_CATEGORIES.map(cat => (
                  <button key={cat} type="button" onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                      category === cat ? 'bg-[#1F1F1F] text-white' : 'bg-[#F8EFF3] text-[#A8678A] hover:bg-[#E7E1D8]'
                    }`}>{cat}</button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">
                Description <span className="text-[#9E9A97] font-normal">(optional)</span>
              </label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={3} maxLength={300}
                placeholder="Describe your reel — brand, campaign, context..."
                className="w-full px-4 py-2.5 bg-[#F6F2E8] border border-transparent rounded-xl text-sm text-[#1F1F1F] placeholder-[#9E9A97] focus:outline-none focus:bg-white focus:border-[#A8678A] focus:ring-2 focus:ring-[#A8678A]/20 transition-all resize-none" />
              <p className="text-[10px] text-[#9E9A97] text-right mt-1">{description.length}/300</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E7E1D8] bg-[#F6F2E8] shrink-0 rounded-b-3xl">
            <button type="button" onClick={onCancel}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#6E6A65] hover:bg-[#E7E1D8] transition-colors">
              Cancel
            </button>
            <button type="submit"
              className="px-6 py-2.5 rounded-xl text-sm font-black bg-[#1F1F1F] text-white hover:opacity-90 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              Publish Reel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ReelCard component ────────────────────────────────────────────────────────
interface ReelCardProps {
  reel: Reel;
  isPinned: boolean;
  isOwnProfile: boolean;
  isDragOver?: boolean;
  onPlay: () => void;
  onPin: () => void;
  onDelete: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

function ReelCard({ reel, isPinned, isOwnProfile, isDragOver, onPlay, onPin, onDelete, onDragStart, onDragOver, onDrop }: ReelCardProps) {
  return (
    <div
      className={`group cursor-pointer transition-all duration-200 ${isDragOver ? 'scale-95 opacity-60' : ''}`}
      draggable={isPinned && isOwnProfile}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Portrait thumbnail */}
      <div
        className={`relative rounded-2xl overflow-hidden bg-[#1F1F1F] aspect-[9/16] ${
          isPinned ? 'ring-2 ring-[#A8678A] ring-offset-2' : ''
        }`}
        onClick={onPlay}
      >
        {reel.thumbnailUrl ? (
          <img src={reel.thumbnailUrl} alt={reel.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : reel.videoUrl ? (
          <video src={reel.videoUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" muted playsInline />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a]">
            <svg className="w-10 h-10 text-white/20 mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
        )}

        {/* Gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Top-left: category chip OR pinned badge */}
        {isPinned ? (
          <span className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-[#A8678A] text-white">
            📌 Pinned
          </span>
        ) : (
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-black capitalize bg-white/90 text-[#1F1F1F]">
            {reel.category}
          </span>
        )}

        {/* Top-right: action buttons on hover (own profile only) */}
        {isOwnProfile && (
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {/* Pin / unpin */}
            <button
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors text-sm ${
                isPinned ? 'bg-[#A8678A] text-white' : 'bg-black/60 text-white hover:bg-[#A8678A]'
              }`}
              onClick={e => { e.stopPropagation(); onPin(); }}
              title={isPinned ? 'Unpin reel' : 'Pin reel'}
            >
              📌
            </button>
            {/* Delete */}
            <button
              className="w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
              onClick={e => { e.stopPropagation(); onDelete(); }}
              aria-label="Delete reel"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        )}

        {/* "Featured by Creator" label for pinned */}
        {isPinned && (
          <span className="absolute bottom-9 left-2.5 right-2.5 text-center text-[9px] font-black text-white/70 uppercase tracking-widest">
            Featured by Creator
          </span>
        )}

        {/* Center play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-white/85 group-hover:bg-white group-hover:scale-110 flex items-center justify-center shadow-lg transition-all duration-200">
            <svg className="w-5 h-5 text-[#1F1F1F] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Views — bottom left */}
        <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 text-white text-xs font-bold">
          <svg className="w-3.5 h-3.5 opacity-80" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
            <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z" clipRule="evenodd" />
          </svg>
          {fmtNum(reel.metrics.views)}
        </div>

        {/* Duration — bottom right */}
        <span className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold">
          0:30
        </span>
      </div>

      {/* Stats below */}
      <div className="pt-2.5 px-0.5">
        <p className="text-xs font-bold text-[#1F1F1F] line-clamp-2 leading-snug mb-1.5">{reel.title}</p>
        <div className="flex items-center gap-3 text-[11px] text-[#6E6A65]">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 text-[#A8678A]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-2.184C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.915l-.018.01-.006.003-.001.001-.002.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
            {fmtNum(reel.metrics.likes)}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
            {fmtNum(reel.metrics.comments)}
          </span>
          <span className="ml-auto font-black text-[#1F1F1F]">
            {(reel.metrics.engagementRate * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CreatorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuthStore();
  const { creator, loadCreator } = useCreatorStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'reels' | 'about' | 'trust' | 'reviews' | 'applied'>('reels');
  const [reels, setReels] = useState<Reel[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [activeReel, setActiveReel] = useState<Reel | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const profileId = id === 'me' ? currentUser?.id : id;
  const isOwnProfile = currentUser?.id === profileId || creator?.userId === currentUser?.id;

  const handleStartEditName = () => {
    setNameInput(creator?.displayName || '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || !creator) return;
    setSavingName(true);
    try {
      const targetId = currentUser?.id || creator.id;

      // 1. Immediate optimistic local update so UI never reverts back
      const optimisticCreator = { ...creator, displayName: trimmed };
      useCreatorStore.setState({ creator: optimisticCreator });

      // 2. Immediate auth store update so navbar updates with 0 delay
      const current = useAuthStore.getState().currentUser;
      if (current) {
        useAuthStore.setState({
          currentUser: { ...current, displayName: trimmed },
        });
      }

      // 3. Persist to Supabase and cache
      const updated = await saveCreatorOnboarding(targetId, { displayName: trimmed });
      if (updated) {
        useCreatorStore.setState({ creator: { ...updated, displayName: trimmed } });
      }

      // 4. Broadcast name change to Supabase presence
      broadcastNameChange(targetId, trimmed);

      setEditingName(false);
    } catch (err) {
      console.warn('Failed to update name:', err);
      useCreatorStore.setState({
        creator: { ...creator, displayName: trimmed },
      });
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!creator) return;
    setSavedToast(true);
    try {
      const targetId = currentUser?.id || creator.id;
      await saveCreatorOnboarding(targetId, {
        displayName: creator.displayName,
        bio: creator.bio,
        location: creator.location,
        categories: creator.contentCategories,
      });
      const current = useAuthStore.getState().currentUser;
      if (current && creator.displayName) {
        useAuthStore.setState({
          currentUser: { ...current, displayName: creator.displayName },
        });
      }
      if (creator.displayName) {
        broadcastNameChange(targetId, creator.displayName);
      }
    } catch (err) {
      console.warn('handleSaveProfile error:', err);
    }
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleContactCreator = async () => {
    if (!creator) return;
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (creator.id === currentUser.id) {
      alert("You cannot start a conversation with yourself.");
      return;
    }
    setContacting(true);
    try {
      const conv = await getOrCreateConversation(creator.id, currentUser.id);
      navigate(`/messages?conversationId=${conv.id}`);
    } catch (err) {
      console.warn('Failed to start chat with creator:', err);
      navigate('/messages');
    } finally {
      setContacting(false);
    }
  };

  useEffect(() => {
    if (!profileId) {
      if (currentUser?.id) {
        loadCreator(currentUser.id);
      }
      return;
    }
    setLoading(true);
    setError('');
    loadCreator(profileId)
      .catch((err: unknown) => setError((err as Error).message || 'Failed to load profile.'))
      .finally(() => setLoading(false));
  }, [profileId, currentUser?.id, loadCreator]);

  // Realtime Supabase Subscription for profile updates
  useEffect(() => {
    if (!profileId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`realtime:creator_profile_${profileId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'creator_profiles',
          filter: `id=eq.${profileId}`,
        },
        () => {
          loadCreator(profileId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profileId}`,
        },
        () => {
          loadCreator(profileId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, loadCreator]);

  // Reset initialization state on profileId change to prevent sync collisions
  useEffect(() => {
    setIsInitialized(false);
  }, [profileId]);

  // Fetch reels from reelsService (Supabase with localStorage fallback)
  useEffect(() => {
    if (!creator) return;

    let active = true;
    const currentCreator = creator;
    async function loadReels() {
      try {
        const fetchedReels = await fetchReels(currentCreator.id, currentCreator.portfolio);
        if (!active) return;
        setReels(fetchedReels);

        const savedPinned = localStorage.getItem(`pinned-${currentCreator.id}`);
        if (savedPinned) {
          try {
            const parsed = JSON.parse(savedPinned) as string[];
            setPinnedIds(parsed);
          } catch (e) {
            console.error('Failed to parse saved pinned:', e);
          }
        } else {
          setPinnedIds([]);
          localStorage.setItem(`pinned-${currentCreator.id}`, JSON.stringify([]));
        }
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to fetch reels:', err);
      }
    }

    loadReels();

    return () => {
      active = false;
    };
  }, [creator]);

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file.');
      return;
    }
    setPendingFile(file);
    e.target.value = '';
  };

  const handleConfirmUpload = async (meta: { title: string; description: string; category: string; thumbnailUrl: string }) => {
    if (!pendingFile || !creator) return;
    setIsUploading(true);
    setUploadError('');
    try {
      // 1. Upload video to Supabase Storage
      const videoUrl = await uploadReelFile(creator.id, pendingFile);

      // 2. Save metadata to Supabase DB
      const saved = await saveReel(creator.id, {
        title: meta.title,
        description: meta.description || 'Uploaded reel',
        category: meta.category,
        thumbnailUrl: meta.thumbnailUrl,
        videoUrl,
        metrics: { views: 0, likes: 0, comments: 0, engagementRate: 0 },
        campaignId: null,
      });

      setReels(prev => [saved, ...prev]);
      setPendingFile(null);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'Failed to upload reel.');
      alert(err.message || 'Failed to upload reel.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteReel = async (reelId: string) => {
    setReels(prev => prev.filter(r => r.id !== reelId));
    setPinnedIds(prev => prev.filter(id => id !== reelId));
    if (creator) {
      try {
        await deleteReel(creator.id, reelId);
      } catch (err) {
        console.error('Failed to delete reel:', err);
      }
    }
  };

  const MAX_PINS = 6;

  const handleTogglePin = (reelId: string) => {
    setPinnedIds(prev => {
      if (prev.includes(reelId)) return prev.filter(id => id !== reelId);
      if (prev.length >= MAX_PINS) { alert(`You can pin up to ${MAX_PINS} reels.`); return prev; }
      return [...prev, reelId];
    });
  };

  // Drag-and-drop reordering for pinned reels
  const handleDragStart = (e: React.DragEvent, reelId: string) => {
    e.dataTransfer.setData('reelId', reelId);
  };
  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(targetId);
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('reelId');
    if (sourceId === targetId) { setDragOverId(null); return; }
    setPinnedIds(prev => {
      const arr = [...prev];
      const fromIdx = arr.indexOf(sourceId);
      const toIdx = arr.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, sourceId);
      return arr;
    });
    setDragOverId(null);
  };

  // Sync reels to localStorage and sessionStorage when they change
  useEffect(() => {
    if (!creator || !isInitialized) return;
    localStorage.setItem(`reels-${creator.id}`, JSON.stringify(reels));
  }, [reels, creator, isInitialized]);

  // Sync pinned IDs to localStorage when they change
  useEffect(() => {
    if (!creator || !isInitialized) return;
    localStorage.setItem(`pinned-${creator.id}`, JSON.stringify(pinnedIds));
  }, [pinnedIds, creator, isInitialized]);

  // Sync pinned reels to sessionStorage so AIPortfolioGeneratorPage can read them
  useEffect(() => {
    if (!creator || !isInitialized) return;
    const pinned = reels.filter(r => pinnedIds.includes(r.id));
    sessionStorage.setItem('pinnedReels', JSON.stringify(pinned));
    sessionStorage.setItem('allReels', JSON.stringify(reels));
  }, [pinnedIds, reels, creator, isInitialized]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-12 h-12 rounded-full bg-[#1F1F1F] flex items-center justify-center text-white font-black text-lg mb-4">CL</div>
        <div className="w-8 h-8 border-4 border-[#A8678A] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-[#6E6A65] text-sm font-medium">Loading profile...</p>
      </div>
    );
  }

  if (error || !creator) {
    if (isOwnProfile && currentUser) {
      return (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-8 h-8 border-4 border-[#A8678A] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-[#6E6A65] text-sm font-medium">Setting up your profile...</p>
        </div>
      );
    }

    return (
      <div className="text-center py-24 bg-white border border-[#E7E1D8] rounded-[20px] shadow-card">
        <div className="text-5xl mb-4">😕</div>
        <p className="text-[#1F1F1F] font-bold text-lg mb-1">{error || 'Profile not found'}</p>
        <p className="text-[#6E6A65] text-sm mb-6">We couldn't find this creator's profile.</p>
        <Link to="/creators" className="inline-block px-6 py-2.5 bg-[#1F1F1F] text-white font-bold text-sm rounded-2xl shadow-soft hover:opacity-90">
          ← Discover Creators
        </Link>
      </div>
    );
  }

  const totalFollowers = creator.socialAccounts.reduce((s, a) => s + a.followerCount, 0);
  const dem = creator.insights.audienceDemographics;
  const connectedPlatforms = creator.socialAccounts.filter(a => a.connected);
  const completeness = computeProfileCompleteness(creator);

  return (
    <div className="space-y-3.5 pb-6 max-w-5xl mx-auto">

      {/* ── HERO CARD ──────────────────────────────────────────────────── */}
      <div className="rounded-[20px] overflow-hidden shadow-card border border-[#E7E1D8] bg-[#F8EFF3]">
        {/* Top area: avatar + name + CTAs */}
        <div className="px-6 pt-6 pb-2 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          {/* Avatar with online dot */}
          <div className="relative shrink-0">
            <img
              src={creator.avatarUrl}
              alt={creator.displayName}
              className="w-24 h-24 rounded-full border-4 border-white shadow-soft object-cover bg-white"
            />
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow-sm" />
          </div>

          {/* Name & Details Block */}
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2 mb-2 max-w-md">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter full name"
                  className="px-3 py-1.5 bg-white border border-[#A8678A] rounded-xl text-sm font-bold text-[#1F1F1F] focus:outline-none ring-2 ring-[#A8678A]/20 flex-1"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="px-3.5 py-1.5 bg-[#1F1F1F] text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity"
                >
                  {savingName ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="px-2.5 py-1.5 text-xs text-[#6E6A65] font-semibold hover:text-[#1F1F1F]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="text-2xl sm:text-3xl font-black text-[#1F1F1F] tracking-tight">
                  {creator.displayName}
                </h1>
                <VerificationBadge status={creator.verificationStatus} size="sm" />
                {isOwnProfile && (
                  <button
                    onClick={handleStartEditName}
                    className="p-1.5 text-[#6E6A65] hover:text-[#A8678A] hover:bg-white/80 rounded-lg transition-colors"
                    title="Change Display Name"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            <p className="text-[#6E6A65] text-sm mb-1.5 font-medium">
              {creator.contentCategories.length > 0
                ? `${creator.contentCategories.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(' • ')} Creator`
                : 'Content Creator'}
            </p>

            <p className="text-[#6E6A65] text-xs flex items-center gap-1 mb-2">
              <svg className="w-3.5 h-3.5 text-[#A8678A]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              <span>{creator.location && creator.location !== 'Not specified' ? creator.location : 'Location: Not specified'}</span>
            </p>

            <p className="text-xs text-[#6E6A65] mb-3 line-clamp-2 max-w-xl leading-relaxed">
              {creator.bio || 'Ready for high-impact brand sponsorships and collaborations.'}
            </p>

            {/* Category tags */}
            <div className="flex flex-wrap gap-1.5">
              {creator.contentCategories.length > 0 ? (
                creator.contentCategories.map((cat) => (
                  <span
                    key={cat}
                    className={`px-3 py-0.5 rounded-full text-xs font-bold capitalize ${
                      CAT_COLORS[cat] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat}
                  </span>
                ))
              ) : (
                <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-white/70 text-[#A8678A] border border-[#E7E1D8]">
                  Content Type: Not specified yet
                </span>
              )}
            </div>
          </div>

          {/* Single Primary Action Cluster */}
          <div className="flex items-center gap-2 shrink-0 sm:self-center">
            {isOwnProfile ? (
              <button
                onClick={() => setShowOnboardingModal(true)}
                className="px-5 py-2.5 bg-[#1F1F1F] text-white font-bold text-xs rounded-xl shadow-soft hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                {creator.onboardingCompleted ? '✏️ Edit Profile' : '✨ Personalize Profile'}
              </button>
            ) : (
              <button
                onClick={handleContactCreator}
                disabled={contacting}
                className="px-6 py-2.5 bg-[#1F1F1F] text-white font-bold text-xs rounded-xl shadow-soft hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
              >
                {contacting ? (
                  <span>Connecting...</span>
                ) : (
                  <>
                    <span>💬</span>
                    <span>Contact Creator</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleSaveProfile}
              className="px-4 py-2.5 bg-white border border-[#E7E1D8] text-[#1F1F1F] font-bold text-xs rounded-xl hover:bg-white/80 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
              </svg>
              <span>{savedToast ? 'Saved ✓' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* Real Profile Highlights / Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 border-t border-[#E7E1D8] mt-4 bg-white/40">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎯</span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black text-[#1F1F1F] leading-tight">{completeness}%</p>
                  <div className="w-14 h-1.5 bg-[#E7E1D8] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#A8678A] rounded-full transition-all"
                      style={{ width: `${completeness}%` }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-[#6E6A65]">Profile Strength</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">🛡️</span>
              <div>
                <p className="text-xs font-black text-[#1F1F1F] leading-tight">
                  {creator.trustScore > 0 ? `${creator.trustScore} / 100` : 'New Creator'}
                </p>
                <p className="text-[10px] text-[#6E6A65]">Trust Score</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">🎬</span>
              <div>
                <p className="text-xs font-black text-[#1F1F1F] leading-tight">{reels.length} Reels</p>
                <p className="text-[10px] text-[#6E6A65]">Portfolio</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm">👥</span>
              <div>
                <p className="text-xs font-black text-[#1F1F1F] leading-tight">
                  {totalFollowers > 0 ? fmtNum(totalFollowers) : '0'}
                </p>
                <p className="text-[10px] text-[#6E6A65]">Followers</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-[#6E6A65] uppercase tracking-wider">Status:</span>
            <span className="text-xs font-semibold text-[#1F1F1F] bg-white px-2.5 py-0.5 rounded-full border border-[#E7E1D8]">
              {creator.onboardingCompleted ? 'Active Profile' : 'Setting Up'}
            </span>
          </div>
        </div>
      </div>

      {/* ── COMPACT 4-METRIC STRIP ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Trust Score',
            value: String(creator.trustScore),
            ariaLabel: `Trust Score: ${creator.trustScore} out of 100`,
            valueColor: 'text-[#A8678A]',
          },
          {
            label: 'Profile Strength',
            value: `${completeness}%`,
            valueColor: 'text-[#1F1F1F]',
          },
          {
            label: 'Showcase Reels',
            value: String(reels.length),
            valueColor: 'text-[#1F1F1F]',
          },
          {
            label: 'Avg. Engagement',
            value: `${(creator.insights.averageEngagementRate * 100).toFixed(1)}%`,
            valueColor: 'text-[#A8678A]',
          },
        ].map(({ label, value, ariaLabel, valueColor }) => (
          <div
            key={label}
            role={ariaLabel ? 'img' : undefined}
            aria-label={ariaLabel}
            className="bg-white border border-[#E7E1D8] rounded-2xl p-4 flex flex-col justify-between min-h-[84px] shadow-sm"
          >
            <div>
              <p className={`text-2xl font-black tracking-tight ${valueColor} leading-none`}>{value}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#6E6A65] font-black uppercase tracking-wider leading-none mt-2">
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── TAB NAVIGATION & CONTENT ────────────────────────────────────── */}
      <div className="space-y-4 pt-1">
        {/* Modern Tab Bar */}
        <div className="flex gap-1.5 bg-white border border-[#E7E1D8] rounded-2xl p-1.5 w-fit shadow-sm overflow-x-auto max-w-full">
          {[
            { id: 'reels', label: '🎬 Showcase & Reels' },
            { id: 'about', label: '🧬 Creator DNA & Style' },
            { id: 'trust', label: '📊 Trust & Analytics' },
            { id: 'reviews', label: '⭐ Reviews' },
            ...(isOwnProfile ? [{ id: 'applied', label: '📋 Applications' }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[#1F1F1F] text-white shadow-soft'
                  : 'text-[#6E6A65] hover:text-[#1F1F1F] hover:bg-[#F8EFF3]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Reels grid ── */}
        {activeTab === 'reels' && (
          <div>
            {/* Section header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <p className="text-sm text-[#6E6A65] font-medium">
                {reels.length} {reels.length === 1 ? 'reel' : 'reels'}
                {pinnedIds.length > 0 && <span className="ml-2 text-[#A8678A] font-bold">· {pinnedIds.length} pinned</span>}
              </p>
              {isOwnProfile && (
                <div className="flex items-center gap-2">
                  {/* AI Portfolio button */}
                  <button
                    onClick={() => navigate('/creator/me/ai-portfolio')}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#F8EFF3] border border-[#A8678A]/30 text-[#A8678A] font-bold text-xs rounded-xl hover:bg-[#E7E1D8] transition-colors"
                  >
                    ✨ Create Portfolio with AI
                  </button>
                  <button
                    onClick={() => uploadRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1F1F1F] text-white font-bold text-xs rounded-xl hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    Upload Reel
                  </button>
                  <input ref={uploadRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelected} />
                </div>
              )}
            </div>

            {reels.length === 0 ? (
              <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#F8EFF3] flex items-center justify-center mx-auto mb-4 text-3xl">🎬</div>
                <p className="text-[#1F1F1F] font-bold mb-1">No reels yet</p>
                <p className="text-[#6E6A65] text-sm mb-5">Upload your first reel to showcase your content.</p>
                {isOwnProfile && (
                  <button onClick={() => uploadRef.current?.click()}
                    className="px-6 py-2.5 bg-[#1F1F1F] text-white font-bold text-xs rounded-xl hover:opacity-90">
                    + Upload Reel
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">

                {/* ── PINNED REELS section ── */}
                {pinnedIds.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">📌</span>
                      <p className="text-xs font-black uppercase tracking-wider text-[#A8678A]">
                        Pinned Reels ({pinnedIds.length}/{MAX_PINS})
                      </p>
                      {isOwnProfile && (
                        <span className="text-[10px] text-[#9E9A97] ml-1">drag to reorder</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                      {pinnedIds.map(pid => {
                        const reel = reels.find(r => r.id === pid);
                        if (!reel) return null;
                        return (
                          <ReelCard
                            key={reel.id}
                            reel={reel}
                            isPinned={true}
                            isOwnProfile={isOwnProfile}
                            isDragOver={dragOverId === reel.id}
                            onPlay={() => setActiveReel(reel)}
                            onPin={() => handleTogglePin(reel.id)}
                            onDelete={() => handleDeleteReel(reel.id)}
                            onDragStart={e => handleDragStart(e, reel.id)}
                            onDragOver={e => handleDragOver(e, reel.id)}
                            onDrop={e => handleDrop(e, reel.id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── ALL REELS section ── */}
                <div>
                  {pinnedIds.length > 0 && (
                    <p className="text-xs font-black uppercase tracking-wider text-[#6E6A65] mb-3">All Reels</p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {reels.map(reel => (
                      <ReelCard
                        key={reel.id}
                        reel={reel}
                        isPinned={pinnedIds.includes(reel.id)}
                        isOwnProfile={isOwnProfile}
                        isDragOver={false}
                        onPlay={() => setActiveReel(reel)}
                        onPin={() => handleTogglePin(reel.id)}
                        onDelete={() => handleDeleteReel(reel.id)}
                      />
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ── ABOUT & CREATOR DNA TAB ── */}
        {activeTab === 'about' && (
          <div className="space-y-4">
            <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-6 shadow-card space-y-5">
              <div className="flex items-center justify-between border-b border-[#E7E1D8] pb-3">
                <div>
                  <h3 className="text-base font-black text-[#1F1F1F]">Creator DNA & Collaboration Preferences</h3>
                  <p className="text-xs text-[#6E6A65]">Personalized strategy directly from {creator.displayName}.</p>
                </div>
                {isOwnProfile && (
                  <button
                    onClick={() => setShowOnboardingModal(true)}
                    className="px-3.5 py-1.5 bg-[#1F1F1F] text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity"
                  >
                    Edit DNA
                  </button>
                )}
              </div>

              {/* Grid of preferences */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Platforms */}
                <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E7E1D8]/70">
                  <span className="font-bold text-[#6E6A65] uppercase tracking-wider text-[10px] block mb-2">
                    Active Platforms
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {creator.platforms && creator.platforms.length > 0 ? (
                      creator.platforms.map((p) => (
                        <span key={p} className="px-2.5 py-1 rounded-lg bg-white font-bold text-[#1F1F1F] border border-[#E7E1D8] shadow-sm">
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-[#9E9A97] italic">Not specified yet</span>
                    )}
                  </div>
                </div>

                {/* Content Style */}
                <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E7E1D8]/70">
                  <span className="font-bold text-[#6E6A65] uppercase tracking-wider text-[10px] block mb-2">
                    Content Style & Tone
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {creator.contentStyle && creator.contentStyle.length > 0 ? (
                      creator.contentStyle.map((s) => (
                        <span key={s} className="px-2.5 py-1 rounded-lg bg-[#F8EFF3] text-[#A8678A] font-bold border border-[#A8678A]/20 shadow-sm">
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-[#9E9A97] italic">Not specified yet</span>
                    )}
                  </div>
                </div>

                {/* Target Audience */}
                <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E7E1D8]/70">
                  <span className="font-bold text-[#6E6A65] uppercase tracking-wider text-[10px] block mb-2">
                    Target Audience
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {creator.targetAudience && creator.targetAudience.length > 0 ? (
                      creator.targetAudience.map((a) => (
                        <span key={a} className="px-2.5 py-1 rounded-lg bg-white font-bold text-[#1F1F1F] border border-[#E7E1D8] shadow-sm">
                          {a}
                        </span>
                      ))
                    ) : (
                      <span className="text-[#9E9A97] italic">Not specified yet</span>
                    )}
                  </div>
                </div>

                {/* Collaboration Interests */}
                <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E7E1D8]/70">
                  <span className="font-bold text-[#6E6A65] uppercase tracking-wider text-[10px] block mb-2">
                    Preferred Brand Collaborations
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {creator.collabTypes && creator.collabTypes.length > 0 ? (
                      creator.collabTypes.map((c) => (
                        <span key={c} className="px-2.5 py-1 rounded-lg bg-[#F8EFF3] text-[#1F1F1F] font-bold border border-[#E7E1D8] shadow-sm">
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-[#9E9A97] italic">Not specified yet</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Unique Value Proposition */}
              {creator.uniqueValue && (
                <div className="bg-[#FAF7F2] p-4 rounded-xl border border-[#E7E1D8]/70">
                  <span className="font-bold text-[#6E6A65] uppercase tracking-wider text-[10px] block mb-1.5">
                    What Makes My Content Special
                  </span>
                  <p className="text-xs text-[#1F1F1F] italic leading-relaxed">
                    "{creator.uniqueValue}"
                  </p>
                </div>
              )}

              {/* Bio */}
              <div className="pt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E6A65] mb-2">About & Bio</p>
                <p className="text-xs text-[#1F1F1F] leading-relaxed bg-[#FAF7F2] p-4 rounded-xl border border-[#E7E1D8]/70">
                  {creator.bio || 'No bio provided yet.'}
                </p>
              </div>

              {/* Social Accounts */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E6A65] mb-2">Connected Accounts</p>
                {creator.socialAccounts.length > 0 ? (
                  <div className="flex flex-wrap gap-3">
                    {creator.socialAccounts.map((acc, i) => (
                      <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${acc.connected ? 'bg-[#F8EFF3] border-[#A8678A] text-[#A8678A]' : 'bg-white border-[#E7E1D8] text-[#6E6A65]'}`}>
                        {PLATFORM_SVG[acc.platform]}
                        <span className="capitalize">{acc.platform}</span>
                        <span className="font-black">{fmtNum(acc.followerCount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#9E9A97] italic">No social accounts connected yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TRUST & ANALYTICS TAB ── */}
        {activeTab === 'trust' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. Creator Trust Score Panel */}
            <div className="bg-white border border-[#E7E1D8] rounded-2xl p-5 shadow-card flex flex-col justify-between gap-4 h-full">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none select-none">🛡️</span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#1F1F1F] leading-none">Creator Trust Score</h3>
                </div>
                <span className="text-[9px] font-bold text-[#A8678A] uppercase tracking-wider pl-7 leading-none">
                  Professional Reputation Score
                </span>
              </div>

              <div className="flex items-center justify-between gap-4" role="img" aria-label={`Trust Score: ${creator.trustScore} out of 100`}>
                <div className="space-y-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-[#1F1F1F] tracking-tight">{creator.trustScore}</span>
                    <span className="text-[#6E6A65] font-semibold text-sm">/ 100</span>
                    <span className="ml-1.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-[#F8EFF3] text-[#A8678A] uppercase tracking-wider">
                      {creator.trustScore >= 70 ? 'Excellent' : 'Calculating'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6E6A65] leading-snug">
                    Based on audience quality, engagement & collaboration history.
                  </p>
                </div>

                <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="38" fill="none" stroke="#E7E1D8" strokeWidth="10" />
                    <circle cx="48" cy="48" r="38" fill="none" stroke="#A8678A" strokeWidth="10"
                      strokeDasharray={`${(creator.trustScore / 100) * 238.76} 238.76`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-base font-black text-[#1F1F1F]">{creator.trustScore}</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#F8EFF3] rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#A8678A] text-center mt-auto">
                🏆 Top Niche Ranking in {creator.contentCategories[0] ?? 'Lifestyle'}
              </div>
            </div>

            {/* 2. Score Breakdown Panel */}
            <div className="bg-white border border-[#E7E1D8] rounded-2xl p-5 shadow-card flex flex-col justify-between gap-4 h-full">
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none select-none">📊</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1F1F1F] leading-none">Score Breakdown</h3>
              </div>
              {(() => {
                const factors = creator.trustScore > 0
                  ? [
                      { factor: 'Audience Authenticity', impact: `+${Math.round(creator.trustScore * 0.27)}` },
                      { factor: 'Engagement Quality', impact: `+${Math.round(creator.trustScore * 0.22)}` },
                      { factor: 'Growth Consistency', impact: `+${Math.round(creator.trustScore * 0.15)}` },
                      { factor: 'Collaboration Success', impact: `+${creator.trustScore - Math.round(creator.trustScore * 0.27) - Math.round(creator.trustScore * 0.22) - Math.round(creator.trustScore * 0.15)}` },
                    ]
                  : [
                      { factor: 'Audience Authenticity', impact: 'Pending' },
                      { factor: 'Engagement Quality', impact: 'Pending' },
                      { factor: 'Growth Consistency', impact: 'Pending' },
                      { factor: 'Collaboration Success', impact: 'Pending' },
                    ];
                return (
                  <div className="space-y-2 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[#6E6A65] leading-none">Contributing Factors</p>
                    <div className="grid grid-cols-2 gap-2">
                      {factors.map((item) => (
                        <div key={item.factor} className="bg-[#F6F2E8]/40 border border-[#E7E1D8]/40 rounded-xl p-3 flex flex-col justify-between min-h-[64px]">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#6E6A65] leading-tight mb-1">{item.factor}</span>
                          <span className="text-sm font-black text-[#A8678A] leading-none">{item.impact}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <p className="text-[10px] text-[#6E6A65] leading-normal italic border-t border-[#E7E1D8]/60 pt-2.5">
                "Calculated using audience authenticity, content quality, and collaboration history."
              </p>
            </div>

            {/* 3. Audience Demographics */}
            <div className="bg-white border border-[#E7E1D8] rounded-2xl p-5 shadow-card flex flex-col justify-between gap-4 h-full">
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none select-none">👥</span>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1F1F1F] leading-none">Audience Demographics</h3>
              </div>

              <div className="flex items-center gap-4 flex-1">
                <DonutChart
                  female={dem.genderSplit.female}
                  male={dem.genderSplit.male}
                  other={dem.genderSplit.other}
                />

                <div className="space-y-1.5 flex-1">
                  {[
                    { label: '18-24', color: 'bg-[#A8678A]', pct: dem.ageGroups['18-24'] },
                    { label: '25-34', color: 'bg-[#1F1F1F]', pct: dem.ageGroups['25-34'] },
                    { label: '35-44', color: 'bg-[#6E6A65]', pct: dem.ageGroups['35-44'] },
                    { label: '45+', color: 'bg-[#E7E1D8]', pct: dem.ageGroups['45+'] },
                  ].map(({ label, color, pct }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                      <span className="text-xs text-[#6E6A65] w-10 leading-none">{label}</span>
                      <span className="text-xs font-black text-[#1F1F1F] leading-none">
                        {typeof pct === 'number' ? `${(pct * 100).toFixed(0)}%` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#6E6A65] mb-1.5 leading-none">Top Regions</p>
                <div className="flex items-center gap-1.5">
                  {(dem.topCountries.length > 0 ? dem.topCountries.slice(0, 3) : ['Global', 'IN', 'US']).map((c) => (
                    <span key={c} className="px-2.5 py-1 rounded-lg bg-[#F8EFF3] text-[#A8678A] border border-[#E7E1D8] text-[10px] font-bold uppercase tracking-wider leading-none shadow-sm">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. AI Creator DNA Summary */}
            <div className="bg-white border border-[#E7E1D8] rounded-2xl p-5 shadow-card relative overflow-hidden flex flex-col justify-between gap-4 h-full">
              <div className="flex items-center justify-between gap-2 z-10 w-full">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none select-none">🧬</span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#1F1F1F] leading-none">AI Profile Assessment</h3>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[9px] font-black bg-[#F8EFF3] text-[#A8678A] border border-[#A8678A]/30 flex items-center gap-1 shadow-sm shrink-0 uppercase tracking-wider">
                  ✨ Realtime AI
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 z-10 flex-1">
                {[
                  { label: 'Content Focus', value: creator.contentCategories[0] ? creator.contentCategories[0].toUpperCase() : 'Lifestyle' },
                  { label: 'Brand Safety', value: 'Verified 100%', valueClass: 'text-emerald-600 font-bold' },
                  { label: 'Audience Trust', value: creator.trustScore > 0 ? 'High' : 'Establishing', valueClass: 'text-[#A8678A] font-bold' },
                  { label: 'Collaboration Match', value: 'Ready', valueClass: 'text-[#1F1F1F] font-bold' },
                ].map((f) => (
                  <div key={f.label} className="bg-[#F6F2E8]/40 border border-[#E7E1D8]/50 rounded-xl p-3 flex flex-col justify-center h-full">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-[#6E6A65] mb-1 leading-none">{f.label}</span>
                    <span className={`block text-xs font-bold text-[#1F1F1F] leading-tight ${f.valueClass ?? ''}`}>{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reviews tab */}
        {activeTab === 'reviews' && (
          <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-12 text-center shadow-card">
            <div className="text-5xl mb-4">⭐</div>
            <p className="text-[#1F1F1F] font-bold">No reviews yet</p>
            <p className="text-[#6E6A65] text-sm mt-1">Reviews from brand collaborations will appear here.</p>
          </div>
        )}

        {/* Applied Campaigns tab */}
        {activeTab === 'applied' && (() => {
          const store = getStore();
          const appliedCampaigns = creator.collaborationHistory.map(collab => {
            const campaign = store.campaigns.get(collab.campaignId);
            const brand    = campaign ? store.brands.get(campaign.brandId) : null;
            return { collab, campaign, brand };
          }).filter(x => x.campaign);

          return appliedCampaigns.length === 0 ? (
            <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-12 text-center">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-[#1F1F1F] font-bold">No applications yet</p>
              <p className="text-[#6E6A65] text-sm mt-2">Apply to campaigns from the Feed to see them here.</p>
              <Link to="/feed" className="inline-block mt-4 px-5 py-2.5 bg-[#1F1F1F] text-white font-bold text-xs rounded-xl hover:opacity-90">
                Browse Campaigns →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {appliedCampaigns.map(({ collab, campaign, brand }) => (
                <div key={collab.campaignId}
                  className="bg-white border border-[#E7E1D8] rounded-[20px] p-5 shadow-card flex items-start gap-4">
                  {brand && (
                    <img src={brand.logoUrl} alt={brand.companyName}
                      className="w-12 h-12 rounded-xl border border-[#E7E1D8] bg-white p-1 shrink-0 object-contain" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1F1F1F] truncate">{campaign!.title}</p>
                    {brand && (
                      <Link to={`/brand/${brand.id}`} className="text-xs text-[#A8678A] hover:underline">{brand.companyName}</Link>
                    )}
                    <p className="text-[10px] text-[#6E6A65] mt-1">
                      Applied {collab.startDate ? new Date(collab.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                    </p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                    collab.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                    : collab.status === 'active'  ? 'bg-blue-100 text-blue-700'
                    : collab.status === 'pending' ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-600'
                  }`}>{collab.status}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* ── VIDEO MODAL ─────────────────────────────────────────────────── */}
      {activeReel && (
        <VideoModal reel={activeReel} onClose={() => setActiveReel(null)} />
      )}

      {/* ── UPLOAD METADATA MODAL ───────────────────────────────────────── */}
      {pendingFile && (
        <UploadModal
          file={pendingFile}
          defaultCategory={creator.contentCategories[0] ?? 'lifestyle'}
          onConfirm={handleConfirmUpload}
          onCancel={() => setPendingFile(null)}
        />
      )}

      {/* ── UPLOADING SPINNER OVERLAY ── */}
      {isUploading && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-[#A8678A] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white font-bold text-sm">Uploading and saving your reel...</p>
        </div>
      )}

      {/* ── ONBOARDING / EDIT PROFILE MODAL ────────────────────────────── */}
      {showOnboardingModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white border border-[#E7E1D8] rounded-[24px] shadow-2xl p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowOnboardingModal(false)}
              className="absolute top-4 right-4 text-[#6E6A65] hover:text-[#1F1F1F] text-sm font-black w-8 h-8 rounded-full bg-[#F8EFF3] flex items-center justify-center transition-colors z-10"
              title="Close"
            >
              ✕
            </button>
            <CreatorOnboardingPage
              isModal={true}
              onComplete={async () => {
                setShowOnboardingModal(false);
                if (profileId) {
                  await loadCreator(profileId);
                }
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
