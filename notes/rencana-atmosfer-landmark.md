# Rencana: atmosfer hidup, landmark, dan sungai

**Status 2026-11-17: sebagian besar sudah dikerjakan sebagai peta 3 "Hutan Sungai" (D-031 di `keputusan.md`), yaitu sungai, 6 jenis landmark, kabut lembah, burung, gagak, dan partikel. Yang belum ada di daftar D-031.**

Dibuat 2026-11-17, setelah peta hutan gelap 864 × 648 m (D-030, commit `844cb47`). Rencana ini menggantikan bagian 8.3 dan 8.5 di `docs/rencana-visual.md`. Lokasi landmark lama di sana mengacu ke peta lama (pulau timur laut, pulau barat daya) yang sudah tidak ada.

Urutan kerja: **Fase 0 → A (atmosfer) → B (landmark) → C (sungai yang bisa diseberangi)**. Fase A dan B tidak mengubah sim. Fase C juga tidak mengubah jalur pasukan, hanya tempat kastil boleh muncul.

---

## Fase 0: ukur dulu (wajib, kecil)

Adegan sekarang sekitar 1,5 juta segitiga dan belum pernah diukur di PC streaming. Sebelum menambah apa pun:

- Tambah penghitung FPS di `?debug`: FPS, waktu frame, jumlah draw call, dan segitiga dari `renderer.info`.
- Ukur di PC streaming dengan resolusi 1080×1920 dan 40 kerajaan, untuk `?veg=1` dan `?veg=0.6`.
- **Anggaran fase A + B:** tambahan paling banyak 60 ribu segitiga, 12 draw call, dan 1 ms per frame. Semua efek bisa dimatikan dengan `?atmo=0`.

---

## Fase A: atmosfer hidup

Tujuannya: hutan terasa gelap, lembab, dan hidup, tanpa membebani GPU. Semua efek ini hanya visual dan tidak dibaca oleh sim.

### A1. Kabut lembah (paling berdampak)
- **Kabut ketinggian:** kabut lebih tebal di dataran rendah, danau, dan lembah, lalu menipis di atas sekitar 15 m, sehingga punggung gunung muncul dari kabut seperti di gambar referensi.
- **Cara teknis:** suntik ke shader material terrain dan vegetasi lewat `onBeforeCompile`, dengan kepadatan `exp(-h / tinggiKabut)` ditambah noise yang bergerak pelan. Tidak menambah segitiga.
- **Gumpalan kabut** di atas 4 danau dan di celah gunung: 20–30 bidang transparan lembut yang melayang pelan, dalam satu `InstancedMesh`.

### A2. Bayangan awan
- Bayangan awan besar yang lewat pelan di atas peta (noise di shader terrain, kecepatan sekitar 3 m/detik). Dari kamera overview efeknya besar: peta terasa luas dan berangin.
- Tidak ada geometri tambahan.

### A3. Burung
- **Kawanan burung:** 3–4 kawanan berisi 8–15 burung V low-poly yang terbang melingkar di atas hutan. Semuanya satu `InstancedMesh` dengan kepak sayap di vertex shader.
- **Burung kabur:** kalau pertempuran besar terjadi di dekat sebuah kawanan, kawanan itu kabur ke arah lain. Pemicunya event `death` yang sudah ada.
- **Gagak:** pada fase FINAL, 5–8 gagak berputar di atas titik dengan mayat terbanyak (data `corpseCount` sudah ada).

### A4. Partikel per fase
Partikel memakai satu `Points` atau `InstancedMesh` dan hanya muncul di sekitar kamera (radius sekitar 80 m), jadi jumlahnya tetap kecil.

| Fase | Suasana sekarang | Partikel tambahan |
|---|---|---|
| LOBBY | Fajar berkabut | Debu cahaya di berkas matahari, kabut lembah tebal |
| WAR | Mendung | Daun gugur terbawa angin, salju tipis di atas 36 m |
| FINAL | Matahari merah | Bara dan abu melayang, gagak berputar |
| RESULT | Senja | Kunang-kunang di tepi hutan, kabut naik lagi |

### A5. Berkas cahaya di hutan (opsional)
- Kerucut cahaya transparan bergaya low-poly di beberapa tanah lapang hutan, hanya di LOBBY dan RESULT.

**Kriteria selesai fase A:** bisa dilihat di 4 fase, `?atmo=0` mematikan semuanya, dan anggaran Fase 0 terpenuhi.

