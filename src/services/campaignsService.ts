import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { Campaign } from '../types/index';
import campaignsData from '../data/campaigns.json';

// Local storage key for fallback campaigns cache
const LS_CAMPAIGNS_KEY = 'createlink-campaigns';

// Map database row to Campaign type
export function mapRowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    brandId: row.brand_id || '',
    title: row.title,
    description: row.description || '',
    requirements: row.requirements || `Min Trust Score: ${row.preferred_trust_score || 0}+ | Min Content Quality Score: ${row.preferred_content_quality || 0}+`,
    contentCategories: row.content_categories || (row.category ? [row.category] : ['lifestyle']),
    compensationType: (row.compensation_type || 'fixed') as any,
    compensationAmount: row.compensation_amount != null ? Number(row.compensation_amount) : (row.budget && !isNaN(Number(row.budget)) ? Number(row.budget) : null),
    deadline: row.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: (row.status || 'active') as any,
    publishedAt: row.created_at || new Date().toISOString(),
    applicantCount: row.applicant_count || 0,
  };
}

// Map Campaign object to DB row fields
export function mapCampaignToRow(brandId: string, campaign: Omit<Campaign, 'id' | 'brandId' | 'status' | 'publishedAt' | 'applicantCount'> & { id?: string; status?: string; applicantCount?: number; publishedAt?: string | null }) {
  const requirements = campaign.requirements || '';
  const trustMatch = requirements.match(/Min Trust Score:\s*(\d+)/i);
  const preferredTrustScore = trustMatch ? parseInt(trustMatch[1], 10) : 0;

  const qualityMatch = requirements.match(/Min Content Quality Score:\s*(\d+)/i);
  const preferredContentQuality = qualityMatch ? parseInt(qualityMatch[1], 10) : 0;

  const budget = campaign.compensationAmount != null ? String(campaign.compensationAmount) : campaign.compensationType;

  return {
    brand_id: brandId,
    title: campaign.title,
    description: campaign.description || '',
    category: campaign.contentCategories?.[0] || 'lifestyle',
    budget,
    preferred_trust_score: preferredTrustScore,
    preferred_content_quality: preferredContentQuality,
    requirements,
    content_categories: campaign.contentCategories || ['lifestyle'],
    compensation_type: campaign.compensationType || 'fixed',
    compensation_amount: campaign.compensationAmount,
    deadline: campaign.deadline,
    status: campaign.status || 'active',
    applicant_count: campaign.applicantCount || 0,
  };
}

// Load seed fallback campaigns
function getFallbackCampaigns(): Campaign[] {
  const stored = localStorage.getItem(LS_CAMPAIGNS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Campaign[];
    } catch {}
  }

  // Fallback to static campaigns.json
  const list = campaignsData as Campaign[];
  localStorage.setItem(LS_CAMPAIGNS_KEY, JSON.stringify(list));
  return list;
}

/**
 * Fetch all campaigns.
 * Queries Supabase when configured, using local seed data only for tests/offline mode.
 */
export async function fetchCampaigns(): Promise<Campaign[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Unable to load campaigns from Supabase: ${error.message}`);
      } else if (data) {
        return data.map(mapRowToCampaign);
      }
    } catch (e) {
      throw e instanceof Error ? e : new Error('Unable to load campaigns from Supabase.');
    }
  }

  return getFallbackCampaigns();
}

/**
 * Create a new campaign.
 * Persists in Supabase when configured, using local storage only for tests/offline mode.
 */
export async function createCampaign(
  brandId: string,
  campaign: Omit<Campaign, 'id' | 'brandId' | 'status' | 'publishedAt' | 'applicantCount'> & { id?: string }
): Promise<Campaign> {
  const id = campaign.id || `camp-${Date.now()}`;
  const status = 'active';
  const publishedAt = new Date().toISOString();
  const applicantCount = 0;

  const campaignToSave: Campaign = {
    ...campaign,
    id,
    brandId,
    status,
    publishedAt,
    applicantCount,
  };

  const dbRow = {
    id,
    ...mapCampaignToRow(brandId, campaignToSave),
    created_at: publishedAt,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .insert([dbRow])
        .select()
        .single();

      if (error) {
        throw new Error(`Unable to publish campaign to Supabase: ${error.message}`);
      } else if (data) {
        const saved = mapRowToCampaign(data);
        await syncToLocalStorage(saved);
        return saved;
      }
    } catch (e) {
      throw e instanceof Error ? e : new Error('Unable to publish campaign to Supabase.');
    }
  }

  // Local storage fallback
  await syncToLocalStorage(campaignToSave);
  return campaignToSave;
}

/**
 * Update an existing campaign.
 */
export async function updateCampaign(
  campaignId: string,
  data: Partial<Campaign>
): Promise<Campaign> {
  const campaignsList = await fetchCampaigns();
  const current = campaignsList.find(c => c.id === campaignId);
  if (!current) throw new Error(`Campaign ${campaignId} not found`);

  const updated: Campaign = { ...current, ...data };
  const dbRow = mapCampaignToRow(updated.brandId, updated);

  if (isSupabaseConfigured) {
    try {
      const { data: updatedRow, error } = await supabase
        .from('campaigns')
        .update(dbRow)
        .eq('id', campaignId)
        .select()
        .single();

      if (error) {
        throw new Error(`Unable to update campaign in Supabase: ${error.message}`);
      } else if (updatedRow) {
        const saved = mapRowToCampaign(updatedRow);
        await syncToLocalStorage(saved);
        return saved;
      }
    } catch (e) {
      throw e instanceof Error ? e : new Error('Unable to update campaign in Supabase.');
    }
  }

  await syncToLocalStorage(updated);
  return updated;
}

/**
 * Delete/remove a campaign.
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) {
        throw new Error(`Unable to delete campaign from Supabase: ${error.message}`);
      }
    } catch (e) {
      throw e instanceof Error ? e : new Error('Unable to delete campaign from Supabase.');
    }
  }

  // Remove from localStorage fallback cache
  const list = getFallbackCampaigns();
  const filtered = list.filter(c => c.id !== campaignId);
  localStorage.setItem(LS_CAMPAIGNS_KEY, JSON.stringify(filtered));
}

// Sync single campaign to local storage cache
async function syncToLocalStorage(campaign: Campaign): Promise<void> {
  const list = getFallbackCampaigns();
  const filtered = list.filter(c => c.id !== campaign.id);
  const updated = [campaign, ...filtered];
  localStorage.setItem(LS_CAMPAIGNS_KEY, JSON.stringify(updated));
}
