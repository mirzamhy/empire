# Langkah selanjutnya

Diperbarui: 2026-11-17. Daftar ini dibuat setelah rencana visual (`docs/rencana-visual.md`) dikerjakan sampai fase V0–V4 dan sebagian V1, V2, V3, V5, V6, V8. Keputusan yang sudah diambil ada di `notes/keputusan.md` (D-019 sampai D-026).

## Status singkat

| Bagian | Status |
|---|---|
| Efek pertarungan, desa dan ekspansi wilayah | Selesai |
| Rig, klip animasi sebagai data, animator, `?perf` | Selesai |
| Fable kit (`docs/fable`, `npm run fable -- <unit>`) | Selesai |
| Model 19 unit, 3 tingkat zirah | Selesai (LOD1 belum) |
| Lab Animasi di Kodeks | Selesai |
| Klip serangan per unit, semburan Naga dari mulut | Selesai |
| Terrain: warna, air, 15 jenis tanaman + angin | Selesai |
| Peta baru 864 x 648 m: benua hutan gelap, 5 barisan gunung dengan kaki bukit, suasana lebih gelap | Selesai (D-030), performa belum diukur |
| 8 unit baru (mekanisme, model, gift) | Selesai, stat masih draf |
| Griffin Rider (unit ke-20, gift 80 koin) | Selesai (D-029), stat draf, belum ditonton bertempur |
| Tiga peta yang bisa dipilih (`?map=1\|2\|3`) | Selesai (D-031) |
| Peta 3: sungai yang bisa diseberangi, 7 landmark, kabut, burung, partikel | Selesai (D-031), belum dilihat satu ronde penuh |
| Jalan tanah, jembatan | Ditunda |
| Animasi mati dan jasad | Selesai (D-028), belum ditonton satu ronde penuh |
| Klip kena pukul dan muncul | Belum |
| Bloom, tone mapping, vignette | Belum (tunggu pengukuran) |

## 1. Lakukan dulu (tanpa kode baru)

1. **Ukur performa di PC streaming.** Buka `http://127.0.0.1:5200/?demo=30&perf` di Chrome atau OBS dan catat frame ms, draw call, dan segitiga (kiri bawah). Panel browser di Claude tidak bisa dipercaya untuk angka GPU. Per terakhir dicek: sekitar 565 ribu segitiga dan 308 draw call, belum ada angka GPU yang sah. Batas aman: 12 ms GPU dan 6 ms CPU. Hasilnya menentukan apakah bloom dan rumput boleh dipakai (lihat bagian 4).
2. **Tonton satu ronde penuh** (`?demo=30`) dan periksa dengan mata:
   - unit baru (Gajah, Trebuchet, Ballista, Shieldbearer, Assassin) saat bertempur;
   - menara jaga yang dibangun Engineer di desa;
   - Naga Dunia menyembur (arah, rahang, api dari mulut);
   - suasana fase RESULT (senja ungu) dan FINAL;
   - kastil dan desa di kaki gunung: apakah miring atau tenggelam di relief baru;
   - kamera sutradara di dekat gunung tinggi.
3. **Uji siaran sungguhan** sekali dengan `npm run dev` dan TikTok LIVE: cek pemetaan gift baru (15, 20, 50, 120, 150, 200 koin) di `config/events.config.json` dan tombol di admin.
4. **Commit dan push** setelah langkah 2 menemukan tidak ada yang rusak.

## 2. Balance (setelah ditonton)

- Selesai (D-027): seed 7 habis waktu karena tiga kerajaan terakhir berjauhan dan pasukan pasif datang satu per satu ke kastil level 10. `castleHpPerLevel` diturunkan 300 -> 150; 8 seed sekarang selesai dalam 7,2–14,5 menit perang, dan di 30 seed tinggal 1 yang habis waktu (sebelumnya 6). Belum ditonton di layar.
- Stat unit baru masih draf dari rencana bagian 6. Yang paling perlu dicurigai: Gajah (900 HP) dan Shieldbearer (taunt memperlambat ronde), Trebuchet (160 damage ke kastil).
- Engineer sengaja tidak ada di produksi pasif karena bikin ronde molor. Boleh dicoba lagi di level 10 saja.
- Sasaran: ronde 7–15 menit di 8 seed, tanpa satu kerajaan terlalu dominan.
- Catat hasil dan alasan di `notes/keputusan.md`.

