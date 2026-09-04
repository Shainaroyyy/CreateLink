import { create } from 'zustand';
import type { Creator, PortfolioItem } from '../types/index';
import * as creatorService from '../services/creatorService';
import { useAuthStore } from './authStore';

interface CreatorStore {
  creator: Creator | null;
  loadCreator: (id: string) => Promise<void>;
  updatePortfolio: (items: PortfolioItem[]) => Promise<void>;
  refreshTrustScore: () => Promise<void>;
  saveOnboarding: (answers: creatorService.OnboardingAnswers) => Promise<Creator>;
}

export const useCreatorStore = create<CreatorStore>((set, get) => ({
  creator: null,

  loadCreator: async (id) => {
    let creator = await creatorService.getCreator(id);
    if (!creator) {
      creator = await creatorService.getCreatorByUserId(id);
    }
    set({ creator });
  },

  updatePortfolio: async (items) => {
    const { creator } = get();
    if (!creator) throw new Error('No creator loaded');
    const updated = await creatorService.updatePortfolio(creator.id, items);
    set({ creator: updated });
  },

  refreshTrustScore: async () => {
    const { creator } = get();
    if (!creator) throw new Error('No creator loaded');
    const updated = await creatorService.refreshTrustScore(creator.id);
    set({ creator: updated });
  },

  saveOnboarding: async (answers) => {
    const { creator } = get();
    const currentAuth = useAuthStore.getState().currentUser;
    const targetId = currentAuth?.id || creator?.id;
    if (!targetId) throw new Error('No creator or authenticated user loaded');
    const updated = await creatorService.saveCreatorOnboarding(targetId, answers);
    set({ creator: updated });
    if (answers.displayName && currentAuth) {
      useAuthStore.setState({
        currentUser: { ...currentAuth, displayName: answers.displayName },
      });
    }
    return updated;
  },
}));
