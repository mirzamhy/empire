# EMPIRE

TikTok LIVE kingdom war game. Viewers type `ikut` to get a kingdom named after their username, spawn at a random spot on the continent, and fight automatically. Gifts, likes and shares send troops to the sender's own kingdom.

- Spec: [docs/PRD.md](docs/PRD.md)
- Vault home (Obsidian): [Home.md](Home.md)

## Run

```bash
npm install
npm run dev
```

- Game: http://127.0.0.1:5200/ (OBS Browser Source, 1080x1920)
- Admin: http://127.0.0.1:8788/admin (DEMO viewer simulator, round controls, kill switch, TikTok connect)

Connect a real LIVE: set `LIVE_SOURCE=tiktok` and `TIKTOK_USERNAME=<handle>` in `.env` (see `.env.example`), or use the admin panel. The TikTok connector is the unofficial `tiktok-live-connector` package.

Game URL flags: `?demo=20` (20 mock kingdoms without the bridge), `?seed=5`, `?free` (orbit camera), `?studio` (all ten unit models).

## Check

```bash
npm run check          # typecheck + tests + build
npx tsx scripts/sim-seeds.ts   # 8 headless rounds without gifts
```

## Layout

| Path | What |
|---|---|
| `bridge/` | Live bridge: TikTok/mock sources, dedupe, streak finals, kill switch, admin panel |
| `shared/contract.ts` | Bridge <-> game messages and validation |
| `game/src/sim/` | Deterministic war sim (map, kingdoms, units, dragon, territory, rounds) |
| `game/src/live/router.ts` | Live events -> sim actions (`config/events.config.json`) |
| `game/src/render/` | Terrain, castles, instanced units (prototype models), effects, director camera |
| `game/src/ui/` | Portrait HUD |
| `config/` | Balance (`game.config.json`) and gift mapping (`events.config.json`) |
| `tools/` | Reference map -> biome grid generator |
