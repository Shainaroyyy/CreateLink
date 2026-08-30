import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Determine if valid Supabase environment variables are provided
export const isSupabaseConfigured =
  import.meta.env.MODE === 'test'
    ? false
    : Boolean(supabaseUrl) &&
      Boolean(supabaseAnonKey) &&
      supabaseUrl !== 'your-supabase-url' &&
      supabaseAnonKey !== 'your-supabase-anon-key';

// Initialize the client. We use placeholders if credentials are not configured
// to prevent initial module loading failures.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key'
);
