import type { User, UserRole, Brand, Creator } from '../types/index';
import { getStore } from './store';
import { generateId, nowISO, simulateLatency } from './mockUtils';
import { validatePassword } from '../lib/validation';
import { createNotification } from './notificationService';

const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_TTL_MS = 30 * 60 * 1000;      // 30 minutes

export class AuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function register(email: string, password: string, role: UserRole, profile?: any): Promise<User> {
  await simulateLatency(300, 800);
  const store = getStore();

  const validationError = validatePassword(password);
  if (validationError) throw new AuthError('invalid_password', validationError);

  const existing = Array.from(store.users.values()).find((u) => u.email === email);
  if (existing) throw new AuthError('email_taken', 'An account with this email already exists.');

  const user: User = {
    id: generateId(),
    email,
    passwordHash: `mock_hash_${password}`, // mock — no real hashing
    role,
    verificationStatus: 'unverified',
    emailVerified: true, // Default to true in mock environment to bypass email verification blockade
    createdAt: nowISO(),
    failedLoginAttempts: 0,
    lockedUntil: null,
  };
  store.users.set(user.id, user);

  // ── Auto-create a Creator profile when role is 'creator' ──────────────────
  if (role === 'creator') {
    const displayName = profile?.displayName || email.split('@')[0];
    const creator: Creator = {
      id: `creator-${user.id}`,
      userId: user.id,
      displayName,
      bio: profile?.bio || 'Content creator on CreatorLink.',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
      contentCategories: profile?.contentCategories ?? ['lifestyle'],
      socialAccounts: [],
      trustScore: 0,
      trustScorePartialData: true,
      portfolio: [],
      collaborationHistory: [],
      insights: {
        audienceDemographics: {
          ageGroups: { '18-24': 0.4, '25-34': 0.4, '35-44': 0.15, '45+': 0.05 },
          topCountries: ['India'],
          genderSplit: { male: 0.5, female: 0.45, other: 0.05 },
        },
        primaryCategories: profile?.contentCategories ?? ['lifestyle'],
        averageEngagementRate: 0,
        collaborationCount: 0,
        successRate: 0,
      },
      verificationStatus: 'unverified',
    };
    store.creators.set(creator.id, creator);
  }

  // ── Auto-create a Brand profile when role is 'brand' ─────────────────────
  if (role === 'brand') {
    const brand: Brand = {
      id: `brand-${generateId()}`,
      userId: user.id,
      companyName: profile?.companyName || profile?.name || 'Brand',
      logoUrl: profile?.logoUrl || '',
      industry: profile?.industry || '',
      description: profile?.description || '',
      brandScore: 0,
      brandScorePartialData: true,
      isNewToPlatform: true,
      completedCollaborations: 0,
      averageCreatorRating: 0,
      averageResponseTimeHours: 48,
      campaigns: [],
      verificationStatus: 'unverified',
    };
    store.brands.set(brand.id, brand);
  }

  // Persist newly registered user/profile details to localStorage
  try {
    const initialUserIds = ['user-c1', 'user-c2', 'user-b1', 'user-b2'];
    const customUsers = Array.from(store.users.values()).filter(u => !initialUserIds.includes(u.id));
    localStorage.setItem('createlink-custom-users', JSON.stringify(customUsers));

    const initialCreatorIds = ['creator-1', 'creator-2', 'creator-3', 'creator-4', 'creator-5', 'creator-6'];
    const customCreators = Array.from(store.creators.values()).filter(c => !initialCreatorIds.includes(c.id));
    localStorage.setItem('createlink-custom-creators', JSON.stringify(customCreators));

    const initialBrandIds = ['brand-1', 'brand-2', 'brand-3'];
    const customBrands = Array.from(store.brands.values()).filter(b => !initialBrandIds.includes(b.id));
    localStorage.setItem('createlink-custom-brands', JSON.stringify(customBrands));
  } catch (e) {}

  await sendVerificationEmail(user.id);
  return user;
}

export async function sendVerificationEmail(userId: string): Promise<void> {
  await simulateLatency(200, 500);
  const store = getStore();
  const token = generateId();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  store.verificationTokens.set(token, { userId, expiresAt });
  // In a real app we'd send an email; here we expose the token on the store for testing
}

export async function resendVerification(email: string): Promise<void> {
  await simulateLatency(200, 500);
  const store = getStore();
  const user = Array.from(store.users.values()).find((u) => u.email === email);
  if (user) {
    await sendVerificationEmail(user.id);
  }
}

export async function verifyEmail(token: string): Promise<User> {
  await simulateLatency(200, 500);
  const store = getStore();
  const entry = store.verificationTokens.get(token);
  if (!entry) throw new AuthError('invalid_token', 'Verification link is invalid or has already been used.');
  if (new Date(entry.expiresAt) < new Date()) {
    store.verificationTokens.delete(token);
    throw new AuthError('expired_token', 'Verification link has expired. Please request a new one.');
  }
  const user = store.users.get(entry.userId);
  if (!user) throw new AuthError('user_not_found', 'User not found.');
  const updated: User = { ...user, emailVerified: true };
  store.users.set(user.id, updated);
  store.verificationTokens.delete(token);
  return updated;
}

export async function login(email: string, password: string): Promise<User> {
  await simulateLatency(300, 700);
  const store = getStore();
  const user = Array.from(store.users.values()).find((u) => u.email === email);
  if (!user) throw new AuthError('invalid_credentials', 'Invalid email or password.');

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remaining = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    throw new AuthError('account_locked', `Account locked. Try again in ${remaining} minute(s).`);
  }

  if (!user.emailVerified) throw new AuthError('email_not_verified', 'Please verify your email before logging in.');

  const passwordMatches =
    user.passwordHash === `mock_hash_${password}` ||
    (user.passwordHash.startsWith('$2b$10$mockHash') && password === 'Test1234!@#$');
  if (!passwordMatches) {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + LOCK_DURATION_MS).toISOString() : null;
    const updated: User = { ...user, failedLoginAttempts: attempts, lockedUntil };
    store.users.set(user.id, updated);
    if (lockedUntil) {
      createNotification(user.id, 'account_locked', 'Account Locked', 'Your account has been locked for 15 minutes due to 5 failed login attempts.');
    }
    throw new AuthError('invalid_credentials', 'Invalid email or password.');
  }

  // Success — reset counter
  const updated: User = { ...user, failedLoginAttempts: 0, lockedUntil: null };
  store.users.set(user.id, updated);
  return updated;
}

export async function resetPassword(email: string): Promise<void> {
  await simulateLatency(300, 700);
  const store = getStore();
  const user = Array.from(store.users.values()).find((u) => u.email === email);
  if (!user) return; // silently ignore unknown emails for security
  const token = generateId();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  store.verificationTokens.set(token, { userId: user.id, expiresAt });
}

export async function applyPasswordReset(token: string, newPassword: string): Promise<void> {
  await simulateLatency(200, 500);
  const store = getStore();
  const validationError = validatePassword(newPassword);
  if (validationError) throw new AuthError('invalid_password', validationError);
  const entry = store.verificationTokens.get(token);
  if (!entry) throw new AuthError('invalid_token', 'Reset link is invalid or has already been used.');
  if (new Date(entry.expiresAt) < new Date()) {
    store.verificationTokens.delete(token);
    throw new AuthError('expired_token', 'Reset link has expired.');
  }
  const user = store.users.get(entry.userId);
  if (!user) throw new AuthError('user_not_found', 'User not found.');
  store.users.set(user.id, { ...user, passwordHash: `mock_hash_${newPassword}` });
  store.verificationTokens.delete(token);
}
