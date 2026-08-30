import type { Application, ApplicationStatus } from '../types/index';
import { getStore } from './store';
import { generateId, nowISO, simulateLatency } from './mockUtils';
import { computeCollaborationMatchScore } from '../lib/scoreEngine';
import { generateAIPitch } from '../lib/aiMock';
import { createNotification } from './notificationService';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { updateCampaign } from './campaignsService';

export class ApplicationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// Local storage key for fallback applications cache
const LS_APPLICATIONS_KEY = 'createlink-applications';

// Map database row to Application type
export function mapRowToApplication(row: any): Application {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    creatorId: row.creator_id,
    aiPitch: row.ai_pitch || '',
    editedPitch: row.edited_pitch || '',
    selectedPortfolioItems: row.selected_portfolio_items || [],
    status: row.status as ApplicationStatus,
    collaborationMatchScore: row.collaboration_match_score || 0,
    submittedAt: row.applied_at || row.submitted_at || new Date().toISOString(),
    reviewedAt: row.reviewed_at || null,
  };
}

// Map Application object to DB row fields
export function mapApplicationToRow(app: Omit<Application, 'id' | 'submittedAt'> & { id?: string; submittedAt?: string }) {
  return {
    campaign_id: app.campaignId,
    creator_id: app.creatorId,
    status: app.status,
    ai_pitch: app.aiPitch,
    edited_pitch: app.editedPitch,
    selected_portfolio_items: app.selectedPortfolioItems,
    collaboration_match_score: app.collaborationMatchScore,
    reviewed_at: app.reviewedAt,
  };
}

// Load fallback local applications
function getFallbackApplications(): Application[] {
  const stored = localStorage.getItem(LS_APPLICATIONS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as Application[];
    } catch {}
  }
  return [];
}

// Sync single application to local storage cache
async function syncToLocalStorage(app: Application): Promise<void> {
  const list = getFallbackApplications();
  const filtered = list.filter(a => a.id !== app.id);
  const updated = [app, ...filtered];
  localStorage.setItem(LS_APPLICATIONS_KEY, JSON.stringify(updated));
}

/**
 * Fetch all applications.
 */
export async function fetchApplications(): Promise<Application[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .order('applied_at', { ascending: false });

      if (error) {
        console.warn('Supabase applications fetch failed, using fallback:', error.message);
      } else if (data) {
        return data.map(mapRowToApplication);
      }
    } catch (e) {
      console.warn('Failed to fetch applications from Supabase:', e);
    }
  }

  return getFallbackApplications();
}

/**
 * Create a new creator application.
 */
