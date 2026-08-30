import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchCampaigns, createCampaign, updateCampaign, deleteCampaign } from '../../services/campaignsService';
import type { ContentCategory } from '../../types/index';

describe('campaignsService Fallback Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('fetchCampaigns should seed default campaigns', async () => {
    const campaigns = await fetchCampaigns();
    expect(campaigns.length).toBeGreaterThan(0);
    
    // Check that we loaded a seed campaign
    const smartwatch = campaigns.find(c => c.id === 'camp-1');
    expect(smartwatch).toBeDefined();
    expect(smartwatch?.title).toBe('SmartWatch X — Lifestyle Creators');
    expect(smartwatch?.compensationType).toBe('paid');
  });

  it('createCampaign should persist a new campaign to localStorage fallback', async () => {
    const newCampData = {
      title: 'Dynamic Summer Launch',
      description: 'Looking for lifestyle influencers.',
      requirements: 'Min Trust Score: 80+ | Min Content Quality Score: 85+',
      contentCategories: ['lifestyle'] as ContentCategory[],
      compensationType: 'paid' as const,
      compensationAmount: 1500,
      deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const saved = await createCampaign('brand-1', newCampData);
    expect(saved.id).toBeDefined();
    expect(saved.title).toBe('Dynamic Summer Launch');
    expect(saved.brandId).toBe('brand-1');
    expect(saved.applicantCount).toBe(0);

    // Fetch and check that it's in the list
    const campaigns = await fetchCampaigns();
    const matched = campaigns.find(c => c.id === saved.id);
    expect(matched).toBeDefined();
    expect(matched?.title).toBe('Dynamic Summer Launch');
    expect(matched?.compensationAmount).toBe(1500);
  });

  it('updateCampaign should modify the campaign details in fallback storage', async () => {
    const newCampData = {
      title: 'Update Target',
      description: 'Initial description',
      requirements: 'Min Trust Score: 50 | Min Content Quality Score: 50',
      contentCategories: ['tech'] as ContentCategory[],
      compensationType: 'gifted' as const,
      compensationAmount: 0,
      deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const saved = await createCampaign('brand-1', newCampData);
    const updated = await updateCampaign(saved.id, {
      title: 'Updated Title',
      compensationAmount: 500,
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.compensationAmount).toBe(500);

    const campaigns = await fetchCampaigns();
    const matched = campaigns.find(c => c.id === saved.id);
    expect(matched?.title).toBe('Updated Title');
  });

  it('deleteCampaign should remove the campaign from fallback storage', async () => {
    const newCampData = {
      title: 'To Be Deleted',
      description: 'Delete me',
      requirements: 'None',
      contentCategories: ['food'] as ContentCategory[],
      compensationType: 'fixed' as any,
      compensationAmount: 200,
      deadline: new Date().toISOString(),
    };

    const saved = await createCampaign('brand-1', newCampData);
    let campaigns = await fetchCampaigns();
    expect(campaigns.some(c => c.id === saved.id)).toBe(true);

    await deleteCampaign(saved.id);
    campaigns = await fetchCampaigns();
    expect(campaigns.some(c => c.id === saved.id)).toBe(false);
  });
});
