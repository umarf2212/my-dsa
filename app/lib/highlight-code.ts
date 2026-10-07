import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";

// Only load the language used by this roadmap, rather than every grammar.
const highlighter = hljs.newInstance();
highlighter.registerLanguage("python", python);

export function highlightCode(code: string, language: string): string | null {
  const normalizedLanguage = language.trim().toLowerCase();
  if (!highlighter.getLanguage(normalizedLanguage)) return null;

  try {
    // highlight.js escapes source text before adding its own token spans.
    // Never trim, format, correct, or otherwise rewrite the supplied snippet.
    return highlighter.highlight(code, {
      language: normalizedLanguage,
      ignoreIllegals: true,
    }).value;
  } catch {
    return null;
  }
}
