import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import VerificationBadge from '../components/shared/VerificationBadge';
import type { ContentCategory, Creator } from '../types/index';
import { getAllCreators } from '../services/creatorService';
import { getOrCreateConversation } from '../services/messagingService';
import { useAuthStore } from '../stores/authStore';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const CATEGORIES: ContentCategory[] = [
  'beauty', 'fitness', 'tech', 'food', 'travel',
  'gaming', 'lifestyle', 'finance', 'education', 'fashion'
];

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function CreatorsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();

  const [allCreators, setAllCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [niche, setNiche] = useState<ContentCategory | 'all'>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'trust' | 'engagement' | 'followers'>('trust');

  // Sync search query from URL params if changed externally
  useEffect(() => {
    const urlQuery = searchParams.get('search') || '';
    setSearchQuery(urlQuery);
  }, [searchParams]);

  // Load creators and subscribe to Supabase Postgres changes in realtime
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const list = await getAllCreators();
        if (mounted) {
          setAllCreators(list);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Failed to load creators list:', err);
        if (mounted) setLoading(false);
      }
    }

    load();

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('realtime:creator_profiles_page')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'creator_profiles' },
          () => {
            load();
          }
        )
        .subscribe();

      return () => {
        mounted = false;
        supabase.removeChannel(channel);
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  const handleStartChat = async (e: React.MouseEvent, creatorId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      const conv = await getOrCreateConversation(creatorId, currentUser.id);
      navigate(`/messages?conversationId=${conv.id}`);
    } catch (err) {
      console.warn('Failed to create conversation:', err);
      navigate('/messages');
    }
  };

  const cleanQuery = searchQuery.trim().toLowerCase();

  const filtered = allCreators
    .filter((c) => {
      if (cleanQuery) {
        const matchesName = c.displayName.toLowerCase().includes(cleanQuery);
        const matchesCategory = c.contentCategories.some((cat) => cat.toLowerCase().includes(cleanQuery));
        const matchesPlatform = c.platforms && c.platforms.some((p) => p.toLowerCase().includes(cleanQuery));
        const matchesBio = c.bio.toLowerCase().includes(cleanQuery);
        if (!matchesName && !matchesCategory && !matchesPlatform && !matchesBio) return false;
      }
      if (niche !== 'all' && !c.contentCategories.includes(niche)) return false;
      if (verifiedOnly && c.verificationStatus !== 'verified') return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'trust') return b.trustScore - a.trustScore;
      if (sortBy === 'engagement') return b.insights.averageEngagementRate - a.insights.averageEngagementRate;
      const aF = a.socialAccounts.reduce((s, x) => s + x.followerCount, 0);
      const bF = b.socialAccounts.reduce((s, x) => s + x.followerCount, 0);
      return bF - aF;
    });

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#1F1F1F]">Discover Creators</h1>
          <p className="text-[#6E6A65] text-sm mt-1">
            Connect and collaborate with active creators across every niche.
          </p>
        </div>

        {/* Local Page Search Input */}
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchParams(e.target.value ? { search: e.target.value } : {});
            }}
            placeholder="Filter by name, niche, skill..."
            className="w-full px-4 py-2 pl-9 bg-white border border-[#E7E1D8] rounded-xl text-xs text-[#1F1F1F] focus:outline-none focus:border-[#A8678A] focus:ring-1 focus:ring-[#A8678A]"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9A97] text-xs pointer-events-none">
            🔍
          </span>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchParams({});
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#6E6A65] hover:text-[#1F1F1F]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filters & Categories */}
      <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-4 py-2.5 bg-[#F6F2E8] border border-transparent rounded-xl text-sm text-[#1F1F1F] focus:outline-none focus:bg-white focus:border-[#A8678A] cursor-pointer"
          >
            <option value="trust">Sort: Trust Score</option>
            <option value="engagement">Sort: Engagement Rate</option>
            <option value="followers">Sort: Followers</option>
          </select>

          <label className="flex items-center gap-2 cursor-pointer">
            <div
              className={`w-9 h-5 rounded-full transition-colors relative ${
                verifiedOnly ? 'bg-[#A8678A]' : 'bg-[#E7E1D8]'
              }`}
              onClick={() => setVerifiedOnly((p) => !p)}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  verifiedOnly ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
            <span className="text-xs font-semibold text-[#6E6A65]">Verified only</span>
          </label>
        </div>

        {/* Niche chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setNiche('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              niche === 'all'
                ? 'bg-[#1F1F1F] text-white'
                : 'bg-[#F8EFF3] text-[#A8678A] hover:bg-[#E7E1D8]'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setNiche(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                niche === cat
                  ? 'bg-[#1F1F1F] text-white'
                  : 'bg-[#F8EFF3] text-[#A8678A] hover:bg-[#E7E1D8]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6E6A65] font-medium">
          {filtered.length} creator{filtered.length !== 1 ? 's' : ''} found
          {cleanQuery && ` matching "${cleanQuery}"`}
        </p>
      </div>

      {/* Creator Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-[#A8678A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#6E6A65]">Loading creators...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-16 text-center shadow-card">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-[#1F1F1F] font-bold">No creators match your filters</p>
          <p className="text-[#6E6A65] text-sm mt-1">Try adjusting your search keywords or niche filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((creator) => {
            const totalFollowers = creator.socialAccounts.reduce((s, a) => s + a.followerCount, 0);
            return (
              <div
                key={creator.id}
                className="bg-white border border-[#E7E1D8] rounded-[20px] p-5 shadow-card hover:border-[#A8678A] hover:-translate-y-0.5 hover:shadow-soft transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Top row: Avatar + info */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative shrink-0">
                      <img
                        src={creator.avatarUrl}
                        alt={creator.displayName}
                        className="w-12 h-12 rounded-full border-2 border-white shadow-soft object-cover bg-[#F8EFF3]"
                      />
                      {creator.verificationStatus === 'verified' && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white text-[8px] flex items-center justify-center text-white font-black">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/creator/${creator.id}`}
                        className="text-sm font-black text-[#1F1F1F] truncate block hover:text-[#A8678A] transition-colors"
                      >
                        {creator.displayName}
                      </Link>
                      <div className="flex items-center gap-1 mt-0.5">
                        <VerificationBadge status={creator.verificationStatus} size="sm" showLabel={false} />
                        <span className="text-[10px] text-[#6E6A65] capitalize truncate">
                          {creator.contentCategories[0] || 'Creator'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-xs text-[#6E6A65] leading-relaxed line-clamp-2 mb-3">
                    {creator.bio || 'Content creator ready for collaboration.'}
                  </p>

                  {/* Category chips */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {creator.contentCategories.slice(0, 3).map((cat) => (
                      <span
                        key={cat}
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F8EFF3] text-[#A8678A] capitalize"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 border-t border-[#E7E1D8] py-2.5 mb-3">
                    <div className="text-center">
                      <p className="text-xs font-black text-[#A8678A]">
                        {creator.trustScore > 0 ? creator.trustScore : '—'}
                      </p>
                      <p className="text-[9px] text-[#6E6A65]">Trust</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black text-[#1F1F1F]">{fmtNum(totalFollowers)}</p>
                      <p className="text-[9px] text-[#6E6A65]">Followers</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-black text-[#1F1F1F]">
                        {(creator.insights.averageEngagementRate * 100).toFixed(1)}%
                      </p>
                      <p className="text-[9px] text-[#6E6A65]">Eng. Rate</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/creator/${creator.id}`}
                      className="flex-1 py-2 text-center text-xs font-bold border border-[#E7E1D8] text-[#1F1F1F] rounded-xl hover:bg-[#F8EFF3] hover:text-[#A8678A] transition-colors"
                    >
                      View Profile
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => handleStartChat(e, creator.id)}
                      className="px-3 py-2 text-xs font-bold bg-[#1F1F1F] text-white rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1 shadow-soft"
                      title="Direct Realtime Message"
                    >
                      <span>💬 Chat</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
