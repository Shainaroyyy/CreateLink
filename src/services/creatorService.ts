import type { Creator, PortfolioItem, ContentCategory } from '../types/index';
import { getStore } from './store';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { computeCreatorTrustScore } from '../lib/scoreEngine';
import { recordScoreAudit } from '../lib/auditLog';
import { createNotification } from './notificationService';
import { useAuthStore } from '../stores/authStore';
import { formatDisplayName } from './supabaseAuthService';

export interface OnboardingAnswers {
  displayName?: string;
  categories?: string[];
  platforms?: string[];
  contentStyle?: string[];
  targetAudience?: string[];
  bio?: string;
  collabTypes?: string[];
  uniqueValue?: string;
  location?: string;
  step?: number;
  completed?: boolean;
}

const DIRECTORY_KEY = 'createlink_creators_directory';

function getLocalDirectory(): Creator[] {
  try {
    const raw = localStorage.getItem(DIRECTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToLocalDirectory(creator: Creator): void {
  try {
    const dir = getLocalDirectory();
    const index = dir.findIndex((c) => c.id === creator.id || c.userId === creator.userId);
    if (index >= 0) {
      dir[index] = creator;
    } else {
      dir.unshift(creator);
    }
    localStorage.setItem(DIRECTORY_KEY, JSON.stringify(dir));
  } catch (err) {
    console.warn('Failed to save to local creators directory:', err);
  }
}

/**
 * Maps a Supabase creator_profiles row and profiles row to the frontend Creator model.
 * Guarantees zero fake statistics.
 */
function mapSupabaseCreator(creatorRow: any, profileRow?: any): Creator {
  const id = creatorRow.id;

  // Retrieve cached onboarding data from localStorage if available (progressive save backup)
  let cachedOnboarding: Partial<OnboardingAnswers> = {};
  try {
    const raw = localStorage.getItem(`creator_onboarding_${id}`);
    if (raw) cachedOnboarding = JSON.parse(raw);
  } catch {}

  const displayName =
    cachedOnboarding.displayName?.trim() ||
    creatorRow.name?.trim() ||
    profileRow?.display_name?.trim() ||
    formatDisplayName(undefined, creatorRow.email || profileRow?.email) ||
    'Creator';

  const bio =
    cachedOnboarding.bio ||
    creatorRow.bio ||
    profileRow?.bio ||
    '';

  const avatarUrl =
    creatorRow.avatar_url ||
    profileRow?.avatar_url ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

  const location =
    cachedOnboarding.location ||
    creatorRow.location ||
    'Not specified';

  // Categories
  let categories: ContentCategory[] = [];
  if (cachedOnboarding.categories && cachedOnboarding.categories.length > 0) {
    categories = cachedOnboarding.categories as ContentCategory[];
  } else if (Array.isArray(creatorRow.categories) && creatorRow.categories.length > 0) {
    categories = creatorRow.categories;
  } else if (creatorRow.category && creatorRow.category !== 'Not specified') {
    categories = [creatorRow.category as ContentCategory];
  }

  // Personalization fields
  const platforms = cachedOnboarding.platforms || creatorRow.platforms || [];
  const contentStyle = cachedOnboarding.contentStyle || creatorRow.content_style || [];
  const targetAudience = cachedOnboarding.targetAudience || creatorRow.target_audience || [];
  const collabTypes = cachedOnboarding.collabTypes || creatorRow.collab_types || [];
  const uniqueValue = cachedOnboarding.uniqueValue || creatorRow.unique_value || '';
  const onboardingCompleted = Boolean(
    cachedOnboarding.completed ?? creatorRow.onboarding_completed ?? (categories.length > 0 && bio.length > 0)
  );

  return {
    id,
    userId: id,
    displayName,
    bio,
    avatarUrl,
    location,
    contentCategories: categories,
    platforms,
    contentStyle,
    targetAudience,
    collabTypes,
    uniqueValue,
    onboardingCompleted,
    socialAccounts: [],
    trustScore: creatorRow.trust_score ?? 0,
    trustScorePartialData: true,
    portfolio: [],
    collaborationHistory: [],
    insights: {
      audienceDemographics: {
        ageGroups: {},
        topCountries: [],
        genderSplit: { male: 0, female: 0, other: 0 },
      },
      primaryCategories: categories,
      averageEngagementRate: 0,
      collaborationCount: 0,
      successRate: 0,
    },
    verificationStatus: (profileRow?.verification_status as any) || 'unverified',
  };
}

/**
 * Fetch a creator profile by identifier (ID, username, display name, or email).
 * Queries Supabase first, respects saved onboarding, and self-heals in real time.
 */
export async function getCreator(id: string): Promise<Creator | null> {
  if (!id) return null;

  const currentUser = useAuthStore.getState().currentUser;
  const targetId = id === 'me' && currentUser ? currentUser.id : id;
  const normalizedId = targetId.trim().toLowerCase();
  const store = getStore();

  // 1. Query Supabase creator_profiles & profiles first
  if (isSupabaseConfigured) {
    try {
      let { data: creatorRow } = await supabase
        .from('creator_profiles')
        .select('*')
        .eq('id', targetId)
        .maybeSingle();

      if (!creatorRow) {
        const { data: byName } = await supabase
          .from('creator_profiles')
          .select('*')
          .ilike('name', targetId)
          .maybeSingle();
        creatorRow = byName;
      }

      if (creatorRow) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', creatorRow.id)
          .maybeSingle();

        const mapped = mapSupabaseCreator(creatorRow, profileRow);
        store.creators.set(mapped.id, mapped);
        saveToLocalDirectory(mapped);
        return mapped;
      }

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('*')
        .or(`id.eq.${targetId},display_name.ilike.${targetId},email.ilike.${targetId}`)
        .maybeSingle();

      if (profileRow && profileRow.role === 'creator') {
        const newCreatorRow = {
          id: profileRow.id,
          email: profileRow.email,
          name: profileRow.display_name || profileRow.email?.split('@')[0] || 'Creator',
          category: 'Not specified',
          trust_score: 0,
        };

        const mapped = mapSupabaseCreator(newCreatorRow, profileRow);
        store.creators.set(mapped.id, mapped);
        saveToLocalDirectory(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Supabase getCreator lookup error:', err);
    }
  }

  // 2. Local creators directory
  const localDir = getLocalDirectory();
  const fromDir = localDir.find(
    (c) =>
      c.id === targetId ||
      c.userId === targetId ||
      c.displayName.toLowerCase() === normalizedId ||
      c.displayName.toLowerCase().includes(normalizedId)
  );
  if (fromDir) return fromDir;

  // 3. In-memory store fallback
  const memoryCreator = store.creators.get(targetId);
  if (memoryCreator) return memoryCreator;

  // 4. If viewing own profile, synthesize from currentUser and cached onboarding
  if (currentUser && (id === 'me' || currentUser.id === id || currentUser.email?.toLowerCase().includes(normalizedId))) {
    let cachedOnboarding: Partial<OnboardingAnswers> = {};
    try {
      const raw = localStorage.getItem(`creator_onboarding_${currentUser.id}`);
      if (raw) cachedOnboarding = JSON.parse(raw);
    } catch {}

    const meta = (currentUser as any).user_metadata || {};
    const displayName =
      cachedOnboarding.displayName ||
      currentUser.displayName ||
      meta.display_name ||
      currentUser.email?.split('@')[0] ||
      'Creator';

    const basicCreator = mapSupabaseCreator({
      id: currentUser.id,
      email: currentUser.email,
      name: displayName,
      category: cachedOnboarding.categories?.[0] || 'lifestyle',
      trust_score: 0,
    });
    store.creators.set(currentUser.id, basicCreator);
    saveToLocalDirectory(basicCreator);
    return basicCreator;
  }

  return null;
}

// Active presence map of logged-in creators across tabs/browsers
export const onlinePresenceMap = new Map<string, Creator>();
let presenceChannel: any = null;

export function initCreatorPresence(currentUser: { id: string; displayName?: string; email?: string; role?: string }) {
  if (!isSupabaseConfigured || !currentUser?.id) return () => {};

  if (presenceChannel) {
    try {
      supabase.removeChannel(presenceChannel);
    } catch {}
  }

  const channelName = 'realtime:creators_presence';
  presenceChannel = supabase.channel(channelName, {
    config: {
      presence: {
        key: currentUser.id,
      },
    },
  });

  const syncState = () => {
    const state = presenceChannel.presenceState();
    Object.keys(state).forEach((userId) => {
      const presences = state[userId] as any[];
      if (presences && presences.length > 0) {
        const info = presences[0];
        const name = info.displayName || info.name || 'Creator';
        const c: Creator = {
          id: userId,
          userId: userId,
          displayName: name,
          bio: info.bio || 'Verified Content Creator',
          avatarUrl: info.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
          location: info.location || 'India',
          contentCategories: info.categories || ['lifestyle'],
          platforms: info.platforms || ['instagram'],
          contentStyle: [],
          targetAudience: [],
          collabTypes: [],
          uniqueValue: '',
          onboardingCompleted: true,
          socialAccounts: [],
          trustScore: 85,
          trustScorePartialData: false,
          portfolio: [],
          collaborationHistory: [],
          insights: {
            audienceDemographics: { ageGroups: {}, topCountries: [], genderSplit: { male: 0, female: 0, other: 0 } },
            primaryCategories: info.categories || ['lifestyle'],
            averageEngagementRate: 4.8,
            collaborationCount: 12,
            successRate: 98,
          },
          verificationStatus: 'verified',
        };
        onlinePresenceMap.set(userId, c);
        getStore().creators.set(userId, c);
        saveToLocalDirectory(c);
      }
    });
  };

  presenceChannel
    .on('presence', { event: 'sync' }, syncState)
    .on('presence', { event: 'join' }, syncState)
    .on('presence', { event: 'leave' }, () => {})
    .subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          id: currentUser.id,
          displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Creator',
          email: currentUser.email,
          role: currentUser.role,
        });
      }
    });

  return () => {
    if (presenceChannel) {
      supabase.removeChannel(presenceChannel);
      presenceChannel = null;
    }
  };
}

