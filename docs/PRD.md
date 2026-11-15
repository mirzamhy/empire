---
title: PRD — EMPIRE (game TikTok LIVE perang kerajaan)
versi: 0.1 (draf)
tanggal: 2026-11-15
status: draf, menunggu review
tags: [prd, empire, tiktok-live]
---

# PRD — EMPIRE

Game perang kerajaan untuk TikTok LIVE. Penonton ketik `ikut`, dapat kerajaan atas nama username mereka, muncul di titik acak di benua, lalu berperang otomatis melawan kerajaan penonton lain. Gift, like, dan share menambah pasukan ke kerajaan si pengirim.

Dokumen terkait:
- [Daftar unit](../notes/unit-pasukan.md)
- [Peta dan terrain](../notes/peta-terrain.md)
- [Pemetaan gift](../notes/pemetaan-gift.md)
- [Log keputusan](../notes/keputusan.md)
- [Pertanyaan terbuka](../notes/pertanyaan-terbuka.md)
- Contoh model dan prototipe: `ref/kingdom-wars-v2-10unit.html`, `ref/kingdom-wars-v1.html`

---

## 1. Ringkasan

| Hal | Isi |
|---|---|
| Nama kerja | EMPIRE |
| Genre | Auto-battler strategi, banyak pemain, ditonton |
| Platform | Browser (Three.js + TypeScript), ditangkap OBS Browser Source 1080×1920 untuk TikTok LIVE |
| Pemain | Penonton LIVE. Host hanya operator (admin panel) |
| Input pemain | Komentar, gift, like, share, follow |
| Bahasa UI | Indonesia |
| Saudara proyek | DEADZONE (`../tiktok`). Bridge, event queue, mapping gift, admin, dan mock dipakai ulang |

### Kenapa game ini
DEADZONE membuktikan alur "gift langsung terlihat di dunia" jalan di LIVE nyata. Tapi di DEADZONE semua penonton satu tim. EMPIRE membuat tiap penonton punya **identitas sendiri di layar** (kastil dengan nama mereka) dan **lawan** (penonton lain). Persaingan antarpenonton jadi pendorong gift, bukan cuma rasa ingin membantu.

### Pilar produk
1. **Namaku ada di peta.** Begitu ketik `ikut`, dalam 2 detik kastil dengan username muncul dan kamera menyorot sebentar.
2. **Gift = pasukan, langsung kelihatan.** Unit keluar dari gerbang kastil pengirim dengan efek dan nama pengirim. Tidak ada gift yang "hilang".
3. **Adil di awal.** Semua kerajaan mulai dengan pasukan yang sama. Gift mempercepat, tapi pemain gratis tetap bisa bertahan dan sesekali menang.
4. **Bisa dibaca sekilas.** Di layar HP vertikal, penonton tahu siapa memimpin, siapa diserang, dan siapa baru kirim gift.
5. **Tahan banting.** Connector putus, gift dobel, antrean penuh: game tetap jalan.

### Non-goal MVP
- Akun pemain tersimpan lintas siaran (progress permanen). Masuk fase 3.
- Diplomasi/aliansi antarpemain.
- Kontrol unit manual per prajurit.
- Mode PC/mobile untuk dimainkan langsung (bukan via LIVE).
- Klaim bahwa connector TikTok resmi. Connector komunitas, bisa berubah sewaktu-waktu.

---

## 2. Alur penonton

```
Penonton masuk LIVE
  └─ lihat peta, papan klasemen, teks "Ketik IKUT"
       └─ komentar "ikut"
            ├─ slot tersedia  → kastil muncul di titik acak, 10 Spearman awal, kamera sorot 3 dtk
            └─ penuh          → masuk antrean, dapat posisi antrean di ticker
       └─ kirim gift / tap like / share
            └─ pasukan keluar dari kastil sendiri (+ nama pengirim melayang)
       └─ komentar perintah ("serang budi", "bertahan")
            └─ pasukan ganti target
       └─ kastil hancur
            └─ "KALAH" di ticker, boleh ikut lagi setelah jeda
Ronde habis → podium 3 besar → ronde baru
```

