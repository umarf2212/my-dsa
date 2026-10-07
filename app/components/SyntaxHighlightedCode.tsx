"use client";

import { useMemo } from "react";
import { highlightCode } from "../lib/highlight-code";

export default function SyntaxHighlightedCode({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const highlighted = useMemo(() => highlightCode(code, language), [code, language]);

  return (
    <pre tabIndex={0} aria-label={`${language} source snippet`}>
      {highlighted === null ? (
        <code>{code}</code>
      ) : (
        <code className="hljs language-python" dangerouslySetInnerHTML={{ __html: highlighted }} />
      )}
    </pre>
  );
}