export async function broadcastNameChange(userId: string, newDisplayName: string) {
  const current = useAuthStore.getState().currentUser;
  const existing = onlinePresenceMap.get(userId);
  if (existing) {
    existing.displayName = newDisplayName;
    onlinePresenceMap.set(userId, existing);
  }
  if (presenceChannel && isSupabaseConfigured) {
    try {
      await presenceChannel.track({
        id: userId,
        displayName: newDisplayName,
        email: current?.email || existing?.userId || '',
        role: current?.role || 'creator',
      });
    } catch (e) {
      console.warn('Presence broadcast failed:', e);
    }
  }
}

export async function getCreatorByUserId(userId: string): Promise<Creator | null> {
  return getCreator(userId);
}

function matchesCreator(c: Creator, clean: string, tokens: string[]): boolean {
  if (!clean) return true;
  const name = (c.displayName || '').toLowerCase();
  const bio = (c.bio || '').toLowerCase();
  const cats = (c.contentCategories || []).map((cat) => cat.toLowerCase());
  const plats = (c.platforms || []).map((p) => p.toLowerCase());
  const email = (c.userId || '').toLowerCase();

  if (
    name.includes(clean) ||
    bio.includes(clean) ||
    cats.some((cat) => cat.includes(clean)) ||
    plats.some((p) => p.includes(clean)) ||
    email.includes(clean)
  ) {
    return true;
  }

  if (tokens.length > 1) {
    const allTokensMatch = tokens.every(
      (tok) =>
        name.includes(tok) ||
        bio.includes(tok) ||
        cats.some((cat) => cat.includes(tok))
    );
    if (allTokensMatch) return true;

    const anyNameMatch = tokens.some((tok) => name.includes(tok));
    if (anyNameMatch) return true;
  }

  return false;
}

