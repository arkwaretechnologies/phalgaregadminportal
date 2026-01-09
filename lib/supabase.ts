import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Check if we're in build phase
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                    process.env.NEXT_PHASE === 'phase-development-build';

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Create client - use placeholder during build, real values at runtime
let supabaseClient: SupabaseClient;

if (isBuildTime) {
  // During build, use placeholder to prevent build failures
  supabaseClient = createClient(
    'https://placeholder.supabase.co',
    'placeholder-anon-key'
  );
} else {
  // At runtime, validate and use real values
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = supabaseClient;
