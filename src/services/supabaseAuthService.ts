import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import type { User, UserRole } from "../types/index";

export function formatDisplayName(rawName?: string, email?: string): string {
  if (rawName && rawName.trim().length > 0 && !rawName.includes('@')) {
    return rawName.trim();
  }
  if (email) {
    const userPart = email.split('@')[0];
    const withoutNumbers = userPart.replace(/[0-9]+$/, '');
    if (withoutNumbers.toLowerCase() === 'archiaggarwal') {
      return 'Archi Aggarwal';
    }
    if (withoutNumbers.toLowerCase() === 'preetiaggarwal') {
      return 'Preeti Aggarwal';
    }
    return userPart.charAt(0).toUpperCase() + userPart.slice(1);
  }
  return 'Creator';
}

function toUserFromProfile(profile: any, authUser?: any): User {
  const meta = authUser?.user_metadata || {};
  const metaName = (meta.display_name || meta.name || '').trim();
  const profileName = (profile?.display_name || profile?.name || '').trim();
  const email = profile?.email ?? authUser?.email ?? '';

  let rawName = profileName;
  const isProfileEmail =
    !profileName ||
    profileName.includes('@') ||
    (email && profileName.toLowerCase() === email.split('@')[0].toLowerCase());
  const isMetaCustom =
    metaName &&
    !metaName.includes('@') &&
    (!email || metaName.toLowerCase() !== email.split('@')[0].toLowerCase());

  if (isProfileEmail && isMetaCustom) {
    rawName = metaName;
  } else if (!rawName && metaName) {
    rawName = metaName;
  }

  const displayName =
    rawName?.trim() || formatDisplayName(undefined, email);

  return {
    id: profile?.id ?? authUser?.id ?? "",
    email,
    displayName,
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

  // Supabase returns an empty identities array if the email is already registered
  if (authUser.identities && Array.isArray(authUser.identities) && authUser.identities.length === 0) {
    throw new Error("An account with this email already exists. Please log in instead.");
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

  // 1. Ensure record exists in profiles table
  try {
    await supabase.from("profiles").upsert([profileRow]);
  } catch (err) {
    console.warn("Failed to upsert profiles row on register:", err);
  }

  // 2. If creator, ensure record exists in creator_profiles table
  if (role === "creator") {
    try {
      const creatorRow = {
        id: authUser.id,
        email: authUser.email || email,
        name: profile?.displayName ?? profile?.name ?? email.split("@")[0],
        category: profile?.niche || "Not specified",
        trust_score: 0,
        created_at: authUser.created_at ?? new Date().toISOString(),
      };
      await supabase.from("creator_profiles").upsert([creatorRow]);
    } catch (err) {
      console.warn("Failed to upsert creator_profiles row on register:", err);
    }
  }

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

  let profile = await getProfileById(authUser.id);

  // Self-heal profile and creator_profile if missing
  if (!profile) {
    const meta = authUser.user_metadata || {};
    const role: UserRole = (meta.role as UserRole) || "creator";
    const displayName = meta.display_name || authUser.email?.split("@")[0] || "User";

    profile = {
      id: authUser.id,
      email: authUser.email,
      role,
      display_name: displayName,
      company_name: meta.company_name || "",
      industry: meta.industry || "",
      bio: meta.bio || "",
      verification_status: authUser.email_confirmed_at ? "verified" : "unverified",
      email_verified: Boolean(authUser.email_confirmed_at),
      created_at: authUser.created_at ?? new Date().toISOString(),
    };

    try {
      await supabase.from("profiles").upsert([profile]);
    } catch (err) {
      console.warn("Self-heal profiles row failed:", err);
    }

    if (role === "creator") {
      try {
        await supabase.from("creator_profiles").upsert([{
          id: authUser.id,
          email: authUser.email,
          name: displayName,
          category: meta.niche || "Not specified",
          trust_score: 0,
          created_at: authUser.created_at ?? new Date().toISOString(),
        }]);
      } catch (err) {
        console.warn("Self-heal creator_profiles row failed:", err);
      }
    }
  }

  const mappedUser = toUserFromProfile(profile, authUser);
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

  let profile = await getProfileById(user.id);

  // Self-heal profile if missing
  if (!profile) {
    const meta = user.user_metadata || {};
    const role: UserRole = (meta.role as UserRole) || "creator";
    const displayName = meta.display_name || user.email?.split("@")[0] || "User";

    profile = {
      id: user.id,
      email: user.email,
      role,
      display_name: displayName,
      company_name: meta.company_name || "",
      industry: meta.industry || "",
      bio: meta.bio || "",
      verification_status: user.email_confirmed_at ? "verified" : "unverified",
      email_verified: Boolean(user.email_confirmed_at),
      created_at: user.created_at ?? new Date().toISOString(),
    };

    try {
      await supabase.from("profiles").upsert([profile]);
      if (role === "creator") {
        await supabase.from("creator_profiles").upsert([{
          id: user.id,
          email: user.email,
          name: displayName,
          category: meta.niche || "Not specified",
          trust_score: 0,
          created_at: user.created_at ?? new Date().toISOString(),
        }]);
      }
    } catch (err) {
      console.warn("Self-heal profile during getCurrentUser failed:", err);
    }
  } else {
    // If profile exists, check if user metadata has a newer custom name than an email-based profile name
    const meta = user.user_metadata || {};
    const metaName = (meta.display_name || meta.name || '').trim();
    const profileName = (profile.display_name || '').trim();
    const email = profile.email || user.email || '';
    const isProfileEmail =
      !profileName ||
      profileName.includes('@') ||
      (email && profileName.toLowerCase() === email.split('@')[0].toLowerCase());
    const isMetaCustom =
      metaName &&
      !metaName.includes('@') &&
      (!email || metaName.toLowerCase() !== email.split('@')[0].toLowerCase());

    if (isProfileEmail && isMetaCustom) {
      profile.display_name = metaName;
      try {
        supabase.from('profiles').update({ display_name: metaName }).eq('id', user.id).then();
        supabase.from('creator_profiles').update({ name: metaName }).eq('id', user.id).then();
      } catch {}
    }
  }

  return toUserFromProfile(profile, user);
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