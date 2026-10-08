import assert from "node:assert/strict";
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const exported = resolve("dist/client/my-dsa");
const destination = resolve("dist/pages");
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
// Vinext includes basePath in its export directories; Pages supplies that
// prefix itself, so publish the contents of the /my-dsa directory.
await cp(exported, destination, { recursive: true });
await cp("dist/client/404.html", resolve(destination, "404.html"));
await writeFile(resolve(destination, ".nojekyll"), "");

const html = await readFile(resolve(destination, "index.html"), "utf8");
assert.match(html, /<title>DSA Field Guide<\/title>/);
assert.match(html, /https:\/\/umarf2212.github.io\/my-dsa\/og.png/);
const assetPaths = [...html.matchAll(/(?:src|href)="(\/my-dsa\/[^"?#]+)(?:[?#][^"]*)?"/g)]
  .map((match) => match[1]);
assert.ok(assetPaths.some((path) => path.endsWith(".js")), "Missing JavaScript assets");
assert.ok(assetPaths.some((path) => path.endsWith(".css")), "Missing stylesheet");
for (const path of new Set(assetPaths)) {
  await access(resolve(destination, path.slice("/my-dsa/".length)));
}
assert.equal(
  await readFile(resolve(destination, "data/roadmap.json"), "utf8"),
  await readFile("public/data/roadmap.json", "utf8"),
  "Published roadmap must exactly match the original",
);
console.log(`Verified static Pages output and ${new Set(assetPaths).size} asset paths in dist/pages`);
