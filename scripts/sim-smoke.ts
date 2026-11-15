// Headless round without gifts: npx tsx scripts/sim-smoke.ts [seed] [kingdoms]
import { loadConfig } from "../game/src/sim/config";
import { WorldMap } from "../game/src/sim/map";
import { Sim } from "../game/src/sim/world";

export function runRound(seed: number, kingdoms = 20, quiet = false) {
  const sim = new Sim(loadConfig(), new WorldMap(), seed);
  for (let i = 0; i < kingdoms; i++) sim.join(`raja${i}`, `Raja${i}`);
  const t0 = Date.now();
  let lastLog = -1;
  while (sim.phase !== "RESULT" && sim.t < 1200) {
    sim.step(0.05);
    const min = Math.floor(sim.t / 60);
    if (!quiet && min !== lastLog && min % 2 === 0) {
      lastLog = min;
      console.log(`t=${min}m phase=${sim.phase} alive=${sim.alive.length} units=${sim.units.length} dragon=${sim.dragon ? Math.round(sim.dragon.hp) : "-"} lead=${sim.leaderboard()[0]?.name}`);
    }
    sim.drainEvents();
  }
  const top = sim.podium[0];
  return { winner: top?.name ?? "-", alive: sim.alive.length, fallen: sim.fallenThisRound, t: Math.round(sim.t), ms: Date.now() - t0, units: sim.units.length };
}

const isMain = process.argv[1]?.includes("sim-smoke");
if (isMain) {
  const seed = Number(process.argv[2] ?? 1);
  const n = Number(process.argv[3] ?? 20);
  console.log(runRound(seed, n));
}
