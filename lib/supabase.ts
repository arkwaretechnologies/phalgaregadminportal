import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Mark this module as server-only to prevent Next.js from trying to bundle it for client
if (typeof window !== 'undefined') {
  throw new Error('Supabase client can only be used on the server');
}

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Check if we're in build phase
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                      process.env.NEXT_PHASE === 'phase-development-build';

  // Get environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

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

  return supabaseClient;
}

// Export as a getter object to avoid Next.js serialization issues
// Only expose the properties we actually use
export const supabase = {
  get from() {
    return getSupabaseClient().from;
  },
  get auth() {
    return getSupabaseClient().auth;
  },
  get storage() {
    return getSupabaseClient().storage;
  },
  get functions() {
    return getSupabaseClient().functions;
  },
  get realtime() {
    return getSupabaseClient().realtime;
  },
  get rpc() {
    return getSupabaseClient().rpc;
  },
} as unknown as SupabaseClient;
