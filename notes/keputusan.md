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


## D-027: HP kastil per level 300 -> 150 (2026-11-16)
- Penyebab seed 7 habis waktu: sejak menit ke-6 tersisa tiga kerajaan yang berjauhan (sekitar 150–270 m). Pasukan pasif (maks 20) berangkat satu per satu begitu muncul, bertemu di tengah, dan yang sampai terlalu sedikit untuk menjebol kastil level 10 (4300 HP, menara 44 damage, HP penuh lagi tiap naik level). Tiga kerajaan saling mengincar bergantian selama 9 menit tanpa ada yang jatuh.
- Diuji di 30 seed (20 kerajaan, tanpa gift). Sebelum: 6 ronde habis waktu, median 12,4 menit. `castleHpPerLevel` 150: 1 habis waktu, median 10,3 menit, tidak ada ronde di bawah 7 menit perang.
- Alternatif yang diuji dan tidak dipakai: `towerDamagePerLevel` 1 (1 habis waktu, tapi 2 ronde di bawah 7 menit), `castleHpPerLevel` 200 (5 habis waktu), `towerDamagePerLevel` 2 (3 habis waktu), `passive.maxUnits` 30, `marchAtUnits` 14, `finalMultiplier` 4 (masih ada yang habis waktu di 12 seed). `hunted.weight` 0,7 jauh lebih buruk: semua mengeroyok pemimpin dan hampir semua ronde habis waktu.
- Kastil level 10 sekarang 2950 HP (sebelumnya 4300). Stat unit baru (Gajah, Shieldbearer, Trebuchet) belum disentuh.

## D-028: Animasi mati dan jasad (2026-11-16)
- Sim tetap menghapus unit saat mati. Event `death` sekarang membawa `id` dan `heading` supaya renderer bisa meninggalkan jasad; hasil sim tidak berubah (8 seed identik sebelum dan sesudah).
- Renderer menyimpan daftar jasad (`UnitRenderer.addCorpse`) dan menggambarnya lewat `InstancedMesh` yang sama dengan unit hidup. Jasad tinggal 4 detik: jatuh 0,6–1 dtk, diam, lalu tenggelam 0,4 m di detik terakhir. Batas 120; kalau penuh, yang tertua langsung tenggelam.
- Gerak dibagi dua: klip `death` di `anims.ts` hanya menggerakkan anggota badan, sedangkan rebah, pecah, dan tenggelam dihitung di `render/units/death.ts`. Alasannya: rig tidak punya tulang akar yang bisa dianimasikan, dan cara ini juga berlaku untuk model prototipe.
- Tiga gaya: `fall` (humanoid jatuh ke belakang atau samping menurut `id`; kuda, Gajah, dan Naga hanya ke samping, penunggang kuda terlempar, Naga jatuh dari udara), `shatter` (Golem, Skeleton, Ballista, Trebuchet: tiap tulang jadi satu bongkah yang terlempar lalu diam), `dissolve` (Demon berlutut lalu menyusut jadi bara, hilang setelah 1,7 dtk).
- Belum: klip mati di Lab Animasi Kodeks, dan pemeriksaan di layar untuk Gajah dan mesin kepung.

## D-029: Unit ke-20, Griffin Rider (2026-11-16)
- Peran: unit terbang jarak dekat kelas menengah. Sebelumnya hanya Naga yang terbang, jadi Ballista (bonus +100% ke unit terbang) jarang punya sasaran.
- Stat draf: 380 HP, 38 damage, jangkauan 2,2, kecepatan 6,6 (tercepat), `flying`, tag `big`, `hunts: ["siege", "ranged"]`. Tidak ada mekanisme sim baru; semuanya baris config. Penangkalnya Ballista (×2) dan Halberdier (+60% karena tag `big`).
- Sumber: gift 80 koin memberi 2 Griffin Rider. Tidak masuk produksi pasif, jadi 8 seed tanpa gift tidak berubah.
- Model `models/griffin.ts` memakai rig `dragon` supaya kepak sayapnya sama; warna kerajaan ada di bulu penutup sayap agar terbaca dari kamera atas. Tiga tingkat zirah: polos, pelindung kepala dan dada besi, lalu paruh dan cakar emas dengan panji di tombak.
- Klip sendiri: `griffinFly`, `swoop` (serang), `griffinDeath` (jatuh, penunggang terlempar).
- Renderer: unit terbang jarak dekat turun dari 4,5 m ke 1,3 m selama menyerang lalu naik lagi (`flyHeight` di `units.ts`), supaya cakarnya terlihat mengenai pasukan darat. Ini hanya tampilan.
- Belum: ditonton dalam pertempuran sungguhan, dan balance dengan gift (misalnya banyak griffin memburu Trebuchet).

