---
tags: [empire, rencana, visual, unit, animasi, terrain]
status: draf
tanggal: 2026-11-16
---

# Rencana Visual EMPIRE: pasukan, animasi, naga, terrain, pencahayaan

Dokumen kerja untuk tahap visual berikutnya. Model low-poly akan dirancang dengan **Claude Fable**, jadi bagian 3 adalah kontrak teknis yang harus dipatuhi setiap model agar langsung bisa dipakai game tanpa diubah tangan. Angka stat unit baru masih **draf** dan harus diuji dengan `scripts/sim-seeds.ts` sebelum dipakai.

Dokumen terkait: [PRD](PRD.md) · [Unit pasukan](../notes/unit-pasukan.md) · [Peta dan terrain](../notes/peta-terrain.md) · [Log keputusan](../notes/keputusan.md)

---

## 0. Ringkasan

| Bagian | Sekarang | Target |
|---|---|---|
| Model unit | Prototipe prosedural (`proto.js`), ~1000 segitiga untuk humanoid, Naga 504 | Model Fable lebih detail, 3 tingkat zirah per level kastil, LOD jarak jauh |
| Rig | 4 bagian bergerak: 2 lengan, 2 kaki (Cavalry 6, Naga hanya sayap) | 8–14 tulang per rig: pinggul, badan, kepala, lengan, lengan bawah, senjata, perisai, jubah, ekor, rahang, sayap |
| Animasi | Satu ayunan lengan kanan untuk semua serangan, jalan sederhana, tanpa animasi mati | Klip per unit: jalan, lari, idle, serang (tusuk, tebas, panah, sihir, hantam), kena pukul, mati, muncul, menang |
| Naga | Model berputar terus, semburan dari titik tetap +7 m, tidak keluar dari mulut | Naga menghadap sasaran, ancang-ancang, rahang terbuka, api kerucut keluar dari mulut, tersinkron dengan damage |
| Unit baru | Belum ada | 8 konsep: Trebuchet, Halberdier, Ballista, Shieldbearer, Berserker, Engineer, Assassin, Gajah Perang |
| Terrain | Warna per segitiga per biome, flat shading | Shader biome bercampur, lereng berbatu, salju di puncak, jalan, sungai, tebing, garis pantai berbuih |
| Vegetasi | 4 jenis (pinus, ek, palem, batu) | 20+ jenis per biome, berkelompok (rumpun dan tanah lapang), bergoyang tertiup angin |
| Pencahayaan | Hemisphere + matahari + rim + kabut | Suasana berubah per fase ronde, tone mapping, bloom untuk api dan sihir, AO murah, cahaya api dinamis terbatas |

---

## 1. Kondisi sekarang (audit kode)

### 1.1 Model dan render unit
- **Sumber model:** `game/src/render/units/proto.js`, fungsi `buildReferenceSoldier(type, primary, crest)` membuat `THREE.Group` dari primitif (box, cone, loft ring).
- **Baking:** `rig.ts` memecah model jadi bagian `body` + maksimal 6 tungkai (`LIMBS`), lalu `bake.ts` menggabungkan semua mesh per bagian jadi satu geometri dengan warna per titik.
  - Warna kerajaan: material berwarna `#ff00ff` (`TINT_MARKER`) atau bertekstur ditandai `tint = 1`, lalu dikali warna instance di shader.
  - Bagian bercahaya: `MeshBasicMaterial` ditandai `tint = -1` (emissive).
- **Render:** `units.ts`, satu `InstancedMesh` per (jenis unit × bagian). Kapasitas 420 instance per bagian. Unit digambar `VISUAL_SCALE = 1.7` × `scale` di config.
- **Ukuran model (unit model, sebelum skala):**

| Unit | Segitiga | Tinggi | Lebar × panjang | Tulang sekarang |
|---|---|---|---|---|
| Spearman | 1049 | 5,15 (dengan tombak) | 1,65 × 1,01 | 4 |
| Knight | 1103 | 4,22 | 1,72 × 2,12 | 4 |
| Ranger | 992 | 3,83 | 1,26 × 1,50 | 4 |
| Wizard | 1072 | 4,49 (dengan topi) | 1,33 × 1,18 | 4 |
| Paladin | 1047 | 3,99 | 1,76 × 0,84 | 4 |
| Necromancer | 1070 | 4,15 | 1,69 × 1,75 | 4 |
| Cavalry | 1343 | 4,45 | 1,63 × 2,19 | 6 |
| Golem | 556 | 3,55 | 2,60 × 1,34 | 4 |
| Naga | 504 | 3,74 | 5,58 × 5,76 | 4 (hanya sayap yang dipakai) |
| Demon Lord | 1054 | 4,15 | 3,31 × 2,87 | 4 |

### 1.2 Animasi
- `limbRotation()` di `rig.ts` menghitung rotasi per tungkai dari `t`, `moving`, dan `attack` (0..1 selama 0,35 dtk setelah `attackAt`).
- **Semua humanoid memakai serangan yang sama** (lengan kanan dari -1,7 ke 0,2 rad). Tombak, pedang, busur, tongkat, dan palu terlihat identik.
- Tidak ada animasi kena pukul (baru ada kilatan putih), mati (unit langsung hilang dan diganti asap), muncul (hanya membesar 0,35 dtk), atau menang.
- Kepala, badan, senjata, perisai, jubah, ekor, dan rahang semuanya menyatu dengan `body` dan tidak bisa bergerak.

### 1.3 Naga: kenapa semburan api tidak terasa
1. **Naga Dunia** (`fx.ts`, `update`): `rotation.y = now * 0.5`, sehingga naga berputar terus dan tidak pernah menghadap sasaran.
2. Semburan (`dragonBreath`) dimulai dari `ground + 7`, bukan dari mulut. Naga Dunia melayang di +4 dengan skala 2,6, dan unit Naga terbang di +4,5. Akibatnya api muncul di udara di atas kepala.
3. Serangan memakai event `shot` biasa: bola oranye terbang ke sasaran, ditambah partikel. Tidak ada ancang-ancang, rahang tidak bergerak, dan kepala tidak mengarah ke sasaran.
4. Damage diterapkan di sim **saat itu juga**, padahal bolanya masih terbang. Api dan damage tidak sinkron.

### 1.4 Terrain dan pencahayaan
- **Terrain:** grid 256×192, sel 2,25 m. Satu segitiga datar = satu warna biome acak dari 2 pilihan × shade 0,94–1,04. Territory dicampur di shader (`terr.a * 0,7`).
- **Laut:** plane bersegi dengan noise statis, naik-turun ±0,05. Tidak ada buih pantai, warna dangkal-dalam, atau kilau.
- **Pohon:** 4 jenis `InstancedMesh` (pinus, ek, palem, batu), disebar per biome dengan peluang tetap, tanpa pengelompokan dan tanpa gerak angin.
- **Belum ada:** sungai, jalan, jembatan, tebing, salju (padahal disebut di notes peta), dan landmark (tulang naga, obelisk).
- **Cahaya:** `HemisphereLight` 0,95 + `DirectionalLight` 1,35 dengan bayangan 4096² mengikuti kamera + rim biru 0,3. Kabut 420–950 m. Tidak ada tone mapping, bloom, maupun perubahan suasana.

---

## 2. Arah visual

**Gaya: low-poly bergaya (stylized), flat shading, siluet kuat, terbaca di layar HP 1080×1920 dari jarak kamera 40–50 m.**

