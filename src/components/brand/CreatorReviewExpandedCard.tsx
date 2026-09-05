import { useEffect, useState } from 'react';
import type { Creator } from '../../types/index';
import { fetchReels, type Reel } from '../../services/reelsService';

interface CreatorReviewExpandedCardProps {
  creator: Creator;
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  onAction: (action: 'left' | 'down' | 'right') => void;
}

// Icons
const IconInstagram = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#E1306C]">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const IconTikTok = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#000000]">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5v3a3 3 0 0 1-3-3"></path>
  </svg>
);

const IconYouTube = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#FF0000]">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.42a2.78 2.78 0 0 0-1.94 2C1 8.17 1 12 1 12s0 3.83.46 5.58a2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.42a2.78 2.78 0 0 0 1.94-2C23 15.83 23 12 23 12s0-3.83-.46-5.58z"></path>
    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"></polygon>
  </svg>
);

const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

const IconEye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#A8678A]">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const IconHeart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#A8678A]">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

const IconMessage = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#A8678A]">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const IconChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#A8678A]">
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
);

const IconReject = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const IconWaitlist = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const IconApprove = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export function CreatorReviewExpandedCard({
  creator,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
  onAction,
}: CreatorReviewExpandedCardProps) {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loadingReels, setLoadingReels] = useState(false);

  useEffect(() => {
    if (creator.id) {
      setLoadingReels(true);
      fetchReels(creator.id)
        .then((fetched) => {
          setReels(fetched);
          setLoadingReels(false);
        })
        .catch(() => setLoadingReels(false));
    }
  }, [creator.id]);

  const primaryCategory = creator.contentCategories?.[0] || 'lifestyle';
  const displayCategory = primaryCategory.charAt(0).toUpperCase() + primaryCategory.slice(1);
  const nicheTags = creator.contentCategories.map(c => c.charAt(0).toUpperCase() + c.slice(1));

  // Social Stats Fallbacks if missing
  const igAccount = creator.socialAccounts?.find(s => s.platform === 'instagram');
  const ttAccount = creator.socialAccounts?.find(s => s.platform === 'tiktok');
  const ytAccount = creator.socialAccounts?.find(s => s.platform === 'youtube');

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    return num.toString();
  };

  // Derived Performance Metrics
  const avgViews = formatNumber(1200000); // Mocks for now based on image if data lacks it
  const avgLikes = formatNumber(45000);
  const avgComments = formatNumber(920);
  const engagementRate = creator.insights?.averageEngagementRate || 3.8;

  const pastCollabs = creator.collaborationHistory?.length > 0 
    ? creator.collaborationHistory.slice(0, 4).map(c => c.brandId) // We could map ID to name if available
    : ['Samsung', 'Notion', 'Nykaa', 'Amazon']; // Fallback matching image

  const demog = creator.insights?.audienceDemographics;
  
  // Format age groups for donut (mocked values based on image if demog missing)
  const age1824 = demog?.ageGroups?.['18-24'] ? Math.round(demog.ageGroups['18-24'] * 100) : 68;
  const age2534 = demog?.ageGroups?.['25-34'] ? Math.round(demog.ageGroups['25-34'] * 100) : 22;
  const age3544 = demog?.ageGroups?.['35-44'] ? Math.round(demog.ageGroups['35-44'] * 100) : 8;
  const age45 = demog?.ageGroups?.['45+'] ? Math.round(demog.ageGroups['45+'] * 100) : 2;

  const femalePct = demog?.genderSplit?.female ? Math.round(demog.genderSplit.female * 100) : 72;
  const malePct = demog?.genderSplit?.male ? Math.round(demog.genderSplit.male * 100) : 28;

  // Build conic gradient for the donut chart
  const donutGradient = `conic-gradient(
    #A8678A 0% ${age1824}%,
    #DDBFD0 ${age1824}% ${age1824 + age2534}%,
    #935B79 ${age1824 + age2534}% ${age1824 + age2534 + age3544}%,
    #E7E1D8 ${age1824 + age2534 + age3544}% 100%
  )`;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[24px] shadow-sm flex flex-col h-full overflow-hidden w-full mx-auto">
      {/* Top Header - Review & Nav */}
      <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
        <h2 className="text-xl font-bold text-[var(--text)]">Creator Review</h2>
        <div className="flex items-center gap-3">
          <button 
            onClick={onPrev} 
            disabled={currentIndex === 0}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[var(--border)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
          >
            <span className="text-sm font-bold">&lt;</span>
          </button>
          <span className="text-sm text-[var(--text-muted)] font-medium">
            {currentIndex + 1} of {totalCount}
          </span>
          <button 
            onClick={onNext} 
            disabled={currentIndex === totalCount - 1}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-[var(--border)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
          >
            <span className="text-sm font-bold">&gt;</span>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="p-5 overflow-y-auto flex-1 space-y-6">
        
        {/* Creator Header Section */}
        <div className="flex flex-col xl:flex-row gap-6 justify-between">
          <div className="flex gap-5 flex-1">
            <img 
              src={creator.avatarUrl} 
              alt={creator.displayName} 
              className="w-24 h-24 rounded-[20px] object-cover bg-[var(--surface-soft)] border border-[var(--border)]"
            />
            <div className="flex flex-col flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold text-[var(--text)]">{creator.displayName}</h3>
                <span className="bg-[var(--accent-bg)] text-[var(--accent)] px-2.5 py-0.5 rounded-full text-sm font-bold">
                  {creator.trustScore}
                </span>
              </div>
              <p className="text-[var(--text)] font-medium text-sm mt-1">
                {displayCategory} Creator
              </p>
              {creator.location && (
                <div className="flex items-center gap-1 text-[var(--text-muted)] text-sm mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <span>{creator.location}</span>
                </div>
              )}
              <p className="text-sm text-[var(--text-muted)] mt-2 line-clamp-2 max-w-lg">
                {creator.bio}
              </p>
              
              <div className="flex flex-wrap gap-2 mt-3">
                {nicheTags.map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-[var(--surface-soft)] border border-[var(--border)] text-[var(--text-muted)] text-xs rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end shrink-0 gap-3">
            <button className="flex items-center gap-2 border border-[var(--border)] rounded-full px-4 py-1.5 text-sm font-semibold hover:bg-[var(--surface-soft)] transition-colors">
              View Full Profile
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </button>
            <div className="flex flex-col gap-2 w-40">
              <div className="flex items-center justify-between text-xs text-[var(--text)]">
                <div className="flex items-center gap-2"><IconInstagram /> <span className="font-semibold">{formatNumber(igAccount?.followerCount || 85000)}</span></div>
                <span className="text-[var(--text-subtle)] text-[10px]">Followers</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--text)]">
                <div className="flex items-center gap-2"><IconTikTok /> <span className="font-semibold">{formatNumber(ttAccount?.followerCount || 120000)}</span></div>
                <span className="text-[var(--text-subtle)] text-[10px]">Followers</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--text)]">
                <div className="flex items-center gap-2"><IconYouTube /> <span className="font-semibold">{formatNumber(ytAccount?.followerCount || 42000)}</span></div>
                <span className="text-[var(--text-subtle)] text-[10px]">Subscribers</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--text)] pt-1 border-t border-[var(--border)] mt-1">
                <div className="flex items-center gap-2"><IconChart /> <span className="font-semibold">{engagementRate}%</span></div>
                <span className="text-[var(--text-subtle)] text-[10px]">Avg. ER</span>
              </div>
            </div>
          </div>
        </div>

        {/* Key Performance Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-[16px] p-4 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 mb-1">
              <IconEye />
              <span className="text-xl font-black text-[var(--text)]">{avgViews}</span>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-medium">Avg. Reel Views</span>
          </div>
          <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-[16px] p-4 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 mb-1">
              <IconHeart />
              <span className="text-xl font-black text-[var(--text)]">{avgLikes}</span>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-medium">Avg. Likes</span>
          </div>
          <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-[16px] p-4 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 mb-1">
              <IconMessage />
              <span className="text-xl font-black text-[var(--text)]">{avgComments}</span>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-medium">Avg. Comments</span>
          </div>
          <div className="bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-[16px] p-4 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 mb-1">
              <IconChart />
              <span className="text-xl font-black text-[var(--text)]">{engagementRate}%</span>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-medium">Engagement Rate</span>
          </div>
        </div>

        {/* About and Recent Reels Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* About Section */}
          <div className="xl:col-span-5 flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text)]"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <h4 className="font-bold text-[var(--text)]">About</h4>
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {creator.bio} I love collaborating with brands that align with mindful living, innovation, and creativity.
              </p>
            </div>

            {/* Audience Demographics */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text)]"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <h4 className="font-bold text-[var(--text)]">Audience Demographics</h4>
              </div>
              <div className="flex items-center gap-6">
                <div 
                  className="w-16 h-16 rounded-full relative flex shrink-0 items-center justify-center"
                  style={{ background: donutGradient }}
                >
                  <div className="w-10 h-10 bg-[var(--surface)] rounded-full"></div>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--accent)]"></span><span className="font-bold">{age1824}%</span> <span className="text-[var(--text-muted)]">18-24 years</span></div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--accent-border)]"></span><span className="font-bold">{age2534}%</span> <span className="text-[var(--text-muted)]">25-34 years</span></div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--accent-hover)]"></span><span className="font-bold">{age3544}%</span> <span className="text-[var(--text-muted)]">35-44 years</span></div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--border)]"></span><span className="font-bold">{age45}%</span> <span className="text-[var(--text-muted)]">45+ years</span></div>
                </div>
                <div className="flex flex-col gap-3 text-xs ml-auto">
                  <div className="flex flex-col items-center">
                    <span className="text-[var(--accent)] font-bold flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="5"></circle><line x1="12" y1="15" x2="12" y2="22"></line><line x1="9" y1="19" x2="15" y2="19"></line></svg>
                      {femalePct}%
                    </span>
                    <span className="text-[var(--text-muted)] text-[10px]">Female</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[#6495ED] font-bold flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="15" r="5"></circle><line x1="12.5" y1="11.5" x2="20" y2="4"></line><polyline points="15 4 20 4 20 9"></polyline></svg>
                      {malePct}%
                    </span>
                    <span className="text-[var(--text-muted)] text-[10px]">Male</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Past Collaborations */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text)]"><rect x="3" y="8" width="18" height="12" rx="2" ry="2"></rect><path d="M16 8V6a4 4 0 0 0-8 0v2"></path></svg>
                <h4 className="font-bold text-[var(--text)]">Past Collaborations</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {pastCollabs.map((brand, i) => (
                  <span key={i} className="px-3 py-1 bg-[var(--surface-soft)] border border-[var(--border)] text-[var(--text)] font-semibold text-xs rounded-md">
                    {brand}
                  </span>
                ))}
                {creator.collaborationHistory?.length > 4 && (
                  <span className="px-3 py-1 bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] text-xs rounded-md">
                    +{creator.collaborationHistory.length - 4} more
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Recent Reels / Content */}
          <div className="xl:col-span-7 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text)]"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
                <h4 className="font-bold text-[var(--text)]">Recent Reels / Content</h4>
              </div>
              <a href="#" className="text-[11px] font-bold text-[var(--accent)] hover:underline">View All</a>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-4">
              {loadingReels ? (
                <div className="col-span-3 text-center py-6 text-sm text-[var(--text-muted)]">Loading content...</div>
              ) : reels.slice(0, 3).map((reel) => (
                <div key={reel.id} className="relative aspect-[9/16] bg-gray-900 rounded-xl overflow-hidden group cursor-pointer border border-[#E7E1D8]">
                  {reel.thumbnailUrl ? (
                    <img src={reel.thumbnailUrl} alt={reel.title} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-b from-[var(--accent)] to-[#6A3D55] opacity-80" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />
                  
                  <div className="absolute inset-0 p-3 flex flex-col justify-between">
                    <p className="text-white font-bold text-[11px] leading-tight line-clamp-3">
                      {reel.title || "A productive day in my life"}
                    </p>
                    <div className="flex items-center gap-1.5 text-white font-semibold text-[10px]">
                      <IconPlay />
                      <span>{formatNumber(reel.metrics.views || 1400000)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {(!loadingReels && reels.length === 0) && (
                <div className="col-span-3 text-center py-6 text-sm text-[var(--text-muted)] border border-dashed border-[var(--border)] rounded-xl">No content available.</div>
              )}
            </div>

            {/* Sample Caption */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text)]"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><line x1="9" y1="10" x2="15" y2="10"></line></svg>
                <h4 className="font-bold text-[var(--text)]">Sample Caption</h4>
              </div>
              <div className="bg-[var(--surface-soft)] border border-[var(--border)] p-3 rounded-xl">
                <p className="text-xs text-[var(--text)] italic leading-relaxed">
                  "Small changes lead to a big, happier life. Here are my top 5 apps that keep me organized and sane! 🤍 #productivity #lifestyle"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-soft)] grid grid-cols-3 gap-3">
        <button 
          onClick={() => onAction('left')}
          className="flex items-center justify-center gap-2 py-3.5 bg-[#FFEBEB] text-[#D83A52] font-bold text-sm rounded-xl hover:bg-[#FFD6D6] transition-colors"
        >
          <IconReject />
          Reject
        </button>
        <button 
          onClick={() => onAction('down')}
          className="flex items-center justify-center gap-2 py-3.5 bg-[#FFF7EB] text-[#C58A3A] font-bold text-sm rounded-xl hover:bg-[#FFEAC2] transition-colors"
        >
          <IconWaitlist />
          Waitlist
        </button>
        <button 
          onClick={() => onAction('right')}
          className="flex items-center justify-center gap-2 py-3.5 bg-[#E8FFF6] text-[var(--success)] font-bold text-sm rounded-xl hover:bg-[#C9FEE7] transition-colors"
        >
          <IconApprove />
          Approve
        </button>
      </div>
    </div>
  );
}