---

## Fase B: landmark

### Catatan skala (penting)
Skala di game ini sengaja bukan skala dunia nyata. Kastil hanya sekitar 4 m tinggi dan 5 m lebar, rumah desa sekitar 2 m, sedangkan pinus 5–7 m. Karena itu landmark diukur **relatif terhadap pinus dan gunung**, bukan terhadap kastil:
- Landmark harus terlihat dari kamera overview (minimal sekitar 12–20 m), tetapi tetap jauh lebih kecil dari gunung (puncak 47 m).
- Kalau landmark terasa membuat kastil kelihatan seperti mainan, pilihannya adalah membesarkan kastil (pertanyaan B-1).

### Daftar landmark
Koordinat ditulis sebagai koordinat normal generator (`tools/gen-map.mjs`: x −1 barat … 1 timur, y −1 utara … 1 selatan) beserta perkiraan meter dari pusat peta. Posisi pastinya ditentukan saat penempatan.

| # | Landmark | Lokasi | Ukuran | Kenapa di sana |
|---|---|---|---|---|
| 1 | **Kerangka Naga.** Tulang naga raksasa yang setengah terkubur: tengkorak, rusuk melengkung, dan ekor menjalar. | Kaki bukit Punggung Naga, dekat celahnya. Sekitar (0,24, 0,02), kira-kira 100 m timur pusat. | Panjang 30 m, rusuk tertinggi 9 m | Nama pegunungannya "Punggung Naga", seolah-olah gunung itu adalah naga yang mati. Ini juga terhubung dengan altar naga. |
| 2 | **Menara Pengawas Celah Utara** (2 buah). Menara batu dengan api suar di puncaknya. | Dua celah Tembok Utara: sekitar (−0,20, −0,47) dan (0,18, −0,41). | Tinggi 12–14 m | Celah adalah jalan lewat yang logis untuk dijaga. Api suarnya terlihat dari jauh saat FINAL. |
| 3 | **Reruntuhan Kastil Kuno.** Tembok runtuh, satu menara patah, dan gerbang berlumut. | Tepi selatan danau utara, sekitar (−0,12, −0,24). | Denah 30 × 24 m, tembok 4–7 m | Reruntuhan di tepi danau membuat siluet bagus dan memberi kesan ada kerajaan lama yang kalah. |
| 4 | **Pohon Raksasa Purba.** Satu pohon kuno yang menjulang di atas kanopi hutan, dengan akar besar yang menonjol. | Hutan barat yang lebat, sekitar (−0,50, −0,15). | Tinggi 22 m, kanopi 18 m | Menegaskan rasa hutan. Jadi titik yang paling mudah dikenali di overview. |
| 5 | **Lingkaran Batu.** Batu tegak di padang moor, dengan batu tengah yang berpendar redup. | Moor timur, sekitar (0,50, −0,05). | Diameter 20 m, batu 3–4 m | Moor yang kosong butuh sesuatu yang misterius. Pendarnya cocok dengan fase senja. |
| 6 | *(opsional)* **Mercusuar Tanjung.** Mercusuar batu di ujung tanjung, dengan cahaya yang berputar. | Tanjung di teluk timur, sekitar (0,88, 0,30). | Tinggi 14 m | Menghidupkan pantai dan terlihat di tepi kamera overview. |
| 7 | *(opsional, ikut fase C)* **Air Terjun Barat.** Air terjun dari celah Pegunungan Barat ke danau barat. | Sekitar (−0,55, 0,27) menuju danau (−0,36, 0,14). | Jatuh 10–15 m | Air bergerak adalah elemen alam yang paling hidup. Butuh sungai dari fase C. |

Prioritas: 1, 4, 2, 3, 5, lalu 6 dan 7 kalau anggaran masih cukup.

