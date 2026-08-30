import React, { useState, useEffect } from 'react';
import type { Creator, PortfolioItem } from '../../types/index';
import { generateCampaignPitch } from '../../services/geminiService';
import AIPitchPanel from './AIPitchPanel';
import { fetchReels } from '../../services/reelsService';

interface CreatorPost {
  id: string;
  kind: 'hiring' | 'share_work';
  authorName: string;
  authorAvatar: string;
  authorId: string;
  createdAt: string;
  roleNeeded?: string;
  budget?: string;
  location?: string;
  isRemote?: boolean;
  deadline?: string;
  description: string;
  title?: string;
  body?: string;
  videoUrl?: string;
  imageUrl?: string;
  category?: string;
}

interface CreatorApplicationFormProps {
  creator: Creator;
  post: CreatorPost;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatorApplicationForm({ creator, post, onClose, onSuccess }: CreatorApplicationFormProps) {
  const [step, setStep] = useState<'options' | 'ai_setup' | 'ai_loading' | 'ai_result' | 'previous'>('options');
  
  // Load reels from localStorage/sessionStorage if available, otherwise fallback to creator.portfolio
  const getReelsSource = (): PortfolioItem[] => {
    const stored = localStorage.getItem(`reels-${creator.id}`) || sessionStorage.getItem('allReels');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as any[];
        return parsed.map(r => ({
          id: r.id,
          creatorId: r.creatorId || creator.id,
          title: r.title,
          description: r.description,
          category: r.category,
          mediaUrl: r.thumbnailUrl || r.mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
          fileSizeBytes: 0,
          campaignId: r.campaignId || null,
          metrics: {
            views: r.metrics?.views ?? 0,
            likes: r.metrics?.likes ?? 0,
            comments: r.metrics?.comments ?? 0,
            shares: r.metrics?.shares ?? 0,
            engagementRate: r.metrics?.engagementRate ?? 0,
          },
          createdAt: r.createdAt
        }));
      } catch (e) {
        console.error("Failed to parse allReels source:", e);
      }
    }

