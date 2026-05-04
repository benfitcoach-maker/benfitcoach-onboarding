// V96.20 — PlanCockpit : bandeau guide-Anissa pour la génération et la
// livraison d'un plan nutrition. 4 macro-étapes (Préparer / Générer /
// Affiner / Livrer) avec auto-détection des sous-checks. Compact par défaut,
// expandable au clic pour voir le détail de chaque étape.
//
// Philosophie : réduire la charge mentale d'Anissa, garantir qu'aucune étape
// critique ne soit oubliée (lettre intro, fiche frigo, recettes, export Word).
//
// Branché dans NutritionConsultation.jsx au-dessus de PlanQualityScore.

import { useState, useMemo } from 'react';
// V96.21 — calcul live du profil composer (sinon on attend qu'Anissa
// régénère pour voir les profils détectés dans le cockpit).
import { detectClientProfile } from '../services/prompts/nutrition/profiles/_detector.fr';

const COL_GREEN = '#6abf8a';
const COL_AMBER = '#e8a040';
const COL_GREY = 'rgba(255,255,255,.35)';

function StepDot({ done, current }) {
  const bg = done ? COL_GREEN : current ? COL_AMBER : 'rgba(255,255,255,.06)';
  const color = done || current ? '#0e150f' : COL_GREY;
  return (
    <span style={{
      display: 'inline-flex', width: 18, height: 18, borderRadius: '50%',
      background: bg, color, alignItems: 'center', justifyContent: 'center',
      fontSize: '.65rem', fontWeight: 700, flexShrink: 0,
    }}>
      {done ? '\u2713' : current ? '\u25b6' : ''}
    </span>
  );
}

function CheckLine({ ok, label, hint, optional = false }) {
  return (
    <li style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '4px 0', fontSize: '.8rem', lineHeight: 1.4,
    }}>
      <span style={{
        display: 'inline-flex', width: 14, height: 14, borderRadius: '50%',
        background: ok ? COL_GREEN : 'rgba(255,255,255,.08)',
        color: ok ? '#0e150f' : COL_GREY,
        alignItems: 'center', justifyContent: 'center',
        fontSize: '.6rem', fontWeight: 700, flexShrink: 0, marginTop: 2,
      }}>
        {ok ? '\u2713' : optional ? '\u25cb' : '\u2715'}
      </span>
      <span style={{ flex: 1, color: ok ? '#d8dfd6' : 'rgba(255,255,255,.55)' }}>
        {label}
        {hint && (
          <span style={{ display: 'block', fontSize: '.7rem', color: 'rgba(255,255,255,.4)', marginTop: 1 }}>
            {hint}
          </span>
        )}
        {optional && !ok && (
          <span style={{ marginLeft: 6, fontSize: '.65rem', color: 'rgba(255,255,255,.35)' }}>(optionnel)</span>
        )}
      </span>
    </li>
  );
}

/**
 * @param {object} props
 * @param {object} props.form              Anamnese client (clients.form)
 * @param {object} props.consultation      Consultation actuelle (avec recipes, intro_letter, etc.)
 * @param {string} props.planDraft         Plan markdown courant
 * @param {string} props.supplementsDraft  Texte supplements
 * @param {boolean} props.hasPlan          true si plan déjà généré
 * @param {object|null} props.liveScore    Score plan ({ normalized, hasHardFail })
 * @param {object|null} props.lastDetectedProfile  Profil composer détecté (badge)
 * @param {string} props.aiDirectives      Directives texte libre par cliente
 * @param {boolean} props.composerBeta     Toggle composer actif
 * @param {boolean} props.isFollowup       Mode followup (sinon plan complet)
 * @param {(tab: string) => void} [props.onJumpTab]  Optional : jump vers un onglet
 */