export async function createApplication(
  creatorId: string,
  campaignId: string,
  portfolioItemIds?: string[]
): Promise<Application> {
  const store = getStore();

  // Duplicate guard (check backend/local storage)
  const currentApps = await fetchApplications();
  const existing = currentApps.find(
    (a) => a.creatorId === creatorId && a.campaignId === campaignId &&
      (a.status === 'pending' || a.status === 'accepted' || a.status === 'shortlisted' || a.status === 'approved' || a.status === 'waitlisted')
  );
  if (existing) throw new ApplicationError('duplicate', `Application already exists with status: ${existing.status}`);

  const creator = store.creators.get(creatorId);
  const campaign = store.campaigns.get(campaignId);
  if (!creator || !campaign) throw new ApplicationError('not_found', 'Creator or Campaign not found.');

  // Parse preferences
  const reqStr = campaign.requirements || '';
  const minTrustMatch = reqStr.match(/Min Trust Score:\s*(\d+)/i);
  const campaignMinTrustScore = minTrustMatch ? parseInt(minTrustMatch[1]) : 0;

  const minQualityMatch = reqStr.match(/Min Content Quality Score:\s*(\d+)/i);
  const campaignMinContentQuality = minQualityMatch ? parseInt(minQualityMatch[1]) : 0;

  // Compute match score
  const matchScore = computeCollaborationMatchScore({
    creatorCategories: creator.contentCategories,
    campaignCategories: campaign.contentCategories,
    creatorTrustScore: creator.trustScore,
    campaignMinTrustScore,
    campaignMinContentQuality,
    audienceAgeGroups: creator.insights.audienceDemographics.ageGroups,
    campaignTargetAgeGroups: [],
  });

  // AI pitch (with latency)
  const aiPitch = await generateAIPitch(creator, campaign);

  // Pre-select up to 3 most relevant portfolio items
  const selectedItems = portfolioItemIds?.slice(0, 3) ??
    creator.portfolio
      .filter((item) => campaign.contentCategories.includes(item.category))
      .sort((a, b) => b.metrics.engagementRate - a.metrics.engagementRate)
      .slice(0, 3)
      .map((item) => item.id);

  const id = `app-${Date.now()}`;
  const submittedAt = new Date().toISOString();

  const application: Application = {
    id,
    campaignId,
    creatorId,
    aiPitch,
    editedPitch: aiPitch,
    selectedPortfolioItems: selectedItems,
    status: 'pending',
    collaborationMatchScore: matchScore,
    submittedAt,
    reviewedAt: null,
  };

  const dbRow = {
    id,
    ...mapApplicationToRow(application),
    applied_at: submittedAt,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('applications')
        .insert([dbRow])
        .select()
        .single();

      if (error) {
        console.warn('Supabase insert application failed, saving to cache:', error.message);
      } else if (data) {
        const saved = mapRowToApplication(data);
        store.applications.set(saved.id, saved);
        await syncToLocalStorage(saved);

        // Update campaign applicantCount
        const latestCampaign = store.campaigns.get(campaignId) || campaign;
        const newCount = (latestCampaign.applicantCount || 0) + 1;
        store.campaigns.set(campaignId, { ...latestCampaign, applicantCount: newCount });
        try {
          await updateCampaign(campaignId, { applicantCount: newCount });
        } catch {}

        return saved;
      }
    } catch (e) {
      console.warn('Failed to save application to Supabase:', e);
    }
  }

  // Local storage fallback
  store.applications.set(application.id, application);
  await syncToLocalStorage(application);

  // Update campaign applicantCount
  const latestCampaign = store.campaigns.get(campaignId) || campaign;
  const newCount = (latestCampaign.applicantCount || 0) + 1;
  store.campaigns.set(campaignId, { ...latestCampaign, applicantCount: newCount });
  try {
    await updateCampaign(campaignId, { applicantCount: newCount });
  } catch {}

  // Update creator collaboration history
  const updatedCreator = store.creators.get(creatorId);
  if (updatedCreator) {
    const alreadyInHistory = updatedCreator.collaborationHistory.some((r) => r.campaignId === campaignId);
    if (!alreadyInHistory) {
      store.creators.set(creatorId, {
        ...updatedCreator,
        collaborationHistory: [
          ...updatedCreator.collaborationHistory,
          { campaignId, brandId: campaign.brandId, status: 'pending', startDate: null, endDate: null },
        ],
      });
    }
  }

  // Confirmation notification to creator
  const creatorUser = store.users.get(creator.userId);
  if (creatorUser) {
    createNotification(creatorUser.id, 'application_received', 'Application Submitted', `Your application for "${campaign.title}" has been received.`);
  }

  return application;
}

/**
 * Update creator's edited pitch and selected items.
 */
export async function updateApplication(
  appId: string,
  editedPitch: string,
  portfolioItemIds: string[]
): Promise<Application> {
  await simulateLatency(100, 300);
  const store = getStore();
  const app = store.applications.get(appId);
  if (!app) throw new ApplicationError('not_found', 'Application not found.');
  
  const updated: Application = { ...app, editedPitch, selectedPortfolioItems: portfolioItemIds.slice(0, 3) };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('applications')
        .update({
          edited_pitch: editedPitch,
          selected_portfolio_items: portfolioItemIds.slice(0, 3),
        })
        .eq('id', appId)
        .select()
        .single();

      if (error) {
        console.warn('Supabase update application failed:', error.message);
      } else if (data) {
        const saved = mapRowToApplication(data);
        store.applications.set(appId, saved);
        await syncToLocalStorage(saved);
        return saved;
      }
    } catch (e) {
      console.warn('Failed to update application in Supabase:', e);
    }
  }

  store.applications.set(appId, updated);
  await syncToLocalStorage(updated);
  return updated;
}

/**
 * Process applicant swipe actions (Decline, Shortlist, Approve).
 */
