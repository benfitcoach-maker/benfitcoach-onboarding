// ─── textDiff.js ─────────────────────────────────────────────────────────
// V97.23.4 — Diff line par line entre deux versions de texte (LCS classique).
//
// Cf chantier : V97.18 Phase F polish (visualisation diff dans cockpit
// brouillons IA).
//
// Algorithme : LCS (Longest Common Subsequence) dynamic programming
// O(m*n). Suffisant pour les plans nutrition ~500 lignes.

/**
 * Construit la matrice LCS pour 2 tableaux.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number[][]}
 */
function lcsMatrix(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

/**
 * Diff line par line entre oldText et newText.
 *
 * @param {string} oldText
 * @param {string} newText
 * @returns {Array<{ type: 'unchanged'|'added'|'removed', text: string }>}
 */
export function diffLines(oldText, newText) {
  const a = (oldText || '').split('\n');
  const b = (newText || '').split('\n');
  const dp = lcsMatrix(a, b);

  const ops = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.unshift({ type: 'unchanged', text: a[i - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.unshift({ type: 'removed', text: a[i - 1] });
      i--;
    } else {
      ops.unshift({ type: 'added', text: b[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    ops.unshift({ type: 'removed', text: a[i - 1] });
    i--;
  }
  while (j > 0) {
    ops.unshift({ type: 'added', text: b[j - 1] });
    j--;
  }
  return ops;
}

/**
 * Stats sur un diff.
 *
 * @param {Array<{type: string}>} ops
 * @returns {{ added: number, removed: number, unchanged: number, total: number }}
 */
export function diffStats(ops) {
  let added = 0, removed = 0, unchanged = 0;
  for (const o of (ops || [])) {
    if (o.type === 'added') added++;
    else if (o.type === 'removed') removed++;
    else unchanged++;
  }
  return { added, removed, unchanged, total: added + removed + unchanged };
}