Prinsip:
1. **Siluet dulu, detail kemudian.** Setiap unit harus bisa dikenali dari siluetnya saja di ukuran 40 px. Misalnya tombak panjang (Spearman), topi runcing (Wizard), tanduk + sayap (Demon), kuda (Cavalry), lengan besi (Ballista).
2. **Warna kerajaan di area besar:** tunik, jubah, perisai, panji, dan pelana. Minimal 25% luas tampak depan memakai warna kerajaan (tint).
3. **Warna netral per unit konsisten:** besi abu kebiruan, kulit cokelat, emas untuk level tinggi, kayu cokelat tua. Palet di 2.1.
4. **Bagian bercahaya (emissive) hanya untuk sihir dan api:** kristal Wizard, inti magma Golem, tengkorak Necromancer, mata Demon, mulut Naga. Bagian ini juga yang nanti terkena bloom.
5. **Gerakan dilebih-lebihkan.** Unit kecil di layar, jadi ancang-ancang dan ayunan perlu 1,5–2× lebih lebar dari gerak realistis.
6. **Tingkat zirah mengikuti level kastil.** Penonton melihat kerajaan kuat dari tampilan pasukannya.

### 2.1 Palet dasar (hex)

| Peran | Warna |
|---|---|
| Besi | `#8b95a5` terang, `#5b6472` gelap |
| Baja level tinggi | `#c9d1dc` dengan tepi `#facc15` |
| Kulit dan kain netral | `#7a5232`, `#5a3d22` |
| Kayu | `#6b4a2a`, `#4a3220` |
| Kulit wajah | `#e0b48a`, `#c08a62` (wajah boleh tanpa fitur, mengikuti prototipe) |
| Emas | `#facc15`, `#d4a017` |
| Sihir api | `#ff7a1a`, `#ffd25a` |
| Sihir ungu | `#a855f7`, `#d8b4fe` |
| Suci | `#fff3c4`, `#fde68a` |
| Batu Golem | `#57534e`, `#78716c` |
| Magma | `#ff5500` |

### 2.2 Tingkat zirah per level kastil
| Tingkat | Level | Perubahan |
|---|---|---|
| I | 1–4 | Kain dan kulit, helm sederhana, senjata kayu-besi |
| II | 5–7 | Pelindung bahu besi, helm berjambul, tepi perisai logam |
| III | 8–10 | Zirah terang, aksen emas, jubah lebih panjang, senjata berukir |

**Cara teknis:** setiap model punya 3 varian geometri (`tier1`, `tier2`, `tier3`). Renderer memilih varian dari level kerajaan, jadi ada 3 set `InstancedMesh` per jenis unit. Bagian yang sama di semua tingkat (kaki, badan dasar) cukup dibuat sekali.

---

## 3. Kontrak model untuk Fable

Setiap model buatan Fable harus berupa **modul TypeScript yang membangun model dari primitif Three.js**, mengikuti pola `proto.js`. Bentuk ini sengaja dipilih (bukan file `.glb`): bisa ditinjau di diff, bisa diberi warna kerajaan, dan bisa di-bake ke instancing tanpa tool tambahan.

### 3.1 Lokasi dan bentuk file
```
game/src/render/units/models/<unit>.ts
```
```ts
import * as THREE from "three";
import type { UnitModel } from "./contract";

/** Fable: <nama unit>. Tier 1 = level 1–4, 2 = 5–7, 3 = 8–10. */
export function build(opts: { tier: 1 | 2 | 3; tint: string; crest: string }): UnitModel { ... }
```

`contract.ts` (dibuat sebelum model pertama):
```ts
export type RigKind = "humanoid" | "quadruped" | "rider" | "dragon" | "golem" | "siege";

export interface UnitModel {
  root: THREE.Group;
  rig: RigKind;
  /** Pivot tiap tulang. Nama wajib sesuai daftar rig di 4.1; tulang yang tidak dipakai boleh tidak ada. */
  bones: Partial<Record<BoneName, THREE.Object3D>>;
  /** Titik penting dalam koordinat lokal tulang induknya. */
  sockets: Partial<Record<SocketName, THREE.Object3D>>;
  /** Untuk validasi otomatis. */
  meta: { tris: number; height: number };
}
```

### 3.2 Aturan wajib
| Aturan | Nilai |
|---|---|
| Sumbu | +Y ke atas, **menghadap +Z**, kanan unit = -X (sama seperti prototipe) |
| Titik asal | Di tanah, di tengah telapak kaki (y = 0 di bawah kaki) |
| Tinggi humanoid | 3,6–4,0 unit model tanpa senjata atau topi (game mengalikan dengan 1,7 × `scale`) |
| Segitiga LOD0 | Humanoid ≤ 1600, kuda/gajah/golem ≤ 2200, naga/demon ≤ 2600, mesin perang ≤ 1800 |
| Segitiga LOD1 | Sekitar 25% LOD0, untuk jarak kamera > 90 m (boleh dibuat terpisah, atau otomatis dengan menghapus detail kecil) |
| Material | `MeshLambertMaterial({ flatShading: true })` dengan warna polos. **Tanpa tekstur** kecuali untuk tint |
| Warna kerajaan | Material berwarna persis `#ff00ff`, atau `material.userData.tint = true` |
| Bagian bercahaya | `MeshBasicMaterial` (otomatis jadi emissive saat bake) |
| Pivot tulang | Di sendi: bahu, siku, pinggul, lutut, leher, pangkal sayap, pangkal ekor. Rotasi nol = pose istirahat |
| Pose istirahat | Berdiri tegak, lengan sedikit menjauh dari badan (A-pose 15°), senjata di tangan kanan menunjuk ke depan-bawah |
| Penamaan | Tulang dan socket persis sesuai 4.1. Mesh boleh bernama bebas |
| Geometri | Tidak boleh ada wajah ganda atau lubang terbuka yang terlihat. `side: DoubleSide` dipakai renderer |
| Determinisme | Tanpa `Math.random()`. Variasi memakai parameter `tier` atau seed yang diberikan |

### 3.3 Validasi otomatis (dibuat bersama model pertama)
`tests/models.test.ts` memeriksa setiap model:
- Tulang wajib untuk rig-nya ada.
- Socket wajib ada (misalnya `weaponTip` untuk unit jarak dekat, `muzzle` untuk unit jarak jauh, `mouth` untuk Naga).
- Jumlah segitiga di bawah anggaran.
- Bounding box: `min.y` antara -0,05 dan 0,05; tinggi sesuai rentang.
- Ada minimal satu bagian tint, dan luasnya cukup.
- Hasil `bake` tidak menghasilkan NaN.

### 3.4 Templat prompt untuk Fable
```
Kamu merancang model low-poly untuk game EMPIRE (Three.js, flat shading, stylized).
Ikuti kontrak di docs/rencana-visual.md bagian 3 dan rig "<rig>" di bagian 4.1.

Unit: <nama>
Peran: <peran>
Siluet kunci: <3 ciri yang harus terlihat dari jauh>
Area warna kerajaan: <bagian yang memakai #ff00ff>
Bagian bercahaya: <atau "tidak ada">
Tier 1 / 2 / 3: <perbedaan per tingkat>
Socket: <daftar>
Anggaran: LOD0 ≤ <n> segitiga

Keluaran: satu file game/src/render/units/models/<unit>.ts yang mengekspor build(opts).
Pakai primitif Three.js (Box, Cylinder, Cone, Sphere/Icosahedron, Lathe, Extrude, atau BufferGeometry buatan sendiri).
Jangan memakai tekstur dan jangan memakai Math.random().
Sertakan komentar singkat per bagian tubuh.
```
Bagian 5 dan 6 berisi isian brief untuk setiap unit.

