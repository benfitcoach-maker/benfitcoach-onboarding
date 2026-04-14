import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export const isCloudEnabled = !!supabase;

export const USERS = ['Benoit', 'Anissa'];

export const USER_EMAILS = {
  Benoit: 'benfitcoach.geneve@gmail.com',
  Anissa: 'anissa.nutri@gmail.com',
};

export async function signIn(username, password) {
  if (!supabase) throw new Error('Cloud non disponible');
  const email = USER_EMAILS[username];
  if (!email) throw new Error('Utilisateur inconnu');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