## D-030: Peta baru, benua hutan gelap 864 x 648 m (2026-11-16)
- Menggantikan D-025 ("peta tidak diperluas") atas permintaan user: peta lebih besar, suasana lebih gelap, terasa hutan, dan gunung dengan skala wajar yang tidak langsung menjulang.
- Peta tidak lagi dijiplak dari gambar referensi. `tools/gen-map.mjs` membuat benua secara prosedural (seed tetap) dan menulis `game/src/sim/mapdata.ts`: grid 384 x 288 sel, 2,25 m per sel, 1,5x lebih lebar dan 2,25x lebih luas dari peta lama. Daratan 52% dari grid; dari daratan itu 56% hutan, 21% gunung, 16% padang, 4% moor, 3% pantai.
- Lima barisan pegunungan bernama (Tembok Utara, Punggung Naga, Pegunungan Barat, Bukit Selatan, Tanduk Timur) digambar sebagai garis punggung dengan lebar berubah-ubah, sehingga tiap barisan punya celah dan ujung yang mengecil, plus beberapa massif lepas dan empat danau.
- Relief (`map.ts`): kaki bukit selebar sekitar 60 m naik sampai 8,5 m sebelum batas batu, lalu tinggi mengikuti kedalaman di dalam barisan dan mendatar di puncak. Bagian lebar jadi puncak (tertinggi 47 m), bagian sempit tetap bukit. Lereng rata-rata 30 sampai 35 derajat. Garis salju 36 m, garis pohon 24 m.
- Bioma `desert` dipakai ulang sebagai moor kering (semak, pohon mati, batu); palem dan kaktus tidak lagi ditanam. Nama bioma di kode tidak diubah.
- Tampilan: palet tanah, daun, dan laut digelapkan; hutan didominasi pinus dan pohon dibuat lebih tinggi; lereng bawah gunung berwarna lantai hutan. Suasana per fase digelapkan (fajar berkabut, siang mendung, sore merah, senja ungu). Kamera overview, kabut, kubah langit, dan jarak pandang mengikuti `WORLD_SCALE`.
- Balance tidak diubah. 30 seed dengan 20 kerajaan: 2 habis waktu, median 10,8 menit perang, 1 ronde di bawah 7 menit. 10 seed dengan 40 kerajaan: 1 habis waktu.
- Biaya: adegan sekitar 1,5 juta segitiga (peta lama sekitar 565 ribu), sebagian besar pohon. Model pohon sudah diringankan; `?veg=0.6` menipiskan vegetasi untuk PC yang lemah. Belum diukur di PC streaming.
- Akibat peta lebih besar: unit terlihat lebih kecil di kamera overview, dan perintah `boss` (40 dtk) bisa habis sebelum pasukan sampai ke altar, jadi penonton perlu mengetiknya lagi.
- Belum: sungai, jalan, jembatan, landmark. `notes/peta-terrain.md` masih menjelaskan peta lama.

## D-031: Tiga peta yang bisa dipilih, dan peta 3 "Hutan Sungai" (2026-11-17)
- Atas permintaan user, perubahan baru tidak menimpa peta lama. Sekarang ada tiga peta di `game/src/sim/maps.ts`, dipilih dengan `?map=1|2|3` di URL (atau `EMPIRE_MAP=2` untuk uji tanpa layar). Peta 3 adalah bawaan.
  - **1 Benua Klasik**: peta pertama, 576 x 432 m, terang, ada gurun, palem, dan kaktus. Datanya dipulihkan dari commit `d274bf6` ke `mapdata1.ts`, berikut rumus relief, palet, vegetasi, dan suasana lamanya.
  - **2 Hutan Gelap**: peta D-030 apa adanya (864 x 648 m), tanpa sungai dan landmark.
  - **3 Hutan Sungai**: peta 2 ditambah sungai, landmark, dan atmosfer hidup.
