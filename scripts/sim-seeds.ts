import { runRound } from "./sim-smoke";
const out = [];
for (let s = 1; s <= 8; s++) out.push({ seed: s, ...runRound(s, 20, true) });
console.table(out);