export default function PlanCockpit({
  form, consultation, planDraft, supplementsDraft, hasPlan,
  liveScore, lastDetectedProfile, aiDirectives, composerBeta, isFollowup,
  onJumpTab,
}) {
  const [expandedStep, setExpandedStep] = useState(null);
  const f = form || {};
  const c = consultation || {};

  // V96.21 — Profil composer calculé en live depuis le form. V96.22 : on
  // calcule même si composer bêta est OFF, pour qu'Anissa voie les profils
  // potentiels et puisse décider d'activer le composer en connaissance de cause.
  const liveProfile = useMemo(() => {
    try { return detectClientProfile(f); }
    catch { return null; }
  }, [f]);
  const profileToDisplay = liveProfile || lastDetectedProfile;

  // ─── Auto-détection des sous-checks par étape ───
  const checks = useMemo(() => {
    const hasDateNaissanceOrAge = Boolean(f.dateNaissance || f.age);
    const hasGenre = Boolean(f.genre);
    const hasPathologiesField = typeof f.pathologies !== 'undefined';
    const hasAllergiesField = typeof f.allergies !== 'undefined';
    const anamneseOk = hasDateNaissanceOrAge && hasGenre && hasPathologiesField && hasAllergiesField;

    const hasLab = Boolean(c.lab_results && Object.values(c.lab_results).some(v => v !== '' && v != null));
    const hasGenetic = Boolean(c.genetic_results && Object.keys(c.genetic_results || {}).length > 0);

    const profilesDetected = composerBeta && (profileToDisplay?.all?.length || 0) > 0;
    const hasDirectives = (aiDirectives || '').trim().length > 0;

    const planPresent = (planDraft || '').trim().length > 200;
    const scoreOk = liveScore?.normalized >= 8 && !liveScore?.hasHardFail;
    const scoreModerate = liveScore?.normalized >= 6 && liveScore?.normalized < 8;

    const fridgePresent = Boolean(c.fiche_frigo_json) || /fiche\s*frigo/i.test(planDraft || '');
    const supplementsPresent = (supplementsDraft || '').trim().length > 50;
    const planReviewed = c.lastReviewedAt || hasPlan; // proxy : on considere qu'ouvrir + sauver = relu

    const introLetter = Boolean(c.intro_letter || c.introLetter);
    const recipesEnriched = Boolean(c.recipes_enriched || c.recipesEnriched
      || (Array.isArray(c.recipes_data) && c.recipes_data.length > 0));
    const wordExported = Boolean(c.word_exported_at || c.wordExportedAt);

    return {
      // Étape 1 — PRÉPARER
      anamneseOk, hasLab, hasGenetic, profilesDetected, hasDirectives,
      // Étape 2 — GÉNÉRER
      planPresent, scoreOk, scoreModerate,
      // Étape 3 — AFFINER
      fridgePresent, supplementsPresent, planReviewed,
      // Étape 4 — LIVRER
      introLetter, recipesEnriched, wordExported,
    };
  }, [f, c, planDraft, supplementsDraft, hasPlan, liveScore, profileToDisplay, aiDirectives, composerBeta]);

  // ─── État de chaque macro-étape (done / current / pending) ───
  const stepsState = useMemo(() => {
    const step1Done = checks.anamneseOk;
    const step2Done = checks.planPresent;
    const step3Done = checks.fridgePresent && (isFollowup || checks.supplementsPresent);
    const step4Done = checks.introLetter && checks.recipesEnriched && checks.wordExported;

    // current = première étape non-done
    let current = 1;
    if (step1Done) current = 2;
    if (step1Done && step2Done) current = 3;
    if (step1Done && step2Done && step3Done) current = 4;
    if (step1Done && step2Done && step3Done && step4Done) current = 0; // tout done

    return [
      { id: 1, label: 'Préparer', done: step1Done, current: current === 1 },
      { id: 2, label: 'Générer', done: step2Done, current: current === 2 },
      { id: 3, label: 'Affiner', done: step3Done, current: current === 3 },
      { id: 4, label: 'Livrer', done: step4Done, current: current === 4 },
    ];
  }, [checks, isFollowup]);

  const totalDone = stepsState.filter(s => s.done).length;

  return (
    <div style={{
      width: '100%',
      background: 'linear-gradient(135deg, rgba(106,191,138,.04) 0%, rgba(108,141,255,.04) 100%)',
      border: '1px solid rgba(255,255,255,.08)',
      borderRadius: 12,
      padding: '10px 14px',
      marginBottom: 12,
    }}>
      {/* Bandeau compact */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{
          fontSize: '.68rem', fontWeight: 700, letterSpacing: '.08em',
          color: 'rgba(255,255,255,.5)',
        }}>
          COCKPIT
        </span>
        <span style={{
          fontSize: '.72rem',
          color: totalDone === 4 ? COL_GREEN : 'rgba(255,255,255,.55)',
          fontWeight: 600,
        }}>
          {totalDone}/4 étapes
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
          {stepsState.map((s, i) => (
            <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setExpandedStep(prev => prev === s.id ? null : s.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 999,
                  border: 'none', cursor: 'pointer',
                  background: s.current
                    ? 'rgba(232,160,64,.12)'
                    : s.done
                    ? 'rgba(106,191,138,.1)'
                    : 'rgba(255,255,255,.03)',
                  fontSize: '.74rem', fontWeight: 600,
                  color: s.current ? '#e8a040' : s.done ? COL_GREEN : COL_GREY,
                  transition: 'all .15s',
                  outline: expandedStep === s.id ? `1px solid ${s.current ? '#e8a040' : COL_GREEN}` : 'none',
                }}
              >
                <StepDot done={s.done} current={s.current} />
                <span>{s.id}. {s.label}</span>
              </button>
              {i < stepsState.length - 1 && (
                <span style={{ color: 'rgba(255,255,255,.15)', margin: '0 2px' }}>{'\u2192'}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Détail expandable de l'étape sélectionnée */}
      {expandedStep && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,.06)',
        }}>
          {expandedStep === 1 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              <CheckLine ok={checks.anamneseOk} label="Anamnèse complète (date naissance, genre, pathologies, allergies)" />
              <CheckLine ok={checks.profilesDetected} optional
                label="Composer bêta + profils cliniques détectés"
                hint={(() => {
                  const profilsList = profileToDisplay?.all?.length > 0
                    ? profileToDisplay.all.join(' + ')
                    : null;
                  if (composerBeta && profilsList) return `Profils actifs dans le prompt : ${profilsList}`;
                  if (composerBeta && !profilsList) return 'Composer bêta actif mais anamnèse trop générique pour déclencher un profil spécifique';
                  if (!composerBeta && profilsList) return `Profils potentiels (composer OFF, non injectés) : ${profilsList} \u2014 active le toggle pour les utiliser`;
                  return 'Coche le toggle Composer bêta à côté du bouton Générer pour activer la génération profil-aware';
                })()} />
              <CheckLine ok={checks.hasLab} label="Bilan sanguin renseigné" optional />
              <CheckLine ok={checks.hasGenetic} label="Analyse ADN renseignée" optional />
              <CheckLine ok={checks.hasDirectives} label="Directives IA additionnelles" optional
                hint={checks.hasDirectives ? `${aiDirectives.length} caractères saisis` : 'Cas complexe : ajoute des consignes spécifiques (refus aliment, contexte clinique...)'} />
            </ul>
          )}
          {expandedStep === 2 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              <CheckLine ok={checks.planPresent} label="Plan généré"
                hint={checks.planPresent ? `${(planDraft || '').length} caractères` : "Clique sur 'Générer avec l'IA'"} />
              <CheckLine ok={checks.scoreOk}
                label={checks.scoreOk
                  ? `Score qualité ${liveScore?.normalized?.toFixed(1)}/10 (excellent)`
                  : checks.scoreModerate
                  ? `Score qualité ${liveScore?.normalized?.toFixed(1)}/10 (à améliorer)`
                  : 'Score qualité 8/10 minimum'}
                hint={liveScore?.hasHardFail ? 'Échec critique détecté — voir détails du score' : null}
              />
            </ul>
          )}
          {expandedStep === 3 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              <CheckLine ok={checks.fridgePresent} label="Fiche frigo présente"
                hint={onJumpTab ? "Onglet 'Fiche frigo' pour vérifier/éditer" : null} />
              {!isFollowup && (
                <CheckLine ok={checks.supplementsPresent} label="Suppléments rédigés"
                  hint={onJumpTab ? "Onglet 'Suppléments' pour vérifier" : null} />
              )}
              <CheckLine ok={checks.planReviewed} label="Plan complet relu et ajusté" optional
                hint="Click sur les sections du plan pour ajuster manuellement" />
            </ul>
          )}
          {expandedStep === 4 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              <CheckLine ok={checks.introLetter} label="Lettre d'introduction générée"
                hint={onJumpTab ? "Onglet 'App cliente' > Lettre" : 'À générer dans l\u2019onglet App cliente'} />
              <CheckLine ok={checks.recipesEnriched} label="Recettes app enrichies"
                hint={onJumpTab ? "Onglet 'App cliente' > Recettes" : 'Nécessaire avant publication app cliente'} optional />
              <CheckLine ok={checks.wordExported} label="Export Word effectué"
                hint="Bouton 'Word' en haut à droite de l'éditeur" />
            </ul>
          )}

          {/* Quick jump to relevant tab */}
          {onJumpTab && expandedStep === 3 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => onJumpTab('frigo')}
                style={btnLink}>Aller à Fiche frigo {'\u2192'}</button>
              {!isFollowup && (
                <button type="button" onClick={() => onJumpTab('supp')}
                  style={btnLink}>Aller à Suppléments {'\u2192'}</button>
              )}
            </div>
          )}
          {onJumpTab && expandedStep === 4 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => onJumpTab('app')}
                style={btnLink}>Aller à App cliente {'\u2192'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const btnLink = {
  background: 'rgba(108,141,255,.12)',
  color: '#a8c1ff',
  border: '1px solid rgba(108,141,255,.3)',
  borderRadius: 8,
  padding: '5px 10px',
  fontSize: '.72rem',
  fontWeight: 600,
  cursor: 'pointer',
};
