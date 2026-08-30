import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSwipeStore } from '../stores/swipeStore';
import { getStore } from '../services/store';
import SwipeCard, { getCreatorDna } from '../components/swipe/SwipeCard';
import SwipeControls from '../components/swipe/SwipeControls';
import UndoToast from '../components/shared/UndoToast';
import type { Creator, Campaign, Application, ApplicationStatus } from '../types/index';
import * as brandService from '../services/brandService';
import { getApplicationsForCampaign, updateApplicationStatus } from '../services/applicationService';
import { fetchReels } from '../services/reelsService';
import type { Reel } from '../services/reelsService';

function ApplicantRow({
  application,
  creator,
  onOpenPreview,
  onUpdateStatus,
}: {
  application: Application;
  creator: Creator;
  onOpenPreview: () => void;
  onUpdateStatus: (appId: string, status: ApplicationStatus) => void;
}) {
  const [reels, setReels] = useState<Reel[]>([]);
  const contentQualityScore = Math.min(100, Math.round(creator.trustScore * 0.95 + 4));

  useEffect(() => {
    fetchReels(creator.id).then(setReels).catch(console.warn);
  }, [creator.id]);

  const dna = getCreatorDna(creator);

  return (
    <tr className="border-b border-[#E7E1D8] hover:bg-[#F6F2E8]/20 transition-colors">
      <td className="p-4 flex items-center gap-3">
        <img src={creator.avatarUrl} alt={creator.displayName} className="w-10 h-10 rounded-lg object-cover border border-[#E7E1D8] bg-white shrink-0" />
        <div className="min-w-0">
          <span className="font-bold text-[#1F1F1F] block text-sm truncate">{creator.displayName}</span>
          <span className="text-[10px] text-[#6E6A65] block truncate max-w-[150px]">{creator.bio}</span>
        </div>
      </td>
      <td className="p-4 text-center">
        <span className="text-xs font-bold text-[#1F1F1F] bg-[#F8EFF3] px-2 py-0.5 rounded border border-[#E7E1D8]">{creator.trustScore}</span>
      </td>
      <td className="p-4 text-center">
        <span className="text-xs font-bold text-[#A8678A] bg-[#F8EFF3] px-2 py-0.5 rounded border border-[#E7E1D8]">{contentQualityScore}</span>
      </td>
      <td className="p-4 text-xs font-semibold text-[#6E6A65] capitalize">
        {creator.contentCategories.slice(0, 2).join(', ')}
      </td>
      <td className="p-4 text-xs min-w-[120px]">
        <span className="block text-[#1F1F1F] font-bold truncate">{dna.contentStyle}</span>
        <span className="block text-[10px] text-emerald-600 font-bold">{dna.audienceTrust} Trust</span>
      </td>
      <td className="p-4">
        {reels.length > 0 ? (
          <div className="flex gap-1 overflow-x-auto max-w-[120px]">
            {reels.slice(0, 2).map(r => (
              <span key={r.id} className="px-1.5 py-0.5 rounded bg-slate-100 text-[#1F1F1F] text-[9px] font-semibold border border-slate-200 truncate shrink-0 max-w-[60px]" title={r.title}>
                🎥 {r.title}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-[#6E6A65]">No Reels</span>
        )}
      </td>
      <td className="p-4">
        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
          application.status === 'accepted' || application.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
          application.status === 'rejected' || application.status === 'declined' ? 'bg-rose-100 text-rose-800' :
          application.status === 'shortlisted' || application.status === 'waitlisted' ? 'bg-amber-100 text-amber-800' :
          'bg-slate-100 text-slate-800'
        }`}>
          {application.status}
        </span>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <button onClick={onOpenPreview} className="px-2.5 py-1 text-[11px] font-bold bg-[#F8EFF3] text-[#A8678A] rounded border border-[#E7E1D8] hover:bg-[#A8678A]/10 transition-colors shrink-0">
            Preview
          </button>
          <div className="flex items-center border border-[#E7E1D8] rounded bg-white overflow-hidden shrink-0">
            <button onClick={() => onUpdateStatus(application.id, 'rejected')} className="p-1 hover:bg-rose-50 text-rose-500 border-r border-[#E7E1D8] transition-colors" title="Pass (Reject)">
              ❌
            </button>
            <button onClick={() => onUpdateStatus(application.id, 'shortlisted')} className="p-1 hover:bg-amber-50 text-amber-500 border-r border-[#E7E1D8] transition-colors" title="Shortlist">
              ❤️
            </button>
            <button onClick={() => onUpdateStatus(application.id, 'accepted')} className="p-1 hover:bg-emerald-50 text-emerald-500 transition-colors" title="Accept (Approve)">
              ✅
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function ApplicantDetailsModal({
  application,
  creator,
  onClose,
  onUpdateStatus,
}: {
  application: Application;
  creator: Creator;
  onClose: () => void;
  onUpdateStatus: (appId: string, status: ApplicationStatus) => void;
}) {
  const [reels, setReels] = useState<Reel[]>([]);
  const contentQualityScore = Math.min(100, Math.round(creator.trustScore * 0.95 + 4));

  useEffect(() => {
    fetchReels(creator.id).then(setReels).catch(console.warn);
  }, [creator.id]);

  const dna = getCreatorDna(creator);

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E7E1D8] rounded-[24px] shadow-card w-full max-w-2xl p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto space-y-6 text-left">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#6E6A65] hover:text-[#1F1F1F] text-xl font-bold p-1">
          ✕
        </button>

        <div className="flex items-center gap-4 border-b border-[#E7E1D8] pb-4">
          <img src={creator.avatarUrl} alt={creator.displayName} className="w-16 h-16 rounded-xl object-cover border border-[#E7E1D8] bg-white" />
          <div>
            <h3 className="text-xl font-black text-[#1F1F1F]">{creator.displayName}</h3>
            <p className="text-xs text-[#6E6A65] mt-1">{creator.bio}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-[#F8EFF3] rounded-xl border border-[#E7E1D8]">
            <span className="block text-[10px] font-black text-[#6E6A65] uppercase tracking-wider">Trust Score</span>
            <span className="text-lg font-black text-[#A8678A]">{creator.trustScore}</span>
          </div>
          <div className="p-3 bg-[#F8EFF3] rounded-xl border border-[#E7E1D8]">
            <span className="block text-[10px] font-black text-[#6E6A65] uppercase tracking-wider">Quality Score</span>
            <span className="text-lg font-black text-[#A8678A]">{contentQualityScore}</span>
          </div>
          <div className="p-3 bg-[#F8EFF3] rounded-xl border border-[#E7E1D8]">
            <span className="block text-[10px] font-black text-[#6E6A65] uppercase tracking-wider">Match Score</span>
            <span className="text-lg font-black text-[#1F1F1F]">{application.collaborationMatchScore}</span>
          </div>
        </div>

        {/* Creator DNA */}
        <div className="bg-[#F6F2E8]/40 border border-[#E7E1D8]/60 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-sm">🧬</span>
            <span className="text-xs font-black uppercase tracking-widest text-[#1F1F1F]">AI Creator DNA</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="block text-[9px] font-black text-[#6E6A65] uppercase tracking-wider">Style</span>
              <span className="font-bold text-[#1F1F1F]">{dna.contentStyle}</span>
            </div>
            <div>
              <span className="block text-[9px] font-black text-[#6E6A65] uppercase tracking-wider">Safety</span>
              <span className="font-bold text-[#A8678A]">{dna.brandSafety} Brand Safe</span>
            </div>
            <div>
              <span className="block text-[9px] font-black text-[#6E6A65] uppercase tracking-wider">Top Niches</span>
              <span className="font-bold text-[#1F1F1F] block truncate">{dna.topNiches}</span>
            </div>
            <div>
              <span className="block text-[9px] font-black text-[#6E6A65] uppercase tracking-wider">Trust Level</span>
              <span className="font-bold text-emerald-600">{dna.audienceTrust}</span>
            </div>
          </div>
        </div>

        {/* Creator Pitch */}
        <div className="space-y-2">
          <span className="block text-[10px] font-black uppercase tracking-widest text-[#6E6A65]">Creator Application Pitch</span>
          <div className="bg-[#F6F2E8]/20 border border-[#E7E1D8] p-4 rounded-xl text-xs text-[#1F1F1F] italic leading-relaxed whitespace-pre-wrap">
            "{application.editedPitch}"
          </div>
        </div>

        {/* Recent Reels */}
        <div>
          <span className="block text-[10px] font-black uppercase tracking-widest text-[#6E6A65] mb-3">Recent Uploaded Reels</span>
          {reels.length === 0 ? (
            <div className="text-center py-4 bg-[#FBFBFB] border border-dashed border-[#E7E1D8] rounded-xl text-xs text-[#6E6A65]">
              No reels uploaded yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {reels.map(r => (
                <div key={r.id} className="bg-white border border-[#E7E1D8] p-3 rounded-xl flex flex-col justify-between shadow-soft">
                  <div>
                    <span className="block font-bold text-xs text-[#1F1F1F] line-clamp-1">{r.title}</span>
                    <span className="block text-[10px] text-[#6E6A65] mt-1 line-clamp-2">{r.description}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-[10px] text-[#A8678A] font-extrabold border-t border-[#E7E1D8]/45 pt-2">
                    <span className="capitalize">{r.category}</span>
                    <span>{r.metrics.views >= 1000 ? `${(r.metrics.views/1000).toFixed(0)}K` : r.metrics.views} views</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Portfolio Summary */}
        <div>
          <span className="block text-[10px] font-black uppercase tracking-widest text-[#6E6A65] mb-3">Portfolio Highlights</span>
          {creator.portfolio.length === 0 ? (
            <div className="text-center py-3 bg-[#FBFBFB] border border-[#E7E1D8] rounded-xl text-xs text-[#6E6A65]">
              No portfolio highlights.
            </div>
          ) : (
            <div className="space-y-2">
              {creator.portfolio.map(p => (
                <div key={p.id} className="bg-[#F8EFF3] border border-[#E7E1D8] p-3 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#1F1F1F] block">{p.title}</span>
                    <span className="text-[10px] text-[#6E6A65] block">{p.description}</span>
                  </div>
                  <span className="text-[10px] text-[#A8678A] font-extrabold text-right shrink-0 ml-3">
                    {(p.metrics.engagementRate * 100).toFixed(1)}% ER
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Review Actions */}
        <div className="border-t border-[#E7E1D8] pt-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs font-bold text-[#6E6A65]">
            Status: <span className="text-[#1F1F1F] uppercase">{application.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { onUpdateStatus(application.id, 'rejected'); onClose(); }} className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold rounded-xl transition-colors">
              ❌ Pass
            </button>
            <button onClick={() => { onUpdateStatus(application.id, 'shortlisted'); onClose(); }} className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 text-xs font-bold rounded-xl transition-colors">
              ❤️ Shortlist
            </button>
            <button onClick={() => { onUpdateStatus(application.id, 'accepted'); onClose(); }} className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 text-xs font-bold rounded-xl transition-colors">
              ✅ Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function getCreatorWithFallback(creatorId: string): Creator {
  const store = getStore();
  const existing = store.creators.get(creatorId);
  if (existing) return existing;

  // Generate a friendly mock creator fallback if the profile got wiped out due to memory reset
  return {
    id: creatorId,
    userId: `user-${creatorId}`,
    displayName: `Creator (${creatorId.replace('creator-', '').substring(0, 8)})`,
    bio: 'Collaborative content creator on CreateLink.',
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(creatorId)}`,
    contentCategories: ['lifestyle', 'beauty'],
    socialAccounts: [
      { platform: 'instagram', handle: `@creator_${creatorId.substring(0, 5)}`, followerCount: 25000, connected: true }
    ],
    trustScore: 78,
    trustScorePartialData: true,
    portfolio: [],
    collaborationHistory: [],
    insights: {
      audienceDemographics: {
        ageGroups: { '18-24': 0.45, '25-34': 0.35, '35-44': 0.15, '45+': 0.05 },
        topCountries: ['India'],
        genderSplit: { male: 0.48, female: 0.48, other: 0.04 },
      },
      primaryCategories: ['lifestyle', 'beauty'],
      averageEngagementRate: 0.045,
      collaborationCount: 3,
      successRate: 0.9,
    },
    verificationStatus: 'verified',
  };
}

export default function SwipeReviewPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const { queue, undoAvailable, loadApplications, rankByMatchScore, swipe, undo } = useSwipeStore();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Mode & List View States
  const [viewMode, setViewMode] = useState<'swipe' | 'list'>('swipe');
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [previewApp, setPreviewApp] = useState<{ app: Application; creator: Creator } | null>(null);

  const fetchAllApps = useCallback(async () => {
    if (campaignId) {
      const apps = await getApplicationsForCampaign(campaignId);
      setAllApplications(apps);
    }
  }, [campaignId]);

  useEffect(() => {
    if (campaignId) {
      setLoading(true);
      loadApplications(campaignId)
        .then(() => fetchAllApps())
        .then(() => brandService.getCampaign(campaignId))
        .then((camp) => {
          setCampaign(camp);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [campaignId, loadApplications, fetchAllApps]);

  const handleSwipe = useCallback(async (direction: 'approve' | 'decline' | 'waitlist') => {
    if (queue.length === 0) return;
    const currentApp = queue[0];
    const directionLabels = { approve: 'accepted', decline: 'rejected', waitlist: 'shortlisted' };

    setToastMessage(`Application ${directionLabels[direction]}.`);
    await swipe(currentApp.id, direction);
    await fetchAllApps();
  }, [queue, swipe, fetchAllApps]);

  const handleUndo = async () => {
    await undo();
    setToastMessage('Swipe undone.');
    await fetchAllApps();
  };

  const handleUpdateStatus = async (appId: string, status: ApplicationStatus) => {
    try {
      await updateApplicationStatus(appId, status);
      setToastMessage(`Status updated to ${status}.`);
      await fetchAllApps();
      if (campaignId) {
        await loadApplications(campaignId);
      }
    } catch (err) {
      console.warn('Failed to update status:', err);
    }
  };

  // Keyboard controls for swipe mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (queue.length === 0 || viewMode !== 'swipe') return;
      if (e.key === 'ArrowRight') {
        handleSwipe('approve');
      } else if (e.key === 'ArrowLeft') {
        handleSwipe('decline');
      } else if (e.key === 'ArrowDown') {
        handleSwipe('waitlist');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queue, handleSwipe, viewMode]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-[#A8678A] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[#6E6A65] text-sm">Loading applications...</p>
      </div>
    );
  }

  const currentApp = queue[0];
  let currentCreator: Creator | null = null;
  if (currentApp) {
    currentCreator = getCreatorWithFallback(currentApp.creatorId);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-center relative min-h-[75vh] flex flex-col justify-between pb-8">
      {/* Undo Toast */}
      {toastMessage && undoAvailable && (
        <UndoToast
          message={toastMessage}
          onUndo={handleUndo}
          onDismiss={() => setToastMessage('')}
        />
      )}

      <div>
        <div className="flex justify-between items-center mb-6">
          <Link
            to={campaign ? `/brand/${campaign.brandId}` : '/feed'}
            className="text-xs font-bold text-[#6E6A65] hover:text-[#1F1F1F] flex items-center gap-1.5 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Brand Profile
          </Link>

          {/* Toggle Button Mode */}
          <div className="flex bg-[#F0EBE3] rounded-xl p-1 border border-[#E7E1D8] shrink-0">
            <button
              onClick={() => setViewMode('swipe')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'swipe' ? 'bg-[#1F1F1F] text-white' : 'text-[#6E6A65] hover:text-[#1F1F1F]'
              }`}
            >
              Swipe Deck
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list' ? 'bg-[#1F1F1F] text-white' : 'text-[#6E6A65] hover:text-[#1F1F1F]'
              }`}
            >
              Applicants List
            </button>
          </div>

          <span className="text-xs font-semibold uppercase tracking-wider text-[#6E6A65] hidden sm:inline">
            Swipe Application Review
          </span>
        </div>

        {campaign && (
          <div className="mb-6 text-left">
            <h2 className="text-2xl font-extrabold text-[#1F1F1F]">{campaign.title}</h2>
            <p className="text-[#6E6A65] text-xs mt-1">
              {viewMode === 'swipe'
                ? 'Review pending candidates using controls or arrow keys.'
                : 'View, sort, filter, and review all campaign applicants in detail.'}
            </p>
          </div>
        )}
      </div>

      {/* Main card viewport */}
      <div className="flex-1 flex flex-col justify-start">
        {viewMode === 'list' ? (
          <div className="bg-white border border-[#E7E1D8] rounded-[24px] shadow-card overflow-hidden">
            <div className="p-5 border-b border-[#E7E1D8] flex items-center justify-between flex-wrap gap-4 text-left">
              <div>
                <h3 className="font-extrabold text-[#1F1F1F] text-sm">Applications Inbox</h3>
                <p className="text-[#6E6A65] text-xs">Total applicants registered: {allApplications.length}</p>
              </div>
              {allApplications.length > 1 && (
                <button
                  onClick={() => {
                    const sorted = [...allApplications].sort((a, b) => b.collaborationMatchScore - a.collaborationMatchScore);
                    setAllApplications(sorted);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F8EFF3] border border-[#E7E1D8] text-xs font-bold text-[#1F1F1F] transition-colors"
                >
                  Sort by AI Match Score
                </button>
              )}
            </div>
            {allApplications.length === 0 ? (
              <div className="p-16 text-center text-xs text-[#6E6A65]">
                No applications received for this campaign yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FBFBFB] border-b border-[#E7E1D8] text-[10px] font-black uppercase tracking-widest text-[#6E6A65]">
                      <th className="p-4">Creator</th>
                      <th className="p-4 text-center">Trust</th>
                      <th className="p-4 text-center">Quality</th>
                      <th className="p-4">Niches</th>
                      <th className="p-4">AI DNA</th>
                      <th className="p-4">Recent Reels</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allApplications.map((app) => {
                      const creator = getCreatorWithFallback(app.creatorId);
                      return (
                        <ApplicantRow
                          key={app.id}
                          application={app}
                          creator={creator}
                          onOpenPreview={() => setPreviewApp({ app, creator })}
                          onUpdateStatus={handleUpdateStatus}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-[350px]">
            {currentApp && currentCreator ? (
              <div className="w-full">
                <SwipeCard
                  application={currentApp}
                  creator={currentCreator}
                />
              </div>
            ) : (
              <div className="bg-white border border-[#E7E1D8] rounded-[20px] shadow-card p-10 text-center w-full py-16 max-w-lg mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor" className="w-12 h-12 text-[#6E6A65] mx-auto mb-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                </svg>
                <h4 className="font-bold text-[#1F1F1F] mb-1">Queue Completed</h4>
                <p className="text-[#6E6A65] text-xs max-w-xs mx-auto">No more pending applications for this campaign.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls & Helpers Footer */}
      {viewMode === 'swipe' && currentApp && (
        <div className="mt-6">
          {queue.length > 1 && (
            <button
              onClick={rankByMatchScore}
              className="mb-4 px-4 py-2 rounded-xl bg-white hover:bg-[#F8EFF3] border border-[#E7E1D8] text-xs font-bold text-[#1F1F1F] transition-colors shadow-soft"
            >
              Rank Queue by AI Match Score
            </button>
          )}

          <SwipeControls onSwipe={handleSwipe} />

          <div className="flex justify-center gap-6 text-[10px] text-[#6E6A65] mt-2 font-medium">
            <span>&larr; Pass (Decline)</span>
            <span>&darr; Shortlist</span>
            <span>&rarr; Accept (Approve)</span>
          </div>
        </div>
      )}

      {/* Applicants List Mode Details Modal */}
      {previewApp && (
        <ApplicantDetailsModal
          application={previewApp.app}
          creator={previewApp.creator}
          onClose={() => setPreviewApp(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  );
}