### 2.1 Bergabung (`ikut`)
- Kata kunci: `ikut`, `join`, `gabung` (tidak peka huruf besar/kecil, boleh ada teks lain di komentar).
- Satu username = satu kerajaan aktif. Ketik `ikut` lagi saat masih hidup tidak berefek.
- Nama kerajaan = `displayId` TikTok (handle). Nickname dipakai untuk label kalau pendek, handle sebagai cadangan. Filter kata kasar dan potong ke 14 karakter.
- Warna bendera diambil dari palet 24 warna, digilir agar tetangga tidak sewarna (lihat §5.4).
- **Gift dari penonton yang belum ikut otomatis membuat kerajaannya** lalu pasukan gift ditambahkan. Pengirim gift tidak boleh merasa giftnya terbuang.

### 2.2 Spawn acak
Spawn **bebas dan acak**, tidak pakai slot tetap seperti prototipe (24 slot cincin).
- Ambil titik acak di daratan yang **boleh dibangun**: bukan air, bukan puncak gunung, bukan sungai, kemiringan rendah.
- Jarak minimal ke kastil lain: **10 m** (peta 192×144 m). Jarak minimal ke altar naga: **16 m**.
- Coba hingga 40 kali. Kalau gagal, turunkan jarak minimal 1,5 m dan ulangi (sampai batas 7 m).
- Pulau kecil yang tidak tersambung ke benua tidak dipakai untuk spawn (pasukan darat tidak bisa menyeberang).
- Kalau tetap gagal atau jumlah kerajaan sudah di batas, pemain masuk **antrean**.
- Kerajaan baru dapat **perisai pemula 45 detik**: tidak bisa diserang, pasukannya juga tidak menyerang keluar. Kubah transparan warna bendera.

### 2.3 Modal awal (sama untuk semua)
| Item | Nilai awal |
|---|---|
| Kastil | Level 1, HP 600 |
| Pasukan | 10 Spearman |
| Emas | 0 |
| Produksi pasif | 1 Spearman tiap 8 detik, maksimal 20 pasukan dari produksi pasif |

Batas 20 dari produksi pasif membuat pemain gratis tetap punya tentara tanpa gift, tapi tidak pernah membesar sendiri.

### 2.4 Menambah pasukan
Semua sumber menambah pasukan **ke kerajaan pengirim** sendiri.

| Sumber | Efek dasar | Catatan |
|---|---|---|
| Like | Tiap 30 like dari satu user = +1 Spearman | Dihitung per user, batas 10 unit/menit/user |
| Share | +3 Archer | 1x per user per 2 menit |
| Follow | +5 Spearman | 1x per user per ronde |
| Komentar | Tidak menambah pasukan | Hanya perintah |
| Gift | Pasukan sesuai tier nilai gift | Lihat [Pemetaan gift](../notes/pemetaan-gift.md) |

Ringkasan tier gift (nilai = koin × jumlah, dibaca dari connector):

| Nilai | Hadiah |
|---|---|
| 1–4 | +3 Spearman per koin |
| 5–9 | +3 Heavy Knight |
| 10–29 | +3 Heavy Cavalry |
| 30–98 | +3 Fire Wizard + 2 Paladin |
| 99–298 | +1 Runic Golem + 2 Necromancer |
| 299–999 | +1 Ancient Dragon |
| 1000–4999 | +1 Demon Lord + upgrade kastil 1 level |
| 5000+ | Event "Panggil Naga Dunia" atas nama pengirim (lihat §3.5) + Demon Lord |

Mapping nama gift spesifik (Rose, Finger Heart, Doughnut, dll.) ditaruh di config dan **wajib dicek dari event nyata**, sama seperti DEADZONE.