### 3.5 Alur kerja per model
1. Isi templat prompt dengan brief unit (bagian 5 atau 6), lalu kirim ke Fable.
2. Simpan hasilnya di `models/<unit>.ts`.
3. Jalankan `npm run test` (validasi 3.3).
4. Buka `units.html` (Kodeks Pasukan). Halaman ini akan diberi **Lab Animasi**: tombol jalan, serang, kena, mati, dan menang, pilihan tier, dan kecepatan putar (lihat fase V1).
5. Cek di game: `?studio` untuk semua model berjajar, `?demo=20` untuk melihat ukuran di layar.
6. Kalau lolos, ganti `MODEL_OF` di `rig.ts` dari prototipe ke model baru. Model prototipe tetap disimpan sebagai cadangan.

---

## 4. Sistem rig dan animasi

### 4.1 Daftar tulang dan socket per rig

**humanoid** (Spearman, Knight, Ranger, Wizard, Paladin, Necromancer, Demon, Skeleton, Halberdier, Shieldbearer, Berserker, Engineer, Assassin)
```
hips (induk semua, untuk bob dan condong)
├─ spine
│  ├─ head
│  ├─ armR ─ forearmR ─ weapon
│  ├─ armL ─ forearmL ─ offhand (perisai, busur, buku)
│  └─ cape (opsional, jubah belakang)
├─ legR
└─ legL
```
Socket: `weaponTip`, `weaponMid` (jejak tebasan), `muzzle` (ujung tongkat atau busur), `offhand`, `headTop` (posisi label dan efek), `chest` (titik kena), `back` (quiver, panji).

**rider** (Cavalry): `mount` (rig quadruped) + `rider` (humanoid tanpa kaki, duduk di socket `saddle`).

**quadruped** (kuda, Gajah Perang)
```
body ─ neck ─ head (─ jaw / trunk1 ─ trunk2 untuk gajah)
     ├─ legFR, legFL, legBR, legBL (masing-masing dengan lutut: legFR2 dst., opsional)
     └─ tail
```
Socket: `saddle`, `headTop`, `chest`, `tusk` (gajah).

**dragon** (unit Naga dan Naga Dunia)
```
body ─ neck1 ─ neck2 ─ head ─ jaw
     ├─ wingR ─ wingR2 (ujung sayap)
     ├─ wingL ─ wingL2
     ├─ legR, legL
     └─ tail1 ─ tail2 ─ tail3
```
Socket **wajib**: `mouth` (di dalam rahang, menghadap +Z kepala), `chest`, `headTop`.

**golem**: humanoid berat dengan `spine` lebar, `armR`/`armL` panjang (tinju menyentuh lutut), tanpa `cape`. Socket `core` (inti magma) dan `fistR`/`fistL`.

**siege** (Trebuchet, Ballista)
```
base (roda: wheelFR, wheelFL, wheelBR, wheelBL)
└─ turret (yaw)
   └─ arm (trebuchet: lengan lontar; ballista: busur)
      └─ sling / string
crew1, crew2 (humanoid kecil tanpa senjata, boleh rig sederhana: hanya lengan)
```
Socket: `muzzle` (titik lepas proyektil), `load` (tempat peluru).

### 4.2 Teknik render animasi
**Tahap A (langsung dipakai): satu `InstancedMesh` per tulang, hierarki dihitung di CPU.**
- Sekarang 4–6 bagian per jenis. Nanti 10–14 bagian.
- Perkiraan: 19 jenis × 12 bagian × 3 tier ≈ 680 `InstancedMesh`. Tapi yang aktif di layar biasanya < 150, karena jenis atau tier tanpa instance tidak digambar (`count = 0`).
- Biaya CPU: 360 unit × 12 tulang = 4320 perkalian matriks per frame, sekitar 0,6 ms.

**Tahap B (kalau draw call terlalu banyak): skinning di vertex shader.**
- Setiap titik membawa atribut `bone` (indeks tulang). Pose dikirim lewat `DataTexture` (baris = instance, kolom = tulang).
- Hasilnya satu draw call per jenis × tier.
- Baru dikerjakan kalau pengukuran di PC streaming menunjukkan frame > 12 ms.

### 4.3 Format klip animasi
Klip disimpan sebagai **data**, bukan kode, di `game/src/render/units/anims/<rig>.ts`, supaya Fable juga bisa menulisnya.
```ts
export const clips: Record<ClipName, Clip> = {
  walk: {
    length: 0.9, loop: true,
    tracks: {
      legR:  [[0, 0.5, 0, 0], [0.45, -0.5, 0, 0], [0.9, 0.5, 0, 0]],  // [waktu, rx, ry, rz]
      legL:  [[0, -0.5, 0, 0], [0.45, 0.5, 0, 0], [0.9, -0.5, 0, 0]],
      hips:  { pos: [[0, 0, 0, 0], [0.225, 0, 0.06, 0], [0.45, 0, 0, 0]] },
    },
  },
  ...
};
```
- Interpolasi Catmull-Rom antar kunci.
- `pos` opsional untuk bob dan dorongan.
- Satu klip bisa dipakai banyak unit dengan rig yang sama. Override per unit cukup untuk tulang yang berbeda, misalnya `stab` hanya mengubah `armR`, `forearmR`, dan `spine`.

### 4.4 State machine per unit (render)
| State | Dipicu oleh | Durasi | Catatan |
|---|---|---|---|
| `spawn` | unit baru (`bornAt`) | 0,5 dtk | Muncul dari portal gift, berlari dari kastil, atau bangkit dari tanah (Skeleton) |
| `idle` | tidak bergerak, tidak menyerang | loop | Napas, lihat kanan-kiri, senjata bergoyang |
| `walk` | `moving` dan kecepatan < 80% maks | loop | Panjang langkah mengikuti kecepatan nyata (kaki tidak meluncur) |
| `run` | perintah serang atau `attack` aktif, jarak > 10 m | loop | Badan condong, senjata ke depan |
| `attack` | event serangan | per unit | Tiga fase: **ancang-ancang → kena → kembali** (4.5) |
| `hit` | `hitAt` baru | 0,2 dtk | Kepala dan badan terdorong mundur, campur di atas state lain |
| `death` | event `death` | 1,2 dtk + tenggelam 1 dtk | Unit mati tetap digambar sebagai "jasad" sementara (4.6) |
| `cheer` | fase `RESULT`, kerajaan pemenang | loop | Senjata diangkat, lompat kecil |

**Gerak terbang** (Naga, Ballista tidak): `fly` loop (kepak 1,1 dtk), `glide` (sayap terbentang saat turun), `hover` (kepak cepat saat menyerang).

### 4.5 Sinkronisasi serangan dengan damage (perubahan sim)
Sekarang damage langsung masuk saat `attackAt`, sehingga ancang-ancang tidak mungkin sinkron.

