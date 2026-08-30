import type { Brand, Campaign, FeedPost, CampaignStatus } from '../types/index';
import { getStore } from './store';
import { generateId, nowISO, simulateLatency } from './mockUtils';
import {
  createCampaign,
  updateCampaign as dbUpdateCampaign,
  deleteCampaign as dbDeleteCampaign,
  fetchCampaigns
} from './campaignsService';

export class BrandServiceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function getBrand(id: string): Promise<Brand | null> {
  await simulateLatency(100, 400);
  return getStore().brands.get(id) ?? null;
}

export async function getBrandByUserId(userId: string): Promise<Brand | null> {
  await simulateLatency(100, 300);
  return Array.from(getStore().brands.values()).find((b) => b.userId === userId) ?? null;
}

export async function publishCampaign(
  brandId: string,
  data: Omit<Campaign, 'id' | 'brandId' | 'status' | 'publishedAt' | 'applicantCount'>
): Promise<Campaign> {
  await simulateLatency(300, 700);
  const store = getStore();
  const brand = store.brands.get(brandId);
  if (!brand) throw new BrandServiceError('not_found', 'Brand not found.');
  if (brand.brandScore < 40 && !brand.isNewToPlatform) {
    throw new BrandServiceError('score_restricted', 'Your Brand Score is below 40. Campaign publishing is restricted pending moderator review.');
  }

  // Create campaign via campaignsService (writes to Supabase/localStorage fallback)
  const campaign = await createCampaign(brandId, data);
  store.campaigns.set(campaign.id, campaign);

  // Create feed post for this campaign
  const post: FeedPost = {
    id: generateId(),
    type: 'campaign',
    authorId: brandId,
    authorRole: 'brand',
    campaignId: campaign.id,
    title: campaign.title,
    body: campaign.description,
    category: campaign.contentCategories[0] ?? 'lifestyle',
    collaborationMatchScore: null,
    aiRecommendationTag: null,
    publishedAt: campaign.publishedAt!,
    removed: false,
  };
  store.feedPosts.set(post.id, post);

  // Update brand's campaign list
  const updatedBrand: Brand = { ...brand, campaigns: [...brand.campaigns, campaign.id] };
  store.brands.set(brandId, updatedBrand);

  return campaign;
}

export async function updateCampaign(campaignId: string, data: Partial<Campaign>): Promise<Campaign> {
  await simulateLatency(200, 500);
  const store = getStore();
  const campaign = store.campaigns.get(campaignId);
  if (!campaign) throw new BrandServiceError('not_found', 'Campaign not found.');
  const updated = await dbUpdateCampaign(campaignId, data);
  store.campaigns.set(campaignId, updated);
  return updated;
}

export async function removeCampaign(campaignId: string): Promise<void> {
  await simulateLatency(200, 400);
  const store = getStore();
  const campaign = store.campaigns.get(campaignId);
  if (!campaign) return;
  
  await dbDeleteCampaign(campaignId);
  store.campaigns.set(campaignId, { ...campaign, status: 'removed' as CampaignStatus });
  
  // Mark associated feed post as removed
  for (const [id, post] of store.feedPosts.entries()) {
    if (post.campaignId === campaignId) {
      store.feedPosts.set(id, { ...post, removed: true });
    }
  }
}

export async function submitVerification(brandId: string): Promise<Brand> {
  await simulateLatency(300, 600);
  const store = getStore();
  const brand = store.brands.get(brandId);
  if (!brand) throw new BrandServiceError('not_found', 'Brand not found.');
  const updated: Brand = { ...brand, verificationStatus: 'pending' };
  store.brands.set(brandId, updated);
  const user = store.users.get(brand.userId);
  if (user) store.users.set(user.id, { ...user, verificationStatus: 'pending' });
  return updated;
}

export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  await simulateLatency(100, 300);
  const store = getStore();
  
  // Sync store from backend
  const campaignsList = await fetchCampaigns();
  for (const c of campaignsList) {
    store.campaigns.set(c.id, c);
  }
  
  return store.campaigns.get(campaignId) ?? null;
}
