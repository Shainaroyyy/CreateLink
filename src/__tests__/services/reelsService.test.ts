import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchReels, saveReel, deleteReel, uploadReelFile } from '../../services/reelsService';

describe('reelsService Fallback Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('fetchReels should seed default reels for creator-1 (Maya Chen)', async () => {
    const reels = await fetchReels('creator-1');
    expect(reels.length).toBeGreaterThan(0);
    // Should contain the hardcoded Dot and Key Collaboration reel
    const dotAndKey = reels.find(r => r.id === 'hardcoded-dotandkey-reel');
    expect(dotAndKey).toBeDefined();
    expect(dotAndKey?.title).toBe('Dot and Key Collaboration');
    expect(dotAndKey?.category).toBe('beauty');
  });

  it('saveReel should persist a new reel to localStorage fallback', async () => {
    const newReelData = {
      title: 'Aesthetic Morning Vlog',
      description: 'Morning skincare routine vlog',
      category: 'lifestyle',
      thumbnailUrl: 'thumb.jpg',
      videoUrl: 'vlog.mp4',
      metrics: { views: 500, likes: 50, comments: 5, engagementRate: 0.11 },
      campaignId: null,
    };

    const saved = await saveReel('creator-1', newReelData);
    expect(saved.id).toBeDefined();
    expect(saved.title).toBe('Aesthetic Morning Vlog');
    expect(saved.videoUrl).toBe('vlog.mp4');

    // Retrieve from database/localStorage fallback
    const reels = await fetchReels('creator-1');
    const matched = reels.find(r => r.id === saved.id);
    expect(matched).toBeDefined();
    expect(matched?.title).toBe('Aesthetic Morning Vlog');
    expect(matched?.description).toBe('Morning skincare routine vlog');
  });

  it('deleteReel should remove the reel from localStorage fallback list', async () => {
    const newReelData = {
      title: 'To Be Deleted',
      description: 'Temp reel',
      category: 'beauty',
      thumbnailUrl: '',
      videoUrl: 'temp.mp4',
      metrics: { views: 0, likes: 0, comments: 0, engagementRate: 0 },
      campaignId: null,
    };

    const saved = await saveReel('creator-1', newReelData);
    let reels = await fetchReels('creator-1');
    expect(reels.some(r => r.id === saved.id)).toBe(true);

    await deleteReel('creator-1', saved.id);
    reels = await fetchReels('creator-1');
    expect(reels.some(r => r.id === saved.id)).toBe(false);
  });

  it('uploadReelFile should fall back to creating a local blob/object URL', async () => {
    const file = new File(['dummy content'], 'video.mp4', { type: 'video/mp4' });
    
    // We mock URL.createObjectURL since jsdom doesn't fully support it in all environments
    const mockUrl = 'blob:http://localhost:5173/mock-uuid';
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => mockUrl);

    const uploadedUrl = await uploadReelFile('creator-1', file);
    expect(uploadedUrl).toBe(mockUrl);
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);

    URL.createObjectURL = originalCreateObjectURL;
  });
});
