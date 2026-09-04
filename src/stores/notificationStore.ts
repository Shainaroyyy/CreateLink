import { create } from 'zustand';
import type { Notification } from '../types/index';
import * as notificationService from '../services/notificationService';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  loadNotifications: (userId: string) => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: (userId: string) => void;
  receiveNotification: (notification: Notification) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,

  loadNotifications: async (userId) => {
    const notifications = await notificationService.getNotifications(userId);
    const unreadCount = notifications.filter((n) => !n.read).length;
    set({ notifications, unreadCount });
  },

  markRead: (id) => {
    notificationService.markRead(id);
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  markAllRead: (userId) => {
    notificationService.markAllRead(userId);
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  receiveNotification: (notification) => {
    set((state) => {
      if (state.notifications.some((item) => item.id === notification.id)) return state;
      return {
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + (notification.read ? 0 : 1),
      };
    });
  },
}));