### Aturan teknis
- **Model:** setiap landmark adalah `Group` statis tanpa rig, satu file di `render/landmarks/`, low-poly, flat shading, dengan palet gelap yang sama.
- **Data:** posisi dan rotasi disimpan di generator dan diekspor ke `mapdata.ts` sebagai `LANDMARKS`, jadi penempatannya sama setiap kali.
- **Sim:** landmark tidak menghalangi unit. Sel di bawahnya hanya ditandai `buildable = false` supaya kastil tidak muncul di atasnya. Ini sedikit mengubah posisi kastil, jadi **8 seed standar diuji ulang**.
- **Vegetasi:** pohon dan semak tidak tumbuh di dalam jejak landmark. Di sekelilingnya ditambah lumut dan batu supaya landmark menyatu dengan tanah.
- **Kamera dan siaran:**
  - Saat LOBBY, director bergantian menyorot 1 landmark selama 4–5 detik dengan namanya tampil sebagai teks.
  - Saat WAR, keterangan pertempuran menyebut landmark terdekat, misalnya "Perang besar di dekat Kerangka Naga!".
  - Minimap menampilkan ikon kecil untuk setiap landmark.

**Kriteria selesai fase B:** 5 landmark utama terlihat dan terbaca di overview 1080×1920, 8 seed tetap selesai, dan anggaran Fase 0 terpenuhi.

---

## Fase C: sungai yang bisa diseberangi (tanpa jembatan)

Diputuskan 2026-11-17: **sungai hanya visual dan dangkal.** Pasukan berjalan melintasinya seperti melintasi tanah biasa, tanpa jembatan, tanpa melambat, dan tanpa bisa tersangkut. Jalan tanah ditunda.

### C1. Kenapa dijamin tidak nyangkut
- Sim hanya menolak sel yang biome-nya `water` (`walkable()` di `game/src/sim/map.ts`). Sungai **tidak** ditulis sebagai biome `water`. Sungai menjadi lapisan terpisah (`river`) yang hanya dibaca oleh renderer.
- Akibatnya, BFS, jalur pasukan, kecepatan, dan pertempuran sama persis dengan sekarang. Sel sungai tetap hutan, padang, atau gunung di mata sim.
- Satu-satunya perubahan sim: sel sungai dan tepinya (±2 sel) dibuat `buildable = false`, supaya kastil dan desa tidak muncul di tengah sungai. Ini sedikit menggeser posisi kastil, jadi 8 seed standar dan 30 seed diuji ulang. Kalau hasilnya berubah banyak, langkah ini bisa dibatalkan, dan kastil cukup dicegah secara visual (sungai berbelok menghindarinya tidak mungkin, karena kastil acak tiap ronde).
- `distWater` (dipakai untuk bentuk pantai, kaki bukit, dan aturan buildable) **tidak** menghitung sungai, jadi bentuk daratan dan altar tidak bergeser.

### C2. Rute sungai
Jalurnya digambar tangan sebagai titik kontrol di `tools/gen-map.mjs` (seperti `RANGES`), lalu dihaluskan menjadi kurva. Sumbernya ada di bawah salju (sekitar 28–32 m), dan setiap sungai berakhir di danau atau laut. Koordinatnya koordinat normal generator; rute pastinya dirapikan di `--preview`.

| # | Nama (usulan) | Rute | Panjang kira-kira |
|---|---|---|---|
| 1 | **Sungai Embun** (utama) | Lereng selatan Tembok Utara → Danau Utara (−0,12, −0,30) → lewat barat Punggung Naga, minimal 25 m dari altar → Danau Selatan (0,02, 0,36) → teluk barat daya (−0,35, 0,98) | 450 m |
| 2 | **Sungai Barat** | Air terjun dari celah Pegunungan Barat → Danau Barat (−0,36, 0,14) → memutari ujung utara Pegunungan Barat → selat barat (−0,96, −0,02) | 300 m |
| 3 | **Sungai Timur** | Lereng Punggung Naga → Danau Timur (0,30, −0,10) → menembus celah Tanduk Timur (0,67, 0,13) → teluk timur (1,0, 0,16) | 280 m |
| 4 | *(opsional)* anak sungai | 2–3 aliran pendek dari lereng utara Tembok Utara ke teluk utara | 60–100 m |

Sungai Embun sengaja lewat dekat tengah peta. Pasukan dari barat dan timur akan sering mengarunginya, jadi momen menyeberang ini sering terlihat di siaran.

