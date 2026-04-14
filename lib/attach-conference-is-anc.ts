import { supabase } from '@/lib/supabase';
import type { RegistrationDetail } from '@/types';

export async function attachConferenceIsAnc(
  registration: RegistrationDetail
): Promise<RegistrationDetail> {
  if (!registration.confcode) {
    return { ...registration, is_anc: null };
  }
  const { data } = await supabase
    .from('conference')
    .select('is_anc')
    .eq('confcode', registration.confcode)
    .maybeSingle();
  return { ...registration, is_anc: data?.is_anc ?? null };
}
