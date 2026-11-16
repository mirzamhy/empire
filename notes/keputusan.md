---
tags: [empire, keputusan]
---

# Log keputusan

Format: `D-xxx` · tanggal · keputusan · alasan. Keputusan baru ditambah di bawah.

- **D-001** · 2026-11-15 · Stack sama dengan DEADZONE (Three.js + TS, Vite, bridge Node `ws`, tiktok-live-connector). · Bridge, antrean event, dan pelajaran connector sudah teruji di LIVE nyata.
- **D-002** · 2026-11-15 · Spawn bebas acak di titik daratan valid, bukan 24 slot tetap seperti prototipe. · Permintaan user ("di-spawn bebas random"); juga tidak membatasi jumlah pemain pada 24.
- **D-003** · 2026-11-15 · Modal awal sama untuk semua: kastil lv 1, 10 Spearman. · Permintaan user (pasukan awal sama). Angka 10 bisa diubah di config.
- **D-004** · 2026-11-15 · Pasukan kerajaan yang runtuh bubar, tidak pindah ke pemenang. · Prototipe v1 memindahkan pasukan; ini mempercepat satu pemain menguasai peta.
- **D-005** · 2026-11-15 · Unit berat (Golem, Dragon, Demon Lord) hanya dari gift. Level kastil hanya membuka unit ringan di produksi pasif. · Menjaga nilai gift; pemain gratis tetap punya pasukan dasar.
- **D-006** · 2026-11-15 · Gift dari penonton yang belum `ikut` otomatis membuat kerajaannya. · Gift tidak boleh terbuang.
- **D-007** · 2026-11-15 · Ronde 15 menit + lobi 60 dtk + hasil 20 dtk. · Cukup panjang untuk naik level dan menghancurkan beberapa kastil, cukup pendek agar penonton baru tidak menunggu lama.
- **D-008** · 2026-11-15 · Batas 40 kerajaan aktif dan 360 unit global. · Anggaran render yang sama dengan DEADZONE; label nama masih terbaca di 1080×1920.
- **D-009** · 2026-11-15 · Port game 5200, bridge 8788. · 5190/8787 dipakai DEADZONE, 5195–5198 proyek lain.
- **D-010** · 2026-11-15 · Peta referensi dipakai sebagai acuan layout, terrain dibuat ulang prosedural dari mask biome. · Lisensi gambar belum jelas, dan terrain 3D tetap perlu heightmap sendiri.
- **D-011** · 2026-11-15 · Peta 192×144 m (grid 128×96 dari gambar, sel 1,5 m), jarak kastil minimal 10 m, pulau terpisah tidak dipakai spawn. Sungai belum ada di mask (terlalu tipis di gambar). · Dengan 14 m, 40 kastil tidak muat di daratan yang bisa dibangun. Diukur di `tests/map.test.ts`.
- **D-012** · 2026-11-16 · Tier gift dihitung dari nilai satu gift, lalu dikali jumlah streak (5 Rose = 15 Spearman). · Kalau dihitung dari total, 5 Rose jadi 3 Knight; penonton akan merasa dapat lebih sedikit.
- **D-013** · 2026-11-16 · Unit digambar 1,7× ukuran sim dan FOV kamera 55°. · Di layar portrait, unit ukuran asli tidak terlihat di antara pohon dan kastil.
- **D-014** · 2026-11-16 · Kastil HP 1600, menara 14 (+3/level). · Dengan 600 HP ronde tanpa gift habis dalam 5–12 menit; sekarang 9–16 menit (`scripts/sim-seeds.ts`).
- **D-015** · 2026-11-16 · Builder model prototipe dipakai apa adanya (`game/src/render/units/proto.js`), satu perbaikan: loft ring dengan jumlah segmen berbeda (topi Wizard crash di prototipe).
- **D-016** · 2026-11-16 · Pemenang ronde lanjut otomatis ke ronde berikut (mulai dari nol, dapat mahkota kosmetik). Yang runtuh harus ketik `ikut` lagi. · Penonton aktif tidak perlu ketik ulang tiap ronde.
- **D-017** · 2026-11-16 · Peta diperbesar 1,5× jadi 288×216 m (sel 2,25 m, grid tetap 128×96), jarak kastil minimal 14 m, kepadatan pohon per m² tetap. Menggantikan ukuran di D-011. · Permintaan user: peta terasa sempit. Ronde tanpa gift tetap 6–16 menit (8 seed).
- **D-018** · 2026-11-16 · Peta diperbesar lagi jadi 576×432 m (grid 256×192, sel 2,25 m), 3× ukuran awal dan 9× luasnya. Gambar tetap dibaca di 128×96 lalu diperbesar 2× dan dihaluskan (`node tools/build-map.mjs 2`). Jarak kastil minimal 20 m. Bayangan mengikuti titik fokus kamera. Menggantikan D-017. · Permintaan user: peta lebih masif. Ronde tanpa gift 9–16 menit (8 seed), render 5,4 ms/frame dengan 30 kerajaan.
- **D-019** · 2026-11-16 · Efek pertarungan di `game/src/render/fx.ts`: percikan dan kilatan pukulan, panah tertancap, bola api dengan jejak, ledakan dan bekas gosong, angka damage (≥24, kastil dijumlah per 0,6 dtk), kilatan putih unit terkena, kastil mengempis saat dipukul, asap <50% HP dan api <25% HP, runtuh dengan cincin kejut dan reruntuhan yang tinggal sampai ronde berakhir, pilar cahaya gift (4 tier warna), cincin naik level, guncangan kamera. Sim hanya menambah event `hit` (melee) serta `dmg`/`on` di `shot`; hasil 8 seed tidak berubah. · Permintaan user: pertarungan harus terasa. Semua efek pakai InstancedMesh, update ±0,1 ms/frame.
- **D-020** · 2026-11-16 · Ekspansi wilayah: 16 desa netral (jarak ≥48 m, posisi dari rng sendiri per seed). Desa direbut kalau hanya satu kerajaan berdiri di radius 6 m selama 4 dtk; kepemilikan mengklaim wilayah radius 10 m, memberi +80 EXP, skor +120, dan 1 Spearman milisi tiap 60 dtk. Wilayah mempercepat produksi pasif sampai +40% (di 600 petak). Perintah komentar `ekspansi`/`perluas`/`jajah` mengirim semua pasukan ke desa terdekat; tanpa perintah, garnisun kecil dan sepertiga pasukan pasif merebut desa dalam 70 m dari kastil. Perbatasan wilayah digambar tegas di tepi area yang padat, texture wilayah difilter linear. Kerajaan runtuh kehilangan desanya. · Permintaan user: mekanisme memperluas area. Milisi 18 dtk + bonus 100% membuat ronde 6–10 menit; nilai akhir memberi 7,7–13,9 menit (8 seed), mendekati 7,9–15 sebelum desa.
- **D-021** · 2026-11-16 · V0 rig: semua model (prototipe dan nanti Fable) lewat kontrak `game/src/render/units/contract.ts`. Satu `InstancedMesh` per tulang, matriks tulang dirangkai di CPU, klip animasi sebagai data (kunci [t, x, y, z], Catmull-Rom). Nama tulang prototipe: torso = spine, kaki kuda = legFR/legFL/legBR/legBL, lengan naga = wingR/wingL. · Langkah pertama rencana visual; tampilan tidak berubah, biaya +0,1 ms dan +12 draw call untuk 360 unit.

