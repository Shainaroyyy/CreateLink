import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getStore } from './store';

export interface DbConversation {
  id: string;
  creator_id: string;
  brand_id: string;
  campaign_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ParticipantInfo {
  id: string;
  type: 'creator' | 'brand';
  name: string;
  avatar?: string;
  score?: number;
  niche?: string;
  audience?: string;
  engagement?: string;
  industry?: string;
  responseRate?: string;
  paymentReliability?: string;
  verificationStatus?: string;
}

export interface MessageItem {
  id: string;
  fromId: string; // 'me' or sender uuid
  toId?: string;
  text: string;
  time: string; // ISO
  read: boolean;
  senderId: string;
}

export interface ConversationItem {
  id: string;
  creatorId: string;
  brandId: string;
  campaignId?: string | null;
  participant: ParticipantInfo;
  lastMessage?: MessageItem;
  unreadCount: number;
  messages: MessageItem[];
  type: 'direct' | 'campaign';
  updatedAt: string;
}

export interface CollaborationDetails {
  participant: ParticipantInfo;
  campaign?: {
    id: string;
    title: string;
    description?: string;
    status: string;
    budget?: string;
    deliverables?: string;
    deadline?: string;
  } | null;
  application?: {
    id: string;
    status: string;
    matchScore?: number;
  } | null;
}

/**
 * Format raw DB message to frontend MessageItem
 */
export function mapDbMessageToItem(msg: DbMessage, currentUserId: string): MessageItem {
  return {
    id: msg.id,
    fromId: msg.sender_id === currentUserId ? 'me' : msg.sender_id,
    senderId: msg.sender_id,
    text: msg.content,
    time: msg.created_at,
    read: msg.is_read,
  };
}

/**
 * Resolve participant metadata from profiles, creator_profiles, and brand_profiles dynamically.
 * Never hardcodes 'brand' or 'creator' — detects the true role from database tables.
 */
export async function resolveParticipant(
  participantId: string,
  roleHint?: 'creator' | 'brand'
): Promise<ParticipantInfo> {
  let detectedRole: 'creator' | 'brand' = roleHint || 'creator';
  let name = 'User';
  let avatar: string | undefined;
  let score: number | undefined;
  let niche = 'Lifestyle';
  let industry: string | undefined;
  let verificationStatus = 'Unverified';

  try {
    // 1. Check profiles table for real user role and display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', participantId)
      .maybeSingle();

    if (profile) {
      if (profile.role === 'brand' || profile.role === 'creator') {
        detectedRole = profile.role;
      }
      if (profile.display_name) name = profile.display_name;
      if (profile.company_name && detectedRole === 'brand') name = profile.company_name;
      if (profile.industry) industry = profile.industry;
      if (profile.verification_status) verificationStatus = profile.verification_status;
      if (profile.avatar_url) avatar = profile.avatar_url;
    }

    // 2. Check creator_profiles table
    const { data: creatorProfile } = await supabase
      .from('creator_profiles')
      .select('*')
      .eq('id', participantId)
      .maybeSingle();

    if (creatorProfile) {
      detectedRole = 'creator';
      if (creatorProfile.name) name = creatorProfile.name;
      if (creatorProfile.category) niche = creatorProfile.category;
      if (creatorProfile.trust_score != null) score = creatorProfile.trust_score;
      if (creatorProfile.avatar_url && !avatar) avatar = creatorProfile.avatar_url;
    } else {
      // 3. Check brand_profiles table
      const { data: brandProfile } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('id', participantId)
        .maybeSingle();

      if (brandProfile) {
        detectedRole = 'brand';
        if (brandProfile.company_name) name = brandProfile.company_name;
        if (brandProfile.logo_url && !avatar) avatar = brandProfile.logo_url;
        if (brandProfile.industry) industry = brandProfile.industry;
      }
    }
  } catch (err) {
    console.warn('Error resolving participant profile:', err);
  }

  // Fallback to store if available
  if (name === 'User' || !name) {
    const creatorFromStore = getStore().creators.get(participantId);
    if (creatorFromStore) {
      name = creatorFromStore.displayName;
      detectedRole = 'creator';
      niche = creatorFromStore.contentCategories[0] || 'Lifestyle';
      if (!avatar) avatar = creatorFromStore.avatarUrl;
      score = creatorFromStore.trustScore;
    }
  }

  if (!avatar) {
    avatar =
      detectedRole === 'brand'
        ? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`;
  }

  return {
    id: participantId,
    type: detectedRole,
    name,
    avatar,
    score,
    niche: detectedRole === 'creator' ? `${niche.charAt(0).toUpperCase() + niche.slice(1)} Creator` : undefined,
    industry,
    verificationStatus,
    audience: 'Not available',
    engagement: 'Not available',
    responseRate: detectedRole === 'brand' ? 'Not available' : undefined,
    paymentReliability: detectedRole === 'brand' ? 'Verified' : undefined,
  };
}

/**
 * Fetch all conversations for the authenticated user with unread counts and latest messages.
 */
export async function fetchUserConversations(currentUserId: string): Promise<ConversationItem[]> {
  if (!isSupabaseConfigured) return [];

  try {
    // 1. Fetch conversations where user is creator OR brand
    const { data: convRows, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .or(`creator_id.eq.${currentUserId},brand_id.eq.${currentUserId}`)
      .order('updated_at', { ascending: false });

    if (convError) {
      console.warn('Error fetching conversations:', convError.message);
      return [];
    }

    if (!convRows || convRows.length === 0) return [];

    // Filter out conversations with oneself if any were accidentally created
    const validConvRows = convRows.filter((c) => c.creator_id !== c.brand_id);
    const effectiveConvRows = validConvRows.length > 0 ? validConvRows : convRows;

    const convIds = effectiveConvRows.map((c) => c.id);

    // 2. Fetch messages for all these conversations in one batch query
    const { data: msgRows, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.warn('Error fetching messages for conversations:', msgError.message);
    }

    // Group messages by conversation_id
    const messagesByConv = new Map<string, DbMessage[]>();
    for (const msg of msgRows || []) {
      const list = messagesByConv.get(msg.conversation_id) || [];
      list.push(msg);
      messagesByConv.set(msg.conversation_id, list);
    }

    // 3. Collect unique other participant IDs
    const otherParticipantIds = new Set<string>();
    const campaignIds = new Set<string>();

    for (const c of effectiveConvRows) {
      const otherId = c.creator_id === currentUserId ? c.brand_id : c.creator_id;
      otherParticipantIds.add(otherId);
      if (c.campaign_id) campaignIds.add(c.campaign_id);
    }

    // 4. Batch resolve participants dynamically
    const resolvedParticipants = new Map<string, ParticipantInfo>();
    await Promise.all(
      Array.from(otherParticipantIds).map(async (id) => {
        const info = await resolveParticipant(id);
        resolvedParticipants.set(id, info);
      })
    );

    // 5. Construct conversation items
    const results: ConversationItem[] = effectiveConvRows.map((c) => {
      const otherId = c.creator_id === currentUserId ? c.brand_id : c.creator_id;
      const participant = resolvedParticipants.get(otherId) || {
        id: otherId,
        type: 'creator' as const,
        name: 'Creator Partner',
      };

      const msgs = messagesByConv.get(c.id) || [];
      const mappedMsgs = msgs.map((m) => mapDbMessageToItem(m, currentUserId));
      const lastMsg = mappedMsgs.length > 0 ? mappedMsgs[mappedMsgs.length - 1] : undefined;

      const unreadCount = msgs.filter(
        (m) => !m.is_read && m.sender_id !== currentUserId
      ).length;

      return {
        id: c.id,
        creatorId: c.creator_id,
        brandId: c.brand_id,
        campaignId: c.campaign_id,
        participant,
        lastMessage: lastMsg,
        unreadCount,
        messages: mappedMsgs,
        type: c.campaign_id ? 'campaign' : 'direct',
        updatedAt: c.updated_at || c.created_at,
      };
    });

    // 6. Sort by most recent message or updated_at
    results.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.time).getTime() : new Date(a.updatedAt).getTime();
      const timeB = b.lastMessage ? new Date(b.lastMessage.time).getTime() : new Date(b.updatedAt).getTime();
      return timeB - timeA;
    });

    return results;
  } catch (err) {
    console.error('Failed to load user conversations:', err);
    return [];
  }
}

/**
 * Fetch messages for a specific conversation ordered chronologically.
 */
export async function fetchConversationMessages(
  conversationId: string,
  currentUserId: string
): Promise<MessageItem[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Error fetching conversation messages:', error.message);
    return [];
  }

  return (data || []).map((m) => mapDbMessageToItem(m, currentUserId));
}

/**
 * Send a message into an active conversation.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<DbMessage> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Message content cannot be empty.');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: trimmed,
      is_read: false,
    })
    .select('*')
    .single();

  if (error) throw error;

  // Touch updated_at on conversation
  try {
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  } catch (err) {
    console.warn('Failed to update conversation timestamp:', err);
  }

  return data;
}

/**
 * Mark all incoming unread messages as read for a given conversation.
 */
export async function markMessagesAsRead(
  conversationId: string,
  currentUserId: string
): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .eq('is_read', false)
      .neq('sender_id', currentUserId);

    if (error) {
      console.warn('Error marking messages as read:', error.message);
    }
  } catch (err) {
    console.warn('Error in markMessagesAsRead:', err);
  }
}

/**
 * Fetch collaboration details for right sidebar: participant, linked campaign, and application.
 */
export async function fetchCollaborationDetails(
  creatorId: string,
  brandId: string,
  campaignId?: string | null,
  currentUserId?: string
): Promise<CollaborationDetails> {
  const isCreator = currentUserId === creatorId;
  const otherId = isCreator ? brandId : creatorId;
  const otherRole: 'creator' | 'brand' = isCreator ? 'brand' : 'creator';

  const participant = await resolveParticipant(otherId, otherRole);

  let campaign: CollaborationDetails['campaign'] = null;
  let application: CollaborationDetails['application'] = null;

  if (campaignId) {
    try {
      const { data: campRow } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle();

      if (campRow) {
        campaign = {
          id: campRow.id,
          title: campRow.title,
          description: campRow.description,
          status: campRow.status || 'Active',
          budget: campRow.budget
            ? `$${campRow.budget}`
            : campRow.compensation_amount
            ? `$${campRow.compensation_amount}`
            : 'Not specified',
          deliverables: campRow.requirements || campRow.description || 'Not specified',
          deadline: campRow.deadline
            ? new Date(campRow.deadline).toISOString().split('T')[0]
            : 'Not specified',
        };
      }

      // Check for application record between creator and campaign
      const { data: appRow } = await supabase
        .from('applications')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('creator_id', creatorId)
        .maybeSingle();

      if (appRow) {
        application = {
          id: appRow.id,
          status: appRow.status,
          matchScore: appRow.collaboration_match_score,
        };
      }
    } catch (err) {
      console.warn('Error fetching campaign or application for collaboration details:', err);
    }
  }

  return {
    participant,
    campaign,
    application,
  };
}

/**
 * Retrieve or create a conversation between creator, brand, and optional campaign.
 * Prevents duplicate conversations for the same combination.
 */
export async function getOrCreateConversation(
  userAId: string,
  userBId: string,
  campaignId?: string | null
): Promise<DbConversation> {
  if (!userAId || !userBId) throw new Error('Both participants are required to start a conversation.');

  // Try finding existing conversation in either direction
  let query = supabase
    .from('conversations')
    .select('*')
    .or(
      `and(creator_id.eq.${userAId},brand_id.eq.${userBId}),and(creator_id.eq.${userBId},brand_id.eq.${userAId})`
    );

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  } else {
    query = query.is('campaign_id', null);
  }

  const { data: existingRows } = await query;
  if (existingRows && existingRows.length > 0) {
    return existingRows[0] as DbConversation;
  }

  const insertPayload = {
    creator_id: userAId,
    brand_id: userBId,
    campaign_id: campaignId ?? null,
  };

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert(insertPayload)
    .select('*')
    .single();

  if (insertError) {
    const { data: retry } = await query;
    if (retry && retry.length > 0) return retry[0] as DbConversation;
    throw insertError;
  }

  return created as DbConversation;
}