### 2.5 Perintah komentar
| Komentar | Efek | Batas |
|---|---|---|
| `ikut` | Gabung | — |
| `serang <nama>` | Semua pasukan menarget kerajaan itu (selama 40 detik) | Cooldown 15 dtk per user |
| `bertahan` | Pasukan kembali menjaga kastil (radius 10 m) selama 40 detik | Cooldown 15 dtk |
| `bebas` | Kembali ke AI otomatis | — |
| `boss` | Ikut menyerbu naga dunia kalau sedang muncul | — |
| `info` | Ticker menampilkan level, pasukan, dan peringkat user | 1x per 30 dtk |

`<nama>` dicocokkan ke handle atau label kerajaan dengan fuzzy match (awalan, tanpa @). Kalau target tidak ketemu atau masih berperisai, abaikan tanpa pesan error yang mengganggu layar.

### 2.6 Kalah dan masuk lagi
- Kastil HP 0 = kerajaan runtuh. Pasukan yang tersisa **bubar** (pudar, tidak pindah ke pemenang). Ini mencegah bola salju terlalu cepat; prototipe v1 memindahkan pasukan ke pemenang dan peta cepat dikuasai satu orang.
- Penghancur kastil dapat EXP `200 + 60 × level lawan` dan emas.
- Pemain yang kalah boleh `ikut` lagi setelah **60 detik**, mulai dari nol di titik acak baru.
- Gift dari pemain yang sedang menunggu jeda: disimpan sebagai "pasukan cadangan" dan keluar saat ia masuk lagi (maks 60 dtk tunggu, setelah itu langsung auto-join).

---

## 3. Aturan permainan

### 3.1 Ronde
| Fase | Durasi | Isi |
|---|---|---|
| Lobi | 60 dtk | Peta kosong, `ikut` dibuka, semua berperisai |
| Perang | 15 menit | Pertempuran bebas |
| Naga Dunia | otomatis di menit ke-10 (atau dipicu gift besar) | Boss di altar tengah |
| Perang Akhir | 2 menit terakhir | Produksi pasif ×2, zona aman menyusut ke dalam (opsional, lihat pertanyaan terbuka) |
| Hasil | 20 dtk | Podium 3 besar, MVP gifter, statistik |

Ronde berikutnya mulai otomatis. Host bisa jeda, perpanjang, atau reset dari admin.

### 3.2 Menang
- Kerajaan terakhir yang bertahan menang langsung, **atau**
- Saat waktu habis, peringkat berdasarkan **Skor Kekuasaan** = `wilayah × 2 + level × 50 + kill pasukan + 300 × kastil dihancurkan`.
- Pemenang tampil di podium dan "Mahkota" di kastilnya pada ronde berikut (kosmetik, tanpa bonus stat).

### 3.3 Level kastil
EXP dari kill (prototipe: 32 per unit) dan menghancurkan kastil. Level 1–10.

| Level | Efek |
|---|---|
| 2 | 4 menara, HP +300 |
| 3 | Produksi pasif bisa mengeluarkan Swordsman/Archer |
| 5 | Dinding batu terang, panah otomatis dari menara |
| 6 | Atap menara emas |
| 8 | Produksi pasif bisa mengeluarkan Cavalry/Wizard |
| 10 | Mahkota raksasa di kastil, aura buff +10% damage |

Level hanya membuka variasi dan pertahanan. Unit berat (Golem, Naga, Demon Lord) hanya dari gift, beda dari prototipe yang membuka semuanya lewat level.

### 3.4 Wilayah
Peta dibagi sel heksagon 4 m (tak terlihat, hanya warna tipis). Sel jadi milik kerajaan yang unitnya paling lama berdiri di sana. Warna tanah berganti tipis ke warna bendera. Wilayah memberi skor dan membuat peta "berwarna" seperti peta perang, sehingga penonton bisa melihat siapa yang kuat tanpa membaca angka.

### 3.5 Naga Dunia (event bersama)
- Muncul di altar tengah. HP besar (prototipe 4500, disesuaikan jumlah pemain: `1500 + 150 × kerajaan aktif`).
- Pasukan yang `boss`/masuk radius 42 m ikut menyerang.
- Penyumbang damage terbanyak dapat **Naga** sebagai unit sendiri + EXP 3000.
- Gift 5000+ memanggil naga lebih awal atas nama pengirim; pengirim dapat bonus damage 25% ke naga.

