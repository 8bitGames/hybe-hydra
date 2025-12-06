/**
 * Supabase Service Role Client
 * ============================
 * Server-side client with service role privileges for internal operations
 * This client bypasses RLS policies - use only for trusted server-side operations
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let serviceClient: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * Get Supabase client with service role privileges
 * Use this for internal operations that need to bypass RLS
 */
export function getServiceClient() {
  if (serviceClient) {
    return serviceClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[Supabase] Missing service role credentials, falling back to anon client');
    // Return a client that will fail gracefully
    return createSupabaseClient(
      supabaseUrl || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
  }

  serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serviceClient;
}
