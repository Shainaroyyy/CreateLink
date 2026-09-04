import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { fetchCampaigns } from '../../services/campaignsService';
import { getStore } from '../../services/store';
import { fetchApplications } from '../../services/applicationService';
import { searchCreators, initCreatorPresence } from '../../services/creatorService';
import { getOrCreateConversation } from '../../services/messagingService';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import type { Notification } from '../../types/index';
import type { Creator } from '../../types/index';

// sidebar widths
const SIDEBAR_W   = 256; // px — expanded
const COLLAPSED_W = 72;  // px — icon-only

export function AppLayout() {
  const { currentUser, logout } = useAuthStore();
  const { unreadCount, loadNotifications, receiveNotification } = useNotificationStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Creator[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Realtime debounced creator search
  useEffect(() => {
    const q = searchQuery.trim();
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchCreators(q);
        setSearchResults(results);
        if (q || showSearchDropdown) {
          setShowSearchDropdown(true);
        }
      } catch (err) {
        console.warn('Realtime search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartChatWithCreator = async (creatorId: string) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (creatorId === currentUser.id) {
      alert('You cannot start a conversation with yourself.');
      return;
    }
    try {
      const conv = await getOrCreateConversation(creatorId, currentUser.id);
      setShowSearchDropdown(false);
      setSearchQuery('');
      navigate(`/messages?conversationId=${conv.id}`);
    } catch (err) {
      console.warn('Failed to start conversation:', err);
      navigate('/messages');
    }
  };

  useEffect(() => {
    if (currentUser) {
      const cleanupPresence = initCreatorPresence(currentUser);
      loadNotifications(currentUser.id);

      const notificationChannel = isSupabaseConfigured
        ? supabase
            .channel(`notifications:${currentUser.id}`)
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${currentUser.id}`,
            }, (payload) => {
              const row = payload.new as any;
              const notification: Notification = {
                id: row.id,
                userId: row.user_id,
                type: row.type,
                title: row.title,
                body: row.body,
                read: Boolean(row.read),
                createdAt: row.created_at,
              };
              receiveNotification(notification);
            })
            .subscribe()
        : null;

      const messageNotificationChannel = isSupabaseConfigured
        ? supabase
            .channel(`message-notifications:${currentUser.id}`)
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
            }, async (payload) => {
              const row = payload.new as any;
              if (!row || row.sender_id === currentUser.id) return;

              const { data: conversation } = await supabase
                .from('conversations')
                .select('creator_id, brand_id')
                .eq('id', row.conversation_id)
                .maybeSingle();
              if (!conversation) return;

              const isRecipient =
                conversation.creator_id === currentUser.id || conversation.brand_id === currentUser.id;
              if (!isRecipient) return;

              receiveNotification({
                id: `message-${row.id}`,
                userId: currentUser.id,
                type: 'message_received',
                title: 'New message',
                body: 'You have received a new message.',
                read: false,
                createdAt: row.created_at || new Date().toISOString(),
              });
            })
            .subscribe()
        : null;
      
      const store = getStore();
      
      fetchCampaigns().then((campaignsList) => {
        for (const c of campaignsList) {
          store.campaigns.set(c.id, c);
        }
      }).catch((err) => {
        console.warn('Failed to preload campaigns:', err);
      });

      fetchApplications().then((appsList) => {
        for (const a of appsList) {
          store.applications.set(a.id, a);
        }
      }).catch((err) => {
        console.warn('Failed to preload applications:', err);
      });

      return () => {
        if (cleanupPresence) cleanupPresence();
        if (notificationChannel) void supabase.removeChannel(notificationChannel);
        if (messageNotificationChannel) void supabase.removeChannel(messageNotificationChannel);
      };
    }
  }, [currentUser, loadNotifications, receiveNotification]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const getProfilePath = () =>
    !currentUser ? '/login'
    : currentUser.role === 'creator' ? `/creator/${currentUser.id}`
    : `/brand/${currentUser.id}`;

  const isActive = (path: string) => location.pathname.startsWith(path);

  // Role-aware navigation
  const navItems = currentUser?.role === 'brand' ? [
    { to: '/brand/dashboard', icon: <DiscoverIcon />, label: 'Dashboard' },
    { to: '/creators',        icon: <PeopleIcon />,   label: 'Discover Creators' },
    { to: '/campaigns',       icon: <CampaignIcon />, label: 'Campaigns' },
    { to: '/messages',        icon: <MessageIcon />,  label: 'Messages', badge: unreadCount },
    { to: '/bookmarks',       icon: <BookmarkIcon />, label: 'Bookmarks' },
    { to: '/analytics',       icon: <AnalyticsIcon />,label: 'Analytics' },
    { isDivider: true, id: 'div-1' },
    { to: '/brand-pro',       icon: <span className="text-lg leading-none flex items-center justify-center">⭐</span>, label: 'Brand Pro' },
  ] : [
    { to: '/feed',          icon: <DiscoverIcon />, label: 'Discover' },
    { to: '/creators',      icon: <PeopleIcon />,   label: 'Creators' },
    { to: '/campaigns',     icon: <CampaignIcon />, label: 'Campaigns' },
    { to: '/messages',      icon: <MessageIcon />,  label: 'Messages', badge: unreadCount },
    { to: '/portfolio',     icon: <BookmarkIcon />, label: 'Portfolio' },
    { to: '/bookmarks',     icon: <BookmarkIcon />, label: 'Bookmarks' },
    { to: '/analytics',     icon: <AnalyticsIcon />,label: 'Analytics' },
  ];

  const sw = sidebarCollapsed ? COLLAPSED_W : SIDEBAR_W;

  return (
    <div className="min-h-screen bg-[#F6F2E8] flex font-sans">

      {/* ─── Sidebar ─── */}
      <aside
        style={{ width: sw }}
        className={`
          fixed left-0 top-0 h-screen z-50
          bg-white border-r border-[#E7E1D8]
          flex flex-col
          transition-all duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-[#E7E1D8] shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-[#1F1F1F] flex items-center justify-center font-black text-white text-base shrink-0">
              CL
            </div>

            {!sidebarCollapsed && (
              <span className="text-base font-extrabold whitespace-nowrap">
                <span className="text-[#A8678A]">Creator</span>
                <span className="text-[#1F1F1F]">Link</span>
              </span>
            )}
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-2 rounded-lg hover:bg-[#F8EFF3]"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${
                sidebarCollapsed ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        </div>

        {/* Navigation - scrollable */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item: any) => {
            if (item.isDivider) {
              return <div key={item.id} className="h-px bg-[#E7E1D8] my-3 mx-2" />;
            }
            const { to, icon, label, badge } = item;
            return (
              <Link key={to} to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center ${
                  sidebarCollapsed ? 'justify-center' : 'gap-3'
                } px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive(to)
                    ? 'bg-[#F8EFF3] text-[#A8678A]'
                    : 'text-[#6E6A65] hover:bg-[#F8EFF3] hover:text-[#A8678A]'
                }`}
                title={sidebarCollapsed ? label : undefined}
              >
                <span className="w-5 h-5 shrink-0 flex items-center justify-center">{icon}</span>
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1">{label}</span>
                    {badge != null && badge > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#A8678A] text-white text-[10px] font-black flex items-center justify-center">
                        {badge}
                      </span>
                    )}
                  </>
                )}
                {sidebarCollapsed && badge != null && badge > 0 && (
                  <span className="absolute w-5 h-5 -top-1 -right-1 rounded-full bg-[#A8678A] text-white text-[10px] font-black flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section - fixed */}
        <div className="shrink-0 border-t border-[#E7E1D8] flex flex-col space-y-3 px-3 py-3">
          {/* Find creator CTA (only shown to brands) */}
          {!sidebarCollapsed && currentUser?.role === 'brand' && (
            <div className="bg-[#F8EFF3] border border-[#E7E1D8] rounded-2xl p-4">
              <p className="text-xs font-bold text-[#1F1F1F] leading-snug mb-3">
                Find the perfect creator for your next campaign
              </p>
              <Link to="/brand/me/campaigns/new"
                className="block text-center w-full py-2 bg-[#1F1F1F] text-white text-xs font-black rounded-xl hover:opacity-90 transition-opacity"
              >
                Create Campaign
              </Link>
              {/* Mini illustration */}
              <div className="flex justify-center mt-3 opacity-60 text-3xl">🤝</div>
            </div>
          )}

          {/* Placeholder for spacing — keep bottom layout consistent */}
          <div className="h-2" />

          {/* User profile */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2'} px-3 py-2`}>
            <div className="w-7 h-7 rounded-full bg-[#A8678A] text-white flex items-center justify-center text-[11px] font-black shrink-0">
              {currentUser?.displayName?.[0]?.toUpperCase() || currentUser?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#1F1F1F] truncate">
                  {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-[10px] text-[#6E6A65] capitalize">{currentUser?.role}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-[#6E6A65] hover:text-[#A8678A] transition-colors shrink-0"
              title="Sign out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── Right column: topbar + page content ─── */}
      <div
        className={`flex flex-col min-w-0 flex-1 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[256px]'
        }`}
      >
        {/* ══ TOPBAR ══════════════════════════════════════════════════════ */}
       <header
 className="sticky top-0 z-30 bg-white/95 backdrop-blur-md"
          style={{ boxShadow: '0 1px 0 0 #E7E1D8, 0 4px 20px 0 rgba(31,31,31,0.04)' }}>
          <div className="flex items-center h-16 px-6 gap-4">

            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-2 rounded-xl text-[#6E6A65] hover:bg-[#F8EFF3] transition-colors shrink-0"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Back button — shown when not on a root page */}
            {location.pathname !== '/feed' &&
             !location.pathname.match(/^\/(feed|creators|campaigns|messages|bookmarks|analytics|notifications)$/) && (
              <button onClick={() => navigate(-1)}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#6E6A65] hover:bg-[#F8EFF3] hover:text-[#1F1F1F] transition-colors shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
                Back
              </button>
            )}

            {/* ── Search bar with Realtime Dropdown ── */}
            <div ref={searchContainerRef} className="flex-1 relative">
              <svg
                className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#9E9A97] pointer-events-none"
                fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={async () => {
                  if (searchResults.length === 0) {
                    try {
                      const results = await searchCreators(searchQuery);
                      setSearchResults(results);
                    } catch {}
                  }
                  setShowSearchDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    setShowSearchDropdown(false);
                    navigate(`/creators?search=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
                placeholder="Search creators, niches or keywords..."
                className="
                  w-full h-10
                  pl-11 pr-16
                  bg-[#F6F2E8] border border-transparent
                  rounded-2xl
                  text-sm text-[#1F1F1F] placeholder-[#9E9A97]
                  focus:outline-none focus:bg-white focus:border-[#A8678A] focus:ring-2 focus:ring-[#A8678A]/20
                  transition-all duration-200
                "
              />
              {isSearching ? (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#A8678A] border-t-transparent rounded-full animate-spin" />
              ) : (
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-[#E7E1D8] bg-white text-[10px] text-[#9E9A97] font-mono pointer-events-none select-none">
                  ↵ Enter
                </kbd>
              )}

              {/* Realtime Search Results Dropdown */}
              {showSearchDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E7E1D8] rounded-2xl shadow-[0_12px_32px_rgba(31,31,31,0.12)] max-h-96 overflow-y-auto z-50 p-2 space-y-1">
                  {searchResults.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[#6E6A65]">
                      No creators found matching "{searchQuery}"
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#A8678A] flex items-center justify-between">
                        <span>Creators ({searchResults.length})</span>
                        <span className="text-[#6E6A65] font-normal lowercase">press enter for all</span>
                      </div>
                      {searchResults.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F8EFF3] transition-colors group cursor-pointer"
                          onClick={() => {
                            setShowSearchDropdown(false);
                            setSearchQuery('');
                            navigate(`/creator/${c.id}`);
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={c.avatarUrl}
                              alt={c.displayName}
                              className="w-9 h-9 rounded-full object-cover border border-[#E7E1D8] bg-white shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-black text-[#1F1F1F] truncate group-hover:text-[#A8678A] transition-colors">
                                {c.displayName}
                              </p>
                              <p className="text-[11px] text-[#6E6A65] truncate capitalize">
                                {c.contentCategories.length > 0 ? c.contentCategories.join(', ') : 'Content Creator'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartChatWithCreator(c.id);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-[#1F1F1F] text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1 shadow-sm"
                              title="Direct Message"
                            >
                              <span>Chat</span>
                            </button>
                            <span className="text-xs text-[#A8678A] font-bold pr-1">→</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Right action cluster ── */}
            <div className="flex items-center gap-1 shrink-0">

              {/* Notification bell */}
              <Link
                to="/notifications"
                className="relative flex items-center justify-center w-10 h-10 rounded-xl text-[#6E6A65] hover:bg-[#F8EFF3] hover:text-[#A8678A] transition-colors"
                aria-label={`${unreadCount} notifications`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#A8678A] ring-2 ring-white" />
                )}
              </Link>

              {/* Messages */}
              <button
                className="flex items-center justify-center w-10 h-10 rounded-xl text-[#6E6A65] hover:bg-[#F8EFF3] hover:text-[#A8678A] transition-colors"
                aria-label="Messages"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
              </button>

              {/* Thin divider */}
              <div className="w-px h-6 bg-[#E7E1D8] mx-1" />

              {/* Avatar + dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-[#F8EFF3] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#A8678A] text-white flex items-center justify-center text-xs font-black ring-2 ring-white shadow-sm select-none">
                    {currentUser?.displayName?.[0]?.toUpperCase() || currentUser?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="hidden sm:flex flex-col items-start leading-none">
                    <span className="text-xs font-bold text-[#1F1F1F] max-w-[120px] truncate">
                      {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
                    </span>
                    <span className="text-[10px] text-[#9E9A97] capitalize mt-0.5">{currentUser?.role}</span>
                  </div>
                  <svg className="w-3.5 h-3.5 text-[#9E9A97] hidden sm:block shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Dropdown */}
                <div className="absolute top-full right-0 mt-2 w-52 bg-white border border-[#E7E1D8] rounded-2xl shadow-[0_8px_32px_rgba(31,31,31,0.12)] py-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150 z-50">
                  <div className="px-4 py-2.5 border-b border-[#F0EBE3]">
                    <p className="text-xs font-bold text-[#1F1F1F] truncate">{currentUser?.email}</p>
                    <p className="text-[10px] text-[#9E9A97] capitalize mt-0.5">{currentUser?.role}</p>
                  </div>
                  <Link to={getProfilePath()}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-[#1F1F1F] hover:bg-[#F8EFF3] hover:text-[#A8678A] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                    View Profile
                  </Link>
                  <Link to={currentUser?.role === 'creator' ? '/creator/me/portfolio' : '/brand/me/campaigns/new'}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-[#1F1F1F] hover:bg-[#F8EFF3] hover:text-[#A8678A] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                    Settings
                  </Link>
                  <button onClick={handleLogout}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-semibold text-[#A8678A] hover:bg-[#F8EFF3] transition-colors border-t border-[#F0EBE3] mt-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-6 lg:px-8 py-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;

// ─── Icon Components ─────────────────────────────────────────────────────────
function DiscoverIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}
function CampaignIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 1 8.835-2.535m0 0A23.74 23.74 0 0 1 18.795 3c1.167 0 2.292.15 3.35.43.877.235 1.328 1.168 1.018 2.033l-.026.079A18.03 18.03 0 0 1 21 9.75c0 1.586-.205 3.124-.59 4.59" />
    </svg>
  );
}
function MessageIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  );
}
function BookmarkIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
    </svg>
  );
}
function AnalyticsIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}
