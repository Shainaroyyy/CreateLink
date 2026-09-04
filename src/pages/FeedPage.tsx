// placeholder

// ── EXISTING IMPORTS (unchanged) ─────────────────────────────────────────────
import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useFeedStore } from '../stores/feedStore';
import { useAuthStore } from '../stores/authStore';
import { useCreatorStore } from '../stores/creatorStore';
import { useBrandStore } from '../stores/brandStore';
import { getBrandsByIds } from '../services/brandService';
import { getStore } from '../services/store';
import FeedCard from '../components/feed/FeedCard';
import ApplicationForm from '../components/application/ApplicationForm';
import CreatorApplicationForm from '../components/application/CreatorApplicationForm';
import type { FeedPost, Campaign } from '../types/index';
import { uploadReelFile, saveReel } from '../services/reelsService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

// ── NEW: Creator post types ───────────────────────────────────────────────────
type CreatorPostKind = 'hiring' | 'share_work';

interface CreatorPost {
  id: string;
  kind: CreatorPostKind;
  authorName: string;
  authorAvatar: string;
  authorId: string;
  createdAt: string;
  // hiring fields
  roleNeeded?: string;
  budget?: string;
  location?: string;
  isRemote?: boolean;
  deadline?: string;
  description: string;
  // share_work
  title?: string;
  body?: string;
  videoUrl?: string;
  imageUrl?: string;
}

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

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

