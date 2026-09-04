import type { Notification, NotificationType } from '../types/index';
import { getStore } from './store';
import { generateId, nowISO } from './mockUtils';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string
): Notification {
  const store = getStore();
  const notification: Notification = {
    id: generateId(),
    userId,
    type,
    title,
    body,
    read: false,
    createdAt: nowISO(),
  };
  store.notifications.set(notification.id, notification);
  return notification;
}

export async function createPersistentNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string
): Promise<Notification | null> {
  const notification = createNotification(userId, type, title, body);
  if (!isSupabaseConfigured) return notification;

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      id: notification.id,
      // Keep compatibility with the original notifications schema.
      creator_id: null,
      campaign_id: null,
      message: body,
      user_id: userId,
      type,
      title,
      body,
      read: false,
      created_at: notification.createdAt,
    })
    .select('*')
    .single();

  if (error) {
    console.warn('Failed to persist notification with the current schema:', error.message);

    // Support the original creator-only notifications table while it is being migrated.
    const { data: legacyData, error: legacyError } = await supabase
      .from('notifications')
      .insert({
        id: notification.id,
        creator_id: userId,
        campaign_id: null,
        title,
        message: body,
      })
      .select('*')
      .single();

    if (legacyError) {
      console.warn('Failed to persist notification with the legacy schema:', legacyError.message);
      return notification;
    }

    return {
      ...notification,
      id: legacyData.id,
    };
  }

  return {
    ...notification,
    id: data.id,
    read: Boolean(data.read),
    createdAt: data.created_at,
  };
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const notificationsById = new Map<string, Notification>();

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error) {
      for (const row of data ?? []) {
        notificationsById.set(row.id, {
        id: row.id,
        userId: row.user_id,
        type: row.type as NotificationType,
        title: row.title,
        body: row.body,
        read: Boolean(row.read),
        createdAt: row.created_at,
        });
      }
    }
    if (error) console.warn('Failed to load notifications with the current schema:', error.message);

    const { data: legacyData, error: legacyError } = await supabase
      .from('notifications')
      .select('id, creator_id, title, message')
      .eq('creator_id', userId)
      .order('id', { ascending: false });

    if (!legacyError) {
      for (const row of legacyData ?? []) {
        if (!notificationsById.has(row.id)) {
          notificationsById.set(row.id, {
            id: row.id,
            userId: row.creator_id,
            type: 'message_received' as NotificationType,
            title: row.title || 'Notification',
            body: row.message || '',
            read: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    if (legacyError) console.warn('Failed to load notifications with the legacy schema:', legacyError.message);

    if (notificationsById.size > 0) {
      return Array.from(notificationsById.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  }

  const store = getStore();
  return Array.from(store.notifications.values())
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function markRead(notificationId: string): void {
  const store = getStore();
  const n = store.notifications.get(notificationId);
  if (n) store.notifications.set(notificationId, { ...n, read: true });
  if (isSupabaseConfigured) {
    void supabase.from('notifications').update({ read: true }).eq('id', notificationId);
  }
}

export function markAllRead(userId: string): void {
  const store = getStore();
  for (const [id, n] of store.notifications.entries()) {
    if (n.userId === userId) store.notifications.set(id, { ...n, read: true });
  }
  if (isSupabaseConfigured) {
    void supabase.from('notifications').update({ read: true }).eq('user_id', userId);
  }
}