### 3.6 Pertarungan
Diambil dari prototipe dan disederhanakan:
- Unit cari target terdekat: unit musuh, kastil musuh, atau boss. Perintah `serang` mengubah prioritas.
- Serangan tiap 0,9 dtk, damage tetap ± 10%. Ranged punya proyektil yang terlihat.
- Paladin menyembuhkan teman dalam radius 4 m. Necromancer membangkitkan 1 skeleton dari unit musuh yang mati (maks 3).
- Unit bertambah kuat ringan per level kastil (+18 HP, +4 dmg per level, sama dengan prototipe).
- Stat lengkap di [Daftar unit](../notes/unit-pasukan.md).

### 3.7 Keseimbangan dan anti-bola-salju
- Batas pasukan per kerajaan: `40 + 10 × level` (maks 140). Gift yang melewati batas diubah jadi **emas** (memperbaiki kastil) atau **buff** sementara, tidak hilang.
- Batas unit global 360 (anggaran render, sama DEADZONE). Kalau penuh, gift baru jadi buff "Semangat Perang" (+20% dmg 30 dtk) dan pasukan tertunda keluar saat ada ruang.
- Kerajaan peringkat 1 mendapat tanda "Diburu": AI kerajaan lain sedikit lebih condong menyerangnya.
- Perisai pemula 45 dtk dan jeda ikut ulang 60 dtk.
- Simulasi tanpa gift harus menghasilkan pemenang beragam (target: tidak ada kerajaan yang selalu menang di 8 seed).

---

## 4. Layar dan kamera

Kanvas 1080×1920 (vertikal). Wilayah aman UI TikTok: atas 160 px dan bawah 420 px tidak boleh berisi info penting.

```
┌───────────────────────────┐
│ (zona UI TikTok)          │
│ EMPIRE · Ronde 3 · 11:42  │  ← bar waktu + fase
│ 🏆 1 budi  2 sari  3 ...  │  ← top 5, warna bendera
│                           │
│        PETA 3D            │  ← kamera auto-director
│   kastil + label nama     │
│                           │
│ [toast gift besar]        │
│ ▸ sari kirim Mawar +3 🔱  │  ← ticker 4 baris
│ ▸ andi hancurkan budi!    │
│ Ketik IKUT untuk bergabung│
│ (zona UI TikTok)          │
└───────────────────────────┘
```

### Kamera auto-director (dari prototipe, diperluas)
Prioritas sorotan:
1. Gift ≥ 99 koin: zoom ke kastil pengirim 4 dtk.
2. Kastil runtuh: slow-motion 1,5 dtk di lokasi.
3. Pemain baru `ikut`: sorot kastil 2,5 dtk (digabung kalau banyak yang join bersamaan).
4. Naga Dunia aktif: 35% waktu di altar.
5. Pertempuran terbesar (unit terbanyak dalam radius 15 m).
6. Overview peta 6 dtk tiap 40 dtk.

Batas: tiap sorotan min 2 dtk, maks 1 sorotan baru per 1,5 dtk, supaya tidak pusing.

### Label
- Kastil: nama + level + bar HP, selalu terlihat. Ukuran ikut skala kamera.
- Unit dari gift: nama pengirim melayang 3 dtk di atas kepala unit pertama.
- Label tidak boleh saling tumpuk: sembunyikan yang lebih kecil level-nya kalau bertabrakan.

### Radar mini
Pojok kanan atas: titik warna tiap kerajaan, wilayah, posisi naga. Dari prototipe (`renderMinimapRadar`).

---

## 5. Dunia