**Usulan:** setiap jenis unit diberi `windup` (detik) di `config/game.config.json`.
1. Saat cooldown selesai, sim mencatat `u.attackAt = t` dan mengirim event `swing` (sasaran, jenis serangan).
2. Damage masuk pada `t + windup` lewat antrean `pendingHits` (dibatalkan kalau penyerang mati duluan).
3. Event `hit` dan `shot` dikirim pada saat itu juga.
4. Proyektil jarak jauh dilepas di `windup`. Damage masuk saat proyektil tiba (`jarak / kecepatan proyektil`), bukan saat ditembakkan.

Nilai awal `windup`:

| Unit | windup | Alasan |
|---|---|---|
| Spearman, Knight, Halberdier, Skeleton | 0,22 | Serangan ringan |
| Assassin | 0,12 | Tusukan cepat |
| Berserker | 0,18 | |
| Cavalry | 0,15 | Momentum dari lari |
| Paladin, Shieldbearer | 0,30 | Palu dan perisai berat |
| Ranger | 0,35 | Tarik busur |
| Wizard, Necromancer | 0,40 | Merapal |
| Golem | 0,45 | Tinju lambat |
| Demon | 0,40 | Tebasan besar |
| Naga | 0,50 | Menarik napas |
| Trebuchet | 1,20 | Lengan diputar |
| Ballista | 0,50 | |

Dampak: DPS efektif sedikit turun di awal pertarungan, dan unit yang mati saat ancang-ancang tidak memberi damage. Harus diuji ulang dengan 8 seed. Kalau ronde jadi lebih panjang, `attackCooldown` disesuaikan.

### 4.6 Jasad dan animasi mati
- Sim menghapus unit yang mati. Renderer menyimpan **daftar jasad** (posisi, arah, jenis, tier, warna kerajaan, waktu mati) dan menggambarnya dengan klip `death`. Setelah 1,2 dtk jasad tenggelam 0,4 m dalam 1 dtk, lalu dihapus.
- Batas 120 jasad. Kalau penuh, yang tertua langsung tenggelam.
- Variasi per rig:
  - humanoid jatuh ke belakang atau ke samping (dipilih dari `id`);
  - kuda roboh ke samping dan penunggangnya terlempar;
  - Golem pecah jadi 6–8 bongkah (pakai `debris` di `fx.ts`);
  - Naga jatuh dari udara lalu menghantam tanah dengan debu;
  - Skeleton berantakan jadi tulang;
  - Demon berlutut lalu hancur jadi bara.

### 4.7 Socket dipakai efek
- **Tebasan:** jejak busur (ribbon pendek 6 segmen) mengikuti `weaponMid` → `weaponTip` selama fase kena. Pool ribbon di `fx.ts`.
- **Proyektil** keluar dari `muzzle`, bukan dari tengah unit.
- **Angka damage dan label** dari `headTop`.
- **Api Naga** dari `mouth` (bagian 7).

---

## 5. Detail unit yang sudah ada

Format setiap unit: **brief Fable** (siluet, warna kerajaan, cahaya, tier) lalu **animasi** dan **efek**.

### 5.1 Royal Spearman 🔱 (humanoid)
- **Siluet:** tombak panjang 1,5× tinggi badan, helm kettle bertepi lebar, perisai heater.
- **Warna kerajaan:** tunik (lambang singa disederhanakan jadi bentuk geometris), perisai bagian dalam.
- **Tier:**
  - I: helm kettle polos, tombak kayu;
  - II: helm kettle dengan pelindung pipi, mata tombak lebih besar, perisai bertepi besi;
  - III: helm bermahkota kecil, panji kecil di bawah mata tombak.
- **Animasi:**
  - `walk` dengan tombak tegak bergoyang;
  - `run` dengan tombak diturunkan ke depan;
  - **`stab`**: tarik ke belakang 0,22 dtk, badan memutar 20°, lalu tusuk lurus. Lengan dan lengan bawah memanjang ke depan, kaki kiri maju;
  - `idle` dengan pangkal tombak di tanah.
- **Efek:** percikan di `weaponTip`, garis tusukan pendek.

### 5.2 Heavy Knight 🗡️ (humanoid)
- **Siluet:** great helm dengan jambul bulu tinggi, pauldron besar, pedang lebar.
- **Warna kerajaan:** surcoat, jambul, perisai.
- **Tier:** I helm terbuka; II great helm dengan salib emas; III zirah lempeng terang dan jubah.
- **Animasi:**
  - **`slash`**: diagonal kanan-atas ke kiri-bawah, pinggul ikut memutar 35°, lalu kembali;
  - setiap serangan ke-3 jadi tebasan horizontal (variasi dari `id + jumlah serangan`);
  - `hit` mengangkat perisai.
- **Efek:** jejak tebasan putih kebiruan.

### 5.3 Longbow Ranger 🏹 (humanoid)
- **Siluet:** tudung lancip, busur panjang setinggi badan, quiver di punggung.
- **Warna kerajaan:** tudung dan jubah.
- **Tier:** I tudung kain; II jubah bertepi bulu; III busur berukir dengan ujung emas.
- **Animasi:** **`shoot`**: ambil panah dari quiver (lengan kanan ke `back`, 0,1 dtk) → pasang dan tarik (0,25 dtk, tali tertarik, busur sedikit melengkung lewat skala Z `offhand`) → lepas (panah keluar dari `muzzle`) → tangan kanan terhentak ke belakang.
- **Efek:** lintasan panah melengkung (sudah ada) yang sekarang dimulai dari `muzzle`.

### 5.4 Fire Wizard 🔥 (humanoid)
- **Siluet:** topi lebar melengkung, janggut panjang, tongkat dengan kristal api.
- **Warna kerajaan:** jubah dan pita topi. **Cahaya:** kristal.
- **Tier:** I tongkat kayu; II kristal lebih besar dengan bara kecil mengorbit; III jubah bersulam emas dengan kerah tinggi.
- **Animasi:** **`cast`**: tongkat diangkat tinggi (0,25 dtk, kristal membesar dan bersinar), lalu ujung tongkat diarahkan ke sasaran dan bola api keluar dari `muzzle`. Jubah berkibar ke belakang.
- **Efek:** lingkaran rune di tanah saat merapal, dan kristal berkedip.

### 5.5 Royal Paladin ✨ (humanoid)
- **Siluet:** helm bersayap, halo, palu perang dua tangan.
- **Warna kerajaan:** tabard dan jubah. **Cahaya:** halo.
- **Tier:** I helm bersayap kecil; II halo lebih terang; III sayap helm emas dan jubah panjang.
- **Animasi:**
  - **`slam`**: palu diangkat dua tangan di atas kepala, lalu dihantamkan ke tanah;
  - **`heal`** (setiap pulse heal, tiap 1 dtk kalau ada teman terluka): telapak tangan kiri terangkat.
- **Efek:** cincin emas di tanah saat menghantam, dan partikel cahaya naik ke teman yang disembuhkan.

### 5.6 Dark Necromancer 💀 (humanoid)
- **Siluet:** tudung bertanduk, tongkat dengan kristal ungu, 3 tengkorak mengorbit.
- **Warna kerajaan:** jubah dalam. **Cahaya:** kristal dan mata tengkorak.
- **Tier:** I 3 tengkorak; II 4 tengkorak dengan tanduk lebih panjang; III jubah compang-camping berkibar dan mahkota tulang.
- **Animasi:**
  - **`cast`**: tangan kiri terbuka ke depan, tengkorak berputar 2× lebih cepat;
  - **`raise`** (saat membangkitkan Skeleton): kedua tangan diangkat.
