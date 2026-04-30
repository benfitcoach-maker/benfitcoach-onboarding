// ─── nutritionEditorParsers (stub) ────────────────────────────────────
// V91.0 : ce fichier est devenu un STUB de re-export.
// La SOURCE UNIQUE est maintenant src/services/nutritionParsers.js.
//
// Pourquoi ce stub : preserve les imports existants (NutritionEditor.jsx,
// services/clientAppMapper.js) sans casser les chemins. Toute nouvelle
// consommation doit importer directement depuis services/nutritionParsers.

export {
  detectSectionType,
  parseLabeledLines,
  parseBulletLines,
  parseRotationGroups,
  parseSlotAlternatives,
  normalizeSlotLabelToSlot,
  parseTimelineSteps,
  parseSupplementEntriesStructured,
} from './services/nutritionParsers';
