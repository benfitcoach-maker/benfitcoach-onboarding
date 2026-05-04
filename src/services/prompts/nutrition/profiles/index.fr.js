// V96.11 — Registry of profile modules consumed by composer.fr.js.
//
// Each entry maps a profile tag (returned by ./_detector.fr.js) to the
// corresponding prompt fragment. Adding a new module : add the file +
// register here. The composer will silently skip unknown tags.

import { FEMME_CYCLE_MODULE_FR } from './femmeCycle.fr';
import { PERIMENOPAUSE_MODULE_FR } from './perimenopause.fr';
import { MENOPAUSE_MODULE_FR } from './menopause.fr';
import { DIABETE_MODULE_FR } from './diabete.fr';
import { DIGESTIF_CHRONIQUE_MODULE_FR } from './digestifChronique.fr';
import { CLOSTRIDIUM_DIFFICILE_MODULE_FR } from './clostridiumDifficile.fr';
import { NEPHROPATHIE_MODULE_FR } from './nephropathie.fr';
import { SAOS_MODULE_FR } from './saos.fr';
import { COMPLICATIONS_DIABETE_MODULE_FR } from './complicationsDiabete.fr';
import { GROSSESSE_MODULE_FR } from './grossesse.fr';
import { ALLAITEMENT_MODULE_FR } from './allaitement.fr';
import { POST_PARTUM_MODULE_FR } from './postPartum.fr';
// V96.26 — 7 nouveaux modules suite priorisation Anissa
import { PERFORMANCE_SPORTIF_MODULE_FR } from './performanceSportif.fr';
import { THYROIDE_MODULE_FR } from './thyroide.fr';
import { BURNOUT_CORTISOL_MODULE_FR } from './burnoutCortisol.fr';
import { PRE_CONCEPTION_FERTILITE_MODULE_FR } from './preConceptionFertilite.fr';
import { SPM_MODULE_FR } from './spm.fr';
import { ENDOMETRIOSE_MODULE_FR } from './endometriose.fr';
import { TDAH_MODULE_FR } from './tdah.fr';
import { SOPK_MODULE_FR } from './sopk.fr';

export const PROFILE_MODULES_FR = {
  femmeCycle: FEMME_CYCLE_MODULE_FR,
  perimenopause: PERIMENOPAUSE_MODULE_FR,
  menopause: MENOPAUSE_MODULE_FR,
  grossesse: GROSSESSE_MODULE_FR,
  allaitement: ALLAITEMENT_MODULE_FR,
  postPartum: POST_PARTUM_MODULE_FR,
  diabete: DIABETE_MODULE_FR,
  digestifChronique: DIGESTIF_CHRONIQUE_MODULE_FR,
  clostridiumDifficile: CLOSTRIDIUM_DIFFICILE_MODULE_FR,
  nephropathie: NEPHROPATHIE_MODULE_FR,
  saos: SAOS_MODULE_FR,
  complicationsDiabete: COMPLICATIONS_DIABETE_MODULE_FR,
  // V96.26
  performanceSportif: PERFORMANCE_SPORTIF_MODULE_FR,
  thyroide: THYROIDE_MODULE_FR,
  burnoutCortisol: BURNOUT_CORTISOL_MODULE_FR,
  preConceptionFertilite: PRE_CONCEPTION_FERTILITE_MODULE_FR,
  spm: SPM_MODULE_FR,
  endometriose: ENDOMETRIOSE_MODULE_FR,
  tdah: TDAH_MODULE_FR,
  sopk: SOPK_MODULE_FR,
};

/** Returns the prompt fragment for a tag, or null if unknown. */
export function getProfileModuleFr(tag) {
  return PROFILE_MODULES_FR[tag] || null;
}