- Ukuran grid, relief (`terrain: classic | wild`), dan tampilan (`render/theme.ts`: `bright | dark`) mengikuti peta yang aktif. Satu peta per muat halaman; berganti peta berarti memuat ulang.
- **Sungai (peta 3)**: hanya bentuk tanah dan pita air. Sel sungai tidak diubah biomanya, jadi tetap `walkable`; tes membuktikan bioma dan medan navigasi peta 3 sama persis dengan peta 2. Pasukan mengarungi air setinggi lutut tanpa jembatan dan tanpa melambat.
  - Rute dicari otomatis di atas medan tinggi (`sim/rivers.ts`): jalur termurah yang menghindari tanjakan dan menyukai tanah rendah, sehingga sungai mengikuti lembah dan celah. Dasar sungai dipaksa selalu turun sampai muara.
  - Empat sungai dalam delapan ruas: Sungai Embun (Tembok Utara, Danau Utara, lewat 67 m di barat altar, Danau Selatan, teluk barat daya), Sungai Barat, Sungai Timur, dan Kali Utara. Lebar 3 sampai 9,5 m, air sedalam 0,38 m.
  - Lembah diukir halus: makin dalam potongannya, makin lebar lembahnya. Tepi sungai ditumbuhi alang-alang.
  - Satu-satunya perubahan sim: kastil tidak boleh berdiri di sungai (dua sel dari tepi) atau di atas landmark.
- **Landmark (peta 3)**: Kerangka Naga (30 m), Pohon Purba (22 m), dua Menara Celah (13 m, dengan api suar), Reruntuhan Kastil Kuno, Lingkaran Batu, dan Mercusuar Tanjung (14 m). Hiasan saja, tidak menghalangi pasukan; tanah di bawahnya diratakan dan pohon disingkirkan. Tiap landmark dipindah otomatis ke titik terdekat yang cocok (dataran, kaki gunung, atau pantai).
  - Kamera lobi mengunjungi landmark bergantian dan menampilkan namanya. Saat perang besar terjadi di dekat landmark, muncul teks "Perang besar di dekat ...". Minimap menggambar sungai dan landmark.
- **Atmosfer hidup (peta 3, `render/life.ts`)**: kabut yang mengendap di lembah, di atas danau, dan di pesisir (dua lembar, mengikuti tinggi tanah, paling tebal saat lobi); empat kawanan burung yang pindah kalau ada pertempuran di bawahnya; gagak yang berputar di atas tempat banyak pasukan gugur saat FINAL; partikel dekat kamera per fase (debu cahaya, daun gugur, bara dan abu, kunang-kunang). Bayangan awan sudah ada sejak sebelumnya. `?atmo=0` mematikan semuanya.
- Biaya peta 3: sekitar 1,49 juta segitiga dan 557 draw call, hanya sekitar 30 ribu segitiga dan 10 draw call di atas peta 2. FPS di PC streaming tetap belum diukur.
- Balance: 8 seed standar selesai tanpa habis waktu di ketiga peta (median 12,0 / 11,8 / 12,1 menit termasuk lobi). Pada 60 seed dengan 20 kerajaan, peta 3 habis waktu 8 kali dan peta 2 habis waktu 6 kali (seed 1 sampai 30: 5 dan 2; seed 31 sampai 60: 3 dan 4), jadi tidak ada beda yang jelas. Bedanya hanya dari posisi kastil yang bergeser.
- Belum dikerjakan dari `notes/rencana-atmosfer-landmark.md`: penghitung FPS (Fase 0), berkas cahaya di hutan, salju di puncak, air terjun sebagai landmark tersendiri, percikan di kaki pasukan, jalan tanah, dan pembesaran kastil (B-1).
- Teks nama landmark saat tur lobi muncul di tengah layar dan bertumpuk dengan tulisan "LOBI". Belum dirapikan.
- Belum dilihat: bara, abu, dan gagak pada fase FINAL dalam ronde sungguhan (shader-nya jalan saat dipaksa), kunang-kunang fase RESULT, dan satu ronde penuh di tampilan potret (lobi potret sudah dicek).
- **Tambahan 2026-11-17 (masih D-031):**
  - Sungai kini benar-benar menyatu dengan danau dan laut. Sebelumnya ada pita pasir dan garis buih di muara. Dasar sungai boleh turun sampai -0,45 m (danau dan laut di -0,25 m), menurun bertahap pada 30 m terakhir, sehingga air danau masuk ke alur; pita sungai dipanjangkan empat sel ke dalam air; buih dan warna dangkal dimatikan di muara. Ruas yang keluar dari danau seluruhnya sejajar permukaan danau. `heightAt` mengizinkan tanah di bawah nol hanya di alur sungai.
  - Pohon peta 3 didetailkan (`detailedTrees`): cemara empat sampai lima tingkat yang diputar dan dimiringkan, batang terlihat di bawah; pohon daun lebar dengan tiga gumpal tajuk dan dahan; birch bergelang; bagian bawah lebih gelap dan pucuk lebih terang; lantai hutan berisi pakis, tunggul, dan batang tumbang. Peta 1 dan 2 tetap memakai pohon lama. `?trees=simple` mengembalikan pohon lama di peta 3.
  - Biaya detail pohon: segitiga yang digambar naik dari 1,48 juta ke 1,86 juta (26%). Di PC ini, pada 1024 x 768, satu frame overview 9,9 ms menjadi 10,1 ms dan tampilan dekat 7,8 ms menjadi 9,1 ms. PC streaming belum diukur.

