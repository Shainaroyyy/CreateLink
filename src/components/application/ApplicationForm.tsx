import React, { useEffect, useState } from 'react';
import type { Creator, Campaign, Application, PortfolioItem } from '../../types/index';
import * as applicationService from '../../services/applicationService';
import AIPitchPanel from './AIPitchPanel';
import { fetchReels } from '../../services/reelsService';

interface ApplicationFormProps {
  creator: Creator;
  campaign: Campaign;
  onClose: () => void;
  onSuccess: () => void;
}

export function ApplicationForm({ creator, campaign, onClose, onSuccess }: ApplicationFormProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [app, setApp] = useState<Application | null>(null);
  const [editedPitch, setEditedPitch] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [existingApp, setExistingApp] = useState<Application | null>(null);

  // Parse preferences
  const reqStr = campaign.requirements || '';
  const minTrustMatch = reqStr.match(/Min Trust Score:\s*(\d+)/i);
  const minTrust = minTrustMatch ? parseInt(minTrustMatch[1]) : 0;
  
  const minQualityMatch = reqStr.match(/Min Content Quality Score:\s*(\d+)/i);
  const minQuality = minQualityMatch ? parseInt(minQualityMatch[1]) : 0;

  const [portfolioList, setPortfolioList] = useState<PortfolioItem[]>(() => {
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
        console.error("Failed to parse allReels source in ApplicationForm:", e);
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
  });

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
        console.error("Failed to fetch reels in ApplicationForm:", e);
      }
    }
    load();
    return () => { active = false; };
  }, [creator.id]);

  useEffect(() => {
    const initApplication = async () => {
      setLoading(true);
      setError('');
      try {
        // Try creating a new application
        const newApp = await applicationService.createApplication(creator.id, campaign.id);
        setApp(newApp);
        setEditedPitch(newApp.editedPitch);
        setSelectedItems(newApp.selectedPortfolioItems);
      } catch (err) {
        const errorObject = err as { code?: string; message?: string };
        if (errorObject.code === 'duplicate') {
          // If already exists, fetch the existing application
          const existing = await applicationService.getApplicationByCreatorAndCampaign(creator.id, campaign.id);
          setExistingApp(existing);
        } else {
          setError(errorObject.message || 'Failed to initialize application.');
        }
      } finally {
        setLoading(false);
      }
    };

    initApplication();
  }, [creator.id, campaign.id]);

  const handleTogglePortfolioItem = (itemId: string) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter((id) => id !== itemId));
    } else {
      if (selectedItems.length >= 3) {
        // Limit to 3 items
        return;
      }
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    setSubmitting(true);
    setError('');
    try {
      await applicationService.updateApplication(app.id, editedPitch, selectedItems);
      onSuccess();
    } catch (err) {
      setError((err as Error).message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
        <div className="w-10 h-10 border-4 border-[#A8678A] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[#6E6A65] text-sm">Generating personalized AI Pitch...</p>
      </div>
    );
  }

  if (existingApp) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 bg-[#F8EFF3] border border-[#E7E1D8] rounded-full flex items-center justify-center text-[#A8678A] mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm11.378-3.917c-.08-.77-.75-1.333-1.528-1.333h-.025c-.778 0-1.45.563-1.528 1.333L10.176 12.35c-.04.374.085.746.34 1.02a1.378 1.378 0 0 0 1.01.43h.023c.387 0 .753-.163 1.01-.43.256-.274.38-.646.34-1.02l-.376-4.265ZM12 16.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[#1F1F1F] mb-2">Already Applied</h3>
        <p className="text-[#6E6A65] text-sm mb-6">
          You have already submitted an application for <span className="font-semibold text-[#1F1F1F]">"{campaign.title}"</span>.
        </p>
        <div className="bg-white border border-[#E7E1D8] rounded-xl p-4 mb-6 inline-block">
          <span className="text-xs text-[#6E6A65] uppercase tracking-wider block mb-1">Status</span>
          <span className="text-sm font-bold uppercase tracking-wider text-[#A8678A]">
            {existingApp.status}
          </span>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-transparent border border-[#A8678A] text-[#A8678A] hover:bg-[#F8EFF3] font-semibold transition-all duration-200 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-left">
      <div>
        <h3 className="text-xl font-bold text-[#1F1F1F]">
          Apply for {campaign.title}
        </h3>
        <p className="text-[#6E6A65] text-xs mt-1">Review your AI-generated pitch and attach work samples.</p>
      </div>

      {minTrust > 0 && (
        <div className="bg-[#F6F2E8]/60 border border-[#E7E1D8] text-[#6E6A65] p-4 rounded-xl text-xs font-semibold space-y-1">
          <p className="font-bold text-[#1F1F1F]">✨ AI Matching Preferences</p>
          <p className="text-[11px] leading-relaxed opacity-95">
            This campaign has prioritized matching enabled. Preferred scores (Trust Score: {minTrust}+, Content Quality: {minQuality}+) will optimize your ranking in the brand's inbox, but do not prevent you from applying.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-[#F8EFF3] border border-[#A8678A] text-[#A8678A] px-4 py-3 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* AI Pitch Panel */}
      <AIPitchPanel pitch={editedPitch} onChange={setEditedPitch} />

      {/* Portfolio Selector */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65] mb-3">
          Select Portfolio Examples (Max 3)
        </label>
        {portfolioList.length === 0 ? (
          <div className="text-[#6E6A65] text-xs border border-dashed border-[#E7E1D8] rounded-xl p-4 text-center">
            No portfolio items found. You can add items later in the Editor.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 max-h-[180px] overflow-y-auto pr-2">
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1F1F1F] truncate">{item.title}</p>
                    <p className="text-xs text-[#6E6A65] capitalize">{item.category} &bull; {(item.metrics.engagementRate * 100).toFixed(1)}% Engagement</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Buttons */}
      <div className="flex justify-end gap-3 border-t border-[#E7E1D8] pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-transparent border border-[#A8678A] text-[#A8678A] hover:bg-[#F8EFF3] font-semibold transition-all duration-200 text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 rounded-xl bg-[#1F1F1F] text-white font-bold hover:opacity-90 shadow-soft transition-all duration-200 text-sm disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>
    </form>
  );
}

export default ApplicationForm;
