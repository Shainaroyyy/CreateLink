import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import creatorsData from '../data/creators.json';

export interface Reel {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string;
  videoUrl: string;
  metrics: {
    views: number;
    likes: number;
    comments: number;
    engagementRate: number;
  };
  createdAt: string;
  campaignId: string | null;
}

// Default hardcoded reel for Maya Chen (creator-1)
const HARDCODED_REEL: Reel = {
  id: 'hardcoded-dotandkey-reel',
  title: 'Dot and Key Collaboration',
  description: 'A fun and authentic collaboration with Dot & Key Skincare — showcasing their sunscreen range with a real daily-use review. Achieved over 120K organic views and 9.7% engagement rate.',
  category: 'beauty',
  thumbnailUrl: '',
  videoUrl: '/instareel.mp4',
  metrics: { views: 120000, likes: 9800, comments: 1200, engagementRate: 0.097 },
  createdAt: '2024-03-15T10:00:00Z',
  campaignId: 'camp-1',
};

// Seed fallback reels for a creator using their JSON database portfolio items
function getFallbackSeedReels(creatorId: string): Reel[] {
  const creator = (creatorsData as any[]).find(c => c.id === creatorId);
  if (!creator) return [];

  const portfolioReels: Reel[] = (creator.portfolio || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    description: item.description || '',
    category: item.category || 'lifestyle',
    thumbnailUrl: item.mediaUrl || '',
    videoUrl: '',
    metrics: {
      views: item.metrics?.views ?? 0,
      likes: item.metrics?.likes ?? 0,
      comments: item.metrics?.comments ?? 0,
      engagementRate: item.metrics?.engagementRate ?? 0,
    },
    createdAt: item.createdAt || new Date().toISOString(),
    campaignId: item.campaignId || null,
  }));

  if (creatorId === 'creator-1') {
    const deduped = portfolioReels.filter(r => r.id !== HARDCODED_REEL.id);
    return [HARDCODED_REEL, ...deduped];
  }
  return portfolioReels;
}

/**
 * Fetch reels for a specific creator.
 * Tries Supabase first, falls back to localStorage / seed data on error/absence of credentials.
 */
export async function fetchReels(creatorId: string, fallbackPortfolio?: any[]): Promise<Reel[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('creator_reels')
        .select('*')
        .eq('creator_id', creatorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetch failed, falling back to local storage:', error.message);
      } else if (data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description || '',
          category: row.category || 'lifestyle',
          thumbnailUrl: row.thumbnail_url || '',
          videoUrl: row.video_url,
          metrics: row.metrics || { views: 0, likes: 0, comments: 0, engagementRate: 0 },
          createdAt: row.created_at,
          campaignId: row.campaign_id || null,
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch from Supabase:', e);
    }
  }

  // Fallback: Read from LocalStorage
  const lsKey = `reels-${creatorId}`;
  const stored = localStorage.getItem(lsKey);
  if (stored) {
    try {
      return JSON.parse(stored) as Reel[];
    } catch {
      // Ignore parse error and proceed to seeding
    }
  }

  // Fallback Seed
  const seeded = fallbackPortfolio
    ? fallbackPortfolio.map(item => ({
        id: item.id || `reel-${Date.now()}-${Math.random()}`,
        title: item.title,
        description: item.description || '',
        category: item.category || 'lifestyle',
        thumbnailUrl: item.mediaUrl || item.thumbnailUrl || '',
        videoUrl: item.videoUrl || '',
        metrics: {
          views: item.metrics?.views ?? 0,
          likes: item.metrics?.likes ?? 0,
          comments: item.metrics?.comments ?? 0,
          engagementRate: item.metrics?.engagementRate ?? 0,
        },
        createdAt: item.createdAt || new Date().toISOString(),
        campaignId: item.campaignId || null,
      }))
    : getFallbackSeedReels(creatorId);

  try {
    localStorage.setItem(lsKey, JSON.stringify(seeded));
  } catch {}
  return seeded;
}