- **Efek:** kabut ungu di tanah, dan Skeleton muncul dari tanah dengan klip `spawn` khusus.

### 5.7 Heavy Cavalry 🐎 (rider)
- **Siluet:** kuda dengan barding, penunggang dengan lance panjang.
- **Warna kerajaan:** barding kuda dan tabard penunggang.
- **Tier:** I barding kain; II pelindung kepala kuda dari besi; III barding berlapis emas dan jambul di kepala kuda.
- **Animasi:**
  - kuda: `walk` (empat ketukan), `gallop` (lompatan, badan naik-turun 0,15), `rear` (berdiri dengan kaki belakang saat muncul dari gift);
  - penunggang: lance tegak saat jalan, **`couch`** (lance diturunkan ke depan) saat lari.
  - **`charge`**: tusukan lance tanpa berhenti.
- **Efek:** debu dari kuku kuda saat lari kencang, dan dorongan mundur pada sasaran.

### 5.8 Runic Iron Golem 🗿 (golem)
- **Siluet:** dada sangat lebar, kepala kecil, lengan sampai lutut, inti magma.
- **Warna kerajaan:** rune di dada dan bahu (garis-garis tint). **Cahaya:** inti dan mata.
- **Tier:** I batu kasar; II pelat besi di bahu; III rune menyala dan mahkota batu.
- **Animasi:**
  - **`walk` berat**: badan bergoyang kanan-kiri 8°;
  - **`punch`**: tinju kanan dan kiri bergantian;
  - **`smash`** (setiap serangan ke-4): dua tinju menghantam tanah dan sekitar ikut kena (efek visual saja kalau sim belum mendukung).
- **Efek:** guncangan kamera kecil (sudah ada), debu dan retakan di tanah, inti magma berdenyut saat menyerang.

### 5.9 Ancient Red Dragon 🐉 (dragon) → lihat bagian 7

### 5.10 Demon Lord Titan 👹 (humanoid besar)
- **Siluet:** 4 tanduk melengkung, sayap iblis, greatsword magma.
- **Warna kerajaan:** jubah dan sabuk. **Cahaya:** pedang, mata, dan retakan di zirah.
- **Tier:** I sayap terlipat; II sayap setengah terbuka; III mahkota api.
- **Animasi:**
  - **`cleave`**: pedang diayun mendatar 270° dari kanan ke kiri, badan ikut berputar;
  - **`roar`** saat muncul;
  - sayap mengepak pelan saat `idle`.
- **Efek:** jejak api di tebasan, aura merah di tanah (sesuai `auraRange` 6 m), dan bara naik dari badan.

### 5.11 Skeleton ☠️ (humanoid)
- **Siluet:** tulang rusuk terbuka, tengkorak, pedang berkarat. **Bukan Necromancer berwarna tulang** seperti sekarang.
- **Warna kerajaan:** sobekan kain di pinggang.
- **Animasi:** `walk` patah-patah (kunci animasi tanpa interpolasi halus), `stab`, `spawn` merangkak keluar dari tanah, `death` berantakan.

### 5.12 Variasi dalam satu jenis
Supaya 40 Spearman tidak kembar:
- 3 varian kepala dipilih dari `id % 3`, misalnya helm berbeda atau ada tidaknya jenggot;
- skala tinggi 0,95–1,05;
- warna kulit 3 pilihan.

Semua dibuat dengan **instance attribute** (bukan geometri baru), kecuali kepala yang memakai 3 `InstancedMesh` kecil.

### 5.13 Pembawa panji
Setiap 12 unit dari satu kerajaan, satu Spearman membawa panji besar warna kerajaan di socket `back`. Pasukan terlihat sebagai satu regu dari jauh.

---

## 6. Unit baru (konsep dan draf stat)

Stat di bawah adalah **draf awal** dan harus diuji ulang dengan `sim-seeds`. Kolom "Mekanisme baru" adalah pekerjaan di sim.

| Unit | HP | Dmg | Jangkauan | Kecepatan | Mekanisme baru | Sumber usulan |
|---|---|---|---|---|---|---|
| Halberdier 🪓 | 170 | 22 | 2,4 | 4,1 | Bonus vs tag `big` (Cavalry, Golem, Demon, Gajah) +60% | Produksi pasif lv 5+, gift 5–9 berganti dengan Knight |
| Shieldbearer 🛡️ | 320 | 12 | 1,6 | 3,8 | `taunt` (musuh dalam 5 m menyerangnya dulu), teman di belakang -40% damage panah | Gift 15–29 |
| Berserker 🔥 | 200 | 26 | 1,7 | 5,0 | Damage +100% × (1 - HP/maxHP) | Gift 20–29 |
| Assassin 🗡️ | 110 | 40 | 1,5 | 6,0 | Mengincar unit `support` atau `ranged`, tembus 40% damage panah saat bergerak, tidak bisa ditarget sampai menyerang pertama kali | Gift 50–98 |
| Engineer 🔨 | 130 | 10 | 1,5 | 4,2 | Membangun menara jaga di desa milik sendiri (20 dtk). Menara: HP 400, panah 12 dmg | Share (berganti dengan Ranger), produksi pasif lv 6+ |
| Ballista 🏹 | 260 | 45 | 14 | 2,6 | Bonus vs `flying` +100%, bisa menembak Naga Dunia | Gift 99–149 |
| Gajah Perang 🐘 | 900 | 48 | 2,6 | 3,4 | `trample`: unit kecil di jalur gerak kena 20 dmg + terdorong | Gift 150–298 |
| Trebuchet 🪨 | 300 | 160 | 18 | 2,2 | Damage ×4 ke kastil, ×0,25 ke unit, area 3 m, tidak bisa menyerang dalam 6 m | Gift 150–298 (berbagi tier dengan Gajah, dipilih bergantian) atau gift tertentu |

**Tag baru di config:** `big`, `flying` (sudah ada), `support`, `ranged` (sudah ada), `siege`. Bonus damage dibaca dari `bonusVs: { big: 0.6 }`.

### 6.1 Brief Fable unit baru

**Halberdier (humanoid).**
- Siluet: kapak bertangkai panjang (halberd) dengan kait, helm sallet, zirah rantai.
- Warna kerajaan: tabard bergaris diagonal.
- Tier: I tanpa pelindung bahu; II pauldron; III halberd berukir dengan bendera kecil.
- Animasi: **`chop`** (ayunan dari atas ke bawah dengan dua tangan), **`brace`** (halberd ditancapkan ke tanah, menghadap kavaleri, dipakai saat musuh `big` mendekat).
- Socket: `weaponTip`, `weaponMid`.

**Shieldbearer (humanoid).**
- Siluet: perisai tower setinggi badan, helm tertutup, pedang pendek.
- Warna kerajaan: muka perisai (area terbesar).
- Tier: I perisai kayu; II tepi besi; III lambang emas di perisai.
- Animasi: `walk` dengan perisai di depan, **`bash`** (dorongan perisai), **`brace`** (lutut ditekuk, perisai ditanam ke tanah).
- Efek: panah memantul dari perisai.

**Berserker (humanoid).**
- Siluet: bertelanjang dada, dua kapak, rambut liar, cat perang.
- Warna kerajaan: celana dan cat perang (garis tint di lengan).
- Tier: I kapak sederhana; II kulit beruang di bahu; III kapak berukir dengan rune bercahaya.
- Animasi: **`frenzy`** (dua kapak bergantian cepat). Saat HP < 50%, tubuh memerah (lerp warna instance) dan gerakan dipercepat 1,3×.
- Efek: uap merah dari badan saat marah.

