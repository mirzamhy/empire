# Langkah selanjutnya

Diperbarui: 2026-11-16. Daftar ini dibuat setelah rencana visual (`docs/rencana-visual.md`) dikerjakan sampai fase V0–V4 dan sebagian V1, V2, V3, V5, V6, V8. Keputusan yang sudah diambil ada di `notes/keputusan.md` (D-019 sampai D-026).

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
| Relief peta (gunung ±44 m), suasana cahaya per fase | Selesai |
| 8 unit baru (mekanisme, model, gift) | Selesai, stat masih draf |
| Sungai, jalan, jembatan, landmark | Belum |
| Animasi mati, jasad, klip kena pukul dan muncul | Belum |
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

- Satu dari 8 seed (seed 7) habis waktu 16 menit dengan 3 kerajaan tersisa. Jalankan `npx tsx scripts/sim-seeds.ts` dan cari penyebabnya sebelum menyetel stat.
- Stat unit baru masih draf dari rencana bagian 6. Yang paling perlu dicurigai: Gajah (900 HP) dan Shieldbearer (taunt memperlambat ronde), Trebuchet (160 damage ke kastil).
- Engineer sengaja tidak ada di produksi pasif karena bikin ronde molor. Boleh dicoba lagi di level 10 saja.
- Sasaran: ronde 7–15 menit di 8 seed, tanpa satu kerajaan terlalu dominan.
- Catat hasil dan alasan di `notes/keputusan.md`.

## 3. Pekerjaan berikutnya (urut saran)

1. **Animasi mati dan jasad** (rencana 4.6): klip `death`, jasad tinggal 4 detik lalu hilang, Golem pecah, Skeleton berantakan. Ini yang membuat pertempuran terasa paling hidup setelah serangan.
2. **Klip kena pukul, muncul (`spawn`), dan lari** untuk semua humanoid. Plus `brace` (Halberdier dan Shieldbearer), `sneak` (Assassin).
3. **Efek unit baru:** asap Assassin saat muncul, uap merah Berserker saat HP < 50%, lingkaran merah sasaran Trebuchet sebelum batu mendarat, debu langkah Gajah, panah memantul dari Shieldbearer.
4. **`windup` di sim** (butuh keputusanmu, lihat pertanyaan 12.2 di rencana): damage jatuh setelah ancang-ancang selesai. Tanpa ini gerakan mulai dari posisi ancang-ancang dan damage terasa sedikit mendahului gerakan.
5. **Sungai, jalan, jembatan, dan 5 landmark** (V7, rencana 8.3 dan 8.5). Sungai yang tidak bisa diseberangi mengubah alur perang, jadi wajib diuji ulang di 8 seed. Keputusan: sungai halangan sungguhan atau hiasan dangkal (pertanyaan 12.4).
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