    if (creator.id === 'creator-1') {
      const hardcodedReel: PortfolioItem = {
        id: 'hardcoded-dotandkey-reel',
        creatorId: creator.id,
        title: 'Dot and Key Collaboration',
        description: 'A fun and authentic collaboration with Dot & Key Skincare — showcasing their sunscreen range with a real daily-use review. Achieved over 120K organic views and 9.7% engagement rate.',
        category: 'beauty',
        mediaUrl: '',
        fileSizeBytes: 0,
        campaignId: 'camp-1',
        metrics: { views: 120000, likes: 9800, comments: 1200, shares: 0, engagementRate: 0.097 },
        createdAt: '2024-03-15T10:00:00Z',
      };
      const portfolioItems: PortfolioItem[] = creator.portfolio.map(item => ({
        ...item,
        creatorId: creator.id
      }));
      const deduped = portfolioItems.filter(r => r.id !== hardcodedReel.id);
      return [hardcodedReel, ...deduped];
    }
    return creator.portfolio.map(item => ({
      ...item,
      creatorId: creator.id
    }));
  };

  const [portfolioList, setPortfolioList] = useState<PortfolioItem[]>(() => getReelsSource());

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const fetchedReels = await fetchReels(creator.id);
        if (!active) return;
        const mapped = fetchedReels.map(r => ({
          id: r.id,
          creatorId: creator.id,
          title: r.title,
          description: r.description,
          category: r.category as any,
          mediaUrl: r.thumbnailUrl || r.videoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
          fileSizeBytes: 0,
          campaignId: r.campaignId,
          metrics: {
            views: r.metrics?.views ?? 0,
            likes: r.metrics?.likes ?? 0,
            comments: r.metrics?.comments ?? 0,
            shares: 0,
            engagementRate: r.metrics?.engagementRate ?? 0,
          },
          createdAt: r.createdAt
        }));
        setPortfolioList(mapped);
      } catch (e) {
        console.error("Failed to fetch reels in CreatorApplicationForm:", e);
      }
    }
    load();
    return () => { active = false; };
  }, [creator.id]);

  // State for AI flow
  const [reelSource, setReelSource] = useState<'pinned' | 'top' | 'all' | 'niche'>('pinned');
  const [aiPitch, setAiPitch] = useState('');
  const [aiSelectedItems, setAiSelectedItems] = useState<string[]>([]);
  
  // State for manual previous portfolio flow
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [manualPitch, setManualPitch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-select reels for AI based on selected method
  useEffect(() => {
    if (step === 'ai_loading') {
      const generateAIPitch = async () => {
        try {
          // Select reels based on criteria
          let selected: PortfolioItem[] = [];
          if (reelSource === 'pinned') {
            let pinnedList: any[] = [];
            const pinnedStored = sessionStorage.getItem('pinnedReels');
            if (pinnedStored) {
              try { pinnedList = JSON.parse(pinnedStored); } catch {}
            } else {
              const lsPinned = localStorage.getItem(`pinned-${creator.id}`);
              const lsReels = localStorage.getItem(`reels-${creator.id}`);
              if (lsPinned && lsReels) {
                try {
                  const parsedIds = JSON.parse(lsPinned) as string[];
                  const parsedReels = JSON.parse(lsReels) as any[];
                  pinnedList = parsedReels.filter(r => parsedIds.includes(r.id));
                } catch {}
              }
            }

            if (pinnedList && pinnedList.length > 0) {
              selected = pinnedList.map(r => ({
                id: r.id,
                creatorId: r.creatorId || creator.id,
                title: r.title,
                description: r.description,
                category: r.category,
                mediaUrl: r.thumbnailUrl || r.mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
                fileSizeBytes: 0,
                campaignId: r.campaignId || null,
                metrics: {
                  views: r.metrics?.views ?? 0,
                  likes: r.metrics?.likes ?? 0,
                  comments: r.metrics?.comments ?? 0,
                  shares: r.metrics?.shares ?? 0,
                  engagementRate: r.metrics?.engagementRate ?? 0,
                },
                createdAt: r.createdAt
              }));
            } else {
              selected = portfolioList.slice(0, 3);
            }
          } else if (reelSource === 'top') {
            selected = [...portfolioList]
              .sort((a, b) => (b.metrics?.views ?? 0) - (a.metrics?.views ?? 0))
              .slice(0, 3);
          } else if (reelSource === 'niche') {
            selected = portfolioList
              .filter(item => item.category === post.category)
              .slice(0, 3);
            if (selected.length === 0) {
              selected = portfolioList.slice(0, 3);
            }
          } else {
            selected = portfolioList.slice(0, 3);
          }
          
          setAiSelectedItems(selected.map(item => item.id));

          // Generate cover pitch via Gemini API
          const mockCampaign = {
            title: post.title || `Hiring: ${post.roleNeeded}`,
            description: post.description,
            category: post.category || 'general'
          };
          const pitchText = await generateCampaignPitch(creator, mockCampaign);
          setAiPitch(pitchText);
          setStep('ai_result');
        } catch (err) {
          console.error("AI Generation Error:", err);
          setAiPitch(`Hi ${post.authorName}, I saw your post for a ${post.roleNeeded || 'Video Editor'} and would love to collaborate! I specialize in high-quality video content and believe my style matches what you're looking for.`);
          setStep('ai_result');
        }
      };

      generateAIPitch();
    }
  }, [step, reelSource, creator, post, portfolioList]);

  const handleTogglePortfolioItem = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter((id) => id !== itemId));
    } else {
      if (selectedItems.length >= 3) return;
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  const handleToggleAiPortfolioItem = (itemId: string) => {
    if (aiSelectedItems.includes(itemId)) {
      setAiSelectedItems(aiSelectedItems.filter((id) => id !== itemId));
    } else {
      if (aiSelectedItems.length >= 3) return;
      setAiSelectedItems([...aiSelectedItems, itemId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate API request delay
    setTimeout(() => {
      setSubmitting(false);
      onSuccess();
    }, 1200);
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* ── STEP 1: OPTIONS SELECTION ── */}
      {step === 'options' && (
        <div className="space-y-6 text-center">
          <div>
            <h3 className="text-xl font-bold text-[#1F1F1F]">
              Apply for {post.authorName}'s Request
            </h3>
            <p className="text-[#6E6A65] text-xs mt-1">
              Choose how you would like to construct your application.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Option A: Create with AI */}
            <button
              type="button"
              onClick={() => setStep('ai_setup')}
              className="flex flex-col items-center text-center p-6 bg-white border-2 border-[#E7E1D8] hover:border-[#A8678A] rounded-[20px] shadow-sm hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#F8EFF3] text-[#A8678A] flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                ✨
              </div>
              <h4 className="font-bold text-sm text-[#1F1F1F] mb-1">Create with AI</h4>
              <p className="text-xs text-[#6E6A65] leading-relaxed">
                Use Gemini AI to write a custom pitch and analyze/select your best reels.
              </p>
            </button>

            {/* Option B: Use Previous Portfolios */}
            <button
              type="button"
              onClick={() => setStep('previous')}
              className="flex flex-col items-center text-center p-6 bg-white border-2 border-[#E7E1D8] hover:border-[#A8678A] rounded-[20px] shadow-sm hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#F6F2E8] text-[#6E6A65] flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                💼
              </div>
              <h4 className="font-bold text-sm text-[#1F1F1F] mb-1">Use Previous Portfolios</h4>
              <p className="text-xs text-[#6E6A65] leading-relaxed">
                Manually pick items from your existing portfolio and write a personalized pitch.
              </p>
            </button>
          </div>

          <div className="flex justify-end border-t border-[#E7E1D8] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-[#A8678A] text-[#A8678A] hover:bg-[#F8EFF3] font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: MANUAL PREVIOUS PORTFOLIO FLOW ── */}
      {step === 'previous' && (
        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          <div>
            <h3 className="text-xl font-bold text-[#1F1F1F]">
              Apply with Previous Portfolio
            </h3>
            <p className="text-[#6E6A65] text-xs mt-1">
              Select up to 3 works to attach and compose your application message.
            </p>
          </div>

          {/* Portfolio Item Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">
              Select Portfolio Items (Max 3)
            </label>
            {portfolioList.length === 0 ? (
              <div className="text-[#6E6A65] text-xs border border-dashed border-[#E7E1D8] rounded-xl p-4 text-center">
                No portfolio items found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 max-h-[200px] overflow-y-auto pr-2">
                {portfolioList.map((item) => {
                  const selected = selectedItems.includes(item.id);
                  const disabled = !selected && selectedItems.length >= 3;
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer transition-all duration-200 ${
                        selected
                          ? 'border-[#A8678A] bg-[#F8EFF3]'
                          : 'border-[#E7E1D8] hover:border-[#A8678A] bg-white'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={disabled}
                        onChange={() => handleTogglePortfolioItem(item.id)}
                        className="w-4 h-4 rounded border-[#E7E1D8] bg-white text-[#A8678A] focus:ring-[#A8678A]"
                      />
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-semibold text-[#1F1F1F] truncate">{item.title}</p>
                        <p className="text-xs text-[#6E6A65] capitalize">
                          {item.category} &bull; {(item.metrics?.engagementRate * 100).toFixed(1)}% Engagement
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pitch Area */}
          <div className="space-y-2">
            <label htmlFor="manual-pitch" className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">
              Pitch Message
            </label>
            <textarea
              id="manual-pitch"
              value={manualPitch}
              onChange={(e) => setManualPitch(e.target.value)}
              rows={4}
              required
              placeholder="Hi, I'm interested in this collaboration because..."
              className="w-full p-3 border border-[#E7E1D8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A] bg-white"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-between items-center border-t border-[#E7E1D8] pt-4">
            <button
              type="button"
              onClick={() => setStep('options')}
              className="px-5 py-2.5 rounded-xl border border-[#E7E1D8] text-[#6E6A65] hover:bg-slate-50 font-semibold text-xs"
            >
              Back
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-[#A8678A] text-[#A8678A] hover:bg-[#F8EFF3] font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-[#1F1F1F] text-white font-bold text-xs rounded-xl shadow-soft hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── STEP 3: AI SETUP (REEL SOURCE SELECTION WIZARD) ── */}
      {step === 'ai_setup' && (
        <div className="space-y-6 text-left">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-xs text-[#9E9A97] font-semibold px-2">
            <div className="flex items-center gap-1.5 text-[#1F1F1F]">
              <span className="w-5 h-5 rounded-full bg-[#1F1F1F] text-white flex items-center justify-center text-[10px]">1</span>
              <span>Select Source</span>
            </div>
            <div className="flex-1 h-px bg-[#E7E1D8] mx-2" />
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#E7E1D8] text-[#6E6A65] flex items-center justify-center text-[10px]">2</span>
              <span>AI Analysis</span>
            </div>
            <div className="flex-1 h-px bg-[#E7E1D8] mx-2" />
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#E7E1D8] text-[#6E6A65] flex items-center justify-center text-[10px]">3</span>
              <span>Portfolio Preview</span>
            </div>
            <div className="flex-1 h-px bg-[#E7E1D8] mx-2" />
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#E7E1D8] text-[#6E6A65] flex items-center justify-center text-[10px]">4</span>
              <span>Publish</span>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#1F1F1F]">Choose reel source</h3>
          </div>

          {/* Yellow Warning/Alert box */}
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex gap-3 text-xs text-amber-800">
            <span className="text-base shrink-0">💡</span>
            <p className="leading-relaxed">
              No pinned reels found. Pin your best reels on your profile first, or AI will auto-select top performers.
            </p>
          </div>

          {/* Reel Source Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* option 1 */}
            <button
              type="button"
              onClick={() => setReelSource('pinned')}
              className={`p-4 border-2 rounded-xl text-left transition-all ${
                reelSource === 'pinned' ? 'border-[#A8678A] bg-[#F8EFF3]' : 'border-[#E7E1D8] bg-white hover:border-[#A8678A]'
              }`}
            >
              <div className="flex gap-3 items-start">
                <span className="text-lg">📌</span>
                <div>
                  <h4 className="font-bold text-xs text-[#1F1F1F]">Use Pinned Reels</h4>
                  <p className="text-[10px] text-[#6E6A65] mt-1">Prioritize your hand-picked best work</p>
                </div>
              </div>
            </button>

            {/* option 2 */}
            <button
              type="button"
              onClick={() => setReelSource('top')}
              className={`p-4 border-2 rounded-xl text-left transition-all ${
                reelSource === 'top' ? 'border-[#A8678A] bg-[#F8EFF3]' : 'border-[#E7E1D8] bg-white hover:border-[#A8678A]'
              }`}
            >
              <div className="flex gap-3 items-start">
                <span className="text-lg">🔥</span>
                <div>
                  <h4 className="font-bold text-xs text-[#1F1F1F]">Top Performing Reels</h4>
                  <p className="text-[10px] text-[#6E6A65] mt-1">AI selects by engagement rate & views</p>
                </div>
              </div>
            </button>

            {/* option 3 */}
            <button
              type="button"
              onClick={() => setReelSource('all')}
              className={`p-4 border-2 rounded-xl text-left transition-all ${
                reelSource === 'all' ? 'border-[#A8678A] bg-[#F8EFF3]' : 'border-[#E7E1D8] bg-white hover:border-[#A8678A]'
              }`}
            >
              <div className="flex gap-3 items-start">
                <span className="text-lg">🎬</span>
                <div>
                  <h4 className="font-bold text-xs text-[#1F1F1F]">Use All Reels</h4>
                  <p className="text-[10px] text-[#6E6A65] mt-1">Full portfolio analysis across all content</p>
                </div>
              </div>
            </button>

            {/* option 4 */}
            <button
              type="button"
              onClick={() => setReelSource('niche')}
              className={`p-4 border-2 rounded-xl text-left transition-all ${
                reelSource === 'niche' ? 'border-[#A8678A] bg-[#F8EFF3]' : 'border-[#E7E1D8] bg-white hover:border-[#A8678A]'
              }`}
            >
              <div className="flex gap-3 items-start">
                <span className="text-lg">🎯</span>
                <div>
                  <h4 className="font-bold text-xs text-[#1F1F1F]">By Niche</h4>
                  <p className="text-[10px] text-[#6E6A65] mt-1">Focus on a specific content category</p>
                </div>
              </div>
            </button>
          </div>

          {/* Reels to be analyzed */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#6E6A65]">
              {portfolioList.length} reels will be analyzed
            </p>
            <div className="flex gap-2.5 overflow-x-auto pb-2">
              {portfolioList.map(item => (
                <div key={item.id} className="relative aspect-[9/16] w-14 shrink-0 bg-slate-100 rounded-lg overflow-hidden border border-[#E7E1D8]">
                  <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/35 flex items-end p-1">
                    <span className="text-[8px] font-bold text-white truncate max-w-full capitalize">{item.category}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-between items-center border-t border-[#E7E1D8] pt-4">
            <button
              type="button"
              onClick={() => setStep('options')}
              className="px-5 py-2.5 rounded-xl border border-[#E7E1D8] text-[#6E6A65] hover:bg-slate-50 font-semibold text-xs"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep('ai_loading')}
              className="w-full sm:w-auto px-6 py-3 bg-[#1F1F1F] text-white font-bold text-xs rounded-xl shadow-soft hover:opacity-90 transition-all flex items-center justify-center gap-1.5"
            >
              ✨ Generate Portfolio with AI
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: AI LOADING PITCH ── */}
      {step === 'ai_loading' && (
        <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
          <div className="w-10 h-10 border-4 border-[#A8678A] border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-bold text-[#1F1F1F]">Analyzing portfolio and writing pitch...</p>
          <p className="text-xs text-[#6E6A65] mt-1">Calling Gemini AI to craft a personalized response</p>
        </div>
      )}

      {/* ── STEP 5: AI GENERATED PITCH RESULT ── */}
      {step === 'ai_result' && (
        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-xs text-[#9E9A97] font-semibold px-2">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">✓</span>
              <span>Select Source</span>
            </div>
            <div className="flex-1 h-px bg-[#E7E1D8] mx-2" />
            <div className="flex items-center gap-1.5 text-[#1F1F1F]">
              <span className="w-5 h-5 rounded-full bg-[#1F1F1F] text-white flex items-center justify-center text-[10px]">2</span>
              <span>AI Analysis</span>
            </div>
            <div className="flex-1 h-px bg-[#E7E1D8] mx-2" />
            <div className="flex items-center gap-1.5 text-[#1F1F1F]">
              <span className="w-5 h-5 rounded-full bg-[#1F1F1F] text-white flex items-center justify-center text-[10px]">3</span>
              <span>Portfolio Preview</span>
            </div>
            <div className="flex-1 h-px bg-[#E7E1D8] mx-2" />
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#E7E1D8] text-[#6E6A65] flex items-center justify-center text-[10px]">4</span>
              <span>Publish</span>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-[#1F1F1F]">AI Application Construction</h3>
            <p className="text-[#6E6A65] text-xs mt-1">Review the AI-generated pitch and selected works before submitting.</p>
          </div>

          {/* AI Pitch Panel */}
          <AIPitchPanel pitch={aiPitch} onChange={setAiPitch} />

          {/* Selected Reels List */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65]">
              AI Selected Works (Max 3)
            </label>
            <div className="grid grid-cols-1 gap-2.5 max-h-[180px] overflow-y-auto pr-2">
              {portfolioList.map((item) => {
                const selected = aiSelectedItems.includes(item.id);
                const disabled = !selected && aiSelectedItems.length >= 3;
                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 border rounded-xl p-3 cursor-pointer transition-all duration-200 ${
                      selected
                        ? 'border-[#A8678A] bg-[#F8EFF3]'
                        : 'border-[#E7E1D8] hover:border-[#A8678A] bg-white'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={disabled}
                      onChange={() => handleToggleAiPortfolioItem(item.id)}
                      className="w-4 h-4 rounded border-[#E7E1D8] bg-white text-[#A8678A] focus:ring-[#A8678A]"
                    />
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-semibold text-[#1F1F1F] truncate">{item.title}</p>
                      <p className="text-xs text-[#6E6A65] capitalize">
                        {item.category} &bull; {(item.metrics?.engagementRate * 100).toFixed(1)}% Engagement
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-between items-center border-t border-[#E7E1D8] pt-4">
            <button
              type="button"
              onClick={() => setStep('ai_setup')}
              className="px-5 py-2.5 rounded-xl border border-[#E7E1D8] text-[#6E6A65] hover:bg-slate-50 font-semibold text-xs"
            >
              Back
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-[#A8678A] text-[#A8678A] hover:bg-[#F8EFF3] font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-[#1F1F1F] text-white font-bold text-xs rounded-xl shadow-soft hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

export default CreatorApplicationForm;