## D-022: Fable kit (2026-11-16)
- Model Fable berupa modul TS (`models/<unit>.ts` mengekspor `build(opts)`), bukan .glb: bisa di-diff, diberi tint, dan di-bake tanpa tool tambahan.
- Registry `MODELS` di `models/index.ts`; tipe tanpa entri tetap memakai prototipe, jadi unit diganti satu per satu.
- `npm run fable -- <unit>` menyatukan aturan, brief, kontrak, helper, dan contoh jadi satu prompt yang berdiri sendiri.
- Tes menemukan model otomatis (`import.meta.glob`): file baru langsung divalidasi pada 3 tier.

## D-023: Model unit, tingkat zirah, klip per unit, semburan Naga (2026-11-16)
- Semua 11 unit memakai model di `models/`; prototipe `proto.js` hanya jadi cadangan untuk tipe tanpa entri di `MODELS`.
- Tingkat zirah dipilih dari level kerajaan (1–4, 5–7, 8+), satu set `InstancedMesh` per tipe × tingkat.
- Klip serangan dipilih per tipe unit (`clipFor`), bukan per rig. Tanpa `windup` di sim, klip dimulai dari ancang-ancang supaya kontak terjadi dekat saat damage. Perubahan `windup` masih menunggu keputusan (rencana 12.2).
- Semburan Naga adalah aliran partikel dari socket `mouth`, bukan proyektil. Event `shot` membawa `id` supaya efek tahu unit mana yang menembak; ini tidak mengubah hasil sim.

## D-024: Terrain dan suasana (2026-11-16)
- Warna terrain di-bake per segitiga di CPU, bukan dihitung di shader: tampilan tetap flat low-poly dan tidak ada biaya per frame. Shader hanya menambah territory dan bayangan awan.
- Awan sungguhan tidak dibuat karena kamera overview berada 400 m di atas peta dan awan akan menutupinya; yang ada hanya bayangannya.
- Suasana mengikuti fase ronde (rencana 9.2), bukan siklus siang-malam penuh. Tone mapping dan bloom ditunda sampai ada pengukuran di PC streaming.
- Semua ini hanya render: sim dan balance tidak berubah.

## D-025: Relief peta diperdalam, luas tetap (2026-11-16)
- Peta tidak diperluas (tetap 576 x 432 m): pasukan akan makin kecil di layar dan ronde makin lama.
- Tinggi tanah di `map.ts` dihitung ulang: puncak gunung sekitar 44 m (sebelumnya 9 m) dengan punggungan bergerigi, kaki gunung menanjak, dataran dan hutan berbukit landai (sampai 3 m), bukit pasir di gurun, dasar laut turun sampai -6 m.
- Sim tidak membaca tinggi tanah (navigasi dan penempatan memakai biome), jadi balance tidak berubah. Noise dipindah ke `sim/noise.ts` supaya peta dan renderer memakai fungsi yang sama.
- Garis salju naik ke 25 m; kamera sutradara dijaga minimal 8 m di atas tanah.

## D-026: Delapan unit baru (2026-11-16)
- Kemampuan unit dibaca dari config (`tags`, `bonusVs`, `taunt`, dst.), bukan ditulis per tipe di sim, supaya unit berikutnya cukup menambah baris config.
- Engineer tidak masuk produksi pasif: saat dicoba di level 8, dua dari 8 seed mencapai batas waktu ronde. Engineer hanya datang dari gift 200 bersama Trebuchet.
- Stat masih draf dari rencana bagian 6. Hasil 8 seed setelah perubahan: 8,2–13,3 menit untuk 7 seed, 1 seed habis waktu.
- Assassin tetap digambar penuh (tidak transparan); "siluman" hanya berarti tidak bisa diincar sampai menyerang atau terkena serangan.