**Assassin (humanoid ramping).**
- Siluet: tudung dan masker, dua belati, jubah pendek.
- Warna kerajaan: syal.
- Tier: I belati besi; II belati beracun (bilah hijau bercahaya); III jubah bayangan dengan tepi ungu.
- Animasi: **`sneak`** (berjalan membungkuk, opacity 40% untuk penonton kerajaan lain, tetap terlihat untuk keterbacaan), **`backstab`** (lompat lalu tusuk dua belati), **`vanish`** (asap hitam).
- Efek: asap saat muncul, dan tanda seru di atas sasaran.

**Engineer (humanoid).**
- Siluet: topi kulit dengan kacamata, palu besar, ransel kayu dengan peralatan.
- Warna kerajaan: celemek.
- Animasi: **`hammer`** (memukul berulang saat membangun), `carry` (membawa balok di bahu saat menuju desa).
- Efek: menara jaga muncul bertahap (fondasi → rangka → menara jadi), serpihan kayu saat dipalu.

**Ballista (siege + 2 kru).**
- Siluet: busur raksasa di atas kereta beroda, baut besar.
- Warna kerajaan: panji di belakang dan kain penutup roda.
- Tier: I kayu; II pelat besi; III busur dengan kepala naga di depan.
- Animasi: `move` (roda berputar mengikuti jarak, kru mendorong), **`load`** (kru memutar engkol, tali tertarik), **`fire`** (busur menghentak dan seluruh kereta mundur 0,2 m).
- Efek: baut panjang dengan jejak putih, dan ledakan serpihan saat mengenai unit terbang.

**Gajah Perang (quadruped besar).**
- Siluet: gajah dengan menara kecil (howdah) di punggung, 2 penombak di menara, gading panjang.
- Warna kerajaan: kain howdah dan selimut gajah.
- Tier: I kain; II pelindung kepala besi; III gading berlapis emas dan panji di howdah.
- Animasi: `walk` lambat (bumi bergetar kecil di kamera dekat), **`trample`** (kaki depan terangkat lalu dihentakkan), **`gore`** (kepala menyeruduk ke samping), belalai bergoyang saat `idle`.
- Efek: debu di setiap langkah, unit kecil terlempar.

**Trebuchet (siege + 3 kru).**
- Siluet: rangka A tinggi, lengan lontar panjang, pemberat kotak, sling.
- Warna kerajaan: panji di puncak dan kain pemberat.
- Animasi: `move` (roda, kru menarik tali), **`wind`** (kru memutar roda engkol, lengan turun, 1,2 dtk), **`launch`** (pemberat jatuh, lengan berputar 150°, sling melepas batu dari `muzzle`), `reset`.
- Efek: batu besar dengan lintasan sangat tinggi, bayangan sasaran (lingkaran merah) di tanah sebelum mendarat, ledakan debu dan puing kastil, guncangan kamera sedang.

---

## 7. Naga: semburan api yang benar

### 7.1 Tujuan
Saat Naga (unit gift maupun Naga Dunia) menyerang, penonton harus melihat:
1. naga **menoleh** ke sasaran;
2. **menarik napas** (leher ke belakang, dada mengembang, cahaya di mulut);
3. **menyemburkan api** berbentuk kerucut dari mulut ke sasaran selama 0,7 dtk, dengan kepala sedikit menyapu;
4. tanah di sasaran **terbakar** (bekas gosong dan api kecil 2 dtk);
5. unit yang kena **berkedip dan terbakar** sebentar.

### 7.2 Perubahan model (Fable brief, rig `dragon`)
- **Siluet:** wyvern merah, leher S, 2 sayap kelelawar besar, ekor berduri, tanduk melengkung ke belakang.
- **Warna kerajaan:** membran sayap bagian dalam dan sisik perut (unit gift). Naga Dunia tetap merah-emas tanpa tint.
- **Cahaya:** mata, celah sisik di dada (menyala saat menarik napas), dan bagian dalam mulut.
- **Tulang:** `body`, `neck1`, `neck2`, `head`, `jaw`, `wingR`, `wingR2`, `wingL`, `wingL2`, `legR`, `legL`, `tail1`–`tail3`.
- **Socket:** `mouth` (di antara rahang, +Z kepala), `chest` (bercahaya saat napas).
- **Anggaran:** LOD0 ≤ 2600 segitiga. Naga Dunia memakai model yang sama dengan skala 2,6 dan tier "dunia" (tanduk lebih banyak, duri punggung).

### 7.3 Klip
| Klip | Durasi | Gerak |
|---|---|---|
| `fly` | 1,1 dtk loop | Kepak penuh (wing ±60°, wing2 menekuk dengan jeda 0,1 dtk), ekor bergelombang |
| `hover` | 0,6 dtk loop | Kepak cepat dan pendek, badan tegak 20° |
| `breath` | 0,5 + 0,7 + 0,3 dtk | **Tarik napas:** leher ke belakang, sayap terangkat, dada bercahaya. **Semburan:** leher ke depan, rahang terbuka 35°, kepala menyapu ±10°. **Kembali** |
| `bite` | 0,4 dtk | Untuk sasaran yang sangat dekat (opsional) |
| `death` | 1,5 dtk | Sayap terlipat, jatuh berputar, lalu menghantam tanah |

### 7.4 Aliran data
**Sim (`world.ts`):**
- Naga Dunia mendapat `heading` dan menghadap sasaran secara bertahap (maks 180°/dtk).
- Unit Naga sudah punya `heading`.
- Serangan Naga memakai `windup = 0,5`: event `swing` (sasaran, tipe `breath`) dikirim di awal, damage area dan `shot` masuk setelah 0,5 dtk.
- Damage boleh dipecah jadi 3 tik selama 0,7 dtk semburan supaya lebih terasa, dengan total yang sama.

**Render:**
- Renderer Naga memutar klip `breath` saat menerima `swing`.
- Setiap frame selama fase semburan, posisi dunia socket `mouth` dibaca (lewat matriks tulang `head` dan `jaw`).
- Lalu `fx.breathStream(mouthPos, mouthDir, targetPos)` dipanggil.
- `fx.ts`:
  - **Hapus** bola oranye untuk `dragon` dan **hapus** offset `+7`.
  - `breathStream` memunculkan 6–10 partikel api per frame dari mulut, dengan kecepatan ke arah sasaran + sebaran kerucut 12°. Partikel membesar, warnanya berubah kuning → oranye → merah → asap.
  - Ada **cahaya titik** oranye di mulut (pool cahaya, 7.5).
  - Saat semburan menyentuh tanah: bekas gosong radius 2,6 m (sudah ada), api kecil 2 dtk (partikel `glow` terus-menerus), dan unit yang kena berkedip oranye (warna kilatan dari jenis serangan).
- **Naga Dunia** tidak lagi memakai `rotation.y = now * 0.5`. Arahnya dari `dragon.heading`, dengan gerak melayang 8 m lingkaran saat tidak menyerang.

### 7.5 Cahaya dinamis
Pool 4 `PointLight` (tanpa bayangan), dipakai bergiliran oleh efek paling dekat ke kamera:
- api Naga (intensitas 3, jarak 14);
- ledakan Wizard (2, 8);
- kastil runtuh (4, 20);
- portal gift.

