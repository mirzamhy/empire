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
