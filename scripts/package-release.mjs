import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const name = `dsa-field-guide-v${version}-source.tar.gz`;
const output = resolve("artifacts", name);
const dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });
if (dirty.trim()) throw new Error("Commit source changes before packaging so the archive matches the checkout.");
mkdirSync("artifacts", { recursive: true });
execFileSync("git", ["archive", "--format=tar.gz", "--prefix=dsa-field-guide/", "-o", output, "HEAD"]);
const checksum = createHash("sha256").update(readFileSync(output)).digest("hex");
writeFileSync(`${output}.sha256`, `${checksum}  ${name}\n`);
console.log(`Created ${output}`);
console.log(`SHA-256: ${checksum}`);
