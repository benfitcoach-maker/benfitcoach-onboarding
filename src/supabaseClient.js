import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const isCloudEnabled = !!supabase;

// Password hashing with SHA-256
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check if a password has been set
export async function getStoredPasswordHash() {
  if (!supabase) return null;
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'password_hash')
    .single();
  return data?.value || null;
}

// Set the password hash
export async function setPasswordHash(hash) {
  if (!supabase) return;
  await supabase
    .from('app_config')
    .upsert({ key: 'password_hash', value: hash });
}
