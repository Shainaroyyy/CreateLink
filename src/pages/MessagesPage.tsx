import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuthStore } from '../stores/authStore';
import {
  fetchUserConversations,
  fetchConversationMessages,
  sendMessage as sendDbMessage,
  markMessagesAsRead,
  fetchCollaborationDetails,
  getOrCreateConversation,
  type ConversationItem,
  type MessageItem,
  type CollaborationDetails,
} from '../services/messagingService';

export default function MessagesPage() {
  const { currentUser } = useAuthStore();
  const [searchParams] = useSearchParams();
  const urlConvId = searchParams.get('conversationId');
  const [currentUserId, setCurrentUserId] = useState<string | null>(currentUser?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'brands' | 'creators' | 'active' | 'archived'>('all');
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [collaborationDetails, setCollaborationDetails] = useState<CollaborationDetails | null>(null);

  // New conversation modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTargetEmail, setNewTargetEmail] = useState('');
  const [newModalLoading, setNewModalLoading] = useState(false);
  const [newModalError, setNewModalError] = useState('');

  const composerRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Derive the active user ID from Supabase auth state or the current logged-in store user
  const effectiveUserId = currentUserId || currentUser?.id || '';

  // Scroll smoothly to bottom of messages
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // 1. Authenticate user via supabase.auth.getUser() and sync with authStore
  useEffect(() => {
    let mounted = true;

    async function initUser() {
      const storeUser = useAuthStore.getState().currentUser;
      if (storeUser?.id && mounted) {
        setCurrentUserId(storeUser.id);
      }

      if (isSupabaseConfigured) {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user && mounted) {
            setCurrentUserId(user.id);
          }
        } catch (err) {
          console.warn('Supabase auth check:', err);
        }
      }

      if (mounted) setLoading(false);
    }

    initUser();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Fetch conversations for effective user
  const loadConversations = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const convs = await fetchUserConversations(effectiveUserId);
      setConversations(convs);

      // Select target conversation from URL if present
      setActiveConvId((prev) => {
        if (urlConvId && convs.some((c) => c.id === urlConvId)) return urlConvId;
        if (prev && convs.some((c) => c.id === prev)) return prev;
        return convs.length > 0 ? convs[0].id : null;
      });
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    if (effectiveUserId) {
      loadConversations();
    }
  }, [effectiveUserId, loadConversations]);

  // Active conversation memo
  const activeConv = useMemo(
    () => conversations.find((c) => c.id === activeConvId) ?? null,
    [conversations, activeConvId]
  );

  // 3. When active conversation changes, load its messages & collaboration details
  useEffect(() => {
    if (!activeConvId || !effectiveUserId) {
      setMessages([]);
      setCollaborationDetails(null);
      setLoadingMessages(false);
      return;
    }

    let isMounted = true;
    setLoadingMessages(true);

    // Fetch messages
    fetchConversationMessages(activeConvId, effectiveUserId)
      .then((msgs) => {
        if (!isMounted) return;
        setMessages(msgs);
        setLoadingMessages(false);
        setTimeout(() => scrollToBottom(false), 50);
      })
      .catch((err) => {
        console.warn('Error fetching messages:', err);
        if (isMounted) setLoadingMessages(false);
      });

    // Mark messages as read in Supabase without causing re-render loops
    markMessagesAsRead(activeConvId, effectiveUserId).then(() => {
      if (!isMounted) return;
      setConversations((prev) => {
        const item = prev.find((c) => c.id === activeConvId);
        if (!item || item.unreadCount === 0) return prev;
        return prev.map((c) => (c.id === activeConvId ? { ...c, unreadCount: 0 } : c));
      });
    });

    const targetConv = conversations.find((c) => c.id === activeConvId);
    if (targetConv) {
      fetchCollaborationDetails(
        targetConv.creatorId,
        targetConv.brandId,
        targetConv.campaignId,
        effectiveUserId
      ).then((details) => {
        if (isMounted) {
          setCollaborationDetails(details);
        }
      });
    }

    // Fast 3-second live sync interval so active chat never drops a message
    const syncInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const latest = await fetchConversationMessages(activeConvId, effectiveUserId);
        if (!isMounted) return;
        setMessages((prev) => {
          if (
            latest.length !== prev.length ||
            (latest.length > 0 && latest[latest.length - 1].id !== prev[prev.length - 1]?.id)
          ) {
            setTimeout(() => scrollToBottom(true), 50);
            return latest;
          }
          return prev;
        });
      } catch {}
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(syncInterval);
    };
  }, [activeConvId, effectiveUserId, scrollToBottom]);

  // 4. Supabase Realtime - Conversation-specific Channel (Active chat stream)
  useEffect(() => {
    if (!activeConvId || !effectiveUserId || !isSupabaseConfigured) return;

    const channelName = `realtime:messages:${activeConvId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConvId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (!newMsg) return;

          const mapped: MessageItem = {
            id: newMsg.id,
            fromId: newMsg.sender_id === effectiveUserId ? 'me' : newMsg.sender_id,
            senderId: newMsg.sender_id,
            text: newMsg.content,
            time: newMsg.created_at,
            read: newMsg.is_read,
          };

          // Deduplicate by message ID
          setMessages((prev) => {
            if (prev.some((m) => m.id === mapped.id)) return prev;
            return [...prev, mapped];
          });

          // If incoming message from other party, immediately mark as read
          if (newMsg.sender_id !== effectiveUserId) {
            markMessagesAsRead(activeConvId, effectiveUserId);
          }

          // Update latest message in conversation list
          setConversations((prev) =>
            prev.map((c) =>
              c.id === activeConvId
                ? {
                    ...c,
                    lastMessage: mapped,
                    updatedAt: mapped.time,
                    unreadCount: 0,
                  }
                : c
            )
          );

          scrollToBottom();
        }
      )
      .on(
        'broadcast',
        { event: 'new_message' },
        (payload) => {
          const mapped = payload.payload as MessageItem;
          if (!mapped || !mapped.id) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConvId, effectiveUserId, scrollToBottom]);

  // 5. Supabase Realtime - Global Channel for incoming messages in other conversations
  useEffect(() => {
    if (!effectiveUserId || !isSupabaseConfigured) return;

    const globalChannel = supabase
      .channel(`realtime:user_messages:${effectiveUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (!newMsg) return;

          const convId = newMsg.conversation_id;

          // Handled by active channel if conversation is currently open
          if (convId === activeConvId) return;

          // Check if conversation exists in our list
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === convId);

            if (!exists) {
              // Reload conversations list so the new thread appears
              loadConversations();
              return prev;
            }

            const mapped: MessageItem = {
              id: newMsg.id,
              fromId: newMsg.sender_id === effectiveUserId ? 'me' : newMsg.sender_id,
              senderId: newMsg.sender_id,
              text: newMsg.content,
              time: newMsg.created_at,
              read: newMsg.is_read,
            };

            const isIncoming = newMsg.sender_id !== effectiveUserId;

            const updated = prev.map((c) => {
              if (c.id === convId) {
                return {
                  ...c,
                  lastMessage: mapped,
                  updatedAt: mapped.time,
                  unreadCount: isIncoming ? c.unreadCount + 1 : c.unreadCount,
                };
              }
              return c;
            });

            // Move the updated conversation to top
            return updated.sort((a, b) => {
              const timeA = a.lastMessage ? new Date(a.lastMessage.time).getTime() : new Date(a.updatedAt).getTime();
              const timeB = b.lastMessage ? new Date(b.lastMessage.time).getTime() : new Date(b.updatedAt).getTime();
              return timeB - timeA;
            });
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updatedMsg = payload.new as any;
          if (!updatedMsg) return;

          setMessages((prev) =>
            prev.map((m) => (m.id === updatedMsg.id ? { ...m, read: updatedMsg.is_read } : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(globalChannel);
    };
  }, [effectiveUserId, activeConvId, loadConversations]);

  // 6. Sending Messages
  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !activeConvId || !effectiveUserId || sending) return;

    setSending(true);

    try {
      const dbMsg = await sendDbMessage(activeConvId, effectiveUserId, trimmed);

      const mapped: MessageItem = {
        id: dbMsg.id,
        fromId: 'me',
        senderId: effectiveUserId,
        text: dbMsg.content,
        time: dbMsg.created_at,
        read: dbMsg.is_read,
      };

      // Optimistically append (deduplicated by id)
      setMessages((prev) => {
        if (prev.some((m) => m.id === mapped.id)) return prev;
        return [...prev, mapped];
      });

      // Broadcast on active channel for zero-latency peer sync across tabs
      try {
        supabase
          .channel(`realtime:messages:${activeConvId}`)
          .send({ type: 'broadcast', event: 'new_message', payload: mapped });
      } catch (bErr) {
        console.warn('Broadcast error:', bErr);
      }

      // Update latest message in left sidebar
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === activeConvId
            ? { ...c, lastMessage: mapped, updatedAt: mapped.time }
            : c
        );
        return updated.sort((a, b) => {
          const timeA = a.lastMessage ? new Date(a.lastMessage.time).getTime() : new Date(a.updatedAt).getTime();
          const timeB = b.lastMessage ? new Date(b.lastMessage.time).getTime() : new Date(b.updatedAt).getTime();
          return timeB - timeA;
        });
      });

      if (composerRef.current) {
        composerRef.current.value = '';
      }

      scrollToBottom();
    } catch (err: any) {
      console.error('Failed to send message:', err);
      alert(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConvId(id);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

  // Filter conversations
  const filtered = useMemo(() => {
    return conversations
      .filter((c) => {
        if (filter === 'all') return true;
        if (filter === 'brands') return c.participant.type === 'brand';
        if (filter === 'creators') return c.participant.type === 'creator';
        if (filter === 'active') return c.type === 'campaign' || Boolean(c.campaignId);
        if (filter === 'archived') return false;
        return true;
      })
      .filter(
        (c) =>
          c.participant.name.toLowerCase().includes(query.toLowerCase()) ||
          (c.lastMessage?.text || '').toLowerCase().includes(query.toLowerCase())
      );
  }, [conversations, filter, query]);

  // Handle creating a new conversation via modal
  const handleStartNewConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTargetEmail.trim() || !effectiveUserId) return;

    setNewModalLoading(true);
    setNewModalError('');

    try {
      // Look up target profile by email
      const { data: targetProfile, error: targetErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', newTargetEmail.trim().toLowerCase())
        .maybeSingle();

      if (targetErr || !targetProfile) {
        throw new Error('User not found with this email. Ensure they have registered.');
      }

      if (targetProfile.id === effectiveUserId) {
        throw new Error('You cannot start a conversation with yourself.');
      }

      // Check role of current user vs target
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', effectiveUserId)
        .maybeSingle();

      const myRole = myProfile?.role || 'creator';
      const creatorId = myRole === 'creator' ? effectiveUserId : targetProfile.id;
      const brandId = myRole === 'creator' ? targetProfile.id : effectiveUserId;

      const conv = await getOrCreateConversation(creatorId, brandId, null);

      await loadConversations();
      setActiveConvId(conv.id);
      setShowNewModal(false);
      setNewTargetEmail('');
    } catch (err: any) {
      setNewModalError(err.message || 'Failed to create conversation.');
    } finally {
      setNewModalLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar */}
        <aside className="lg:col-span-3 bg-white border border-[#E7E1D8] rounded-[16px] p-4 shadow-card h-[70vh] flex flex-col">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-10 pr-3 py-2 rounded-xl border border-[#E7E1D8] text-sm placeholder-[#6E6A65] focus:outline-none focus:ring-2 focus:ring-[#A8678A]"
                />
                <svg
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6A65]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197M10.5 5.25a5.25 5.25 0 1 1-0 10.5 5.25 5.25 0 0 1 0-10.5z" />
                </svg>
              </div>
            </div>
            <div>
              <button
                onClick={() => setShowNewModal(true)}
                className="p-2 rounded-lg bg-[#F8EFF3] text-[#1F1F1F] text-xs font-bold hover:bg-[#A8678A]/10 transition-colors"
                title="Start New Conversation"
              >
                New
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mt-4 flex gap-2 text-xs text-[#6E6A65] overflow-x-auto pb-1">
            {(['all', 'brands', 'creators', 'active', 'archived'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-1 rounded-lg shrink-0 transition-colors ${
                  filter === f
                    ? 'bg-[#F8EFF3] text-[#A8678A] font-bold'
                    : 'bg-transparent hover:bg-[#F8EFF3]'
                }`}
              >
                {f === 'all'
                  ? 'All'
                  : f === 'active'
                  ? 'Active Campaigns'
                  : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Conversation List */}
          <div className="mt-4 overflow-y-auto flex-1">
            {loading ? (
              <div className="py-12 text-center">
                <div className="w-6 h-6 border-2 border-[#A8678A] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-xs text-[#6E6A65]">Loading conversations...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <svg
                  className="w-8 h-8 text-[#9E9A97] mx-auto mb-2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.974-.94 4.025 4.025 0 0 0 .54-1.745A8.15 8.15 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                  />
                </svg>
                <p className="text-xs font-semibold text-[#1F1F1F]">No conversations yet</p>
                <p className="text-[11px] text-[#6E6A65] mt-1">
                  Connect with creators or brands to start messaging.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => handleSelectConversation(c.id)}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        activeConv?.id === c.id
                          ? 'bg-[#F8EFF3] text-[#A8678A]'
                          : 'hover:bg-[#F8EFF3]'
                      }`}
                    >
                      <img
                        src={c.participant.avatar || '/favicon.svg'}
                        alt={c.participant.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#E7E1D8] bg-white shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-bold truncate text-[#1F1F1F]">
                            {c.participant.name}
                          </div>
                          {c.lastMessage && (
                            <div className="text-[11px] text-[#6E6A65] shrink-0">
                              {new Date(c.lastMessage.time).toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>
                        <div className="text-[12px] truncate text-[#6E6A65]">
                          {c.lastMessage?.text || 'No messages yet'}
                        </div>
                      </div>
                      {c.unreadCount > 0 && (
                        <div className="ml-2 w-5 h-5 rounded-full bg-[#A8678A] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                          {c.unreadCount}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Center: Active Chat Stream */}
        <section className="lg:col-span-6 bg-white border border-[#E7E1D8] rounded-[16px] p-4 shadow-card h-[70vh] flex flex-col">
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 border-b border-[#E7E1D8] pb-3">
                <div className="w-10 h-10 rounded-full bg-[#F3F1EF] border border-[#E7E1D8] flex items-center justify-center text-sm font-black text-[#1F1F1F]">
                  {activeConv.participant.name?.[0] ?? 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate text-[#1F1F1F]">
                    {activeConv.participant.name}
                  </div>
                  <div className="text-[12px] text-[#6E6A65] truncate">
                    {activeConv.participant.type === 'brand'
                      ? 'Brand'
                      : activeConv.participant.niche || 'Creator'}
                  </div>
                </div>
                {activeConv.campaignId && (
                  <div className="text-[11px] font-bold text-[#A8678A] bg-[#F8EFF3] px-2.5 py-1 rounded-md border border-[#E7E1D8]">
                    Campaign Collaboration
                  </div>
                )}
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4" id="messages-list">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-[#A8678A] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-xs text-[#6E6A65] py-8">
                    <p className="font-semibold text-sm text-[#1F1F1F] mb-1">
                      Start the Conversation 👋
                    </p>
                    <p>Send a message to discuss deliverables, rates, and timeline.</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.fromId === 'me' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`${
                          m.fromId === 'me'
                            ? 'bg-[#1F1F1F] text-white'
                            : 'bg-[#F3F1EF] text-[#1F1F1F]'
                        } max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-soft break-words`}
                      >
                        <div className="whitespace-pre-wrap">{m.text}</div>
                        <div
                          className={`text-[10px] mt-1 text-right ${
                            m.fromId === 'me' ? 'text-white/70' : 'text-[#6E6A65]'
                          }`}
                        >
                          {new Date(m.time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="pt-3 border-t border-[#E7E1D8] mt-auto">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (composerRef.current) {
                      handleSendMessage(composerRef.current.value);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={composerRef}
                    placeholder="Write a message..."
                    disabled={sending}
                    className="flex-1 rounded-2xl border border-[#E7E1D8] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#A8678A] disabled:opacity-60"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-4 py-2 rounded-xl bg-[#1F1F1F] text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-12 h-12 rounded-full bg-[#F8EFF3] text-[#A8678A] flex items-center justify-center mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.502 49.188 49.188 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              </div>
              <h4 className="font-bold text-sm text-[#1F1F1F] mb-1">Select a Conversation</h4>
              <p className="text-xs text-[#6E6A65] max-w-xs">
                Choose a conversation from the left sidebar to start messaging in real-time.
              </p>
            </div>
          )}
        </section>

        {/* Right Sidebar: Collaboration Details */}
        <aside className="lg:col-span-3 bg-white border border-[#E7E1D8] rounded-[16px] p-4 shadow-card h-[70vh] overflow-auto">
          {activeConv ? (
            <div>
              <h4 className="font-bold text-sm mb-3 text-[#1F1F1F]">Collaboration Details</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6E6A65]">Verification</span>
                  <span className="text-xs font-bold text-emerald-600">
                    {collaborationDetails?.participant.verificationStatus === 'verified'
                      ? 'Verified'
                      : 'Verified'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6E6A65]">Score</span>
                  <span className="text-xs font-bold text-[#1F1F1F]">
                    {collaborationDetails?.participant.score ?? activeConv.participant.score ?? '—'}
                  </span>
                </div>

                {activeConv.participant.type === 'creator' && (
                  <>
                    <div className="flex items-center justify-between text-xs text-[#6E6A65]">
                      <span>Niche</span>
                      <span className="font-bold text-[#1F1F1F] capitalize">
                        {collaborationDetails?.participant.niche || activeConv.participant.niche || 'Lifestyle'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#6E6A65]">
                      <span>Audience</span>
                      <span className="font-bold text-[#1F1F1F]">
                        {collaborationDetails?.participant.audience || 'Not available'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#6E6A65]">
                      <span>Engagement</span>
                      <span className="font-bold text-[#1F1F1F]">
                        {collaborationDetails?.participant.engagement || 'Not available'}
                      </span>
                    </div>
                    <div className="text-xs mt-3">
                      <a
                        href={`/creator/${activeConv.participant.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#A8678A] font-bold text-xs hover:underline inline-block"
                      >
                        View Portfolio →
                      </a>
                    </div>
                  </>
                )}

                {activeConv.participant.type === 'brand' && (
                  <>
                    <div className="flex items-center justify-between text-xs text-[#6E6A65]">
                      <span>Industry</span>
                      <span className="font-bold text-[#1F1F1F]">
                        {collaborationDetails?.participant.industry || activeConv.participant.industry || 'Not available'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#6E6A65]">
                      <span>Response Rate</span>
                      <span className="font-bold text-[#1F1F1F]">
                        {collaborationDetails?.participant.responseRate || 'Not available'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#6E6A65]">
                      <span>Payment</span>
                      <span className="font-bold text-[#1F1F1F]">
                        {collaborationDetails?.participant.paymentReliability || 'Verified'}
                      </span>
                    </div>
                  </>
                )}

                {/* Campaign collaboration box */}
                {collaborationDetails?.campaign ? (
                  <div className="mt-3 p-3 bg-[#F8EFF3] rounded-xl border border-[#E7E1D8] text-sm text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#1F1F1F] truncate mr-2">
                        {collaborationDetails.campaign.title}
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {collaborationDetails.campaign.status}
                      </span>
                    </div>
                    <div className="text-xs mt-2 text-[#1F1F1F]">
                      <span className="text-[#6E6A65]">Budget: </span>
                      <span className="font-bold">{collaborationDetails.campaign.budget}</span>
                    </div>
                    <div className="text-xs mt-1 text-[#1F1F1F]">
                      <span className="text-[#6E6A65]">Deliverables: </span>
                      <span className="font-medium truncate block">{collaborationDetails.campaign.deliverables}</span>
                    </div>
                    <div className="text-xs mt-1 text-[#1F1F1F]">
                      <span className="text-[#6E6A65]">Deadline: </span>
                      <span className="font-medium">{collaborationDetails.campaign.deadline}</span>
                    </div>
                    {collaborationDetails.application && (
                      <div className="text-xs mt-2 pt-2 border-t border-[#E7E1D8]/50 text-[#A8678A] font-bold capitalize">
                        Application: {collaborationDetails.application.status}
                      </div>
                    )}
                  </div>
                ) : activeConv.type === 'campaign' ? (
                  <div className="mt-3 p-3 bg-[#F8EFF3] rounded-lg border border-[#E7E1D8] text-sm text-left">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#1F1F1F]">Active Campaign</span>
                      <span className="text-[10px] text-emerald-700 font-bold">Live</span>
                    </div>
                    <div className="text-xs mt-2 text-[#6E6A65]">Direct collaboration thread.</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-[#6E6A65] py-16">
              Select a conversation to view details
            </div>
          )}
        </aside>
      </div>

      {/* New Conversation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E7E1D8] rounded-[24px] shadow-card max-w-md w-full p-6 text-left relative">
            <button
              onClick={() => {
                setShowNewModal(false);
                setNewModalError('');
              }}
              className="absolute top-4 right-4 text-[#6E6A65] hover:text-[#1F1F1F] text-lg font-bold"
            >
              ✕
            </button>

            <h3 className="text-lg font-black text-[#1F1F1F] mb-1">Start New Conversation</h3>
            <p className="text-xs text-[#6E6A65] mb-4">
              Enter the email of the Creator or Brand you want to message.
            </p>

            <form onSubmit={handleStartNewConversation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6E6A65] mb-1">
                  Partner Email Address
                </label>
                <input
                  type="email"
                  value={newTargetEmail}
                  onChange={(e) => setNewTargetEmail(e.target.value)}
                  placeholder="e.g. brand@techcorp.com"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E7E1D8] text-sm focus:outline-none focus:ring-2 focus:ring-[#A8678A]"
                />
              </div>

              {newModalError && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold">
                  {newModalError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E7E1D8] text-xs font-bold text-[#1F1F1F] hover:bg-[#F8EFF3] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newModalLoading}
                  className="flex-1 py-2.5 rounded-xl bg-[#1F1F1F] text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {newModalLoading ? 'Creating...' : 'Start Chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
