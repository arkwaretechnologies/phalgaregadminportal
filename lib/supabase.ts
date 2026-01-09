import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  // Return existing client if already created
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  // Check if we're in a build context
  // During build, Next.js may not have environment variables available
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                      process.env.NEXT_PHASE === 'phase-development-build' ||
                      process.env.NODE_ENV === 'production' && !supabaseUrl;

  if (isBuildTime) {
    // During build, create a placeholder client that won't be used
    // This prevents the build from failing
    supabaseClient = createClient(
      'https://placeholder.supabase.co',
      'placeholder-anon-key'
    );
    return supabaseClient;
  }

  // At runtime, validate and throw if missing
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  // Create and cache the client with actual values
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}

// Export a Proxy that lazily creates the client
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    // If it's a function, bind it to the client
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});


