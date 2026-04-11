import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const isCloudEnabled = !!supabase;

// Valid users
export const USERS = ['Benoit', 'Anissa'];

// Password hashing with SHA-256
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get stored password hash for a specific user
export async function getStoredPasswordHash(username) {
  if (!supabase) return null;
  const key = `password_hash_${username.toLowerCase()}`;
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', key)
    .single();
  return data?.value || null;
}

// Set the password hash for a specific user
export async function setPasswordHash(username, hash) {
  if (!supabase) return;
  const key = `password_hash_${username.toLowerCase()}`;
  await supabase
    .from('app_config')
    .upsert({ key, value: hash });
}
