// Build one self-contained prompt for Fable: rules + brief + helper source + reference model.
//   npm run fable -- dragon        ->  docs/fable/out/dragon.txt   (paste its contents into Fable)
// Briefs live in docs/fable/<unit>.md. Everything Fable needs is inlined, so it never has to see the repo.
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const unit = process.argv[2];
const briefs = readdirSync(join(root, "docs/fable")).filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "rules.md").map((f) => f.replace(/\.md$/, ""));
if (!unit || !existsSync(join(root, `docs/fable/${unit}.md`))) {
  console.error(`usage: npm run fable -- <unit>\nbriefs available: ${briefs.join(", ") || "(none)"}`);
  process.exit(1);
}

const read = (p) => readFileSync(join(root, p), "utf8");
const fence = (lang, body) => "```" + lang + "\n" + body.trim() + "\n```";

const text = [
  "# Tugas",
  `Tulis satu file TypeScript \`game/src/render/units/models/${unit}.ts\` yang mengekspor \`build(opts: ModelOpts): UnitModel\`.`,
  "Balas dengan **isi file saja** dalam satu blok kode, tanpa penjelasan panjang. Komentar singkat per bagian tubuh boleh di dalam kode.",
  "Sebelum membalas, periksa sendiri daftar di bagian \"Cek mandiri\" di bawah.",
  "",
  "# Aturan",
  read("docs/fable/rules.md"),
  "",
  "# Brief unit",
  read(`docs/fable/${unit}.md`),
  "",
  "# Kontrak tipe (contract.ts)",
  fence("ts", read("game/src/render/units/contract.ts")),
  "",
  "# Helper (kit.ts), pakai ini",
  fence("ts", read("game/src/render/units/models/kit.ts")),
  "",
  "# Contoh model yang sudah lolos validasi (_reference.ts, humanoid). Tiru strukturnya",
  fence("ts", read("game/src/render/units/models/_reference.ts")),
].join("\n");

mkdirSync(join(root, "docs/fable/out"), { recursive: true });
const out = join(root, `docs/fable/out/${unit}.txt`);
writeFileSync(out, text);
console.log(`wrote ${out} (${Math.round(text.length / 1024)} KB, ~${Math.round(text.length / 3.5)} tokens)`);
