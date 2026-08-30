import { useEffect, useState } from 'react';
import type { Application, Creator } from '../../types/index';
import ScoreBadge from '../shared/ScoreBadge';
import VerificationBadge from '../shared/VerificationBadge';
import AIPitchPanel from '../application/AIPitchPanel';
import { fetchReels } from '../../services/reelsService';
import type { Reel } from '../../services/reelsService';

interface SwipeCardProps {
  application: Application;
  creator: Creator;
}

export function getCreatorDna(creator: Creator) {
  const contentStyleMap: Record<string, string> = {
    beauty: 'Aesthetic Tutorials & Reviews',
    fitness: 'Workout Guides & Motivation',
    tech: 'Hands-on Reviews & Deep Dives',
    food: 'Recipe Vlogs & Culinary Tours',
    travel: 'Cinematic Vlogs & Guides',
    gaming: 'Gameplay Let\'s Plays & Tips',
    lifestyle: 'Vlogs & Daily Inspiration',
    finance: 'Educational Explaners & Tips',
    education: 'Insightful Explaners & Guides',
    fashion: 'Style Lookbooks & Trends',
  };

  const primaryCategory = creator.contentCategories?.[0] || 'lifestyle';
  const style = contentStyleMap[primaryCategory] || 'Creative Storytelling';
  const trust = creator.trustScore >= 85 ? 'Exceptional' : creator.trustScore >= 70 ? 'High' : 'Healthy';
  const brandSafety = `${Math.min(100, Math.round(creator.trustScore * 0.8 + 20))}%`;
  const niches = creator.contentCategories.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' • ');

  return {
    contentStyle: style,
    audienceTrust: trust,
    brandSafety,
    topNiches: niches,
  };
}

export function SwipeCard({ application, creator }: SwipeCardProps) {
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

  const portfolioItems = creator.portfolio.slice(0, 3);
  const dna = getCreatorDna(creator);
  const contentQualityScore = Math.min(100, Math.round(creator.trustScore * 0.95 + 4));

  return (
    <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-5 sm:p-6 shadow-card relative overflow-hidden flex flex-col justify-between max-w-lg mx-auto w-full group max-h-[85vh] overflow-y-auto space-y-5">
      {/* Creator Info Header */}
      <div className="flex items-center gap-4 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={creator.avatarUrl}
            alt={creator.displayName}
            className="w-14 h-14 rounded-xl border border-[#E7E1D8] bg-white object-cover shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-[#1F1F1F] text-base truncate">{creator.displayName}</h4>
              <VerificationBadge status={creator.verificationStatus} size="sm" showLabel={false} />
            </div>
            <p className="text-xs text-[#6E6A65] truncate">{creator.bio}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <ScoreBadge score={application.collaborationMatchScore} label="Match" size="sm" />
          <ScoreBadge score={creator.trustScore} label="Trust" size="sm" />
          <ScoreBadge score={contentQualityScore} label="Quality" size="sm" />
        </div>
      </div>

      {/* AI Creator DNA Card */}
      <div className="bg-[#F6F2E8]/40 border border-[#E7E1D8]/60 rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="text-sm select-none">🧬</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#1F1F1F]">AI Creator DNA</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="block text-[8px] font-black text-[#6E6A65] uppercase tracking-wider">Style</span>
            <span className="font-bold text-[#1F1F1F]">{dna.contentStyle}</span>
          </div>
          <div>
            <span className="block text-[8px] font-black text-[#6E6A65] uppercase tracking-wider">Safety</span>
            <span className="font-bold text-[#A8678A]">{dna.brandSafety} Brand Safe</span>
          </div>
          <div>
            <span className="block text-[8px] font-black text-[#6E6A65] uppercase tracking-wider">Niches</span>
            <span className="font-bold text-[#1F1F1F] truncate block">{dna.topNiches}</span>
          </div>
          <div>
            <span className="block text-[8px] font-black text-[#6E6A65] uppercase tracking-wider">Trust</span>
            <span className="font-bold text-emerald-600">{dna.audienceTrust}</span>
          </div>
        </div>
      </div>

      {/* AI Pitch Panel */}
      <AIPitchPanel pitch={application.editedPitch} onChange={() => {}} readOnly={true} />

      {/* Recent Reels */}
      <div>
        <span className="block text-[10px] font-black uppercase tracking-widest text-[#6E6A65] mb-2">Recent Uploaded Reels</span>
        {loadingReels ? (
          <div className="text-center py-2 text-xs text-[#6E6A65]">Loading reels...</div>
        ) : reels.length === 0 ? (
          <div className="text-center py-3 bg-[#FBFBFB] border border-dashed border-[#E7E1D8] rounded-xl text-xs text-[#6E6A65]">
            No recent uploaded reels.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {reels.slice(0, 2).map((reel) => (
              <div key={reel.id} className="bg-white border border-[#E7E1D8] p-2.5 rounded-xl flex flex-col justify-between shadow-soft">
                <span className="text-[11px] font-bold text-[#1F1F1F] line-clamp-1">{reel.title}</span>
                <div className="flex items-center justify-between mt-1 text-[9px] text-[#A8678A] font-extrabold">
                  <span className="capitalize">{reel.category}</span>
                  <span>{reel.metrics.views >= 1000 ? `${(reel.metrics.views / 1000).toFixed(0)}K` : reel.metrics.views} views</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Portfolio Highlights */}
      <div>
        <span className="block text-[10px] font-black uppercase tracking-widest text-[#6E6A65] mb-2">Portfolio Highlights</span>
        {portfolioItems.length === 0 ? (
          <div className="text-center py-3 bg-white border border-[#E7E1D8] rounded-xl text-xs text-[#6E6A65]">
            No portfolio items attached.
          </div>
        ) : (
          <div className="space-y-1.5">
            {portfolioItems.map((item) => (
              <div key={item.id} className="bg-[#F8EFF3] border border-[#E7E1D8] px-3 py-2 rounded-xl flex items-center justify-between text-xs">
                <div className="min-w-0">
                  <span className="block font-bold text-[#1F1F1F] truncate">{item.title}</span>
                  <span className="block text-[9px] text-[#6E6A65] capitalize">{item.category}</span>
                </div>
                <span className="text-[10px] text-[#A8678A] font-extrabold shrink-0">
                  {(item.metrics.engagementRate * 100).toFixed(1)}% Engagement
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SwipeCard;
