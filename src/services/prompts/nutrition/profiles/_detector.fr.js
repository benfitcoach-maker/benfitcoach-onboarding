// V96.11 — Profile detector for the nutrition prompt composer (Phase 3.B).
//
// Maps a client `form` (anamnese) to a list of structured profile tags that
// the composer uses to decide which profile-specific modules to inject into
// the final prompt. Detection is intentionally conservative:
//   - Only triggers a module when the signal is unambiguous in the form.
//   - Returns an ordered list with `primary` first, then comorbidities and
//     context flags.
//
// CRITICAL : tags returned here MUST match exactly the keys exposed by the
// modules registry in ./index.fr.js. Any new module = update both files.
//
// DRAFT V96.11 — detection rules to be reviewed with Anissa before activating
// the composer in production. The default code path (buildSystemPromptFr in
// ../fr.js) is unaffected by this file.

/**
 * @typedef {'femmeCycle' | 'perimenopause' | 'menopause' | 'grossesse' | 'allaitement' | 'postPartum' | 'diabete' | 'digestifChronique' | 'clostridiumDifficile' | 'nephropathie' | 'saos' | 'complicationsDiabete' | 'performanceSportif' | 'thyroide' | 'burnoutCortisol' | 'preConceptionFertilite' | 'spm' | 'endometriose' | 'tdah' | 'sopk'} ProfileTag
 */

