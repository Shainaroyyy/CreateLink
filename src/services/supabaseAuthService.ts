import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import type { User, UserRole } from "../types/index";

function toUserFromProfile(profile: any, authUser?: any): User {
  return {
    id: profile?.id ?? authUser?.id ?? "",
    email: profile?.email ?? authUser?.email ?? "",
    passwordHash: "supabase-auth",
    role: (profile?.role as UserRole) ?? "creator",
    verificationStatus: (profile?.verification_status as any) ?? "unverified",
    emailVerified: Boolean(profile?.email_verified ?? authUser?.email_confirmed_at),
    createdAt: profile?.created_at ?? authUser?.created_at ?? new Date().toISOString(),
    failedLoginAttempts: 0,
    lockedUntil: null,
  };
}

async function getProfileById(id: string) {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("Failed to fetch profile:", error.message);
    return null;
  }

  return data;
}

export async function register(
  email: string,
  password: string,
  role: UserRole,
  profile?: any
): Promise<User> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/verify-email`,
      data: {
        role,
        display_name: profile?.displayName ?? profile?.name ?? email.split("@")[0],
        company_name: profile?.companyName ?? "",
        industry: profile?.industry ?? "",
        bio: profile?.bio ?? "",
      },
    },
  });

  if (error) throw error;

  const authUser = data.user;
  if (!authUser) {
    throw new Error("Supabase sign-up returned no user.");
  }

  const profileRow = {
    id: authUser.id,
    email,
    role,
    display_name: profile?.displayName ?? profile?.name ?? email.split("@")[0],
    company_name: profile?.companyName ?? "",
    industry: profile?.industry ?? "",
    bio: profile?.bio ?? "",
    email_verified: Boolean(authUser.email_confirmed_at),
    verification_status: authUser.email_confirmed_at ? "verified" : "unverified",
    created_at: authUser.created_at ?? new Date().toISOString(),
  };

  return toUserFromProfile(profileRow, authUser);
}

export async function login(email: string, password: string): Promise<User> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  const authUser = data.user;
  if (!authUser) {
    throw new Error("Supabase login returned no user.");
  }

  const profile = await getProfileById(authUser.id);
  const mappedUser = toUserFromProfile(profile ?? {
    id: authUser.id,
    email: authUser.email,
    role: "creator",
    verification_status: authUser.email_confirmed_at ? "verified" : "unverified",
    email_verified: Boolean(authUser.email_confirmed_at),
    created_at: authUser.created_at ?? new Date().toISOString(),
  }, authUser);

  return mappedUser;
}

export async function logout(): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const profile = await getProfileById(user.id);
  return toUserFromProfile(profile ?? {
    id: user.id,
    email: user.email,
    role: "creator",
    verification_status: user.email_confirmed_at ? "verified" : "unverified",
    email_verified: Boolean(user.email_confirmed_at),
    created_at: user.created_at ?? new Date().toISOString(),
  }, user);
}

export async function verifyEmail(token: string, email?: string): Promise<User> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.");
  }

  if (!email) {
    throw new Error("Email is required to verify the Supabase signup token.");
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });

  if (error) throw error;

  const authUser = data.user;
  if (!authUser) throw new Error("Email verification did not return a user.");

  const profile = await getProfileById(authUser.id);
  return toUserFromProfile(profile ?? {
    id: authUser.id,
    email: authUser.email,
    role: "creator",
    verification_status: authUser.email_confirmed_at ? "verified" : "unverified",
    email_verified: Boolean(authUser.email_confirmed_at),
    created_at: authUser.created_at ?? new Date().toISOString(),
  }, authUser);
}

export async function resendVerification(email: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) throw error;
}

export async function resetPassword(email: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
}

export async function applyPasswordReset(token: string, newPassword: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.");
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}