Intensitas meredup sesuai umur efek.

---

## 8. Terrain dan shader

### 8.1 Shader terrain (`terrain.ts`)
Ganti warna per segitiga acak dengan perhitungan di shader yang tetap mempertahankan kesan low-poly (warna konstan per segitiga lewat `flat` varying):
1. **Warna biome dasar** dari texture biome 256×192 (1 texel per sel). Batas biome dicampur 1 sel dengan noise, jadi tidak ada garis lurus.
2. **Lereng:** normal.y < 0,75 → campur warna batu (tebing). Normal.y < 0,55 → batu gelap.
3. **Ketinggian:** di atas 70% tinggi maksimum gunung → salju (`#eef2f5`), dengan batas bergerigi oleh noise.
4. **Noise makro** (dua oktaf, skala 40 m dan 9 m) mengubah kecerahan ±8% dan menggeser hue, sehingga ada petak rumput tua/muda dan pasir basah/kering.
5. **Garis pantai:** pasir basah lebih gelap 1,5 m dari air.
6. **Jalan dan sungai** dari texture mask kedua (8.3).
7. **Territory:** tetap seperti sekarang, ditambah **garis batas** dari turunan (`fwidth`) alpha territory, sehingga tepinya tajam 0,6 m tanpa bergantung pada ukuran petak.
8. **AO murah:** gelapkan lembah (selisih tinggi dengan rata-rata 5×5 sel), dihitung sekali saat build dan disimpan sebagai atribut titik.

### 8.2 Air
- **Warna dangkal ke dalam** dari jarak ke pantai (distance field air dihitung sekali): `#5fc4c9` dangkal → `#2f7f93` → `#163d4d` dalam.
- **Buih pantai:** garis putih bergerak maju-mundur di jarak 0–1,2 m dari pantai, dengan noise.
- **Gelombang:** vertex shader dengan 2 gelombang sinus bersilang (amplitudo 0,08 m) dan normal flat per segitiga.
- **Kilau matahari:** specular sederhana dari arah matahari, dipotong (step) supaya tetap bergaya low-poly.
- **Ombak di karang:** partikel buih kecil di titik pantai yang menghadap laut lepas.

### 8.3 Sungai, jalan, jembatan
- **Sungai:** digambar sebagai kurva di `tools/rivers.json` (dari gambar referensi: dari pegunungan tengah ke laut). Saat build peta: sel di jalur sungai diturunkan, jadi biome `river` (tidak bisa dilalui kecuali di jembatan), dan dipakai shader air.
  - Sim: `walkable` false untuk sungai. BFS navigasi otomatis memutar lewat jembatan.
  - **Ini mengubah alur perang** dan harus diuji dengan 8 seed.
- **Jembatan:** 3–4 titik, model kayu atau batu, masing-masing sebuah `InstancedMesh`.
- **Jalan:** jalur terpendek (A* di grid, biaya lebih tinggi di hutan dan gunung) antara desa-desa dan altar, dihitung sekali per seed. Digambar di mask jalan (tanah cokelat, lebar 2 m, tepi berkerikil). Unit di jalan bergerak +15% lebih cepat (opsional, perubahan sim).

### 8.4 Ragam vegetasi
Satu `InstancedMesh` per jenis. Penempatan memakai **noise kepadatan** (rumpun lebat, tepi hutan, tanah lapang), bukan peluang tetap per sel.

| Biome | Jenis | Catatan |
|---|---|---|
| Hutan | Ek bulat (3 varian), pinus (2), birch putih, pohon tumbang, semak, jamur merah, pakis | Rumpun lebat dengan tanah lapang kecil |
| Hutan tua (inti hutan barat) | Pohon raksasa (2× ek, akar menonjol), lumut bercahaya kecil | Landmark visual |
| Dataran | Ek tunggal, semak, rumput tinggi (rumpun kecil), bunga (kuning, ungu), batu kecil | Sangat jarang, supaya pasukan terlihat |
| Pantai | Palem miring, batu karang, kayu hanyut, kerang | |
| Gurun | Kaktus (2 varian), pohon akasia gepeng, tulang hewan, batu oranye berlapis | Utara-timur |
| Gunung | Pinus bersalju di ketinggian, batu besar, kristal kecil di celah | |
| Rawa (opsional) | Pohon mati, alang-alang, kabut rendah | Kalau biome rawa ditambah |

- **Angin:** vertex shader menggeser titik daun berdasarkan tinggi titik (pangkal diam, pucuk bergoyang) × `sin(waktu + posisi)`. Arah angin global berubah pelan.
- **Interaksi:** pohon di radius ledakan besar (kastil runtuh, Trebuchet) bergoyang keras sesaat (parameter `shake` per instance lewat atribut).
- **Rumput:** hanya di jarak kamera < 60 m, rumpun kecil (8 segitiga) dengan kepadatan menurun mengikuti jarak, digambar dalam satu draw call.
- **Anggaran:** total pohon ≤ 9000 instance. Pohon di luar frustum tetap dihitung oleh GPU. Kalau berat, bagi peta jadi 6×6 chunk dan sembunyikan chunk di luar kamera.

### 8.5 Landmark
Dari catatan gambar referensi:
- kerangka naga raksasa di barat laut;
- obelisk di pulau timur laut;
- menara merah di kaki gunung tengah;
- kuil di pulau barat daya;
- reruntuhan kastil kuno di dataran utara.

Semua dekorasi statis (bisa dibuat Fable dengan kontrak sederhana: satu `Group` tanpa rig). Kamera overview sesekali menyorot landmark saat lobi.

---

## 9. Pencahayaan dan post-processing

### 9.1 Dasar
- `renderer.toneMapping = ACESFilmicToneMapping`, `toneMappingExposure` disesuaikan per fase (9.2). `outputColorSpace = SRGBColorSpace` (cek warna HUD dan territory setelah diubah).
- Bayangan:
  - tetap 1 `DirectionalLight` yang mengikuti kamera;
  - `shadow.radius` dan `bias` disetel ulang setelah tone mapping;
  - kotak bayangan menyesuaikan jarak kamera (dekat 120 m, overview 320 m);
  - pohon dan unit memberi bayangan, rumput tidak.
- **Bayangan kontak:** lingkaran gelap lembut di bawah setiap unit (satu `InstancedMesh` quad). Murah dan sangat membantu keterbacaan di overview, saat peta bayangan terlalu kasar.

### 9.2 Suasana per fase ronde
| Fase | Matahari | Langit dan kabut | Suasana |
|---|---|---|---|
| LOBBY | Pagi, rendah dari timur, `#ffe2b0` 1,2 | Kabut tipis keemasan `#b9c8c4` | Tenang |
| WAR | Siang, tinggi, `#fff1d6` 1,4 | Biru jernih `#163d4d` (sekarang) | Netral, paling terbaca |
| FINAL (2 menit terakhir) | Sore, rendah dari barat, `#ff9b5a` 1,3 | Kabut oranye-ungu, langit gradasi | Dramatis, api lebih menonjol |
| RESULT | Senja, `#c58cff` 0,8, cahaya dari api dan obor | Gelap biru-ungu | Podium dan kembang api |

Transisi antar fase 6 dtk (lerp warna, intensitas, dan arah).

