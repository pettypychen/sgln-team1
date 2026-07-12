import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf-8")
);

const content = `export const APP_VERSION = "${version}";\n`;
writeFileSync(resolve(__dirname, "../src/lib/version.ts"), content);
console.log(`✅ version.ts updated to ${version}`);
