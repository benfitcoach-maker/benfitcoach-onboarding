// ─────────────────────────────────────────────────────────────────
// Phase AE — Notes internes Anissa par cliente
// Date : 2026-05-11
//
// Texte libre privé, jamais envoyé à la cliente. Stocké dans
// clients.notes_anissa (TEXT, migration AE). Anissa y note ses
// observations long-terme, hypothèses, points à creuser, etc.
//
// Pas de versioning : un seul bloc éditable. Si on veut un historique
// plus tard, on créera une table notes_anissa_log.
// ─────────────────────────────────────────────────────────────────

import { supabase } from '../supabaseClient';

/**
 * Récupère les notes internes d'une cliente. Retourne string vide si null.
 */
export async function fetchClientNotes(clientId) {
  if (!clientId) return '';
  const { data, error } = await supabase
    .from('clients')
    .select('notes_anissa')
    .eq('id', clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.notes_anissa || '';
}

/**
 * Sauvegarde les notes (overwrite). Retourne le texte sauvegardé.
 * Trim côté client pour éviter d'écrire des espaces vides.
 */
export async function saveClientNotes(clientId, text) {
  if (!clientId) throw new Error('clientId requis');
  const cleaned = (text || '').trim();
  const { data, error } = await supabase
    .from('clients')
    .update({ notes_anissa: cleaned || null })
    .eq('id', clientId)
    .select('notes_anissa')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.notes_anissa || '';
}