### C3. Bentuk sungai (skala masuk akal)
- **Lebar:** 2–3 m di hulu dan 6–8 m di muara, bertambah setiap kali bertemu anak sungai.
- **Lembah:** terrain diturunkan dengan profil halus (kosinus), bukan parit. Di dataran lembahnya selebar 15–20 m dengan dasar 0,8–1 m di bawah tepi. Di pegunungan sungai mengukir lembah V yang lebih dalam (3–6 m), jadi masuk akal secara geologi.
- **Kedalaman air:** sekitar 0,4 m. Prajurit terlihat mengarungi air setinggi lutut, kuda dan gajah hampir tidak basah. Unit tidak pernah tenggelam karena dasar sungai tidak pernah lebih dari sekitar 0,5 m di bawah permukaan air.
- **Selalu menurun:** dasar sungai dipaksa tidak pernah naik ke hilir. Di muara, permukaan air bertemu tepat dengan permukaan danau atau laut (y = −0,25).
- **Transisi mulus:** `heightAt` tetap kontinu di tepi sungai, jadi unit tidak melompat atau bergetar saat turun ke air.

### C4. Tampilan
- **Pita air:** satu mesh yang mengikuti kurva, dengan shader aliran (noise bergerak searah arus) dan warna yang sama dengan danau.
- **Jeram:** di bagian curam (pegunungan) ada buih putih dan aliran lebih cepat. Di dataran airnya tenang dan gelap.
- **Tepi sungai:** pohon tidak tumbuh di air. Di tepinya ada alang-alang, batu basah, dan semak, dengan warna tanah lebih gelap dan lembab.
- **Percikan:** riak kecil di kaki unit yang mengarungi air, dibatasi sekitar 30 riak sekaligus. Hanya visual.
- **Minimap:** sungai digambar sebagai garis biru tipis.
- **Kabut:** sungai ikut lembah, jadi kabut lembah dari A1 otomatis berkumpul di atasnya.
- **Air Terjun Barat (landmark 7):** air jatuh 10–15 m dari celah ke Danau Barat, dengan buih dan percikan di bawahnya.
- **Anggaran:** semua sungai sekitar 15–20 ribu segitiga dalam 2–3 draw call.

### C5. Tes
- Setiap sel sungai tetap `walkable`, dan biome di luar jalur sungai sama persis dengan sebelumnya.
- Semua kastil di 8 seed masih punya jalur ke altar, dan panjang jalurnya tidak berubah (pathing tidak tersentuh).
- Dasar sungai tidak pernah naik ke hilir, dan setiap sungai berakhir di air.
- Tidak ada sel `buildable` di dalam sungai.
- `heightAt` mulus: selisih tinggi antar titik berjarak 0,5 m di tepi sungai kurang dari 0,3 m.
- 8 seed standar selesai dengan durasi ronde yang mirip sebelumnya.

**Kriteria selesai fase C:** sungai mengalir dari pegunungan ke danau dan laut tanpa naik bukit, pasukan menyeberang tanpa tersangkut atau melambat, terbaca di overview 1080×1920, dan semua tes C5 lulus.

### Ditunda
- **Jalan tanah:** jaringan jalan antara altar, celah, dan landmark. Bisa ditambahkan kemudian tanpa mengubah sim.
- **Jembatan:** tidak perlu, karena sungai bisa diarungi. Bisa ditambahkan sebagai hiasan kalau jalan tanah dibuat.

---


---

## Keputusan yang perlu diambil

| Kode | Pertanyaan | Rekomendasi |
|---|---|---|
| B-1 | Kastil sekarang lebih kecil dari pinus. Apakah kastil dibesarkan supaya skalanya cocok dengan landmark? | Besarkan kastil sekitar 1,8×. Ini hanya visual, dan radius klaim di sim tetap. |
| B-2 | Apakah landmark punya efek gameplay, misalnya bonus jika kerajaan menguasai area landmark? | Belum. Hiasan dulu, efek dipertimbangkan setelah dilihat di siaran. |
| C-1 | ~~Sungai sebagai halangan atau hiasan?~~ | **Diputuskan:** dangkal, bisa diseberangi, tanpa jembatan. |
| C-2 | Nama keempat sungai sudah cocok? | Pakai usulan di C2, bisa diganti kapan saja. |

## Perkiraan urutan kerja
1. Fase 0: penghitung FPS dan pengukuran.
2. A1 dan A2: kabut lembah dan bayangan awan, untuk dampak terbesar dengan biaya terkecil.
3. A3 dan A4: burung dan partikel per fase.
4. B: landmark 1 dan 4, lalu 2, 3, dan 5, sekaligus sorotan director, keterangan pertempuran, dan ikon minimap.
5. C: Sungai Embun dulu (paling terlihat), lalu Sungai Barat dengan air terjun dan Sungai Timur.