/** Parse a numeric field defensively (returns NaN if missing). */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Normalize a string field to lowercase trimmed. */
function lc(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

/**
 * V96.18 — Calcule l'age depuis une date de naissance ISO (YYYY-MM-DD).
 * Renvoie null si dateNaissance manquante ou invalide. Utilise dans tout le
 * detecteur en remplacement du champ `f.age` brut (qui devient obsolete).
 */
function ageFromDob(dob) {
  if (!dob || typeof dob !== 'string') return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** Resolves age from dateNaissance (priority) or falls back to f.age. */
function resolveAge(form) {
  const dobAge = ageFromDob(form?.dateNaissance);
  if (dobAge != null) return dobAge;
  return num(form?.age);
}

/**
 * V97.34 (réconciliation schéma in-app ↔ détecteur, 2026-06-12) — résout
 * l'état maternel depuis DEUX formats d'entrée, sans en privilégier un :
 *   - legacy (cockpit AnissaClientForm / fallback QuestionnaireClient) :
 *     champs SÉPARÉS grossesseActuelle / allaitement / postPartum = "Oui"/"Non".
 *   - in-app (pré-questionnaire app cliente, lib/questionnaire-schema.ts) :
 *     UN champ combiné grossesseActuelle = "Non" | "Grossesse" | "Allaitement"
 *     | "PostPartum".
 *
 * DISPATCH PAR VALEUR, jamais "non-vide" : dans le format in-app le même champ
 * grossesseActuelle porte aussi "Allaitement"/"PostPartum". Un test paresseux
 * `grossesseActuelle !== 'Non'` classerait une femme ALLAITANTE comme enceinte
 * (faux positif inverse, défaut de sécurité dans l'autre sens). On lit donc la
 * valeur explicitement.
 *
 * STRICTEMENT ADDITIF : 'oui' reste mappé vers grossesse (cockpit/fallback
 * legacy préservés) ; on n'ajoute QUE la reconnaissance des libellés combinés.
 * Précédence : grossesse > allaitement > postPartum.
 *
 * @returns {'grossesse'|'allaitement'|'postPartum'|null}
 */
export function resolveMaternalState(form) {
  const f = form || {};
  // Valeur du champ (potentiellement combiné) grossesseActuelle, normalisée
  // (minuscule, sans espaces ni tirets) pour matcher "PostPartum"/"Post-partum".
  const ga = lc(f.grossesseActuelle).replace(/[\s-]/g, '');

  // grossesse — legacy "Oui" OU combiné "Grossesse" OU alias legacy f.grossesse.
  if (ga === 'oui' || ga === 'grossesse' || lc(f.grossesse) === 'oui') {
    return 'grossesse';
  }
  // allaitement — combiné "Allaitement" OU champ legacy séparé f.allaitement.
  if (ga === 'allaitement' || lc(f.allaitement) === 'oui') {
    return 'allaitement';
  }
  // post-partum — combiné "PostPartum" OU champ legacy séparé f.postPartum.
  if (ga === 'postpartum' || lc(f.postPartum) === 'oui') {
    return 'postPartum';
  }
  return null;
}

/**
 * Detect the PRIMARY hormonal/life-stage profile (max 1 per client).
 * Order of precedence : grossesse > allaitement > menopause > perimenopause >
 * femmeCycle. Returns null for men or when no primary profile applies.
 *
 * Note V96.11 : grossesse and allaitement modules are not yet shipped — only
 * menopause / perimenopause / femmeCycle are returned here. The detector still
 * checks pregnancy/breastfeeding flags so we can short-circuit and avoid
 * shipping a generic plan that would be unsafe for those clients.
 *
 * @returns {{ tag: ProfileTag | null, blocked: boolean, reason?: string }}
 */
function detectPrimaryFemaleProfile(form) {
  const f = form || {};
  const genre = lc(f.genre);
  if (genre && genre !== 'femme' && genre !== 'female' && genre !== 'f') {
    return { tag: null, blocked: false };
  }

  // V96.17 — Grossesse / allaitement / post-partum : modules dedies disponibles.
  // V96.18 — champs structures `grossesseActuelle`, `allaitement`, `postPartum`
  // prioritaires sur regex texte (anamnese formalisee).
  // V97.34 — objectif_primaire / dureeProbleme (noms émis par le pré-q in-app)
  // ajoutés au scan texte libre EN PLUS de objectifPrincipal (legacy), pas en
  // remplacement : le filet regex (« enceinte » écrit dans l'objectif) était
  // débranché par le décalage de nom. Additif.
  const allText = [
    f.pathologies, f.objectifPrincipalNutrition, f.objectifPrincipal,
    f.objectif_primaire, f.dureeProbleme,
    f.commentaires, f.commentaire, f.notes, f.symptomes, f.contexteEmotionnel,
  ].filter(Boolean).map(lc).join(' | ');

  // V97.34 — état maternel résolu depuis legacy ET combiné in-app (cf.
  // resolveMaternalState). Le second terme regex reste le filet texte libre.
  const maternal = resolveMaternalState(f);
  if (maternal === 'grossesse'
    || /\benceinte\b|\bgrossesse\b|trimestre\s*[123]|t[123]\s*grossesse|\bsemaine\s*amenorrh/i.test(allText)) {
    return { tag: 'grossesse', blocked: false };
  }
  if (maternal === 'allaitement'
    || /\ballait|\bteta?ee|\bteter\b|consultante\s*lactation|\bdiversification/i.test(allText)) {
    return { tag: 'allaitement', blocked: false };
  }
  if (maternal === 'postPartum'
    || /post.?partum|post.?accouch|apres\s*accouch|sevrage\s*allait|\bcouches\b/i.test(allText)) {
    return { tag: 'postPartum', blocked: false };
  }

  // Menopause : explicit flag OR age >= 52 + cycle absent for >= 12 months.
  const menopauseFlag = lc(f.menopause);
  if (menopauseFlag === 'oui' || menopauseFlag === 'confirmee') {
    return { tag: 'menopause', blocked: false };
  }
  const age = resolveAge(f);  // V96.18 : dateNaissance prioritaire sur f.age
  if (age >= 52 && lc(f.cycleRegulier) === 'non' && lc(f.derniereRegle) === 'plus_12_mois') {
    return { tag: 'menopause', blocked: false };
  }

  // Perimenopause : 40-55 with hormonal signs (chaleurs, sommeil perturbe,
  // cycle irregulier) OR explicit flag.
  if (lc(f.perimenopause) === 'oui') {
    return { tag: 'perimenopause', blocked: false };
  }
  if (age >= 40 && age <= 55) {
    const signs = [
      lc(f.bouffeesChaleur) === 'oui',
      lc(f.sueursNocturnes) === 'oui',
      lc(f.cycleRegulier) === 'non' || lc(f.cycleRegulier) === 'irregulier',
      lc(f.troubleSommeil) === 'oui',
    ].filter(Boolean).length;
    if (signs >= 2) return { tag: 'perimenopause', blocked: false };
  }

  // Default for women of reproductive age (18-50 with regular or trackable cycle).
  if (age != null && age >= 18 && age < 52) {
    return { tag: 'femmeCycle', blocked: false };
  }

  return { tag: null, blocked: false };
}

/**
 * Detect comorbidity / pathology modules (additive, max 2 to avoid prompt bloat).
 * Currently shipped : `diabete`, `digestifChronique`.
 *
 * @returns {ProfileTag[]} ordered list, most relevant first.
 */
function detectPathologyProfiles(form) {
  const f = form || {};
  const tags = [];

  // V96.15 — scanner sur plusieurs champs texte libre (pas seulement
  // f.pathologies). Anissa note souvent les comorbidites dans l'objectif,
  // les commentaires ou les symptomes (ex : "hapnee du sommeil niveau 3"
  // saisie dans l'objectif principal pour Melissa).
  const allTextFields = [
    f.pathologies, f.objectifPrincipalNutrition, f.objectifPrincipal,
    f.commentaires, f.commentaire, f.notes, f.symptomes,
    f.douleursInflammations, f.troublesPeau, f.contexteEmotionnel,
    f.antecedentsMedicaux, f.medicamentsActuels, f.observations,
  ].filter(Boolean).map(lc).join(' | ');

  const pathologies = allTextFields; // alias pour les regex existantes
  const objectif = lc(f.objectifPrincipalNutrition || f.objectifPrincipal || '');
  const ballonnements = num(f.frequenceBallonnements);
  const apneeNiveau = num(f.apneeSommeilNiveau || f.apneeNiveau || f.iah);
  const ageDiabete = num(f.ageDebutDiabete || f.dureeDiabete);

  // V97.4 V3.H quick win — détection glycémie instable depuis les champs
  // structurés (fringalesSucre, variationsGlycemie, reactionGlucides) qui
  // sont collectés étape symptomes mais n'étaient pas exploités. PATTERN
  // COMBINATOIRE (jamais un signal isolé) pour éviter faux positifs :
  //   - fringales quotidiennes OU plusieurs fois par jour
  //   - ET (variations glycémiques marquées OU réaction glucides hors "stable")
  const fringales = lc(f.fringalesSucre);
  const variationsGlyc = lc(f.variationsGlycemie);
  const reactGluc = Array.isArray(f.reactionGlucides)
    ? f.reactionGlucides.map(lc)
    : [];
  const hasStrongCravings = fringales.includes('quotidien') || fringales.includes('plusieurs');
  const hasVariationsMarquees =
    variationsGlyc.includes('permanence') ||
    variationsGlyc.includes('apres les repas') ||
    variationsGlyc.includes('milieu de journee');
  const hasUnstableReaction = reactGluc.some((r) =>
    r.includes('somnolence') || r.includes('faim rapide') || r.includes('ballonnement'),
  );
  const hasGlycemicInstability = hasStrongCravings && (hasVariationsMarquees || hasUnstableReaction);

  // Diabete : T1, T2, prediabete, glycemie, insulinoresistance.
  // V3.H quick win : déclenche aussi sur pattern glycémie instable structuré.
  const hasDiabete = /diabete|diabète|t1|t2|insulinoresist|prediabete/i.test(pathologies)
    || /glycemie|insuline/i.test(objectif)
    || hasGlycemicInstability;
  if (hasDiabete) {
    tags.push('diabete');
  }

  // V96.14 — Complications du diabete (additif a `diabete`) : retinopathie,
  // cataracte diabetique, neuropathie, mal perforant, calcifications arterielles.
  // On ne le pousse QUE si le module diabete est deja detecte (sinon hors-scope).
  if (hasDiabete && /retinopath|cataracte|neuropath|mal\s*perforant|pied\s*diabetique|calcification|atherosclero/i.test(pathologies)) {
    tags.push('complicationsDiabete');
  }

  // Digestif chronique : SII, MICI, RGO, dysbiose, ou ballonnements frequents
  // (score <= 2 sur l'echelle 1-5).
  if (/sii|crohn|rch|mici|rgo|reflux|dysbiose|colopathie/i.test(pathologies)
    || (ballonnements && ballonnements <= 2)) {
    tags.push('digestifChronique');
  }

  // V96.14 — Nephropathie / fonction renale fragilisee (post diabete, HTA,
  // ou IRC primitive). Mots-cles : nephropath, insuffisance renale, IRC,
  // microalbuminurie, eGFR diminue, dialyse.
  // V96.15 — heuristique additionnelle : T1 declare > 20 ans => suspicion.
  // V96.16 — heuristique elargie : si T1 + complications (retinopathie,
  // calcifications, neuropathie), suspicion forte de nephropathie associee
  // (les complications microvasculaires evoluent souvent de pair). Anissa
  // peut affiner via anamnese, mais on protege par defaut.
  const hasNephropathie = /nephropath|insuffisance\s*renale|\birc\b|microalbumin|egfr|dialyse|fonction\s*renale\s*(diminuee|alteree|fragile)|preserver\s*(les|tes)\s*reins|protege.*rein/i.test(pathologies);
  const hasT1 = hasDiabete && /t1|type\s*1|depuis\s*l'enfance|depuis\s*\d{2,}\s*ans/i.test(pathologies);
  const t1AncienSuspicion = hasT1
    && (ageDiabete >= 20 || /\b(2[0-9]|[3-9][0-9])\s*ans\b/.test(pathologies));
  const hasComplicationsMicrovasculaires = /retinopath|cataracte|neuropath|mal\s*perforant|pied\s*diabetique|calcification|atherosclero/i.test(pathologies);
  const t1AvecComplicationsSuspicion = hasT1 && hasComplicationsMicrovasculaires;
  if (hasNephropathie || t1AncienSuspicion || t1AvecComplicationsSuspicion) {
    tags.push('nephropathie');
  }

  // V96.14 — SAOS / apnee du sommeil. Detection : flag explicite dans
  // pathologies, OU IAH renseigne >= 5, OU IMC > 30 + tour de cou eleve
  // (>43 cm homme / >40 cm femme) + ronflement declare.
  const hasApneeFlag = /apnee\s*(du)?\s*sommeil|saos|sahos|\biah\b|\bppc\b|\bcpap\b/i.test(pathologies);
  const hasApneeIAH = apneeNiveau >= 5;
  if (hasApneeFlag || hasApneeIAH) {
    tags.push('saos');
  }

  // V96.12 — Clostridioides difficile (CDI) : infection severe post-antibio,
  // recidivante. Detectee prioritairement et independante du `digestifChronique`
  // qui ne couvre pas les specificites infectieuses (rehydratation, recolonisation,
  // garde-fous probiotiques, signaux d'alerte megacolon toxique). On l'insere en
  // tete pour qu'elle soit prioritaire au cap.
  if (/clostridi(?:um|oides)\s*difficile|c\.\s*diff|cdi\b/i.test(pathologies)) {
    tags.unshift('clostridiumDifficile');
  }

  // V96.26 — 8 nouveaux modules suite priorisation Anissa.

  // Performance sportif : objectif performance OU pratique sportive intense.
  if (/performance|musculation|hypertroph|endurance|marathon|triathl|crossfit|powerlift|rugby|football\s*pro/i.test(pathologies + ' ' + objectif)
    || /performance/i.test(lc(f.frequenceSport)) || lc(f.objectifSportif) === 'performance') {
    tags.push('performanceSportif');
  }

  // Thyroide / clarte hormonale : Hashimoto, hypo, hyper, Levothyrox, Basedow.
  if (/thyro[iï]d|hashimoto|levothyrox|basedow|hypothyr|hyperthyr|tsh\s*(haut|bas|elevee?|diminuee?)/i.test(pathologies)) {
    tags.push('thyroide');
  }

  // Burn-out / cortisol chronique : flag explicite OU stress >= 8/10.
  const stress = num(f.niveauStressActuel);
  if (/burn[\s-]?out|surmenage|epuisement\s*professionnel|fatigue\s*chronique\s*severe/i.test(pathologies)
    || stress >= 8) {
    tags.push('burnoutCortisol');
  }

  // Pre-conception / fertilite / env cellulaire : projet grossesse OUI,
  // parcours PMA, fertilite, IVF, FIV, IAC.
  if (lc(f.projetGrossesse) === 'oui'
    || /pre.?conception|fertilit|infertilit|\bpma\b|\bfiv\b|\biac\b|conception/i.test(pathologies + ' ' + objectif)) {
    tags.push('preConceptionFertilite');
  }

  // SPM : flag explicite OU regles douloureuses notees.
  if (/spm|premenstr|dysmenorrh|regles\s*douloureuses/i.test(pathologies + ' ' + lc(f.spm) + ' ' + lc(f.douleursMenstruelles))
    || (lc(f.spm) && /oui|fort|severe|regulier/i.test(f.spm))
    || (lc(f.douleursMenstruelles) && /oui|fort|severe|regulier/i.test(f.douleursMenstruelles))) {
    tags.push('spm');
  }

  // Endometriose : flag explicite, frequemment sous-diagnostique.
  if (/endometr|adenomyose/i.test(pathologies)) {
    tags.push('endometriose');
  }

  // SOPK : Syndrome des Ovaires Poly-Kystiques. Mots-cles : SOPK, PCOS,
  // ovaires polykystiques, hyperandrogenie, acne adulte severe.
  if (/sopk|\bpcos\b|ovaires?\s*polykyst|hyperandrog/i.test(pathologies)) {
    tags.push('sopk');
  }

  // TDAH / TDA : adulte ou enfant.
  if (/\btdah\b|\btda\b|attention\s*deficit|hyperactiv/i.test(pathologies)) {
    tags.push('tdah');
  }

  // V96.14 — cap monte de 2 a 4 pour permettre les profils multi-comorbidites.
  // V96.17 — cap monte de 4 a 5.
  // V96.26 — cap monte de 5 a 7 pour absorber les profils ultra-complexes
  // (ex: femme avec SOPK + thyroide + burn-out + spm + tdah). Le composer
  // applique un cap final a 8 modules total (1 primary + 7 pathologies).
  return tags.slice(0, 7);
}

/**
 * Top-level detector. Returns the full structured profile a composer can
 * consume. The shape is stable and additive — adding new tags must not
 * remove or rename existing ones.
 *
 * @returns {{
 *   primary: ProfileTag | null,
 *   blocked: boolean,
 *   blockReason?: string,
 *   pathologies: ProfileTag[],
 *   all: ProfileTag[],
 * }}
 */
export function detectClientProfile(form) {
  const primaryRes = detectPrimaryFemaleProfile(form);
  const pathologies = detectPathologyProfiles(form);

  const all = [];
  if (primaryRes.tag) all.push(primaryRes.tag);
  for (const t of pathologies) if (!all.includes(t)) all.push(t);

  return {
    primary: primaryRes.tag,
    blocked: primaryRes.blocked,
    blockReason: primaryRes.reason,
    pathologies,
    all,
  };
}