### 9.3 Post-processing (`EffectComposer`)
1. **RenderPass**
2. **UnrealBloomPass** (strength 0,6, radius 0,4, threshold 0,85). Hanya bagian emissive dan partikel aditif yang cukup terang untuk lolos threshold.
3. **Vignette + color grading** (shader kecil): kontras sedikit naik, saturasi +8%, LUT per fase opsional.
4. **FXAA** (antialias MSAA bawaan tidak bekerja di render target composer, kecuali `samples = 4` di WebGL2).

Ukur dulu biayanya di 1080×1920. Kalau > 2 ms, bloom dirender di setengah resolusi.

### 9.4 Langit
- Gradasi vertikal (dome atau background shader) mengikuti fase.
- Awan low-poly (10–14 gumpalan) bergerak pelan di ketinggian 120 m. Bayangannya di tanah memakai texture noise yang digeser di shader terrain (murah, tanpa shadow map).

### 9.5 Siang-malam penuh (opsional, nanti)
Siklus 15 menit selaras dengan ronde (pagi saat lobi, malam di akhir). Bisa menggantikan 9.2. Malam butuh obor di kastil dan desa (pool cahaya + emissive). Keputusan ada di pertanyaan terbuka.

---

## 10. Anggaran performa

Target: **60 fps di 1080×1920 di PC streaming** (spesifikasi GPU perlu dicek, lihat 12). Batas aman 12 ms GPU + 6 ms CPU per frame.

| Bagian | CPU | GPU | Catatan |
|---|---|---|---|
| Sim (360 unit) | 2,0 ms | — | Perkiraan, belum diukur di 360 unit. Diukur di V0 |
| Pose unit (12 tulang) | 0,8 ms | — | Tahap A |
| Unit (draw) | — | 2,5 ms | ~150 draw call aktif + bayangan |
| Terrain + air | — | 1,5 ms | Shader baru |
| Vegetasi + rumput | 0,2 ms | 2,5 ms | Batas 9000 pohon |
| Efek | 0,2 ms | 1,0 ms | Sudah ada |
| Bayangan | — | 2,0 ms | 4096² |
| Post (bloom, grading, FXAA) | — | 2,0 ms | Setengah resolusi kalau perlu |
| HUD (DOM) | 0,5 ms | — | |
| **Total** | **3,7 ms** | **11,5 ms** | |

Alat ukur: tambahkan `?perf` untuk menampilkan ms per bagian (`renderer.info`, `performance.now()` per tahap) dan satu skrip uji 30 kerajaan × 360 unit.

---

## 11. Urutan kerja

| Fase | Isi | Selesai jika |
|---|---|---|
| **V0** Fondasi | `contract.ts`, `tests/models.test.ts`, rig humanoid 10 tulang dari model prototipe (dipecah ulang), format klip + interpolasi, state machine, `?perf` | Prototipe jalan dengan rig baru, tanpa perubahan tampilan, frame ≤ sekarang + 1 ms |
| **V1** Lab Animasi | Kodeks Pasukan ditambah tombol klip, pilihan tier, dan kecepatan | Semua klip humanoid bisa diputar dan dinilai tanpa masuk game |
| **V2** Animasi unit lama | Klip per unit (stab, slash, shoot, cast, slam, punch, cleave, charge), jasad dan animasi mati, `windup` di sim | Setiap unit punya serangan yang berbeda, damage sinkron dengan kontak, 8 seed tetap 7–15 menit |
| **V3** Naga | Model Fable Naga, rig dragon, klip breath, semburan dari mulut, Naga Dunia menghadap sasaran, pool cahaya | Semburan api keluar dari mulut dan mengenai sasaran tepat saat damage |
| **V4** Model Fable unit lama | 10 model + Skeleton, 3 tier, LOD1 | Validasi lolos, anggaran segitiga terpenuhi, terbaca di layar HP |
| **V5** Pencahayaan | Tone mapping, suasana per fase, bloom, bayangan kontak, langit dan awan | Tangkapan 1080×1920 tiap fase disetujui user |
| **V6** Terrain | Shader biome, lereng, salju, air baru, ragam vegetasi + angin + rumput | Overview dan jarak dekat disetujui, frame dalam anggaran |
| **V7** Sungai, jalan, landmark | Sungai dan jembatan (mengubah sim), jalan, 5 landmark | 8 seed tetap seimbang dengan sungai |
| **V8** Unit baru | Mekanisme sim (tag, bonusVs, taunt, trample, siege, build, stealth), model Fable, klip, efek, mapping gift | Setiap unit punya tes sim dan masuk Kodeks |

### Status
- **V0 selesai (2026-11-16).**
  - `contract.ts`: tipe, tulang dan socket wajib, anggaran segitiga, `validateModel()`.
  - `rig.ts`: adaptor prototipe ke kontrak, dan baker per tulang dengan matriks istirahat.
  - `anims.ts`: format klip dan sampler Catmull-Rom. Klip V0 meniru gerak prototipe.
  - `animator.ts`: state idle, walk, dan attack per unit, plus `peek` untuk socket.
  - `units.ts`: rantai matriks tulang, dan `socketWorld()`.
  - `?perf`: overlay waktu per tahap.
  - `tests/models.test.ts`: 36 tes model.
  - **Hasil:** tampilan sama dengan sebelumnya. Dengan 360 unit, `units.update` 0,59 ms (sebelumnya 0,49 ms) dan draw call 469 (sebelumnya 457).
  - **Pengecualian prototipe:** kaki Cavalry di y = -0,34. Akan hilang saat model Fable dipakai.

- **Fable kit siap (2026-11-16).** `models/kit.ts` (helper), `models/_reference.ts` (humanoid contoh, lolos kontrak), `models/index.ts` (registry `MODELS`, `bakeUnit` memakainya), tes otomatis untuk semua file di `models/` (3 tier, deterministik), `docs/fable/` (aturan, brief Naga, README) dan `npm run fable -- <unit>` yang membuat prompt lengkap di `docs/fable/out/`. Belum: Kodeks belum menampilkan model baru (V1), brief unit lain.

**Urutan yang disarankan:** V0 → V1 → V3 (Naga paling terlihat, sekaligus menguji rig yang rumit) → V2 → V4 → V5 → V6 → V8 → V7. V5 (cahaya) bisa dikerjakan bersamaan dengan V4 karena tidak menyentuh file yang sama.

---

## 12. Pertanyaan terbuka

1. **Spesifikasi PC streaming** (GPU dan CPU): menentukan bloom dan rumput, dan perlu tidaknya skinning shader (tahap B).
2. **`windup` di sim:** boleh mengubah timing damage? Ini mengubah balance sedikit, tapi animasi tidak bisa sinkron tanpa itu.
3. **Gaya cahaya:** suasana per fase (9.2) atau siklus siang-malam penuh (9.5)?
4. **Sungai:** sungai yang tidak bisa diseberangi mengubah strategi dan peta spawn. Mau dipakai, atau sungai hanya hiasan dangkal yang bisa dilewati (lebih lambat)?
5. **Unit baru:** urutan prioritas dan pemetaan gift. Ada gift TikTok tertentu yang ingin dikaitkan ke unit tertentu?
6. **Tier zirah:** cukup 3 tier per level kastil, atau juga kosmetik permanen (F8)?
7. **Fable:** model dikirim per unit (satu file per percakapan) atau sekaligus? Disarankan per unit, mulai dari Naga (V3), supaya kontrak bisa diperbaiki sebelum unit lain dibuat.
