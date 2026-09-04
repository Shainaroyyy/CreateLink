// pl

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getStore } from '../services/store';
import { useAuthStore } from '../stores/authStore';
import type { Campaign, CompensationType, ContentCategory } from '../types/index';
import { fetchCampaigns } from '../services/campaignsService';
import { getBrandsByIds } from '../services/brandService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const COMP_TYPES: { value: CompensationType | 'all'; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'paid',         label: 'Paid 💸' },
  { value: 'gifted',       label: 'Gifted 🎁' },
  { value: 'commission',   label: 'Commission 📈' },
  { value: 'revenue_share',label: 'Revenue Share 🤝' },
];

const CATEGORIES: (ContentCategory | 'all')[] = ['all','beauty','fitness','tech','food','travel','gaming','lifestyle','finance','education','fashion'];

const STATUS_STYLE: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  draft:     'bg-slate-100 text-slate-600',
  paused:    'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
};

function fmtNum(n: number) {
  if (n >= 1_000) return `${(n/1_000).toFixed(0)}K`;
  return String(n);
}

export default function CampaignsPage() {
  const { currentUser } = useAuthStore();
  const store = getStore();
  const navigate = useNavigate();

  const [compFilter, setCompFilter] = useState<CompensationType | 'all'>('all');
  const [catFilter, setCatFilter]   = useState<ContentCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [campaignsList, setCampaignsList] = useState<Campaign[]>([]);
  const [brandsById, setBrandsById] = useState(store.brands);

  useEffect(() => {
    // Use seeded data only when Supabase is unavailable; configured deployments start live.
    if (!isSupabaseConfigured) {
      setCampaignsList(Array.from(store.campaigns.values()));
    }

    // Dynamic load from campaignsService (backend/cache)
    fetchCampaigns().then((fetched) => {
      for (const c of fetched) {
        store.campaigns.set(c.id, c);
      }
      setCampaignsList(fetched);
      return getBrandsByIds(fetched.map((campaign) => campaign.brandId));
    }).then(() => setBrandsById(new Map(store.brands)))
      .catch(err => console.warn('Failed to load campaigns:', err));

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('campaigns-page')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, async () => {
          const refreshed = await fetchCampaigns();
          for (const campaign of refreshed) store.campaigns.set(campaign.id, campaign);
          await getBrandsByIds(refreshed.map((campaign) => campaign.brandId));
          setCampaignsList(refreshed);
          setBrandsById(new Map(store.brands));
        })
        .subscribe();
      return () => { void supabase.removeChannel(channel); };
    }
  }, []);

  const allCampaigns = campaignsList;
  const allBrands    = brandsById;

  const filtered = allCampaigns.filter(c => {
    if (c.status === 'removed') return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (compFilter !== 'all' && c.compensationType !== compFilter) return false;
    if (catFilter !== 'all' && !c.contentCategories.includes(catFilter)) return false;
    return true;
  }).sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime());

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#1F1F1F]">Campaigns</h1>
          <p className="text-[#6E6A65] text-sm mt-1">Browse all active brand collaboration opportunities</p>
        </div>
        {currentUser?.role === 'brand' && (
          <Link to="/brand/me/campaigns/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1F1F1F] text-white font-bold text-xs rounded-xl hover:opacity-90">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Campaign
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-5 shadow-card space-y-4">
        {/* Status tabs */}
        <div className="flex gap-1 bg-[#F6F2E8] rounded-2xl p-1 w-fit">
          {(['all','active','completed'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${statusFilter === s ? 'bg-white text-[#1F1F1F] shadow-sm' : 'text-[#6E6A65] hover:text-[#1F1F1F]'}`}>
              {s === 'all' ? 'All Campaigns' : s}
            </button>
          ))}
        </div>

        {/* Compensation type */}
        <div className="flex flex-wrap gap-2">
          {COMP_TYPES.map(ct => (
            <button key={ct.value} onClick={() => setCompFilter(ct.value as CompensationType | 'all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${compFilter === ct.value ? 'bg-[#1F1F1F] text-white' : 'bg-[#F8EFF3] text-[#A8678A] hover:bg-[#E7E1D8]'}`}>
              {ct.label}
            </button>
          ))}
        </div>

        {/* Category */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${catFilter === cat ? 'bg-[#1F1F1F] text-white' : 'bg-[#F8EFF3] text-[#A8678A] hover:bg-[#E7E1D8]'}`}>
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-[#6E6A65] font-medium">{filtered.length} campaign{filtered.length !== 1 ? 's' : ''}</p>

      {/* Campaign grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-16 text-center">
          <div className="text-5xl mb-4">📢</div>
          <p className="text-[#1F1F1F] font-bold">No campaigns match your filters</p>
          <p className="text-[#6E6A65] text-sm mt-1">Try changing the status or category filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(camp => {
            const brand = allBrands.get(camp.brandId);
            return (
              <div key={camp.id}
                className="bg-white border border-[#E7E1D8] rounded-[20px] p-5 shadow-card hover:border-[#A8678A] hover:-translate-y-0.5 hover:shadow-soft transition-all duration-200 flex flex-col">

                {/* Brand info */}
                <div className="flex items-start gap-3 mb-3">
                  {brand && (
                    <img src={brand.logoUrl} alt={brand.companyName}
                      className="w-10 h-10 rounded-xl border border-[#E7E1D8] bg-white p-0.5 shrink-0 object-contain" />
                  )}
                  <div className="flex-1 min-w-0">
                    {brand && (
                      <Link to={`/brand/${brand.id}`} className="text-xs font-bold text-[#6E6A65] hover:text-[#A8678A] block truncate">
                        {brand.companyName}
                      </Link>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${STATUS_STYLE[camp.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {camp.status}
                      </span>
                      <span className="text-[10px] text-[#9E9A97]">
                        {camp.publishedAt ? new Date(camp.publishedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Draft'}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F8EFF3] text-[#A8678A] capitalize">
                    {camp.compensationType.replace('_', ' ')}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-bold text-[#1F1F1F] text-sm leading-snug mb-2">{camp.title}</h3>

                {/* Description */}
                <p className="text-xs text-[#6E6A65] leading-relaxed line-clamp-2 mb-3 flex-1">{camp.description}</p>

                {/* Category chips */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {camp.contentCategories.map(cat => (
                    <span key={cat} className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F6F2E8] text-[#6E6A65] capitalize">{cat}</span>
                  ))}
                </div>

                {/* Footer */}
                <div className="border-t border-[#E7E1D8] pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[11px] text-[#6E6A65]">
                    {camp.compensationAmount && (
                      <span className="font-black text-[#1F1F1F]">₹{fmtNum(camp.compensationAmount)}</span>
                    )}
                    <span>{camp.applicantCount} applicants</span>
                    <span>Due {new Date(camp.deadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  {currentUser?.role === 'creator' && camp.status === 'active' && (
                    <button onClick={() => navigate('/feed')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#1F1F1F] text-white font-bold text-[11px] rounded-xl hover:opacity-90 transition-opacity">
                      Apply
                    </button>
                  )}
                  {currentUser?.role === 'brand' && camp.brandId === currentUser.id && (
                    <div className="flex gap-2">
                      <Link to={`/brand/me/campaigns/${camp.id}/edit`}
                        className="text-[11px] font-bold text-[#6E6A65] hover:text-[#1F1F1F]">Edit</Link>
                      <Link to={`/brand/me/campaigns/${camp.id}/review`}
                        className="text-[11px] font-bold text-[#A8678A] hover:underline">Review →</Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
