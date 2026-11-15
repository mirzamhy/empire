---
tags: [empire, gift, config]
---

# Pemetaan gift

Prinsip sama dengan DEADZONE (`../tiktok/config/events.config.json`):
- Gift adalah input tervalidasi, bukan perintah mentah.
- Proses gift streak saat `final`, nilai = koin × `repeat`.
- Dedupe 15 dtk, gabung gift kecil dari user yang sama dalam 1,8 dtk.
- Mapping nama spesifik **harus dicek dari event nyata** di LIVE. Harga koin di bawah adalah perkiraan umum dan bisa beda per wilayah/waktu.
- Gift tanpa mapping nama jatuh ke **tier nilai**.
- Semua efek masuk ke kerajaan **pengirim**. Pengirim belum ikut = auto-join dulu.

## Tier nilai (cadangan utama)

| Nilai (koin × repeat) | Pasukan |
|---|---|
| 1–4 | 3 Spearman per koin |
| 5–9 | 3 Knight |
| 10–29 | 3 Cavalry |
| 30–98 | 3 Wizard + 2 Paladin |
| 99–298 | 1 Golem + 2 Necromancer |
| 299–999 | 1 Dragon |
| 1000–4999 | 1 Demon Lord + kastil naik 1 level |
| 5000+ | Panggil Naga Dunia atas nama pengirim + 1 Demon Lord |

Nilai di atas batas tier tidak dikalikan terus. Contoh: 600 koin = 1 Dragon + sisa 301 dihitung ulang sebagai tier 299 = 1 Dragon lagi. Loop berhenti setelah 5 iterasi; sisanya jadi emas.

## Kandidat mapping nama (cek dulu)

| Gift | Perkiraan koin | Aksi | Status |
|---|---|---|---|
| Rose | 1 | 3 Spearman | Terlihat di DEADZONE |
| TikTok | 1 | 3 Spearman | Terlihat di DEADZONE |
| Finger Heart | 5 | 3 Knight | Terlihat di DEADZONE |
| Doughnut | 30 | 3 Wizard + 2 Paladin | Terlihat di DEADZONE |
| Perfume | 20 | 3 Cavalry | Belum dicek |
| Hand Hearts | 100 | 1 Golem + 2 Necromancer | Belum dicek |
| Corgi | 299 | 1 Dragon | Belum dicek |
| Lion | besar | Naga Dunia | Belum dicek |

## Selain gift
| Event | Aksi | Batas |
|---|---|---|
| Like (tiap 30 dari 1 user) | 1 Spearman | 10/menit/user |
| Share | 3 Archer | 1x / 2 menit / user |
| Follow | 5 Spearman | 1x / ronde / user |

## Overflow
Kalau kerajaan pengirim di batas pasukan, atau batas global 360 unit penuh:
1. Unit masuk antrean kerajaan (keluar saat ada slot, maks 60 dtk).
2. Lewat 60 dtk: diubah jadi emas (perbaikan kastil 10 HP per koin) atau buff "Semangat Perang" +20% dmg 30 dtk.
3. Toast tetap muncul dengan nama pengirim. Tidak ada gift yang diam saja.

## Draf config
```json
{
  "version": 1,
  "dedupeWindowMs": 15000,
  "batchWindowMs": 1800,
  "join": { "keywords": ["ikut", "join", "gabung"], "autoJoinOnGift": true },
  "likes": { "perUnit": 30, "unit": "spearman", "maxPerMinute": 10 },
  "share": { "units": { "archer": 3 }, "cooldownSeconds": 120 },
  "follow": { "units": { "spearman": 5 }, "oncePerRound": true },
  "valueTiers": [
    { "minValue": 5000, "units": { "demon": 1 }, "event": "WORLD_DRAGON" },
    { "minValue": 1000, "units": { "demon": 1 }, "castleLevel": 1 },
    { "minValue": 299, "units": { "dragon": 1 } },
    { "minValue": 99, "units": { "golem": 1, "necromancer": 2 } },
    { "minValue": 30, "units": { "wizard": 3, "paladin": 2 } },
    { "minValue": 10, "units": { "cavalry": 3 } },
    { "minValue": 5, "units": { "swordsman": 3 } },
    { "minValue": 1, "perCoin": { "spearman": 3 } }
  ],
  "giftMappings": [
    { "source": "tiktok-live-connector", "giftName": "Rose", "tierOverride": 1 },
    { "source": "mock", "giftName": "demo_rose", "tierOverride": 1 }
  ]
}
```
