---
tags: [empire, unit, balance]
sumber: ref/kingdom-wars-v2-10unit.html (UNIT_STATS, UNIT_DESCRIPTIONS)
---

# Unit pasukan

Sepuluh unit dari prototipe `ref/kingdom-wars-v2-10unit.html` (tab "Studio 10 Karakter"). Model dibuat prosedural (loft ring + atlas 256×256), ~536 segitiga untuk Spearman. Stat awal di bawah diambil dari `UNIT_STATS` prototipe; kolom "Sumber" adalah keputusan EMPIRE.

| # | Unit | HP | Dmg | Jangkauan | Kecepatan | Skala | Sumber di EMPIRE |
|---|---|---|---|---|---|---|---|
| 1 | Royal Spearman | 120 | 15 | 2,0 | 5,5 | 0,42 | Modal awal, produksi pasif, like, follow, gift 1–4 |
| 2 | Heavy Knight (swordsman) | 155 | 20 | 1,9 | 5,8 | 0,42 | Produksi pasif lv 3+, gift 5–9 |
| 3 | Longbow Ranger (archer) | 90 | 18 | 11,0 | 5,5 | 0,42 | Produksi pasif lv 3+, share |
| 4 | Fire Wizard | 110 | 32 | 10,0 | 5,2 | 0,44 | Produksi pasif lv 8+, gift 30–98 |
| 5 | Royal Paladin Healer | 220 | 25 | 2,1 | 5,4 | 0,46 | Gift 30–98 |
| 6 | Dark Necromancer | 170 | 30 | 9,5 | 5,2 | 0,45 | Gift 99–298 |
| 7 | Heavy Cavalry | 250 | 32 | 2,4 | 8,2 | 0,46 | Produksi pasif lv 8+, gift 10–29 |
| 8 | Runic Iron Golem | 550 | 52 | 2,6 | 4,0 | 0,60 | Gift 99–298 |
| 9 | Ancient Red Dragon | 750 | 70 | 7,0 | 7,5 | 0,62 | Gift 299–999, hadiah Naga Dunia |
| 10 | Demon Lord Titan | 1100 | 95 | 3,0 | 5,4 | 0,72 | Gift 1000+ |

Bonus level kastil per unit: +18 HP dan +4 dmg per level (dari prototipe).

## Kemampuan khusus (baru di EMPIRE)
- **Paladin:** heal 12 HP/dtk ke teman dalam radius 4 m.
- **Necromancer:** unit musuh yang mati dalam radius 6 m bangkit jadi skeleton (HP 60, dmg 10), maks 3 per Necromancer.
- **Dragon:** terbang (abaikan sungai dan gunung), serangan api area radius 2 m.
- **Golem:** -30% damage dari panah.
- **Demon Lord:** aura +10% dmg ke teman radius 6 m.

## Penanda visual
Ciri tiap unit (dari `UNIT_DESCRIPTIONS`):
- Spearman: helm kettle, tunik singa heraldik, tombak, heater shield.
- Knight: great helm salib emas + jambul, pauldron, broadsword.
- Ranger: tudung lancip, quiver, longbow.
- Wizard: topi lebar melengkung, janggut putih, tongkat kristal api.
- Paladin: helm mahkota bersayap, halo, palu perang.
- Necromancer: tudung bertanduk, tongkat ungu, 3 tengkorak mengorbit.
- Cavalry: kuda 4 kaki dengan barding, tombak lance.
- Golem: batu-besi asimetris, inti magma.
- Dragon: wyvern merah, sayap kelelawar, ekor berduri.
- Demon Lord: zirah hitam-emas, 4 tanduk, sayap, greatsword magma.

## Catatan teknis
Prototipe membuat satu `THREE.Group` per unit (banyak mesh, banyak draw call). Untuk 360 unit, pindahkan ke pola DEADZONE: tiap bagian tubuh satu `InstancedMesh`, warna bendera = warna vertex × warna instance. Lihat F3 di [PRD](../docs/PRD.md).
