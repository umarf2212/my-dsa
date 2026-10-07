import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("production Worker serves the guide and exact original roadmap", { timeout: 45000 }, async (t) => {
  const port = await availablePort();
  const child = spawn(process.execPath, [
    "node_modules/wrangler/bin/wrangler.js", "dev", "--local",
    "--config", "dist/server/wrangler.json", "--port", String(port),
    "--inspector-port", "0",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  t.after(() => { child.kill("SIGTERM"); });

  const url = `http://127.0.0.1:${port}`;
  let response;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error(output);
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) break;
    } catch { /* Wait for workerd to start. */ }
    await delay(250);
  }
  assert.ok(response?.ok, output);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
  const html = await response.text();
  assert.match(html, /<title>DSA Field Guide<\/title>/);
  assert.match(html, /Loading your roadmap/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/);
  const roadmapResponse = await fetch(`${url}/data/roadmap.json`);
  assert.equal(roadmapResponse.status, 200);
  assert.equal(await roadmapResponse.text(), await readFile("public/data/roadmap.json", "utf8"));
});
