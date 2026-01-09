import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getSupabaseClient = (): SupabaseClient => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  // During build, use placeholders to prevent failures
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                      process.env.NEXT_PHASE === 'phase-development-build';

  if (isBuildTime || !supabaseUrl || !supabaseAnonKey) {
    return createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder-anon-key'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = getSupabaseClient();
