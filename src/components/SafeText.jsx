// ─────────────────────────────────────────────────────────────────
// Compliance — Composant <SafeText> pour wrapping des textes IA en UI
// Date : 2026-05-11
//
// Sanitize les textes générés par IA avant affichage. Filet de
// sécurité supplémentaire au-delà du prompt guard injecté dans
// callClaude (cf. services/anthropic.js).
//
// Usage :
//   <SafeText text={planTextFromAI} as="p" className="..." />
//   <SafeText text={consultation.synthesis} as="div" />
//
// En dev (import.meta.env.DEV), affiche aussi un console.warn si des
// termes risqués sont trouvés — permet à Anissa/Benoit de repérer
// les zones à corriger sans casser la prod.
// ─────────────────────────────────────────────────────────────────

import { sanitizeText, auditText } from '../services/complianceVocabulary';

/**
 * @param {object} props
 * @param {string} props.text - texte brut (potentiellement à risque)
 * @param {string} [props.as='span'] - balise HTML (span / p / div / li...)
 * @param {string} [props.className]
 * @param {object} [props.style]
 * @param {boolean} [props.preserveLineBreaks=false] - rend les \n en <br/>
 *        ou via white-space:pre-wrap
 */
export default function SafeText({
  text,
  as: Tag = 'span',
  className,
  style,
  preserveLineBreaks = false,
  ...rest
}) {
  if (!text) return null;

  // Sanitize systématique (filet de sécurité)
  const safe = sanitizeText(text);

  // Dev only : warn si le texte original contenait des termes risqués
  if (import.meta.env?.DEV) {
    const findings = auditText(text);
    if (findings.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[SafeText] Termes risqués sanitizés :',
        findings.map((f) => `"${f.term}" → "${f.replacement}" (x${f.occurrences})`).join(', '),
        '\nTexte original :', text.slice(0, 200),
      );
    }
  }

  const mergedStyle = preserveLineBreaks
    ? { whiteSpace: 'pre-wrap', ...style }
    : style;

  return (
    <Tag className={className} style={mergedStyle} {...rest}>
      {safe}
    </Tag>
  );
}