## D-032: Peta 4 "Tiga Alam" menjadi peta bawaan (2026-11-18)

- Dijiplak dari gambar referensi pengguna ke grid 384 x 288 (864 x 648 m), sama dengan peta 2 dan 3, supaya cocok untuk layar potret dan kamera tidak perlu diubah.
- Tiga alam: salju di utara, tanah hijau di tengah, gurun dan mesa merah di timur laut. Bioma baru: `snow` (bisa ditempati kastil, kecepatan 0,9) dan `mesa` (tidak bisa ditempati kastil, kecepatan 0,6).
- Relief `alpine`, tema `vivid`, 6 sungai, 10 landmark termasuk Gerbang Batu Merah dan Mahkota Es, serta awan di atas pegunungan.
- Peta 1 sampai 3 tetap bisa dibuka dengan `?map=1|2|3`.
- Balance belum disetel: pada 8 seed standar dengan 20 kerajaan, 4 ronde di peta 4 berjalan sampai batas 960 detik dan masih menyisakan 2 sampai 4 kerajaan; di peta 3 semua selesai lebih cepat (496 sampai 850 detik).

## D-033: Peta 5 "Teluk Naga" menjadi peta bawaan (2026-11-19)

- Dijiplak dari gambar referensi `attachments/peta5-referensi.jpg` dengan `tools/trace-map5.py` ke grid 384 x 288, sama dengan peta 2 sampai 4.
- Isi: teluk spiral, gletser di utara, barisan gunung dan danau di tengah, mesa merah di timur, rawa di tenggara. Memakai relief `alpine` dan tema `vivid` dari peta 4, jadi tidak ada bioma baru.
- Kolam rawa dibuat sendiri karena di gambar tertutup tanaman. Lembah di dalam pegunungan juga dibuat dengan noise.
- 6 sungai bernama (9 ruas) dan 10 landmark. Peta 1 sampai 4 tetap bisa dibuka dengan `?map=1|2|3|4`.
- Balance belum disetel: pada 8 seed dengan 20 kerajaan, 4 ronde selesai dengan satu pemenang (603 sampai 767 detik) dan 4 ronde berjalan sampai batas 960 detik dengan 2 sampai 3 kerajaan tersisa.

## D-034: Tiga event dunia untuk milestone like (2026-11-19)

Bagian pertama dari `rencana-donasi-like.md`. Event dan visualnya sudah ada; sistem milestone like yang memicunya belum dibuat.

- **Hujan Meteor Dunia** (`sim.worldMeteor`): peringatan 4 dtk, lalu 150 meteor selama 20 dtk (55% di sekitar 3 kerajaan teratas), lalu Meteor Induk jatuh pelan selama 5 dtk ke kerajaan sasaran (pilihan MVP, atau peringkat 1). Kerusakannya milik "dunia": tidak ada yang mendapat kill, kerajaan berperisai aman. Langit menggelap merah selama event, dengan banner hitung mundur.
- **Titan Neraka** (`summonBoss("titan")`): satu boss untuk semua peta (bukan empat boss per peta seperti di rancangan awal). Berjalan ke pemimpin klasemen, menghantam dengan gada (ada ancang-ancang 0,7 dtk dan cincin merah di tanah), menghentak tanah kalau dikerubungi. Setiap 50 like dari satu penonton menjadi satu batu yang dilempar ke Titan, termasuk dari penonton yang belum ikut. Kalau tidak tumbang dalam 90 dtk, ia menghantam kastil pemimpin (900) lalu pergi. Hadiah: 2 Golem + 1 level untuk penyerang terbesar, +1 level untuk pukulan terakhir.
- **Naga Purba** (`summonBoss("elder")`): naga terpisah dari Naga Dunia, HP 3x. Terbang ke pemimpin klasemen dan setiap 12 dtk menyemburkan garis api neraka melintang di atas kastilnya. Hadiah: EXP 2x, 2 Naga, dan +1 level.
- Hanya satu boss di medan pada satu waktu. Naga Dunia yang terjadwal di detik 600 menunggu sampai medan kosong.
- Model baru di `render/bosses/` (Titan sekitar 15 m, Naga Purba bentang sayap sekitar 50 m). Naga Dunia ikut pindah ke renderer boss tanpa perubahan tampilan.
- Uji coba: `?event=meteor|titan|elder` di alamat game, atau `__em.event("titan")` di konsol.
