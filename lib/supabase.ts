import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  // Return existing client if already created
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  // Only use placeholder during actual build phase, not at runtime
  // NEXT_PHASE is only set during build, not during runtime
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                      process.env.NEXT_PHASE === 'phase-development-build';

  if (isBuildTime) {
    // During build, create a placeholder client that won't be used
    // This prevents the build from failing
    supabaseClient = createClient(
      'https://placeholder.supabase.co',
      'placeholder-anon-key'
    );
    return supabaseClient;
  }

  // At runtime (including production), validate and throw if missing
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
      nodeEnv: process.env.NODE_ENV,
      nextPhase: process.env.NEXT_PHASE
    });
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


