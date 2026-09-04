import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useBrandStore } from '../stores/brandStore';
import * as brandService from '../services/brandService';
import type { ContentCategory, CompensationType } from '../types/index';

const CATEGORIES: ContentCategory[] = [
  'beauty', 'fitness', 'tech', 'food', 'travel',
  'gaming', 'lifestyle', 'finance', 'education', 'fashion'
];

export default function CampaignEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuthStore();
  const { brand, loadBrand, publishCampaign } = useBrandStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minTrustScore, setMinTrustScore] = useState(80);
  const [minContentQuality, setMinContentQuality] = useState(85);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [brandSafe, setBrandSafe] = useState(true);
  const [priorExperience, setPriorExperience] = useState(false);
  const [aiPrioritized, setAiPrioritized] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<ContentCategory[]>([]);
  const [compensationType, setCompensationType] = useState<CompensationType>('paid');
  const [compensationAmount, setCompensationAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');

  const isEdit = !!id;

  useEffect(() => {
    if (currentUser) {
      loadBrand(currentUser.id);
    }
  }, [currentUser, loadBrand]);

  useEffect(() => {
    if (isEdit && id) {
      Promise.resolve().then(() => {
        setLoading(true);
      });
      brandService.getCampaign(id)
        .then((campaign) => {
          if (campaign) {
            setTitle(campaign.title);
            setDescription(campaign.description);
            
            // Parse requirements
            const reqStr = campaign.requirements || '';
            const minTrustMatch = reqStr.match(/Min Trust Score:\s*(\d+)/i);
            const minQualityMatch = reqStr.match(/Min Content Quality Score:\s*(\d+)/i);
            setMinTrustScore(minTrustMatch ? parseInt(minTrustMatch[1]) : 80);
            setMinContentQuality(minQualityMatch ? parseInt(minQualityMatch[1]) : 85);
            setVerifiedOnly(reqStr.toLowerCase().includes('verified creators only'));
            setBrandSafe(reqStr.toLowerCase().includes('brand-safe creators'));
            setPriorExperience(reqStr.toLowerCase().includes('prior collaboration experience'));
            setAiPrioritized(!reqStr.toLowerCase().includes('no prioritized matching'));
            
            setSelectedCategories(campaign.contentCategories);
            setCompensationType(campaign.compensationType);
            setCompensationAmount(campaign.compensationAmount ? String(campaign.compensationAmount) : '');
            setDeadline(campaign.deadline.split('T')[0]);
          }
          setLoading(false);
        })
        .catch(() => {
          setError('Failed to load campaign.');
          setLoading(false);
        });
    }
  }, [isEdit, id]);

  const handleToggleCategory = (cat: ContentCategory) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const categoryMatchCounts: Record<ContentCategory, number> = {
    beauty: 145, fitness: 92, tech: 68, food: 110, travel: 85,
    gaming: 55, lifestyle: 215, finance: 38, education: 42, fashion: 120
  };

  const getEstimatedMatches = () => {
    if (selectedCategories.length === 0) return 0;
    const sum = selectedCategories.reduce((acc, cat) => acc + (categoryMatchCounts[cat] || 50), 0);
    return Math.round(sum * 0.75); // simulate overlap
  };

  const getCampaignQualityScore = () => {
    let score = 20; // base score
    if (title.trim().length > 10) score += 15;
    if (description.trim().length > 30) score += 20;
    if (selectedCategories.length > 0) score += 15;
    if (compensationAmount && Number(compensationAmount) > 0) score += 15;
    if (minTrustScore >= 70 || minContentQuality >= 70) score += 15;
    return Math.min(100, score);
  };

  const getQualityBarClass = () => {
    const score = getCampaignQualityScore();
    if (score >= 95) return 'campaign-quality-bar campaign-quality-bar--95';
    if (score >= 85) return 'campaign-quality-bar campaign-quality-bar--85';
    if (score >= 75) return 'campaign-quality-bar campaign-quality-bar--75';
    if (score >= 65) return 'campaign-quality-bar campaign-quality-bar--65';
    if (score >= 50) return 'campaign-quality-bar campaign-quality-bar--50';
    return 'campaign-quality-bar campaign-quality-bar--low';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand) return;
    setError('');

    const serializedReqs = [
      `Min Trust Score: ${minTrustScore}+`,
      `Min Content Quality Score: ${minContentQuality}+`
    ];
    if (verifiedOnly) serializedReqs.push('Verified Creators Only');
    if (brandSafe) serializedReqs.push('Brand-Safe Creators');
    if (priorExperience) serializedReqs.push('Prior Collaboration Experience');
    if (aiPrioritized) serializedReqs.push('AI Prioritized Matching');
    else serializedReqs.push('No Prioritized Matching');
    const requirementsStr = serializedReqs.join(' | ');

    const amount = compensationAmount ? parseFloat(compensationAmount) : null;
    const deadlineISO = new Date(deadline).toISOString();

    const campaignData = {
      title,
      description,
      requirements: requirementsStr,
      contentCategories: selectedCategories,
      compensationType,
      compensationAmount: amount,
      deadline: deadlineISO,
    };

    try {
      if (isEdit && id) {
        await brandService.updateCampaign(id, campaignData);
      } else {
        await publishCampaign(brand.id, campaignData as Parameters<typeof publishCampaign>[1]);
      }
      navigate(`/brand/${brand.id}`);
    } catch (err) {
      setError((err as Error).message || 'Failed to save campaign.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-[#A8678A] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[#6E6A65] text-sm">Loading campaign details...</p>
      </div>
    );
  }

  // Check publish restriction
  const isRestricted = brand && brand.brandScore < 40 && !brand.isNewToPlatform;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)] w-full py-4">
      <div className="w-full max-w-3xl bg-white border border-[#E7E1D8] rounded-[20px] p-6 sm:p-10 shadow-card relative overflow-hidden">
        {/* Glow removed */}

      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-[#1F1F1F]">
          {isEdit ? 'Edit Campaign' : 'Create Collaboration Campaign'}
        </h2>
        <p className="text-[#6E6A65] text-sm mt-1">
          Publish campaign requirements and connect with matches in the network.
        </p>
      </div>

      {isRestricted ? (
        <div className="bg-[#F8EFF3] border border-[#A8678A] text-[#A8678A] p-6 rounded-[20px]">
          <h3 className="font-bold text-lg mb-2">Publishing Restricted</h3>
          <p className="text-sm leading-relaxed mb-4">
            Your Brand Score is currently <span className="font-bold">{brand?.brandScore}</span>, which is below the platform minimum of 40. New campaign publishing has been restricted pending moderator review.
          </p>
          <button
            onClick={() => navigate(`/brand/${brand?.id}`)}
            className="px-5 py-2.5 rounded-xl bg-white border border-[#E7E1D8] text-[#1F1F1F] text-xs font-semibold hover:bg-[#F8EFF3] transition-colors"
          >
            Back to Profile
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-[#F8EFF3] border border-[#A8678A] text-[#A8678A] px-5 py-3 rounded-2xl text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65] mb-1.5">Campaign Title</label>
            <input
              type="text"
              placeholder="e.g. Summer Skincare Content Partnership"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-[#E7E1D8] rounded-xl px-4 py-2.5 text-xs text-[#1F1F1F] placeholder-[#6E6A65] focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65] mb-1.5">Description</label>
            <textarea
              placeholder="Describe the campaign objectives, deliverables, and expectations..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-white border border-[#E7E1D8] rounded-xl px-4 py-2.5 text-xs text-[#1F1F1F] placeholder-[#6E6A65] focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A] resize-none"
              required
            ></textarea>
          </div>

          {/* Structured Creator Requirements Section */}
          <div className="bg-[#F6F2E8]/40 border border-[#E7E1D8] rounded-[20px] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7E1D8]/60 pb-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#1F1F1F] flex items-center gap-1.5">
                <span>🛡️</span> Creator Requirements
              </h3>
              <span className="text-[9px] font-black text-[#A8678A] bg-[#F8EFF3] px-2 py-0.5 rounded-full uppercase tracking-wider">
                Smart Filters
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Minimum Trust Score Selection */}
              <div>
                <label className="block text-[11px] font-bold text-[#6E6A65] mb-1.5 flex justify-between">
                  <span>Preferred Trust Score</span>
                  <span className="text-[#A8678A] font-extrabold">{minTrustScore}+</span>
                </label>
                <select
                  value={minTrustScore}
                  onChange={(e) => setMinTrustScore(Number(e.target.value))}
                  className="w-full bg-white border border-[#E7E1D8] rounded-xl px-3 py-2 text-xs font-semibold text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#A8678A]"
                >
                  <option value={50}>50+ (Standard)</option>
                  <option value={60}>60+ (Good Quality)</option>
                  <option value={70}>70+ (Highly Trusted)</option>
                  <option value={80}>80+ (Top Tier Creator)</option>
                  <option value={90}>90+ (Elite Only)</option>
                </select>
              </div>

              {/* Minimum Content Quality Score Selection */}
              <div>
                <label className="block text-[11px] font-bold text-[#6E6A65] mb-1.5 flex justify-between">
                  <span>Preferred Content Quality Score</span>
                  <span className="text-[#A8678A] font-extrabold">{minContentQuality}+</span>
                </label>
                <select
                  value={minContentQuality}
                  onChange={(e) => setMinContentQuality(Number(e.target.value))}
                  className="w-full bg-white border border-[#E7E1D8] rounded-xl px-3 py-2 text-xs font-semibold text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#A8678A]"
                >
                  <option value={50}>50+ (Basic quality)</option>
                  <option value={60}>60+ (Consistent styling)</option>
                  <option value={70}>70+ (Premium aesthetics)</option>
                  <option value={80}>80+ (SaaS Grade / Editorial)</option>
                  <option value={85}>85+ (Elite Production Value)</option>
                  <option value={90}>90+ (Top 1% Creators Only)</option>
                </select>
              </div>
            </div>

            {/* Checkboxes/Chips for creator type */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6E6A65] mb-2">Creator Type & History</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setVerifiedOnly(!verifiedOnly)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                    verifiedOnly
                      ? 'bg-[#F8EFF3] border-[#A8678A] text-[#A8678A]'
                      : 'bg-white border-[#E7E1D8] text-[#6E6A65] hover:border-[#A8678A]'
                  }`}
                >
                  <span className="text-xs">{verifiedOnly ? '✓' : '+'}</span> Verified Creators Only
                </button>

                <button
                  type="button"
                  onClick={() => setBrandSafe(!brandSafe)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                    brandSafe
                      ? 'bg-[#F8EFF3] border-[#A8678A] text-[#A8678A]'
                      : 'bg-white border-[#E7E1D8] text-[#6E6A65] hover:border-[#A8678A]'
                  }`}
                >
                  <span className="text-xs">{brandSafe ? '✓' : '+'}</span> Brand-Safe Creators
                </button>

                <button
                  type="button"
                  onClick={() => setPriorExperience(!priorExperience)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                    priorExperience
                      ? 'bg-[#F8EFF3] border-[#A8678A] text-[#A8678A]'
                      : 'bg-white border-[#E7E1D8] text-[#6E6A65] hover:border-[#A8678A]'
                  }`}
                >
                  <span className="text-xs">{priorExperience ? '✓' : '+'}</span> Prior Collaboration Experience
                </button>

                <button
                  type="button"
                  onClick={() => setAiPrioritized(!aiPrioritized)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 ${
                    aiPrioritized
                      ? 'bg-[#F8EFF3] border-[#A8678A] text-[#A8678A]'
                      : 'bg-white border-[#E7E1D8] text-[#6E6A65] hover:border-[#A8678A]'
                  }`}
                >
                  <span className="text-xs">{aiPrioritized ? '✓' : '+'}</span> 🎯 AI Prioritized Matching
                </button>
              </div>
            </div>

            <p className="text-[10px] text-[#6E6A65] leading-relaxed mt-1">
              Trust Score and Content Quality influence creator ranking and recommendations, but do not automatically prevent applications.
            </p>
          </div>

          {/* Compensation and Deadline Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Compensation Type */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65] mb-1.5">Compensation</label>
              <select
                value={compensationType}
                onChange={(e) => setCompensationType(e.target.value as CompensationType)}
                className="w-full bg-white border border-[#E7E1D8] rounded-xl px-4 py-2.5 text-xs font-semibold text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A]"
              >
                <option value="paid">Paid Collaboration</option>
                <option value="gifted">Gifted / Barter</option>
                <option value="commission">Commission Basis</option>
                <option value="revenue_share">Revenue Share</option>
              </select>
            </div>

            {/* Compensation Amount */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65] mb-1.5">
                Value / Amount ($)
              </label>
              <input
                type="number"
                placeholder="e.g. 500"
                value={compensationAmount}
                onChange={(e) => setCompensationAmount(e.target.value)}
                className="w-full bg-white border border-[#E7E1D8] rounded-xl px-4 py-2.5 text-xs text-[#1F1F1F] placeholder-[#6E6A65] focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A]"
                disabled={compensationType === 'gifted'}
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65] mb-1.5">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-white border border-[#E7E1D8] rounded-xl px-4 py-2.5 text-xs text-[#1F1F1F] focus:outline-none focus:ring-2 focus:ring-[#A8678A] focus:border-[#A8678A]"
                required
              />
            </div>
          </div>

          {/* Category Tags */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6E6A65] mb-2">Niche Categories</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const selected = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleToggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 flex items-center gap-1.5 ${
                      selected
                        ? 'bg-[#A8678A] text-white border-[#A8678A] shadow-soft'
                        : 'bg-white border-[#E7E1D8] text-[#6E6A65] hover:border-[#A8678A] hover:text-[#1F1F1F]'
                    }`}
                  >
                    {selected && <span className="text-[10px]">✓</span>}
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Match Preview Card */}
          <div className="bg-[#F8EFF3]/40 border border-[#A8678A]/20 rounded-[20px] p-5 space-y-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🎯</span>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#1F1F1F]">AI Match Preview</h4>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-[#A8678A] bg-[#F8EFF3] px-2.5 py-1 rounded-md animate-pulse">
                Live Analysis
              </span>
            </div>

            {selectedCategories.length === 0 ? (
              <div className="text-center py-3 text-xs font-semibold text-[#6E6A65] italic">
                Select categories and creator preferences to preview matching creators.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 divide-x divide-[#E7E1D8]/60">
                <div className="text-center px-1">
                  <p className="text-[10px] font-bold text-[#6E6A65] uppercase tracking-wider mb-1">Est. Matches</p>
                  <p className="text-lg font-black text-[#1F1F1F]">{getEstimatedMatches()} Creators</p>
                </div>
                <div className="text-center px-1">
                  <p className="text-[10px] font-bold text-[#6E6A65] uppercase tracking-wider mb-1">Avg. Trust Score</p>
                  <p className="text-lg font-black text-[#A8678A]">{`${Math.max(84, minTrustScore + 4)}+`}</p>
                </div>
                <div className="text-center px-1">
                  <p className="text-[10px] font-bold text-[#6E6A65] uppercase tracking-wider mb-1">Top Niches</p>
                  <p className="text-xs font-bold text-[#1F1F1F] truncate mt-1">
                    {selectedCategories.slice(0, 3).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' • ')}
                  </p>
                </div>
              </div>
            )}

            <p className="text-[10px] text-[#6E6A65] italic text-center pt-1 border-t border-[#E7E1D8]/40">
              Matches estimated using niche alignment, creator reputation, and content quality, and creator relevance.
            </p>
          </div>

          {/* Campaign Quality Score */}
          <div className="bg-[#F6F2E8]/30 border border-[#E7E1D8] rounded-[20px] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#6E6A65] uppercase tracking-wider">Campaign Quality Score</span>
              <span className="text-sm font-black text-[#A8678A]">{getCampaignQualityScore()}/100</span>
            </div>
            <div className="w-full bg-[#E7E1D8]/50 h-2 rounded-full overflow-hidden">
              <div className={getQualityBarClass()} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <span className={description.trim().length > 30 ? "text-[#5B8C5A]" : "text-[#9E9A97]"}>
                  {description.trim().length > 30 ? "✓" : "○"}
                </span>
                <span className={description.trim().length > 30 ? "text-[#1F1F1F]" : "text-[#6E6A65]"}>
                  Clear campaign description
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <span className={(compensationAmount && Number(compensationAmount) > 0) || compensationType === 'gifted' ? "text-[#5B8C5A]" : "text-[#9E9A97]"}>
                  {(compensationAmount && Number(compensationAmount) > 0) || compensationType === 'gifted' ? "✓" : "○"}
                </span>
                <span className={(compensationAmount && Number(compensationAmount) > 0) || compensationType === 'gifted' ? "text-[#1F1F1F]" : "text-[#6E6A65]"}>
                  Competitive compensation
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <span className={minTrustScore >= 70 || minContentQuality >= 70 ? "text-[#5B8C5A]" : "text-[#9E9A97]"}>
                  {minTrustScore >= 70 || minContentQuality >= 70 ? "✓" : "○"}
                </span>
                <span className={minTrustScore >= 70 || minContentQuality >= 70 ? "text-[#1F1F1F]" : "text-[#6E6A65]"}>
                  Relevant creator requirements
                </span>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-[#E7E1D8]">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-xl bg-white border border-[#E7E1D8] hover:bg-[#F8EFF3] text-[#1F1F1F] font-semibold transition-all duration-200 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#1F1F1F] text-white font-bold hover:opacity-90 shadow-soft transition-all duration-200 text-sm"
            >
              {isEdit ? 'Update Campaign' : 'Publish Campaign'}
            </button>
          </div>
        </form>
      )}
      </div>
    </div>
  );
}