## 3. Pekerjaan berikutnya (urut saran)

1. ~~Animasi mati dan jasad~~ selesai (D-028). Sisa: tombol "Mati" di Lab Animasi Kodeks, dan cek Gajah serta mesin kepung di layar.
2. **Klip kena pukul, muncul (`spawn`), dan lari** untuk semua humanoid. Plus `brace` (Halberdier dan Shieldbearer), `sneak` (Assassin).
3. **Efek unit baru:** asap Assassin saat muncul, uap merah Berserker saat HP < 50%, lingkaran merah sasaran Trebuchet sebelum batu mendarat, debu langkah Gajah, panah memantul dari Shieldbearer.
4. **`windup` di sim** (butuh keputusanmu, lihat pertanyaan 12.2 di rencana): damage jatuh setelah ancang-ancang selesai. Tanpa ini gerakan mulai dari posisi ancang-ancang dan damage terasa sedikit mendahului gerakan.
5. **Sisa rencana peta 3** (`notes/rencana-atmosfer-landmark.md`): penghitung FPS dan pengukuran di PC streaming, pembesaran kastil, air terjun, percikan air, jalan tanah. Sungai dan landmark sudah ada (D-031); sungai diputuskan dangkal dan bisa diseberangi.
6. **Pencahayaan tahap 2** (V5): tone mapping ACES, bloom, vignette. Hanya setelah ada angka dari PC streaming (bagian 1).
7. **LOD1 model** (±25% segitiga untuk kamera jauh) dan variasi kepala per unit supaya 40 Spearman tidak kembar (rencana 5.12), pembawa panji tiap 12 unit (5.13).
8. **Rumput rapat dekat kamera** dan ledakan yang menggoyang pohon (rencana 8.4), kalau anggaran performa mengizinkan.

## 4. Keputusan yang masih menunggu kamu

Dari `docs/rencana-visual.md` bagian 12, yang masih terbuka:

1. Spesifikasi PC streaming (GPU, CPU). Menentukan bloom, rumput, dan perlunya skinning di shader.
2. Boleh mengubah timing damage dengan `windup`?
3. Gaya cahaya: suasana per fase (sudah dipakai) atau siklus siang-malam penuh?
4. Sungai: halangan sungguhan atau hiasan dangkal?
5. Tier zirah: cukup 3 per level kastil, atau juga kosmetik permanen?
6. Gift TikTok tertentu yang ingin dikaitkan ke unit tertentu (pemetaan sekarang berdasarkan nilai koin).

## 5. Hal teknis yang perlu diingat

- `proto.js` (model prototipe) tinggal cadangan untuk tipe tanpa entri di `models/index.ts`. Boleh dihapus nanti kalau semua tipe sudah punya model.
- Sim tidak membaca tinggi tanah. Kalau suatu hari tinggi dipakai (misalnya jalan menanjak lebih lambat), uji ulang 8 seed.
- Panel browser Claude menghentikan `requestAnimationFrame` saat tersembunyi. Untuk tangkapan layar gunakan `window.__em` (`run`, `render`, `sim`, `view`), jangan percaya angka GPU dari sana.
- Model baru: tulis `models/<unit>.ts`, daftarkan di `models/index.ts`, `npm run test` otomatis memeriksanya. Panduan: `docs/fable/README.md`.
- Menambah kemampuan unit: cukup baris config (`tags`, `bonusVs`, `taunt`, `cover`, `rage`, `stealth`, `hunts`, `dodge`, `trample`, `minRange`, `builds`), mekanisme umumnya sudah ada di `sim/world.ts`.
- Tautan Kodeks untuk meninjau: `units.html?unit=<unit>&level=8&spin=1&clip=attack&t=0.2`.

## 6. Cara mulai sesi berikutnya

1. `npm install` (kalau perlu), lalu `npm run dev`: game `http://127.0.0.1:5200/`, admin `http://127.0.0.1:8788/admin`.
2. `npm run check` harus hijau (typecheck, tes, build).
3. Baca bagian "Status" di `docs/rencana-visual.md` dan daftar ini, lalu pilih satu item dari bagian 3.