### 5.1 Peta
Benua tunggal di peta 192×144 m (grid 128×96, sel 1,5 m) mengikuti layout [gambar referensi](../notes/peta-terrain.md):
- Utara: dataran pasir/stepa terang dengan tulang naga.
- Tengah-utara: rangkaian pegunungan diagonal (tidak bisa dibangun, bisa dilewati lewat celah).
- Timur laut: gurun oranye + pulau-pulau kecil + menara di pulau.
- Selatan dan barat daya: hutan lebat.
- Teluk/danau di tengah-tenggara, sungai berkelok dengan jembatan.
- Pulau kecil di barat daya dan sekitar pantai.
- Altar Naga di tengah benua.

Detail teknis pembuatan terrain di [Peta dan terrain](../notes/peta-terrain.md).

### 5.2 Efek biome (ringan, MVP)
| Biome | Efek |
|---|---|
| Hutan | Unit di dalamnya -20% terkena panah |
| Gunung | Tidak bisa dibangun, jalan -40% |
| Gurun | Tidak ada efek (MVP) |
| Sungai | Hanya lewat jembatan atau arungan dangkal |
| Pulau | Bisa jadi titik spawn; pasukan menyeberang lewat arungan dangkal yang ditandai |

### 5.3 Gaya visual
- Low-poly flat-shaded, bidang besar yang rapi (aturan gaya yang sama dengan DEADZONE, lihat catatan low-poly di vault model 3d maker).
- Unit ~500 segitiga, 1 atlas tekstur 256×256, 1 draw call per jenis unit lewat InstancedMesh.
- Warna bendera = warna tunik, atap kastil, dan cincin klaim.

### 5.4 Palet bendera
24 warna. Prototipe memakai nama kerajaan Nusantara (Majapahit, Sriwijaya, ...). Di EMPIRE nama kerajaan = username, nama Nusantara hanya dipakai sebagai nama warna di config. Penugasan warna: pilih warna dengan jarak warna terjauh dari 3 kerajaan terdekat.

---

## 6. Arsitektur teknis

Mengikuti DEADZONE agar bisa memakai ulang kode.

```
TikTok LIVE ──► bridge (Node/TS, ws 127.0.0.1:8788)
                 ├─ tiktok-live-connector adapter
                 ├─ mock adapter (label DEMO)
                 ├─ normalisasi event, dedupe, batch streak
                 ├─ admin panel /admin (kill switch, simulator gift)
                 └─► game page (Vite :5200)
                       ├─ sim/  — TS murni, deterministik, bisa headless
                       │    world, kingdoms, units, combat, territory, round
                       ├─ events/ — antrean perintah, cooldown, cap
                       ├─ render/ — Three.js, InstancedMesh per part, terrain
                       └─ ui/  — HUD, ticker, podium, radar
config/
  game.config.json    — stat unit, ronde, batas
  events.config.json  — mapping gift/like/share/komentar
```

### Yang dipakai ulang dari DEADZONE
- Bridge, provider interface, reconnect, kill switch, admin.
- Format event ternormalisasi dan antrean prioritas.
- Pelajaran connector (`displayId`, gift di `gift{name,diamondCount}`, jangan aktifkan `enableExtendedGiftInfo`, bridge hanya terima satu halaman game).
- Pola sim murni + `scripts/sim-smoke.ts <seed>`.

### Yang baru
- `Kingdom` sebagai entitas yang dimiliki user (bukan tim bersama).
- Routing gift ke kerajaan pengirim + auto-join.
- Spawn acak dengan sampling titik valid dari mask biome.
- Wilayah heksagon.
- Parser perintah komentar dengan target nama.

### Port
Game `5200`, bridge `8788` (5190/8787 dipakai DEADZONE, 5195–5198 proyek lain).

### Performa
| Target | Nilai |
|---|---|
| FPS di PC streaming | 60, minimal 45 dengan 360 unit + 40 kastil |
| Draw call | < 150 |
| Kerajaan aktif | 40 (antrean di atas itu) |
| Waktu gift → unit muncul | < 1,5 dtk |
| Waktu `ikut` → kastil muncul | < 2 dtk |

---

## 7. Data dan event

### Event ternormalisasi (dari bridge)
```json
{
  "kind": "gift",
  "source": "tiktok",
  "user": { "id": "7012...", "handle": "budi_123", "nickname": "Budi" },
  "gift": { "name": "Rose", "value": 1, "repeat": 5, "final": true },
  "receivedAt": 1763190000000
}
```

