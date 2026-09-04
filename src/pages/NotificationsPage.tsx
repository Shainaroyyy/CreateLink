import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import type { NotificationType } from '../types/index';

// Icon + colour per notification type
const TYPE_CONFIG: Record<NotificationType, { icon: string; bg: string; label: string }> = {
  trust_score_change:     { icon: '📊', bg: 'bg-blue-100',    label: 'Trust Score' },
  application_approved:   { icon: '✅', bg: 'bg-emerald-100', label: 'Approved' },
  application_declined:   { icon: '❌', bg: 'bg-red-100',     label: 'Declined' },
  application_received:   { icon: '📩', bg: 'bg-purple-100',  label: 'Application' },
  brand_score_change:     { icon: '🏷️', bg: 'bg-amber-100',   label: 'Brand Score' },
  verification_update:    { icon: '🛡️', bg: 'bg-[#F8EFF3]',  label: 'Verification' },
  post_removed:           { icon: '🗑️', bg: 'bg-slate-100',  label: 'Post Removed' },
  account_locked:         { icon: '🔒', bg: 'bg-red-100',     label: 'Security' },
  message_received:       { icon: '💬', bg: 'bg-[#F8EFF3]',  label: 'Message' },
};

function relTime(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)  return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export default function NotificationsPage() {
  const { currentUser } = useAuthStore();
  const { notifications, unreadCount, loadNotifications, markRead, markAllRead } = useNotificationStore();

  useEffect(() => {
    if (currentUser) loadNotifications(currentUser.id);
  }, [currentUser, loadNotifications]);

  if (!currentUser) return null;

  const unread = notifications.filter(n => !n.read);
  const read   = notifications.filter(n => n.read);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#1F1F1F]">Notifications</h1>
          <p className="text-[#6E6A65] text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : "You're all caught up ✓"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead(currentUser.id)}
            className="px-4 py-2 text-xs font-bold text-[#A8678A] border border-[#A8678A]/30 bg-[#F8EFF3] rounded-xl hover:bg-[#E7E1D8] transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white border border-[#E7E1D8] rounded-[20px] p-16 text-center">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-[#1F1F1F] font-bold">No notifications yet</p>
          <p className="text-[#6E6A65] text-sm mt-1">We'll let you know when something important happens.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Unread section */}
          {unread.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E6A65] mb-3 px-1">New</p>
              <div className="space-y-2">
                {unread.map(n => {
                  const cfg = TYPE_CONFIG[n.type] ?? { icon: '🔔', bg: 'bg-slate-100', label: n.type };
                  return (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className="flex items-start gap-4 bg-white border border-[#A8678A]/20 rounded-[20px] p-4 cursor-pointer hover:border-[#A8678A]/50 hover:shadow-soft transition-all"
                    >
                      <div className={`w-10 h-10 rounded-2xl ${cfg.bg} flex items-center justify-center text-lg shrink-0`}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-[#1F1F1F] leading-snug">{n.title}</p>
                          <span className="text-[10px] text-[#6E6A65] font-medium shrink-0 mt-0.5">{relTime(n.createdAt)}</span>
                        </div>
                        <p className="text-xs text-[#6E6A65] leading-relaxed mt-1">{n.body}</p>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-[#A8678A] shrink-0 mt-2" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Read section */}
          {read.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6E6A65] mb-3 px-1">Earlier</p>
              <div className="space-y-2">
                {read.map(n => {
                  const cfg = TYPE_CONFIG[n.type] ?? { icon: '🔔', bg: 'bg-slate-100', label: n.type };
                  return (
                    <div key={n.id}
                      className="flex items-start gap-4 bg-[#F6F2E8] border border-[#E7E1D8] rounded-[20px] p-4 opacity-80">
                      <div className={`w-10 h-10 rounded-2xl ${cfg.bg} flex items-center justify-center text-lg shrink-0 opacity-70`}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-[#6E6A65] leading-snug">{n.title}</p>
                          <span className="text-[10px] text-[#9E9A97] font-medium shrink-0 mt-0.5">{relTime(n.createdAt)}</span>
                        </div>
                        <p className="text-xs text-[#9E9A97] leading-relaxed mt-1">{n.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
