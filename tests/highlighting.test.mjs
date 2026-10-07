import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { highlightCode } from "../app/lib/highlight-code.ts";

const roadmap = JSON.parse(await readFile(new URL("../public/data/roadmap.json", import.meta.url), "utf8"));
const baseline = JSON.parse(await readFile(new URL("fixtures/original-snippets.json", import.meta.url), "utf8"));
const snippets = roadmap.nodes.flatMap((node) => node.content.filter((block) => block.type === "code"));

function textFromHighlighted(html) {
  const entities = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '\"', "&#x27;": "'" };
  return html.replace(/<span class="[^"]*">|<\/span>/g, "")
    .replace(/&amp;|&lt;|&gt;|&quot;|&#x27;/g, (entity) => entities[entity]);
}

test("all 68 original snippets retain their exact contents and language", () => {
  assert.equal(snippets.length, 68);
  assert.deepEqual(snippets.map(({ id, language, code }) => ({
    id, language, sha256: createHash("sha256").update(code).digest("hex"),
  })), baseline);
});

test("highlighted output preserves every character of all Python snippets", () => {
  const python = snippets.filter((block) => block.language === "python");
  assert.equal(python.length, 61);
  for (const { id, code, language } of python) {
    const html = highlightCode(code, language);
    assert.notEqual(html, null, id);
    assert.equal(textFromHighlighted(html), code, id);
  }
  assert.match(highlightCode("def solve(n):\n    # unchanged\n    return n + 42\n", "python"), /hljs-keyword/);
});

test("plain text and unsupported languages keep the original-text rendering path", () => {
  for (const { code, language } of snippets.filter((block) => block.language === "text")) {
    assert.equal(highlightCode(code, language), null);
  }
  assert.equal(highlightCode("<example>\n", "unknown"), null);
  assert.equal(highlightCode("", "python"), "");
});

test("HTML-like source is escaped while tabs, newlines, and Unicode survive", () => {
  const code = 'def café():\r\n\treturn "<img src=x onerror=alert(1)> & <script>hi</script>"\r\n';
  const html = highlightCode(code, " Py ");
  assert.equal(textFromHighlighted(html), code);
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img/);
});