// ── NEW: Hiring Modal ─────────────────────────────────────────────────────────
interface HiringModalProps {
  authorName: string;
  authorAvatar: string;
  authorId: string;
  onPublish: (p: CreatorPost) => void;
  onClose: () => void;
}
function HiringModal({ authorName, authorAvatar, authorId, onPublish, onClose }: HiringModalProps) {
  const [role, setRole] = useState('');
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');

  const ROLE_SUGGESTIONS = ['Video Editor', 'Photographer', 'Videographer', 'Thumbnail Designer', 'UGC Creator', 'Script Writer'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim()) return;
    onPublish({
      id: `cp-${Date.now()}`,
      kind: 'hiring',
      authorName,
      authorAvatar,
      authorId,
      createdAt: new Date().toISOString(),
      roleNeeded: role.trim(),
      budget: budget.trim(),
      location: location.trim() || (isRemote ? 'Remote' : ''),
      isRemote,
      deadline,
      description: description.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 2rem)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E1D8] shrink-0">
          <h2 className="font-black text-[#1F1F1F] text-base">🎬 Post a Hiring Request</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F8EFF3] flex items-center justify-center text-[#6E6A65] hover:bg-[#E7E1D8]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Role quick-pick */}
            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-2">Role Needed *</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ROLE_SUGGESTIONS.map(r => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${role === r ? 'bg-[#1F1F1F] text-white' : 'bg-[#F8EFF3] text-[#A8678A] hover:bg-[#E7E1D8]'}`}>
                    {r}
                  </button>
                ))}
              </div>
              <input value={role} onChange={e => setRole(e.target.value)} required placeholder="Or type a custom role..."
                className="w-full px-4 py-2.5 bg-[#F6F2E8] border border-transparent rounded-xl text-sm text-[#1F1F1F] placeholder-[#9E9A97] focus:outline-none focus:bg-white focus:border-[#A8678A] focus:ring-2 focus:ring-[#A8678A]/20" />
            </div>
            {/* Budget */}
            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">Budget</label>
              <input value={budget} onChange={e => setBudget(e.target.value)} placeholder="e.g. ₹5,000 – ₹15,000 or Negotiable"
                className="w-full px-4 py-2.5 bg-[#F6F2E8] border border-transparent rounded-xl text-sm text-[#1F1F1F] placeholder-[#9E9A97] focus:outline-none focus:bg-white focus:border-[#A8678A] focus:ring-2 focus:ring-[#A8678A]/20" />
            </div>
            {/* Location + Remote */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City or region"
                  className="w-full px-4 py-2.5 bg-[#F6F2E8] border border-transparent rounded-xl text-sm text-[#1F1F1F] placeholder-[#9E9A97] focus:outline-none focus:bg-white focus:border-[#A8678A] focus:ring-2 focus:ring-[#A8678A]/20" />
              </div>
              <div className="flex flex-col justify-end gap-1">
                <label className="text-xs font-bold text-[#1F1F1F]">Remote?</label>
                <button type="button" onClick={() => setIsRemote(p => !p)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${isRemote ? 'bg-[#1F1F1F] text-white' : 'bg-[#F8EFF3] text-[#A8678A] border border-[#E7E1D8]'}`}>
                  {isRemote ? '✓ Remote' : 'Remote'}
                </button>
              </div>
            </div>
            {/* Deadline */}
            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">Application Deadline</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#F6F2E8] border border-transparent rounded-xl text-sm text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#A8678A] focus:ring-2 focus:ring-[#A8678A]/20" />
            </div>
            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} maxLength={600}
                placeholder="Describe the role, deliverables, requirements..."
                className="w-full px-4 py-2.5 bg-[#F6F2E8] border border-transparent rounded-xl text-sm text-[#1F1F1F] placeholder-[#9E9A97] focus:outline-none focus:bg-white focus:border-[#A8678A] focus:ring-2 focus:ring-[#A8678A]/20 resize-none" />
              <p className="text-[10px] text-[#9E9A97] text-right mt-1">{description.length}/600</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E7E1D8] bg-[#F6F2E8] shrink-0 rounded-b-3xl">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#6E6A65] hover:bg-[#E7E1D8]">Cancel</button>
            <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-black bg-[#1F1F1F] text-white hover:opacity-90 flex items-center gap-2">
              🎬 Publish
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── NEW: Share Work Modal ─────────────────────────────────────────────────────
interface ShareWorkModalProps {
  authorName: string; authorAvatar: string; authorId: string;
  onPublish: (p: CreatorPost, file?: File | null) => void; onClose: () => void;
}
function ShareWorkModal({ authorName, authorAvatar, authorId, onPublish, onClose }: ShareWorkModalProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedFileBase64, setAttachedFileBase64] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PROMPTS = ['Completed a brand campaign', 'Hit a milestone', 'Launched new content', 'Achieved a metric goal'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 2.5MB limit validation
    if (file.size > 2.5 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 2.5MB limit. Please upload a smaller image or video.');
      setAttachedFile(null);
      setAttachedFileBase64('');
      return;
    }

    setErrorMessage('');
    setAttachedFile(file);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setAttachedFileBase64(reader.result as string);
    };
    reader.onerror = (err) => {
      console.error('File reading error:', err);
      setErrorMessage('Failed to read media file.');
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    const isVideo = attachedFile?.type.startsWith('video/');
    const isImage = attachedFile?.type.startsWith('image/');

    onPublish({
      id: `reel-${Date.now()}`,
      kind: 'share_work',
      authorName,
      authorAvatar,
      authorId,
      createdAt: new Date().toISOString(),
      title: title.trim(),
      body: body.trim(),
      description: body.trim(),
      videoUrl: isVideo ? attachedFileBase64 : undefined,
      imageUrl: isImage ? attachedFileBase64 : undefined,
    }, attachedFile);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 2rem)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E1D8] shrink-0">
          <h2 className="font-black text-[#1F1F1F] text-base">📷 Share Your Work</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F8EFF3] flex items-center justify-center text-[#6E6A65] hover:bg-[#E7E1D8]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {PROMPTS.map(p => (
                <button key={p} type="button" onClick={() => setBody(prev => prev ? prev : p + '... ')}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F8EFF3] text-[#A8678A] hover:bg-[#E7E1D8]">{p}</button>
              ))}
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">Title (optional)</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Dot & Key Campaign Result"
                className="w-full px-4 py-2.5 bg-[#F6F2E8] border border-transparent rounded-xl text-sm text-[#1F1F1F] placeholder-[#9E9A97] focus:outline-none focus:bg-white focus:border-[#A8678A] focus:ring-2 focus:ring-[#A8678A]/20" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">What did you achieve? *</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} required maxLength={800}
                placeholder="Completed a campaign with Dot & Key and achieved 120K views..."
                className="w-full px-4 py-2.5 bg-[#F6F2E8] border border-transparent rounded-xl text-sm text-[#1F1F1F] placeholder-[#9E9A97] focus:outline-none focus:bg-white focus:border-[#A8678A] focus:ring-2 focus:ring-[#A8678A]/20 resize-none" />
              <p className="text-[10px] text-[#9E9A97] text-right mt-1">{body.length}/800</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">Attach Media (Reel or Image)</label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="video/*,image/*"
                className="hidden"
              />
              {attachedFileBase64 ? (
                <div className="relative border border-[#E7E1D8] rounded-xl p-3 bg-[#F8EFF3] flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl">{attachedFile?.type.startsWith('video/') ? '🎬' : '📷'}</span>
                    <span className="text-xs font-semibold text-[#1F1F1F] truncate max-w-[200px]">{attachedFile?.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setAttachedFile(null); setAttachedFileBase64(''); }}
                    className="text-xs text-[#A8678A] hover:underline font-bold"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#F8EFF3] border border-[#E7E1D8] text-[#A8678A] hover:opacity-90 rounded-xl text-xs font-bold transition-opacity cursor-pointer"
                >
                  <span>📎</span>
                  <span>Select Reel or Image</span>
                </button>
              )}
              {errorMessage && (
                <p className="text-red-500 text-xs font-bold mt-1.5">{errorMessage}</p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E7E1D8] bg-[#F6F2E8] shrink-0 rounded-b-3xl">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#6E6A65] hover:bg-[#E7E1D8]">Cancel</button>
            <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-black bg-[#1F1F1F] text-white hover:opacity-90">📷 Share</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── NEW: Creator Post Card ────────────────────────────────────────────────────
function CreatorPostCard({ post, onApply }: { post: CreatorPost; onApply?: (post: CreatorPost) => void }) {
  const kindLabel: Record<CreatorPostKind, string> = { hiring: 'Hiring', share_work: 'Work Update' };
  const kindIcon: Record<CreatorPostKind, string> = { hiring: '🎬', share_work: '📷' };

  return (
    <article className="bg-white border border-[#E7E1D8] rounded-[20px] p-5 shadow-card hover:shadow-soft hover:-translate-y-0.5 transition-all duration-200">
      {/* Author header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#1F1F1F] text-white flex items-center justify-center text-sm font-black shrink-0">
          {post.authorName[0]?.toUpperCase() ?? 'C'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-[#1F1F1F]">{post.authorName}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F8EFF3] text-[#A8678A]">
              {kindIcon[post.kind]} {kindLabel[post.kind]}
            </span>
          </div>
          <p className="text-[11px] text-[#6E6A65] mt-0.5">{relTime(post.createdAt)}</p>
        </div>
      </div>

      {/* HIRING layout */}
      {post.kind === 'hiring' && (
        <div>
          <h3 className="text-base font-bold text-[#1F1F1F] mb-2">
            {post.title ? post.title : `Need ${post.roleNeeded}`}
          </h3>
          {/* Meta row */}
          <div className="flex flex-wrap gap-3 text-xs text-[#6E6A65] mb-3">
            {post.budget && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-[#A8678A]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
                </svg>
                {post.budget}
              </span>
            )}
            {(post.location || post.isRemote) && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                {post.isRemote ? 'Remote' : post.location}
              </span>
            )}
            {post.deadline && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v7.5" />
                </svg>
                Apply by {new Date(post.deadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          {post.description && (
            <p className="text-sm text-[#6E6A65] leading-relaxed mb-4 line-clamp-3">{post.description}</p>
          )}
          <div className="border-t border-[#E7E1D8] pt-3 flex justify-end">
            <button
              onClick={() => onApply && onApply(post)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1F1F1F] text-white font-bold text-xs rounded-xl hover:opacity-90 transition-opacity">
              Apply Now →
            </button>
          </div>
        </div>
      )}

      {/* SHARE WORK layout */}
      {post.kind === 'share_work' && (
        <div>
          {post.title && <h3 className="text-base font-bold text-[#1F1F1F] mb-2">{post.title}</h3>}
          <p className="text-sm text-[#6E6A65] leading-relaxed whitespace-pre-line mb-4">{post.body}</p>
          {post.videoUrl && (
            <div className="mb-4 rounded-xl overflow-hidden max-h-[420px] bg-black flex items-center justify-center">
              <video src={post.videoUrl} controls className="max-h-[420px] w-auto object-contain" />
            </div>
          )}
          {post.imageUrl && (
            <div className="mb-4 rounded-xl overflow-hidden max-h-[420px]">
              <img src={post.imageUrl} alt={post.title || 'Work update image'} className="w-full object-cover max-h-[420px] h-auto" />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ── MAIN COMPONENT (existing logic UNCHANGED, new features ADDED) ─────────────
export default function FeedPage() {
  // ── EXISTING state (unchanged) ──────────────────────────────────────────────
  const { posts: rawPosts, loadFeed } = useFeedStore();
  const { currentUser } = useAuthStore();
  const { creator, loadCreator } = useCreatorStore();
  const { brand, loadBrand } = useBrandStore();

  const posts = rawPosts
    .filter((p) => p.type === 'campaign')
    .map((p) => {
      if (p.id === 'post-7') {
        return {
          ...p,
          // Make it 1 hour ago so it's newer than Aarav Mehta's post (2 hours ago)
          publishedAt: new Date(Date.now() - 3600000).toISOString(),
        };
      }
      return p;
    });

  const [applyingPost, setApplyingPost] = useState<FeedPost | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [, setBrandRefresh] = useState(0);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('feed-campaigns')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => {
        void loadFeed();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [loadFeed]);

  useEffect(() => {
    const campaignBrandIds = rawPosts
      .filter((post) => post.type === 'campaign')
      .map((post) => post.authorId);
    if (!campaignBrandIds.length) return;

    getBrandsByIds(campaignBrandIds)
      .then(() => setBrandRefresh((value) => value + 1))
      .catch((error) => console.warn('Failed to load campaign brand profiles:', error));
  }, [rawPosts]);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'creator') loadCreator(currentUser.id);
      else loadBrand(currentUser.id);
    }
  }, [currentUser, loadCreator, loadBrand]);

  const handleApply = (post: FeedPost) => {
    if (!currentUser) return;
    if (currentUser.role !== 'creator') {
      alert('Only content creators can apply for campaigns.');
      return;
    }
    setApplyingPost(post);
  };

  const [applyingCreatorPost, setApplyingCreatorPost] = useState<CreatorPost | null>(null);

  const handleApplyCreatorPost = (post: CreatorPost) => {
    if (!currentUser) return;
    if (currentUser.role !== 'creator') {
      alert('Only content creators can apply for collaborations.');
      return;
    }
    setApplyingCreatorPost(post);
  };

  const handleSuccessCreatorPost = () => {
    setApplyingCreatorPost(null);
    setSuccessMessage('Application submitted! 🎉');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleSuccess = () => {
    setApplyingPost(null);
    setSuccessMessage('Application submitted! 🎉');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const store = getStore();
  const recCreators = Array.from(store.creators.values()).filter((c) => c.id !== currentUser?.id).slice(0, 3);
  const recBrands = Array.from(store.brands.values()).filter((b) => b.id !== currentUser?.id).slice(0, 3);

  const verificationStatus = currentUser?.role === 'creator' ? creator?.verificationStatus : brand?.verificationStatus;
  const isVerified = verificationStatus === 'verified';
  const isPending = verificationStatus === 'pending';

  const [creatorPosts, setCreatorPosts] = useState<CreatorPost[]>(() => {
    const stored = localStorage.getItem('createlink-creator-posts');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse creator posts:', e);
      }
    }
    return [
      {
        id: "cp-default-1",
        kind: "hiring",
        authorName: "Aarav Mehta",
        authorAvatar: "",
        authorId: "creator-3",
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        roleNeeded: "Video Editor",
        budget: "₹12,000 – ₹18,000 / month",
        location: "Mumbai",
        isRemote: true,
        deadline: "2026-07-15",
        title: "🎬 Pacing is Everything! Hiring a Video Editor 🚀",
        description: "🔥 COLLAB OPPORTUNITY: Looking for a creative editing wizard! 🔥\n\nI need a Video Editor who knows how to keep viewers hooked with snappy transitions, clean sound design, and slick motion graphics. If you're passionate about storytelling and want to co-create viral-ready content, let's team up! 🎬✨"
      }
    ];
  });
  const [modal, setModal] = useState<'hiring' | 'share_work' | null>(null);
  const [sortBy, setSortBy] = useState<'top' | 'recent'>('top');
  const [postTypeFilter, setPostTypeFilter] = useState<'all' | 'creator' | 'brand'>('all');

  const authorName = currentUser?.role === 'creator' ? (creator?.displayName ?? 'Creator') : (brand?.companyName ?? 'Brand');
  const authorAvatar = '';
  const authorId = currentUser?.id ?? '';

  const handlePublishCreatorPost = async (p: CreatorPost, rawFile?: File | null) => {
    if (p.kind === 'share_work') {
      const creatorId = creator?.id || (currentUser ? `creator-${currentUser.id}` : 'creator-1');
      setIsUploading(true);
      try {
        let finalVideoUrl = p.videoUrl || '';
        let finalImageUrl = p.imageUrl || '';

        // 1. If there's a raw file, upload it to Supabase Storage
        if (rawFile) {
          try {
            const uploadedUrl = await uploadReelFile(creatorId, rawFile);
            if (rawFile.type.startsWith('video/')) {
              finalVideoUrl = uploadedUrl;
            } else if (rawFile.type.startsWith('image/')) {
              finalImageUrl = uploadedUrl;
            }
          } catch (uploadErr) {
            console.error('File upload to Supabase failed:', uploadErr);
          }
        }

        // 2. Save metadata to Supabase DB
        const saved = await saveReel(creatorId, {
          title: p.title || 'Work Collaboration',
          description: p.body || p.description || '',
          category: creator?.contentCategories?.[0] || 'lifestyle',
          thumbnailUrl: finalImageUrl,
          videoUrl: finalVideoUrl,
          metrics: {
            views: Math.floor(Math.random() * 8000) + 1200,
            likes: Math.floor(Math.random() * 800) + 120,
            comments: Math.floor(Math.random() * 80) + 12,
            engagementRate: 0.07 + Math.random() * 0.05,
          },
          campaignId: null,
        });

        // 3. Prepend to creatorPosts feed list
        const updatedPost = {
          ...p,
          videoUrl: finalVideoUrl,
          imageUrl: finalImageUrl,
        };
        const updatedPosts = [updatedPost, ...creatorPosts];
        setCreatorPosts(updatedPosts);
        localStorage.setItem('createlink-creator-posts', JSON.stringify(updatedPosts));

        setModal(null);
        setSuccessMessage('Work successfully added to your profile! 🎉');
        setTimeout(() => setSuccessMessage(''), 4000);
      } catch (err: any) {
        console.error('Failed to publish work update:', err);
        alert('Failed to publish work update.');
      } finally {
        setIsUploading(false);
      }
    } else {
      const updatedPosts = [p, ...creatorPosts];
      setCreatorPosts(updatedPosts);
      localStorage.setItem('createlink-creator-posts', JSON.stringify(updatedPosts));
      setModal(null);
      setSuccessMessage('Post published! 🎉');
      setTimeout(() => setSuccessMessage(''), 4000);
    }
  };

  // ── Interleaved/Sorted feed (campaign posts + creator posts) ────────────────
  const filteredCampaigns = postTypeFilter === 'creator'
    ? posts.filter(p => p.authorRole === 'creator')
    : (postTypeFilter === 'brand'
      ? posts.filter(p => p.authorRole === 'brand')
      : posts);
  const filteredCreators = postTypeFilter === 'brand' ? [] : creatorPosts;
  const mergedList: Array<{ type: 'campaign'; post: FeedPost } | { type: 'creator'; post: CreatorPost }> = [];

  if (sortBy === 'top') {
    // Default Top: interleave creator posts between every 2 campaign cards
    let ci = 0;
    filteredCampaigns.forEach((p, i) => {
      mergedList.push({ type: 'campaign', post: p });
      if ((i + 1) % 2 === 0 && ci < filteredCreators.length) {
        mergedList.push({ type: 'creator', post: filteredCreators[ci++] });
      }
    });
    // append remaining creator posts after all campaigns
    while (ci < filteredCreators.length) {
      mergedList.push({ type: 'creator', post: filteredCreators[ci++] });
    }
    // If there are no campaigns, push all remaining creator posts
    if (filteredCampaigns.length === 0) {
      filteredCreators.forEach(p => {
        mergedList.push({ type: 'creator', post: p });
      });
    }
  } else {
    // Recent: sort all posts purely by date
    const combined = [
      ...filteredCampaigns.map(p => ({ type: 'campaign' as const, post: p })),
      ...filteredCreators.map(p => ({ type: 'creator' as const, post: p }))
    ];
    combined.sort((a, b) => {
      const timeA = new Date(a.type === 'campaign' ? a.post.publishedAt : a.post.createdAt).getTime();
      const timeB = new Date(b.type === 'campaign' ? b.post.publishedAt : b.post.createdAt).getTime();
      return timeB - timeA;
    });
    mergedList.push(...combined);
  }

  return (
    <div className="relative">
      {/* Existing success toast (unchanged) */}
      {successMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F1F1F] text-white font-bold px-6 py-3.5 rounded-2xl shadow-card flex items-center gap-2.5 animate-bounce">
          <span>🎉</span>
          {successMessage}
        </div>
      )}

      {/* New modals (portalled above everything) */}
      {modal === 'hiring' && (
        <HiringModal authorName={authorName} authorAvatar={authorAvatar} authorId={authorId}
          onPublish={handlePublishCreatorPost} onClose={() => setModal(null)} />
      )}
      {modal === 'share_work' && (
        <ShareWorkModal authorName={authorName} authorAvatar={authorAvatar} authorId={authorId}
          onPublish={handlePublishCreatorPost} onClose={() => setModal(null)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── CENTER: Feed ── */}
        <div className="lg:col-span-9 space-y-4">

          {/* ── NEW: LinkedIn-style Post Composer ── */}
          <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-4 shadow-card space-y-3">
            {/* Top row: avatar + "Start a post..." */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1F1F1F] text-white flex items-center justify-center text-sm font-black shrink-0">
                {currentUser?.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <button
                onClick={() => setModal('share_work')}
                className="flex-1 bg-[#F8EFF3] hover:bg-[#E7E1D8] border border-[#E7E1D8] px-4 py-2.5 rounded-2xl text-[#9E9A97] text-left text-sm font-medium transition-colors cursor-pointer"
              >
                Start a post...
              </button>
            </div>
            {/* Action buttons row */}
            <div className="flex items-center gap-1 border-t border-[#F0EBE3] pt-2">
              <button onClick={() => setModal('hiring')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#6E6A65] hover:bg-[#F8EFF3] hover:text-[#A8678A] transition-colors flex-1 justify-center">
                🎬 <span>Hiring</span>
              </button>
              <div className="w-px h-5 bg-[#E7E1D8]" />
              <button onClick={() => setModal('share_work')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#6E6A65] hover:bg-[#F8EFF3] hover:text-[#A8678A] transition-colors flex-1 justify-center">
                📷 <span>Share Work</span>
              </button>
            </div>
          </div>

          {/* ── LinkedIn-style Sort & Filter ── */}
          <div className="flex items-center gap-2 py-2">
            <hr className="flex-grow border-t border-[#E7E1D8]" />
            <div className="flex items-center gap-4 text-xs text-[#6E6A65] shrink-0">
              {/* Show Filter */}
              <div className="flex items-center gap-1">
                <span>Show:</span>
                <div className="relative inline-flex items-center">
                  <select
                    value={postTypeFilter}
                    onChange={(e) => setPostTypeFilter(e.target.value as 'all' | 'creator' | 'brand')}
                    className="appearance-none bg-transparent font-bold text-[#1F1F1F] pr-4 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Posts</option>
                    <option value="creator">Creator Posts</option>
                    <option value="brand">Brand Posts</option>
                  </select>
                  <span className="pointer-events-none absolute right-0 text-[#1F1F1F] text-[10px]">▾</span>
                </div>
              </div>

              <div className="w-px h-3 bg-[#E7E1D8]" />

              {/* Sort by */}
              <div className="flex items-center gap-1">
                <span>Sort by:</span>
                <div className="relative inline-flex items-center">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'top' | 'recent')}
                    className="appearance-none bg-transparent font-bold text-[#1F1F1F] pr-4 focus:outline-none cursor-pointer"
                  >
                    <option value="top">Top</option>
                    <option value="recent">Recent</option>
                  </select>
                  <span className="pointer-events-none absolute right-0 text-[#1F1F1F] text-[10px]">▾</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── MERGED FEED LIST ── */}
          {mergedList.length === 0 ? (
            <div className="text-center py-16 bg-white border border-[#E7E1D8] rounded-[20px] shadow-card flex flex-col items-center">
              <div className="text-5xl mb-4">🔍</div>
              <p className="text-[#6E6A65] text-sm font-medium">
                No posts available.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {mergedList.map((item) =>
                item.type === 'campaign' ? (
                  /* ── EXISTING campaign card (completely unchanged) ── */
                  <FeedCard
                    key={item.post.id}
                    post={item.post}
                    onApply={handleApply}
                    onContact={(p) => alert(`Contacting author of: ${p.title}`)}
                  />
                ) : (
                  /* ── NEW creator post card ── */
                  <CreatorPostCard key={item.post.id} post={item.post} onApply={handleApplyCreatorPost} />
                )
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Widgets (completely unchanged) ── */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {!isVerified && (
            <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-4 shadow-card shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">⚡</span>
                <h4 className="font-bold text-[#1F1F1F] text-sm">{isPending ? 'Verification Pending' : 'Get Verified'}</h4>
              </div>
              <p className="text-[#6E6A65] text-xs leading-relaxed mb-3">
                {isPending ? 'Your verification is under review. Connecting more socials speeds this up.' : 'Boost your Trust Score and unlock premium collaborations by verifying your profile.'}
              </p>
              <Link to={currentUser?.role === 'creator' ? '/creator/me/verification' : '/brand/me/verification'}
                className="block text-center w-full px-3 py-2 bg-[#1F1F1F] text-white font-bold text-xs rounded-2xl hover:opacity-90">
                {isPending ? 'Check Status →' : 'Start Verification →'}
              </Link>
            </div>
          )}

          <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-6 shadow-card flex-1 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-[#1F1F1F] text-sm flex items-center gap-2">
                <span>{currentUser?.role === 'creator' ? '🏷️' : '🌟'}</span>
                {currentUser?.role === 'creator' ? 'Recommended Brands' : 'Recommended Creators'}
              </h4>
              <div className="text-xs text-[#6E6A65]">{(currentUser?.role === 'creator' ? recBrands.length : recCreators.length)} suggestions</div>
            </div>
            <div className="space-y-4">
              {currentUser?.role === 'creator' ? (
                recBrands.map((b) => (
                  <div key={b.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#F8EFF3] transition-colors">
                    <img src={b.logoUrl} alt={b.companyName} className="w-12 h-12 rounded-xl border border-[#E7E1D8] bg-[#F8EFF3] shrink-0 object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link to={`/brand/${b.id}`} className="text-sm font-bold text-[#1F1F1F] hover:text-[#A8678A] truncate">{b.companyName}</Link>
                        <div className="text-[12px] text-[#6E6A65] font-bold">{b.brandScore ?? '—'}</div>
                      </div>
                      <div className="text-[12px] text-[#6E6A65] mt-1">{b.industry}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#6E6A65]">
                        <span className="px-2 py-1 bg-white/50 border border-[#E7E1D8] rounded-full">{b.completedCollaborations ?? 0} collabs</span>
                        <span className={`px-2 py-1 rounded-full ${b.verificationStatus === 'verified' ? 'bg-[#F8EFF3] text-[#A8678A]' : ''}`}>{b.verificationStatus}</span>
                      </div>
                    </div>
                    <button className="text-[11px] font-bold text-[#A8678A] border border-[#A8678A] rounded-xl px-3 py-1 hover:bg-[#F8EFF3] shrink-0">Follow</button>
                  </div>
                ))
              ) : (
                recCreators.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#F8EFF3] transition-colors">
                    <img src={c.avatarUrl} alt={c.displayName} className="w-12 h-12 rounded-full border border-[#E7E1D8] bg-[#F8EFF3] shrink-0 object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link to={`/creator/${c.id}`} className="text-sm font-bold text-[#1F1F1F] hover:text-[#A8678A] truncate">{c.displayName}</Link>
                        <div className="text-[12px] text-[#6E6A65] font-bold">{c.trustScore ?? '—'}</div>
                      </div>
                      <div className="text-[12px] text-[#6E6A65] mt-1">{c.contentCategories?.[0] ?? 'General'}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#6E6A65]">
                        <span className="px-2 py-1 bg-white/50 border border-[#E7E1D8] rounded-full">{c.portfolio?.length ?? 0} portfolio</span>
                        <span className="px-2 py-1 bg-white/50 border border-[#E7E1D8] rounded-full">{c.collaborationHistory?.length ?? 0} collabs</span>
                        <span className={`px-2 py-1 rounded-full ${c.verificationStatus === 'verified' ? 'bg-[#F8EFF3] text-[#A8678A]' : ''}`}>{c.verificationStatus}</span>
                      </div>
                    </div>
                    <button className="text-[11px] font-bold text-[#A8678A] border border-[#A8678A] rounded-xl px-3 py-1 hover:bg-[#F8EFF3] shrink-0">Connect</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── EXISTING application modal (completely unchanged) ── */}
      {applyingPost && creator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F1F1F]/60 backdrop-blur-sm">
          <div className="max-w-xl w-full bg-white border border-[#E7E1D8] rounded-[20px] p-6 sm:p-8 shadow-card relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setApplyingPost(null)}
              className="absolute top-4 right-4 text-[#6E6A65] hover:text-[#1F1F1F] bg-[#F8EFF3] rounded-xl p-1.5 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
            <ApplicationForm
              creator={creator}
              campaign={{ id: applyingPost.campaignId || '', title: applyingPost.title } as unknown as Campaign}
              onClose={() => setApplyingPost(null)}
              onSuccess={handleSuccess}
            />
          </div>
        </div>
      )}

      {/* ── NEW creator application modal ── */}
      {applyingCreatorPost && creator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F1F1F]/60 backdrop-blur-sm">
          <div className="max-w-2xl w-full bg-white border border-[#E7E1D8] rounded-[20px] p-6 sm:p-8 shadow-card relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setApplyingCreatorPost(null)}
              className="absolute top-4 right-4 text-[#6E6A65] hover:text-[#1F1F1F] bg-[#F8EFF3] rounded-xl p-1.5 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
            <CreatorApplicationForm
              creator={creator}
              post={applyingCreatorPost}
              onClose={() => setApplyingCreatorPost(null)}
              onSuccess={handleSuccessCreatorPost}
            />
          </div>
        </div>
      )}

      {/* ── UPLOADING SPINNER OVERLAY ── */}
      {isUploading && (
        <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-[#A8678A] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white font-bold text-sm">Uploading and publishing your work...</p>
        </div>
      )}
    </div>
  );
}
