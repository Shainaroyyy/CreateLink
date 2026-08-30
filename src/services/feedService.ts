import type { FeedPost, FeedFilters } from '../types/index';
import { getStore } from './store';
import { generateId, nowISO, simulateLatency } from './mockUtils';
import { createNotification } from './notificationService';
import { fetchCampaigns } from './campaignsService';

export async function loadFeed(filters?: Partial<FeedFilters>): Promise<FeedPost[]> {
  await simulateLatency(200, 600);
  const store = getStore();

  // 1. Fetch campaigns from Supabase/cache
  const campaignsList = await fetchCampaigns();

  // 2. Synchronize fetched campaigns to the in-memory store
  for (const c of campaignsList) {
    store.campaigns.set(c.id, c);
  }

  // 3. Get active campaigns (not removed)
  const activeCampaigns = campaignsList.filter(c => c.status !== 'removed');

  // 4. Creator posts (type is NOT 'campaign')
  const creatorPosts = Array.from(store.feedPosts.values()).filter(
    (p) => p.type !== 'campaign' && !p.removed
  );

  // 5. Map campaigns to FeedPost objects
  const campaignPosts = activeCampaigns.map((c) => {
    const existingPost = Array.from(store.feedPosts.values()).find(
      (p) => p.campaignId === c.id
    );

    return {
      id: existingPost?.id || `post-dyn-${c.id}`,
      type: 'campaign' as const,
      authorId: c.brandId,
      authorRole: 'brand' as const,
      campaignId: c.id,
      title: c.title,
      body: c.description,
      category: c.contentCategories[0] ?? 'lifestyle',
      collaborationMatchScore: existingPost?.collaborationMatchScore ?? null,
      aiRecommendationTag: existingPost?.aiRecommendationTag ?? null,
      publishedAt: c.publishedAt || new Date().toISOString(),
      removed: existingPost?.removed ?? false,
      imageFilename: existingPost?.imageFilename,
    };
  }).filter(p => !p.removed);

  // 6. Merge posts
  let posts = [...creatorPosts, ...campaignPosts];

  if (filters?.category) posts = posts.filter((p) => p.category === filters.category);
  if (filters?.deadlineBefore) {
    const deadline = new Date(filters.deadlineBefore);
    posts = posts.filter((p) => {
      if (p.campaignId) {
        const campaign = store.campaigns.get(p.campaignId);
        return campaign ? new Date(campaign.deadline) <= deadline : true;
      }
      return true;
    });
  }
  if (filters?.compensationType) {
    posts = posts.filter((p) => {
      if (p.campaignId) {
        const campaign = store.campaigns.get(p.campaignId);
        return campaign?.compensationType === filters.compensationType;
      }
      return false;
    });
  }

  // Sort by collaborationMatchScore descending, tiebreak by publishedAt descending
  return posts.sort((a, b) => {
    const scoreDiff = (b.collaborationMatchScore ?? 0) - (a.collaborationMatchScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

export async function publishPost(
  post: Omit<FeedPost, 'id' | 'publishedAt' | 'removed'>
): Promise<FeedPost> {
  await simulateLatency(200, 500);
  const store = getStore();
  const newPost: FeedPost = {
    ...post,
    id: generateId(),
    publishedAt: nowISO(),
    removed: false,
  };
  store.feedPosts.set(newPost.id, newPost);
  return newPost;
}

export function removePost(postId: string, reason?: string): void {
  const store = getStore();
  const post = store.feedPosts.get(postId);
  if (!post) return;
  store.feedPosts.set(postId, { ...post, removed: true });
  // Notify the post author
  const notifBody = reason ?? 'Your post was removed for violating community guidelines.';
  createNotification(post.authorId, 'post_removed', 'Post Removed', notifBody);
}