export async function processSwipe(
  appId: string,
  direction: 'approve' | 'decline' | 'waitlist'
): Promise<Application> {
  await simulateLatency(150, 400);
  const store = getStore();
  const app = store.applications.get(appId);
  if (!app) throw new ApplicationError('not_found', 'Application not found.');

  const statusMap: Record<typeof direction, ApplicationStatus> = {
    approve: 'accepted',
    decline: 'rejected',
    waitlist: 'shortlisted',
  };
  const status = statusMap[direction];
  const reviewedAt = new Date().toISOString();
  const updated: Application = { ...app, status, reviewedAt };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('applications')
        .update({ status, reviewed_at: reviewedAt })
        .eq('id', appId)
        .select()
        .single();

      if (error) {
        console.warn('Supabase swipe application update failed:', error.message);
      } else if (data) {
        const saved = mapRowToApplication(data);
        store.applications.set(appId, saved);
        await syncToLocalStorage(saved);
        return saved;
      }
    } catch (e) {
      console.warn('Failed to update swipe application in Supabase:', e);
    }
  }

  store.applications.set(appId, updated);
  await syncToLocalStorage(updated);

  // Notify creator on approve/decline only
  if (direction !== 'waitlist') {
    const creator = store.creators.get(app.creatorId);
    if (creator) {
      const user = store.users.get(creator.userId);
      const campaign = store.campaigns.get(app.campaignId);
      if (user && campaign) {
        const type = direction === 'approve' ? 'application_approved' : 'application_declined';
        const title = direction === 'approve' ? 'Application Approved!' : 'Application Update';
        const body = direction === 'approve'
          ? `Congratulations! Your application for "${campaign.title}" has been approved.`
          : `Your application for "${campaign.title}" was not selected at this time.`;
        createNotification(user.id, type, title, body);
      }
    }
  }

  return updated;
}

/**
 * Undo swipe.
 */
export async function undoSwipe(appId: string, previousStatus: ApplicationStatus): Promise<Application> {
  await simulateLatency(100, 300);
  const store = getStore();
  const app = store.applications.get(appId);
  if (!app) throw new ApplicationError('not_found', 'Application not found.');
  
  const restored: Application = { ...app, status: previousStatus, reviewedAt: null };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('applications')
        .update({ status: previousStatus, reviewed_at: null })
        .eq('id', appId)
        .select()
        .single();

      if (error) {
        console.warn('Supabase undoSwipe failed:', error.message);
      } else if (data) {
        const saved = mapRowToApplication(data);
        store.applications.set(appId, saved);
        await syncToLocalStorage(saved);
        return saved;
      }
    } catch (e) {
      console.warn('Failed to undo swipe in Supabase:', e);
    }
  }

  store.applications.set(appId, restored);
  await syncToLocalStorage(restored);
  return restored;
}

/**
 * Explicit status update (for table review actions).
 */
export async function updateApplicationStatus(appId: string, status: ApplicationStatus): Promise<Application> {
  const store = getStore();
  const app = store.applications.get(appId);
  if (!app) throw new ApplicationError('not_found', 'Application not found.');

  const reviewedAt = new Date().toISOString();
  const updated: Application = { ...app, status, reviewedAt };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('applications')
        .update({ status, reviewed_at: reviewedAt })
        .eq('id', appId)
        .select()
        .single();

      if (error) {
        console.warn('Supabase update status failed:', error.message);
      } else if (data) {
        const saved = mapRowToApplication(data);
        store.applications.set(appId, saved);
        await syncToLocalStorage(saved);
        return saved;
      }
    } catch (e) {
      console.warn('Failed to update status in Supabase:', e);
    }
  }

  store.applications.set(appId, updated);
  await syncToLocalStorage(updated);
  return updated;
}

/**
 * Get applications for a campaign.
 */
export async function getApplicationsForCampaign(campaignId: string): Promise<Application[]> {
  const store = getStore();
  const appsList = await fetchApplications();
  for (const a of appsList) {
    store.applications.set(a.id, a);
  }
  return appsList.filter((a) => a.campaignId === campaignId);
}

/**
 * Get applications by creator and campaign.
 */
export async function getApplicationByCreatorAndCampaign(
  creatorId: string,
  campaignId: string
): Promise<Application | null> {
  const store = getStore();
  const appsList = await fetchApplications();
  for (const a of appsList) {
    store.applications.set(a.id, a);
  }
  return appsList.find((a) => a.creatorId === creatorId && a.campaignId === campaignId) ?? null;
}

