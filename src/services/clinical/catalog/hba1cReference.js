// ─────────────────────────────────────────────────────────────────────────────
// HbA1c — table de référence IFCC (mmol/mol) — SOURCE DE VÉRITÉ UNIQUE
//
// Validé Anissa — HbA1c IFCC mmol/mol — plafond 200, frontière prédiabète 39,
// diabète 48 (réf. VALIDATION-CLINIQUE-ANISSA-V1.md).
//
// Frontière normale/prédiabète ALIGNÉE ADA : ≥39 mmol/mol = prédiabète,
// ≥48 = diabète. Choix clinique d'Anissa (longévité : repérer le prédiabète
// précoce 39–47 où la nutrition peut encore inverser la trajectoire).
//
// markers.js (ref_range + MARKER_PLAUSIBLE_MAX) ET labInterpretationEngine.js
// (bandes d'interprétation) DÉRIVENT d'ici — ne JAMAIS redéfinir les bornes
// HbA1c ailleurs. Une seule source de vérité.
//
// Bornes en ENTIERS INCLUSIFS (lecture clinicienne) :
//   normale    20 – 38   (< 39)
//   prédiabète 39 – 47
//   diabète    ≥ 48
//
// ⚠️ Le moteur classe en [min, max) (borne haute exclue, cf. classifyLabValue).
//    La dérivation des bandes moteur utilise donc prediabete.min (39) et
//    diabete.min (48) comme bornes hautes EXCLUES → une valeur de 39 tombe en
//    prédiabète, 48 en diabète. Les sous-bandes descriptives basses (low/
//    low_borderline) restent locales au moteur (aucun signal clinique).
//
// Conversion DCCT % → IFCC : mmol/mol = (% − 2,15) × 10,929.
// ─────────────────────────────────────────────────────────────────────────────

export const HBA1C_REF = {
  unit: 'mmol/mol',
  plausible_max: 200,
  // Bornes entières inclusives, telles que validées par Anissa (frontière ADA 39).
  tranches: {
    normale:    { min: 20, max: 38 },        // < 39        (≈ 4,0 – 5,6 %)
    prediabete: { min: 39, max: 47 },        // 39 – 47     (≈ 5,7 – 6,45 %)
    diabete:    { min: 48, max: Infinity },  // ≥ 48        (≈ ≥ 6,5 %, = ADA)
  },
};
