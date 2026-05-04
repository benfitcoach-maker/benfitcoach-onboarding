// V96.20 — PlanCockpit : bandeau guide-Anissa pour la generation et la
// livraison d'un plan nutrition. 4 macro-etapes (Preparer / Generer /
// Affiner / Livrer) avec auto-detection des sous-checks. Compact par defaut,
// expandable au click pour voir le detail de chaque etape.
//
// Philosophie : reduire la charge mentale d'Anissa, garantir qu'aucune etape
// critique ne soit oubliee (lettre intro, fiche frigo, recettes, export Word).
//
// Branche dans NutritionConsultation.jsx au-dessus de PlanQualityScore.

import { useState, useMemo } from 'react';
// V96.21 — calcul live du profil composer (sinon on attend qu'Anissa
// regenere pour voir les profils detectes dans le cockpit).
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
 * @param {boolean} props.hasPlan          true si plan deja genere
 * @param {object|null} props.liveScore    Score plan ({ normalized, hasHardFail })
 * @param {object|null} props.lastDetectedProfile  Profile composer detecte (badge)
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

  // V96.21 — Profil composer calcule en live depuis le form. V96.22 : on
  // calcule meme si composer beta est OFF, pour qu'Anissa voie les profils
  // potentiels et puisse decider d'activer le composer en connaissance de cause.
  const liveProfile = useMemo(() => {
    try { return detectClientProfile(f); }
    catch { return null; }
  }, [f]);
  const profileToDisplay = liveProfile || lastDetectedProfile;

  // ─── Auto-detection des sous-checks par etape ───
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
      // Etape 1 — PREPARER
      anamneseOk, hasLab, hasGenetic, profilesDetected, hasDirectives,
      // Etape 2 — GENERER
      planPresent, scoreOk, scoreModerate,
      // Etape 3 — AFFINER
      fridgePresent, supplementsPresent, planReviewed,
      // Etape 4 — LIVRER
      introLetter, recipesEnriched, wordExported,
    };
  }, [f, c, planDraft, supplementsDraft, hasPlan, liveScore, profileToDisplay, aiDirectives, composerBeta]);

  // ─── Etat de chaque macro-etape (done / current / pending) ───
  const stepsState = useMemo(() => {
    const step1Done = checks.anamneseOk;
    const step2Done = checks.planPresent;
    const step3Done = checks.fridgePresent && (isFollowup || checks.supplementsPresent);
    const step4Done = checks.introLetter && checks.recipesEnriched && checks.wordExported;

    // current = premiere etape non-done
    let current = 1;
    if (step1Done) current = 2;
    if (step1Done && step2Done) current = 3;
    if (step1Done && step2Done && step3Done) current = 4;
    if (step1Done && step2Done && step3Done && step4Done) current = 0; // tout done

    return [
      { id: 1, label: 'Preparer', done: step1Done, current: current === 1 },
      { id: 2, label: 'Generer', done: step2Done, current: current === 2 },
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
          {totalDone}/4 etapes
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

      {/* Detail expandable de l'etape selectionnee */}
      {expandedStep && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,.06)',
        }}>
          {expandedStep === 1 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              <CheckLine ok={checks.anamneseOk} label="Anamnese complete (date naissance, genre, pathologies, allergies)" />
              <CheckLine ok={checks.profilesDetected} optional
                label="Composer beta + profils cliniques detectes"
                hint={(() => {
                  const profilsList = profileToDisplay?.all?.length > 0
                    ? profileToDisplay.all.join(' + ')
                    : null;
                  if (composerBeta && profilsList) return `Profils actifs dans le prompt : ${profilsList}`;
                  if (composerBeta && !profilsList) return 'Composer beta active mais anamnese trop generique pour declencher un profil specifique';
                  if (!composerBeta && profilsList) return `Profils potentiels (composer OFF, non injectes) : ${profilsList} \u2014 active le toggle pour les utiliser`;
                  return 'Coche le toggle Composer beta a cote du bouton Generer pour activer la generation profil-aware';
                })()} />
              <CheckLine ok={checks.hasLab} label="Bilan sanguin renseigne" optional />
              <CheckLine ok={checks.hasGenetic} label="Analyse ADN renseignee" optional />
              <CheckLine ok={checks.hasDirectives} label="Directives IA additionnelles" optional
                hint={checks.hasDirectives ? `${aiDirectives.length} caracteres saisis` : 'Cas complexe : ajoute des consignes specifiques (refus aliment, contexte clinique...)'} />
            </ul>
          )}
          {expandedStep === 2 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              <CheckLine ok={checks.planPresent} label="Plan genere"
                hint={checks.planPresent ? `${(planDraft || '').length} caracteres` : "Click 'Generer avec l'IA'"} />
              <CheckLine ok={checks.scoreOk}
                label={checks.scoreOk
                  ? `Score qualite ${liveScore?.normalized?.toFixed(1)}/10 (excellent)`
                  : checks.scoreModerate
                  ? `Score qualite ${liveScore?.normalized?.toFixed(1)}/10 (a ameliorer)`
                  : 'Score qualite 8/10 minimum'}
                hint={liveScore?.hasHardFail ? 'Echec critique detecte — voir details du score' : null}
              />
            </ul>
          )}
          {expandedStep === 3 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              <CheckLine ok={checks.fridgePresent} label="Fiche frigo presente"
                hint={onJumpTab ? "Onglet 'Fiche frigo' pour verifier/editer" : null} />
              {!isFollowup && (
                <CheckLine ok={checks.supplementsPresent} label="Supplements rediges"
                  hint={onJumpTab ? "Onglet 'Supplements' pour verifier" : null} />
              )}
              <CheckLine ok={checks.planReviewed} label="Plan complet relu et ajuste" optional
                hint="Click sur les sections du plan pour ajuster manuellement" />
            </ul>
          )}
          {expandedStep === 4 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              <CheckLine ok={checks.introLetter} label="Lettre d'introduction generee"
                hint={onJumpTab ? "Onglet 'App cliente' > Lettre" : 'A generer dans l\u2019onglet App cliente'} />
              <CheckLine ok={checks.recipesEnriched} label="Recettes app enrichies"
                hint={onJumpTab ? "Onglet 'App cliente' > Recettes" : 'Necessaire avant publication app cliente'} optional />
              <CheckLine ok={checks.wordExported} label="Export Word effectue"
                hint="Bouton 'Word' en haut a droite de l'editeur" />
            </ul>
          )}

          {/* Quick jump to relevant tab */}
          {onJumpTab && expandedStep === 3 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => onJumpTab('frigo')}
                style={btnLink}>Aller a Fiche frigo {'\u2192'}</button>
              {!isFollowup && (
                <button type="button" onClick={() => onJumpTab('supp')}
                  style={btnLink}>Aller a Supplements {'\u2192'}</button>
              )}
            </div>
          )}
          {onJumpTab && expandedStep === 4 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => onJumpTab('app')}
                style={btnLink}>Aller a App cliente {'\u2192'}</button>
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