/**
 * Uploads a video file to the 'creator-reels' storage bucket in Supabase.
 * Generates a public URL. Falls back to a local URL (object URL or base64 mock) on failure.
 */
export async function uploadReelFile(creatorId: string, file: File): Promise<string> {
  if (isSupabaseConfigured) {
    try {
      const fileExt = file.name.split('.').pop();
      const randomId = Math.random().toString(36).substring(2, 10);
      const fileName = `${creatorId}/${Date.now()}-${randomId}.${fileExt}`;

      const { error } = await supabase.storage
        .from('creator-reels')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(`Upload error: ${error.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('creator-reels')
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        return urlData.publicUrl;
      }
    } catch (e) {
      console.warn('Supabase storage upload failed, falling back:', e);
    }
  }

  // Fallback: Create Object URL
  return URL.createObjectURL(file);
}

/**
 * Saves a new reel.
 * Tries Supabase insert first, falls back to localStorage on failure.
 */
export async function saveReel(
  creatorId: string,
  newReel: Omit<Reel, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): Promise<Reel> {
  const id = newReel.id || `reel-${Date.now()}`;
  const createdAt = newReel.createdAt || new Date().toISOString();

  const reelToSave: Reel = {
    ...newReel,
    id,
    createdAt,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('creator_reels')
        .insert([
          {
            id,
            creator_id: creatorId,
            title: newReel.title,
            video_url: newReel.videoUrl,
            thumbnail_url: newReel.thumbnailUrl || '',
            description: newReel.description || '',
            category: newReel.category || 'lifestyle',
            metrics: newReel.metrics || { views: 0, likes: 0, comments: 0, engagementRate: 0 },
            campaign_id: newReel.campaignId || null,
            created_at: createdAt,
          },
        ])
        .select()
        .single();

      if (error) {
        console.warn('Supabase insert failed, syncing to local storage:', error.message);
      } else if (data) {
        const saved: Reel = {
          id: data.id,
          title: data.title,
          description: data.description || '',
          category: data.category || 'lifestyle',
          thumbnailUrl: data.thumbnail_url || '',
          videoUrl: data.video_url,
          metrics: data.metrics || { views: 0, likes: 0, comments: 0, engagementRate: 0 },
          createdAt: data.created_at,
          campaignId: data.campaign_id || null,
        };
        // Sync to local storage too to keep sessionStorage and tabs updated
        await syncToLocalStorage(creatorId, saved);
        return saved;
      }
    } catch (e) {
      console.warn('Failed to save to Supabase:', e);
    }
  }

  // Fallback: Save to LocalStorage
  await syncToLocalStorage(creatorId, reelToSave);
  return reelToSave;
}

/**
 * Deletes a reel.
 * Tries Supabase delete first, falls back to localStorage on failure.
 */
export async function deleteReel(creatorId: string, reelId: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('creator_reels')
        .delete()
        .eq('id', reelId);

      if (error) {
        console.warn('Supabase delete failed:', error.message);
      }
    } catch (e) {
      console.warn('Failed to delete from Supabase:', e);
    }
  }

  // Local storage sync
  const lsKey = `reels-${creatorId}`;
  const stored = localStorage.getItem(lsKey);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Reel[];
      const filtered = parsed.filter(r => r.id !== reelId);
      localStorage.setItem(lsKey, JSON.stringify(filtered));
    } catch {}
  }
}

// Helper to prepend a reel to local storage cache
async function syncToLocalStorage(creatorId: string, reel: Reel): Promise<void> {
  const lsKey = `reels-${creatorId}`;
  let list: Reel[] = [];
  const stored = localStorage.getItem(lsKey);
  if (stored) {
    try {
      list = JSON.parse(stored) as Reel[];
    } catch {}
  } else {
    list = getFallbackSeedReels(creatorId);
  }

  // Deduplicate and prepend
  const filtered = list.filter(r => r.id !== reel.id);
  const updated = [reel, ...filtered];
  localStorage.setItem(lsKey, JSON.stringify(updated));
}