### Perintah game
```json
{ "cmd": "ADD_TROOPS", "userId": "7012...", "units": { "spearman": 15 }, "reason": "gift:Rose x5" }
{ "cmd": "JOIN", "userId": "7012...", "label": "budi_123" }
{ "cmd": "ORDER", "userId": "7012...", "order": "attack", "target": "sari" }
```

### Aturan penting
- Gift streak: proses hanya saat `final`, kalikan `repeat`. Dedupe 15 dtk per (user, gift, id).
- Gift kecil dari user yang sama digabung dalam jendela 1,8 dtk (satu toast, satu gelombang unit).
- Event `DEMO` dari mock tidak masuk statistik ronde nyata.

---

## 8. Admin (host)
- Status connector (online/offline), tombol hubungkan ulang.
- Kill switch (abaikan semua event nyata).
- Simulator: kirim `ikut` palsu, gift palsu ke user tertentu, like massal.
- Kontrol ronde: jeda, lanjut, +5 menit, reset.
- Moderasi: tendang/ban username (kastil runtuh tanpa EXP untuk siapa pun), filter kata.
- Pengaturan cepat: durasi ronde, modal awal, batas kerajaan.

---

## 9. Metrik sukses
| Metrik | Target awal |
|---|---|
| Penonton yang `ikut` | ≥ 30% dari penonton aktif puncak |
| Waktu tonton rata-rata | Naik ≥ 25% dibanding siaran DEADZONE |
| Gifter unik per ronde | ≥ 5 |
| Ronde tanpa crash | 100% dalam siaran 2 jam |
| Gift yang tidak menghasilkan efek di layar | 0 |

---

## 10. Fase pengerjaan

| Fase | Isi | Selesai jika |
|---|---|---|
| F0 | Scaffold Vite + bridge (salin pola DEADZONE), config, sim kosong | `npm run dev` jalan, admin terhubung |
| F1 | Terrain dari layout referensi, mask biome, spawn acak | 40 kastil muncul acak tanpa di air/gunung/bertumpuk |
| F2 | Sim perang: unit, combat, kastil, level, runtuh | `sim-smoke` 8 seed tanpa gift selesai dengan pemenang beragam |
| F3 | Render unit: 10 model dari prototipe dipindah ke InstancedMesh part | 360 unit ≥ 45 fps |
| F4 | Event: `ikut`, gift → pasukan, like/share/follow, perintah komentar, mock | Simulator admin bisa memainkan satu ronde penuh |
| F5 | HUD vertikal, ticker, label, radar, auto-director, podium | Terbaca di HP (uji tangkapan 1080×1920) |
| F6 | Wilayah heksagon, Naga Dunia, perisai pemula, antrean | Ronde 15 menit penuh di mock tanpa error |
| F7 | Uji LIVE nyata, kalibrasi mapping gift | Gift asli terpetakan semua, tidak ada gift dobel |
| F8 (nanti) | Progress permanen, kosmetik bendera, musim | — |

---

## 11. Risiko
| Risiko | Mitigasi |
|---|---|
| Connector komunitas berubah/putus | Adapter terpisah, mock selalu ada, game tetap jalan tanpa event |
| Satu gifter besar menguasai peta | Batas pasukan per kerajaan, gift lebih jadi emas/buff, tanda "Diburu" |
| Terlalu banyak `ikut` sekaligus | Batas 40 kerajaan + antrean, gabung sorotan kamera |
| Label nama berantakan di HP | Label prioritas level, sembunyikan saat tabrakan |
| Nama kasar sebagai nama kerajaan | Filter kata + ban dari admin |
| Lisensi gambar peta referensi | Hanya jadi acuan layout; terrain dibuat ulang prosedural (lihat pertanyaan terbuka) |
| Kebijakan TikTok soal game berbasis gift | Tidak ada hadiah uang/barang nyata; gift hanya mengubah game |
