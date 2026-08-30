import { useEffect, useMemo, useState } from 'react';
import { getStore } from '../services/store';
import type { Creator, Campaign, Application } from '../types/index';
import { Link } from 'react-router-dom';
import { fetchCampaigns } from '../services/campaignsService';
import { fetchApplications } from '../services/applicationService';


// Simple utility components — keep design consistent with app
function ScorePill({ score }: { score: number }) {
  return (
    <div
      className="
        px-2.5 py-1
        rounded-full
        bg-[#A8678A]
        text-white
        text-xs
        font-bold
        shadow-sm
      "
    >
      {score}
    </div>
  );
}

function CreatorCard({ creator }: { creator: Creator }) {
  return (
    <div className="
  bg-white
  border border-[#E7E1D8]
  rounded-2xl
  p-4
  shadow-sm
  flex gap-3
  transition-all duration-300
  hover:border-[#A8678A]
  hover:shadow-lg
  hover:-translate-y-1
">
      <img src={creator.avatarUrl} alt={creator.displayName} className="w-14 h-14 rounded-full object-cover" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold truncate">{creator.displayName}</h4>
          <ScorePill score={creator.trustScore} />
        </div>
        <p className="text-xs text-[#6E6A65] truncate">{creator.bio}</p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[#6E6A65]">
          <span>{creator.socialAccounts?.[0]?.platform ?? 'instagram'}</span>
          <span>â€¢</span>
          <span>{creator.socialAccounts?.[0]?.followerCount ?? 0} followers</span>
          <span>â€¢</span>
          <span>{creator.insights?.averageEngagementRate?.toFixed?.(1) ?? 'â€”'}% ER</span>
        </div>
        <div className="mt-3 flex gap-2">
          <Link to={`/creator/${creator.id}`} className="px-3 py-1 text-xs bg-[#F8EFF3] text-[#A8678A] rounded-md font-bold">View</Link>
          <button className="px-3 py-1 text-xs border border-[#E7E1D8] rounded-md">Message</button>
          <button className="px-3 py-1 text-xs border border-[#E7E1D8] rounded-md">Save</button>
        </div>
      </div>
    </div>
  );
}

export default function BrandDashboardPage() {

  const [creators, setCreators] = useState<Creator[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);

  useEffect(() => {
    const store = getStore();
    setCreators(Array.from(store.creators.values()));
    setCampaigns(Array.from(store.campaigns.values()));
    setApplications(Array.from(store.applications.values()));

    fetchCampaigns().then((campaignsList) => {
      for (const c of campaignsList) {
        store.campaigns.set(c.id, c);
      }
      setCampaigns(Array.from(store.campaigns.values()));
    }).catch(err => console.warn('Failed to load campaigns for brand dashboard:', err));

    fetchApplications().then((appsList) => {
      for (const a of appsList) {
        store.applications.set(a.id, a);
      }
      setApplications(Array.from(store.applications.values()));
    }).catch(err => console.warn('Failed to load applications for brand dashboard:', err));
  }, []);

  // filters
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const filteredCreators = useMemo(() => creators.filter(c => {
    if (category && !c.contentCategories.includes(category as any)) return false;
    if (query && !c.displayName.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [creators, category, query]);

  // swipe queue
  const [queueIdx, setQueueIdx] = useState(0);

  function handleSwipe(action: 'left' | 'right' | 'down') {
    // action handling: left=reject, right=approve, down=waitlist
    const current = filteredCreators[queueIdx];
    if (!current) return;
    // For now just advance queue and mark status in localStorage
    const key = `brand-review-${current.id}`;
    localStorage.setItem(key, action);
    setQueueIdx((i) => Math.min(i + 1, filteredCreators.length - 1));
  }

  const nextCandidate = filteredCreators[queueIdx];

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left: Discover */}
      <div className="col-span-12 lg:col-span-4">
        <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-4">
          <h3 className="text-sm font-bold mb-3">Discover Creators</h3>
          <div className="mb-3">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name, niche or handle" className="w-full p-2 border border-[#E7E1D8] rounded-md" />
          </div>
          <div className="mb-3 flex gap-2">
            <select value={category ?? ''} onChange={e => setCategory(e.target.value || null)} className="p-2 border border-[#E7E1D8] rounded-md">
              <option value="">All categories</option>
              <option value="beauty">Beauty</option>
              <option value="fitness">Fitness</option>
              <option value="tech">Tech</option>
              <option value="lifestyle">Lifestyle</option>
            </select>
            <button onClick={() => { setQuery(''); setCategory(null); }} className="px-3 py-2 bg-[#F8EFF3] rounded-md">Reset</button>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {filteredCreators.map(c => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </div>
        </div>

        <div className="mt-4 bg-white border border-[#E7E1D8] rounded-[20px] p-4">
          <h3 className="text-sm font-bold mb-3">Applications Inbox</h3>
          <div className="space-y-3 max-h-[40vh] overflow-auto">
            {applications.slice(0, 20).map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 border border-[#F0EBE3] rounded-md">
                <div>
                  <div className="text-sm font-bold">{a.creatorId}</div>
                  <div className="text-[11px] text-[#6E6A65]">Applied for: {a.campaignId}</div>
                </div>
                <div className="text-[11px] text-[#9E9A97]">{new Date(a.submittedAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center: Review + Campaigns */}
      <div className="col-span-12 lg:col-span-5">
        <div className="
  bg-gradient-to-br
  from-white
  to-[#FCF6FA]
  border border-[#E7E1D8]
  rounded-[24px]
  p-6
  min-h-[72vh]
  shadow-sm
">
          <h3 className="text-sm font-bold mb-3">Creator Review</h3>
          {nextCandidate ? (
            <div className="w-full max-w-md">
              <div className="bg-white border border-[#E7E1D8] rounded-xl p-4 shadow-md">
                <div className="flex items-center gap-3">
                  <img src={nextCandidate.avatarUrl} alt={nextCandidate.displayName} className="w-16 h-16 rounded-full" />
                  <div>
                    <h4 className="text-lg font-bold">{nextCandidate.displayName}</h4>
                    <div className="text-xs text-[#6E6A65]">{nextCandidate.bio}</div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-[#6E6A65]"><span>{nextCandidate.trustScore}</span><span>â€¢</span><span>{nextCandidate.insights.averageEngagementRate}% ER</span></div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleSwipe('left')} className="px-3 py-2 bg-[#FFEBEB] rounded-lg">Reject</button>
                    <button onClick={() => handleSwipe('down')} className="px-3 py-2 bg-[#FFF7EB] rounded-lg">Waitlist</button>
                    <button onClick={() => handleSwipe('right')} className="px-3 py-2 bg-[#E8FFF6] rounded-lg">Approve</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[#9E9A97]">No more candidates</div>
          )}

          <div className="mt-4 w-full">
            <h4 className="text-sm font-bold mb-2">Campaigns</h4>
            <div className="space-y-2">
              {campaigns.map(c => (
                <div key={c.id} className="p-3 border border-[#F0EBE3] rounded-md flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">{c.title}</div>
                    <div className="text-xs text-[#6E6A65]">Status: {c.status}</div>
                    {(() => {
                      const campApps = applications.filter(a => a.campaignId === c.id);
                      const total = campApps.length;
                      const shortlisted = campApps.filter(a => a.status === 'shortlisted' || a.status === 'waitlisted').length;
                      const accepted = campApps.filter(a => a.status === 'accepted' || a.status === 'approved').length;
                      return (
                        <div className="text-[10px] text-[#A8678A] font-extrabold mt-1">
                          Applicants: {total} | Shortlisted: {shortlisted} | Accepted: {accepted}
                        </div>
                      );
                    })()}
                  </div>
                  <Link to={`/brand/me/campaigns/${c.id}/review`} className="px-3 py-1 bg-[#F8EFF3] rounded-md text-xs font-bold">Review</Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Messages + Analytics */}
      <div className="col-span-12 lg:col-span-3">
        <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-4 mb-4">
          <h3 className="text-sm font-bold mb-3">Brand Analytics</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-3 bg-[#F8EFF3] rounded-md">
              <div className="text-xs text-[#6E6A65]">Active Campaigns</div>
              <div className="text-lg font-bold">{campaigns.filter(c => c.status === 'active').length}</div>
            </div>
            <div className="p-3 bg-[#F8EFF3] rounded-md">
              <div className="text-xs text-[#6E6A65]">Applications</div>
              <div className="text-lg font-bold">{applications.length}</div>
            </div>
            <div className="p-3 bg-[#F8EFF3] rounded-md">
              <div className="text-xs text-[#6E6A65]">Creators Contacted</div>
              <div className="text-lg font-bold">0</div>
            </div>
            <div className="p-3 bg-[#F8EFF3] rounded-md">
              <div className="text-xs text-[#6E6A65]">Approved</div>
              <div className="text-lg font-bold">0</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-4">
          <h3 className="text-sm font-bold mb-3">Messages</h3>
          <Link to="/messages" className="block text-xs font-bold text-[#1F1F1F] hover:text-[#A8678A]">Open Messages</Link>
        </div>
      </div>
    </div>
  );
}
