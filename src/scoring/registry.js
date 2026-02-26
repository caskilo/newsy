/**
 * Lexicon Registry — pluggable multi-language scoring architecture.
 *
 * Each lexicon is registered by language code and provides:
 *   - sentiment: Map<string, number>  (word → score, typically [-5, 5])
 *   - arousal:   Set<string>          (high-arousal terms)
 *
 * Phase 1: English (AFINN-165)
 * Phase 3+: Additional languages registered at runtime.
 */

const lexicons = new Map();

export function registerLexicon(langCode, lexicon) {
  if (!lexicon.sentiment || !lexicon.arousal) {
    throw new Error(`Lexicon for '${langCode}' must provide 'sentiment' (Map) and 'arousal' (Set)`);
  }
  lexicons.set(langCode, lexicon);
}

export function getLexicon(langCode) {
  return lexicons.get(langCode) || null;
}

export function hasLexicon(langCode) {
  return lexicons.has(langCode);
}

export function availableLanguages() {
  return [...lexicons.keys()];
}
