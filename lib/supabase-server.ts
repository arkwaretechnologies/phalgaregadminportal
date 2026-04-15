import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { Agent, fetch as undiciFetch } from 'undici';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Node's fetch (undici) caps total response headers at 16 KiB by default. Kong / edge
// setups occasionally exceed that, which surfaces as UND_ERR_HEADERS_OVERFLOW.
const supabaseDispatcher = new Agent({
  maxHeaderSize: 256 * 1024,
});

function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Supabase passes the standard Request type; undici's fetch typings expect undici's Request.
  return undiciFetch(input as Parameters<typeof undiciFetch>[0], {
    ...init,
    dispatcher: supabaseDispatcher,
  } as Parameters<typeof undiciFetch>[1]) as unknown as Promise<Response>;
}

export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: supabaseFetch },
});
