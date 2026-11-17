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
- Troop codex: http://127.0.0.1:5200/units.html (3D models, stats per castle level, abilities, how to get each unit)

Connect a real LIVE: set `LIVE_SOURCE=tiktok` and `TIKTOK_USERNAME=<handle>` in `.env` (see `.env.example`), or use the admin panel. The TikTok connector is the unofficial `tiktok-live-connector` package.

Game URL flags: `?demo=20` (20 mock kingdoms without the bridge), `?seed=5`, `?free` (orbit camera), `?studio` (all ten unit models), `?map=1|2|3` (which map; 3 is the default), `?veg=0.6` (thinner vegetation), `?atmo=0` (no mist, birds or particles on map 3).

Maps (`game/src/sim/maps.ts`): **1 Benua Klasik** (576 x 432 m, bright, with a desert), **2 Hutan Gelap** (864 x 648 m dark forest with five mountain ranges), **3 Hutan Sungai** (map 2 plus rivers troops wade through, landmarks, valley mist, birds and particles). Headless runs pick a map with `EMPIRE_MAP=2 npm run smoke`.

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
