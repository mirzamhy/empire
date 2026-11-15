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
