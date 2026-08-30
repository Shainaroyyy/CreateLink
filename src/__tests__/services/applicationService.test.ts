import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchApplications,
  createApplication,
  processSwipe,
  undoSwipe,
  updateApplicationStatus,
  getApplicationsForCampaign,
  getApplicationByCreatorAndCampaign
} from '../../services/applicationService';
import { getStore } from '../../services/store';

describe('applicationService Backend/Fallback Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('fetchApplications should return an array of applications (empty initially in fallback)', async () => {
    const apps = await fetchApplications();
    expect(Array.isArray(apps)).toBe(true);
  });

  it('createApplication should persist a new application to localStorage fallback and update campaign count', async () => {
    const store = getStore();
    // Seed creator and campaign
    const creator = {
      id: 'creator-1',
      userId: 'user-2',
      displayName: 'Maya Chen',
      bio: 'Beauty content creator',
      avatarUrl: '',
      contentCategories: ['beauty'] as any,
      socialAccounts: [],
      trustScore: 92,
      trustScorePartialData: false,
      portfolio: [],
      collaborationHistory: [],
      insights: {
        audienceDemographics: { ageGroups: {}, topCountries: [], genderSplit: { male: 0, female: 0, other: 0 } },
        primaryCategories: ['beauty'] as any,
        averageEngagementRate: 9.7,
        collaborationCount: 4,
        successRate: 1.0,
      },
      verificationStatus: 'verified' as any,
    };
    const campaign = {
      id: 'camp-1',
      brandId: 'brand-1',
      title: 'SmartWatch X',
      description: 'Tech Watch',
      requirements: 'Min Trust Score: 80+ | Min Content Quality Score: 85+',
      contentCategories: ['tech'] as any,
      compensationType: 'paid' as any,
      compensationAmount: 1000,
      deadline: new Date().toISOString(),
      status: 'active' as any,
      publishedAt: new Date().toISOString(),
      applicantCount: 0,
    };
    store.creators.set(creator.id, creator);
    store.campaigns.set(campaign.id, campaign);

    const saved = await createApplication('creator-1', 'camp-1', []);
    expect(saved.id).toBeDefined();
    expect(saved.creatorId).toBe('creator-1');
    expect(saved.campaignId).toBe('camp-1');
    expect(saved.status).toBe('pending');

    const apps = await fetchApplications();
    const matched = apps.find(a => a.id === saved.id);
    expect(matched).toBeDefined();
    expect(matched?.status).toBe('pending');

    // Campaign applicant count should be incremented
    const updatedCampaign = store.campaigns.get('camp-1');
    expect(updatedCampaign?.applicantCount).toBe(1);
  });

  it('processSwipe should set correct statuses (approve -> accepted, decline -> rejected, waitlist -> shortlisted)', async () => {
    const store = getStore();
    const app = {
      id: 'app-test-1',
      campaignId: 'camp-1',
      creatorId: 'creator-1',
      aiPitch: 'test',
      editedPitch: 'test',
      selectedPortfolioItems: [],
      status: 'pending' as any,
      collaborationMatchScore: 90,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
    };
    store.applications.set(app.id, app);
    localStorage.setItem('createlink-applications', JSON.stringify([app]));

    const accepted = await processSwipe('app-test-1', 'approve');
    expect(accepted.status).toBe('accepted');

    const shortlisted = await processSwipe('app-test-1', 'waitlist');
    expect(shortlisted.status).toBe('shortlisted');

    const rejected = await processSwipe('app-test-1', 'decline');
    expect(rejected.status).toBe('rejected');
  });

  it('updateApplicationStatus should explicitly update status in backend/localStorage', async () => {
    const store = getStore();
    const app = {
      id: 'app-test-2',
      campaignId: 'camp-1',
      creatorId: 'creator-1',
      aiPitch: 'test',
      editedPitch: 'test',
      selectedPortfolioItems: [],
      status: 'pending' as any,
      collaborationMatchScore: 90,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
    };
    store.applications.set(app.id, app);
    localStorage.setItem('createlink-applications', JSON.stringify([app]));

    const updated = await updateApplicationStatus('app-test-2', 'shortlisted');
    expect(updated.status).toBe('shortlisted');

    const appsList = await getApplicationsForCampaign('camp-1');
    expect(appsList.find(a => a.id === 'app-test-2')?.status).toBe('shortlisted');
  });

  it('undoSwipe should restore previous status', async () => {
    const store = getStore();
    const app = {
      id: 'app-test-3',
      campaignId: 'camp-1',
      creatorId: 'creator-1',
      aiPitch: 'test',
      editedPitch: 'test',
      selectedPortfolioItems: [],
      status: 'shortlisted' as any,
      collaborationMatchScore: 90,
      submittedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
    };
    store.applications.set(app.id, app);
    localStorage.setItem('createlink-applications', JSON.stringify([app]));

    const undone = await undoSwipe('app-test-3', 'pending');
    expect(undone.status).toBe('pending');
    expect(undone.reviewedAt).toBeNull();
  });
});