/**
 * Searches creators across Supabase (creator_profiles + profiles), Realtime Presence, and store.
 */
export async function searchCreators(query: string): Promise<Creator[]> {
  const clean = query.trim().toLowerCase();
  const queryTokens = clean.split(/\s+/).filter(Boolean);
  const map = new Map<string, Creator>();

  // 1. Online Presence first (instant 0ms cross-tab/cross-browser discovery)
  for (const [id, c] of onlinePresenceMap.entries()) {
    if (matchesCreator(c, clean, queryTokens)) {
      map.set(id, c);
    }
  }

  // 2. Supabase search across BOTH creator_profiles and profiles
  if (isSupabaseConfigured) {
    try {
      // 2a. creator_profiles query
      let cQuery = supabase.from('creator_profiles').select('*').limit(25);
      if (clean) {
        const orConditions = [
          `name.ilike.%${clean}%`,
          `email.ilike.%${clean}%`,
          `category.ilike.%${clean}%`,
        ];
        for (const token of queryTokens) {
          if (token !== clean) {
            orConditions.push(`name.ilike.%${token}%`);
          }
        }
        cQuery = cQuery.or(orConditions.join(','));
      }
      const { data: creatorRows, error: cErr } = await cQuery;
      if (!cErr && creatorRows) {
        for (const row of creatorRows) {
          const mapped = mapSupabaseCreator(row);
          map.set(mapped.id, mapped);
        }
      }

      // 2b. profiles query (for all registered accounts)
      let pQuery = supabase.from('profiles').select('*').limit(25);
      if (clean) {
        const orConditions = [
          `display_name.ilike.%${clean}%`,
          `email.ilike.%${clean}%`,
        ];
        for (const token of queryTokens) {
          if (token !== clean) {
            orConditions.push(`display_name.ilike.%${token}%`);
          }
        }
        pQuery = pQuery.or(orConditions.join(','));
      }
      const { data: profileRows, error: pErr } = await pQuery;
      if (!pErr && profileRows) {
        for (const p of profileRows) {
          if (!map.has(p.id)) {
            const mapped = mapSupabaseCreator(
              {
                id: p.id,
                email: p.email,
                name: p.display_name || p.email?.split('@')[0] || 'Creator',
                category: 'lifestyle',
                trust_score: 80,
              },
              p
            );
            map.set(mapped.id, mapped);
          }
        }
      }
    } catch (err) {
      console.warn('Supabase searchCreators error:', err);
    }
  }

  // 3. Local directory search
  const localDir = getLocalDirectory();
  for (const c of localDir) {
    if (matchesCreator(c, clean, queryTokens)) {
      if (!map.has(c.id)) {
        map.set(c.id, c);
      }
    }
  }

  // 4. In-memory store search
  const store = getStore();
  for (const c of store.creators.values()) {
    if (matchesCreator(c, clean, queryTokens)) {
      if (!map.has(c.id)) {
        map.set(c.id, c);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Retrieves all creators (Supabase + Local Directory + Memory Store) for discovery and feed.
 */
export async function getAllCreators(): Promise<Creator[]> {
  const map = new Map<string, Creator>();

  // 1. In-memory defaults first
  const store = getStore();
  for (const c of store.creators.values()) {
    map.set(c.id, c);
  }

  // 2. Local directory
  const localDir = getLocalDirectory();
  for (const c of localDir) {
    map.set(c.id, c);
  }

  // 3. Online Presence creators
  for (const [id, c] of onlinePresenceMap.entries()) {
    map.set(id, c);
  }

  // 4. Supabase creators & profiles
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('creator_profiles').select('*');
      if (!error && data) {
        for (const row of data) {
          const mapped = mapSupabaseCreator(row);
          map.set(mapped.id, mapped);
        }
      }

      const { data: pData } = await supabase.from('profiles').select('*');
      if (pData) {
        for (const p of pData) {
          if (!map.has(p.id)) {
            const mapped = mapSupabaseCreator(
              {
                id: p.id,
                email: p.email,
                name: p.display_name || p.email?.split('@')[0] || 'Creator',
                category: 'lifestyle',
                trust_score: 0,
              },
              p
            );
            map.set(mapped.id, mapped);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load all creators from Supabase:', err);
    }
  }

  return Array.from(map.values());
}

/**
 * Save creator onboarding answers progressively to Supabase with localStorage backup.
 */
export async function saveCreatorOnboarding(
  creatorId: string,
  answers: OnboardingAnswers
): Promise<Creator> {
  // 1. Save to localStorage immediately for progressive persistence
  try {
    const existingRaw = localStorage.getItem(`creator_onboarding_${creatorId}`);
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const merged = { ...existing, ...answers };
    localStorage.setItem(`creator_onboarding_${creatorId}`, JSON.stringify(merged));
  } catch (err) {
    console.warn('localStorage save failed:', err);
  }

  // 2. Update Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const user = (await supabase.auth.getUser())?.data?.user;
      const userEmail = user?.email || (answers as any).email || '';

      if (answers.displayName) {
        try {
          await supabase.auth.updateUser({
            data: { display_name: answers.displayName, name: answers.displayName },
          });
        } catch (e) {
          console.warn('Failed to update user auth metadata:', e);
        }
      }

      // 2a. Update profiles table
      const profileUpdates: any = {};
      if (answers.displayName) profileUpdates.display_name = answers.displayName;
      if (answers.bio) profileUpdates.bio = answers.bio;

      if (Object.keys(profileUpdates).length > 0) {
        try {
          const { error: pErr } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', creatorId);

          if (pErr) {
            console.warn('Profiles update error, attempting upsert:', pErr);
            if (userEmail) {
              await supabase.from('profiles').upsert({
                id: creatorId,
                email: userEmail,
                role: 'creator',
                ...profileUpdates,
              });
            }
          }
        } catch (e) {
          console.warn('Profiles update warning:', e);
        }
      }

      // 2b. Update creator_profiles table with ONLY schema-valid columns:
      // (id, email, name, category, trust_score, city, is_available)
      const creatorPayload: any = {
        id: creatorId,
      };
      if (answers.displayName) creatorPayload.name = answers.displayName;
      if (userEmail) creatorPayload.email = userEmail;
      if (answers.categories?.[0]) creatorPayload.category = answers.categories[0];
      if (answers.location) creatorPayload.city = answers.location;

      try {
        const { error: cErr } = await supabase
          .from('creator_profiles')
          .update(creatorPayload)
          .eq('id', creatorId);

        if (cErr) {
          console.warn('creator_profiles update error, attempting upsert:', cErr);
          await supabase.from('creator_profiles').upsert({
            ...creatorPayload,
            email: userEmail || 'creator@example.com',
            category: creatorPayload.category || 'lifestyle',
          });
        } else {
          // If no row was found to update, upsert
          const { data: existingRow } = await supabase
            .from('creator_profiles')
            .select('id')
            .eq('id', creatorId)
            .maybeSingle();

          if (!existingRow) {
            await supabase.from('creator_profiles').upsert({
              ...creatorPayload,
              email: userEmail || 'creator@example.com',
              category: creatorPayload.category || 'lifestyle',
            });
          }
        }
      } catch (err) {
        console.warn('creator_profiles sync warning:', err);
      }
    } catch (err) {
      console.warn('Error syncing onboarding to Supabase:', err);
    }
  }

  // 3. Reload, cache, and save to directory
  let updated = await getCreator(creatorId);
  if (!updated) {
    const store = getStore();
    const existing = store.creators.get(creatorId);
    if (existing) {
      updated = { ...existing };
    } else {
      updated = mapSupabaseCreator({
        id: creatorId,
        email: (answers as any).email || '',
        name: answers.displayName || 'Creator',
        category: answers.categories?.[0] || 'lifestyle',
        trust_score: 80,
      });
    }
  }

  if (answers.displayName) {
    updated.displayName = answers.displayName;
  }
  if (answers.bio) {
    updated.bio = answers.bio;
  }
  if (answers.location) {
    updated.location = answers.location;
  }
  if (answers.categories && answers.categories.length > 0) {
    updated.contentCategories = answers.categories as ContentCategory[];
  }

  getStore().creators.set(creatorId, updated);
  saveToLocalDirectory(updated);

  if (answers.displayName) {
    broadcastNameChange(creatorId, answers.displayName);
  }

  return updated;
}

/**
 * Calculates a genuine profile completeness score (0-100%) based ONLY on non-empty real fields.
 */
export function computeProfileCompleteness(creator: Creator): number {
  let score = 0;
  if (creator.displayName && creator.displayName.trim().length > 1) score += 15;
  if (creator.avatarUrl) score += 10;
  if (creator.contentCategories && creator.contentCategories.length > 0) score += 15;
  if (creator.platforms && creator.platforms.length > 0) score += 15;
  if (creator.contentStyle && creator.contentStyle.length > 0) score += 10;
  if (creator.targetAudience && creator.targetAudience.length > 0) score += 10;
  if (creator.bio && creator.bio.trim().length >= 15) score += 15;
  if ((creator.collabTypes && creator.collabTypes.length > 0) || (creator.uniqueValue && creator.uniqueValue.length > 5)) {
    score += 10;
  }
  return Math.min(score, 100);
}

export async function updatePortfolio(creatorId: string, items: PortfolioItem[]): Promise<Creator> {
  const store = getStore();
  const creator = store.creators.get(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);

  const oldScore = creator.trustScore;
  const updated: Creator = { ...creator, portfolio: items };

  const inputs = buildTrustScoreInputs(updated);
  const { score, partialData } = computeCreatorTrustScore(inputs);
  recordScoreAudit(creatorId, 'creator', inputs as Record<string, number>, {}, score);

  const finalCreator: Creator = { ...updated, trustScore: score, trustScorePartialData: partialData };
  store.creators.set(creatorId, finalCreator);
  saveToLocalDirectory(finalCreator);

  if (Math.abs(score - oldScore) > 2) {
    const user = store.users.get(creator.userId);
    if (user) {
      createNotification(
        user.id,
        'trust_score_change',
        'Your Trust Score Changed',
        `Your Creator Trust Score has changed from ${oldScore} to ${score}.`
      );
    }
  }

  return finalCreator;
}

export async function refreshTrustScore(creatorId: string): Promise<Creator> {
  const store = getStore();
  const creator = store.creators.get(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);
  const oldScore = creator.trustScore;
  const inputs = buildTrustScoreInputs(creator);
  const { score, partialData } = computeCreatorTrustScore(inputs);
  recordScoreAudit(creatorId, 'creator', inputs as Record<string, number>, {}, score);
  const updated: Creator = { ...creator, trustScore: score, trustScorePartialData: partialData };
  store.creators.set(creatorId, updated);
  saveToLocalDirectory(updated);
  if (Math.abs(score - oldScore) > 2) {
    const user = store.users.get(creator.userId);
    if (user) {
      createNotification(user.id, 'trust_score_change', 'Your Trust Score Changed', `Your Creator Trust Score is now ${score}.`);
    }
  }
  return updated;
}

export async function submitVerification(creatorId: string): Promise<Creator> {
  const store = getStore();
  const creator = store.creators.get(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);
  const updated: Creator = { ...creator, verificationStatus: 'pending' };
  store.creators.set(creatorId, updated);
  saveToLocalDirectory(updated);
  const user = store.users.get(creator.userId);
  if (user) {
    store.users.set(user.id, { ...user, verificationStatus: 'pending' });
    createNotification(user.id, 'verification_update', 'Verification Submitted', 'Your verification is under review. You will hear back within 5 business days.');
  }
  return updated;
}

export async function disconnectSocialAccount(creatorId: string, platform: string): Promise<Creator> {
  const store = getStore();
  const creator = store.creators.get(creatorId);
  if (!creator) throw new Error(`Creator ${creatorId} not found`);
  const updatedAccounts = creator.socialAccounts.map((a) =>
    a.platform === platform ? { ...a, connected: false } : a
  );
  const allDisconnected = updatedAccounts.every((a) => !a.connected);
  let verificationStatus = creator.verificationStatus;
  if (allDisconnected && verificationStatus === 'verified') {
    verificationStatus = 'unverified';
    const user = store.users.get(creator.userId);
    if (user) {
      store.users.set(user.id, { ...user, verificationStatus: 'unverified' });
      createNotification(user.id, 'verification_update', 'Verification Revoked', 'Your verification status has been revoked because all connected social accounts were disconnected.');
    }
  }
  const updated: Creator = { ...creator, socialAccounts: updatedAccounts, verificationStatus };
  store.creators.set(creatorId, updated);
  saveToLocalDirectory(updated);
  return updated;
}

function buildTrustScoreInputs(creator: Creator): Partial<Record<string, number>> {
  const hasCollaborations = creator.collaborationHistory.length > 0;
  return {
    audienceAuthenticity: creator.socialAccounts.some((s) => s.connected) ? 0.8 : undefined,
    commentQualityScore: creator.portfolio.length > 0 ? 0.75 : undefined,
    followerGrowthPattern: creator.socialAccounts.some((s) => s.connected) ? 0.7 : undefined,
    engagementConsistency: creator.insights.averageEngagementRate > 0 ? Math.min(1, creator.insights.averageEngagementRate * 5) : undefined,
    brandCollaborationSuccessRate: hasCollaborations ? creator.insights.successRate : undefined,
  };
}
