---
tags: [empire, terrain, peta, sungai, landmark]
terkait: cara-merancang-model.md, keputusan.md (D-017, D-018, D-030, D-031), peta-terrain.md
---

# Cara membuat terrain

Catatan ini menjelaskan bagaimana peta EMPIRE dibuat, dari grid huruf sampai pohon, sungai, dan
kabut di layar, beserta alasan di balik tiap langkah. Pasangannya untuk model adalah
`cara-merancang-model.md`.

## 1. Gambaran besar

Terrain dibuat dalam dua bagian yang dipisah tegas:

| Bagian | Berkas | Isi | Siapa yang membaca |
|---|---|---|---|
| Data dan aturan | `game/src/sim/` | grid bioma, ketinggian, sungai, landmark, tempat kastil, navigasi | simulasi dan tampilan |
| Tampilan | `game/src/render/` | warna tanah, laut, pohon, pita sungai, kabut, burung | hanya tampilan |

Simulasi tidak pernah membaca apa pun dari tampilan. Akibatnya, pohon, warna, dan kabut boleh
diubah sesuka hati tanpa mengubah jalannya pertandingan, dan tes simulasi tetap berjalan tanpa
layar.

Urutan pembuatannya:

1. **Grid bioma**: satu huruf per sel (`tools/gen-map.mjs` menghasilkan `sim/mapdata.ts`).
2. **Definisi peta**: ukuran, gaya relief, tema, sungai, landmark (`sim/maps.ts`).
3. **Ketinggian**: dihitung dari bioma dan jarak ke air dan gunung (`sim/map.ts`).
4. **Sungai**: jalur dicari di atas ketinggian lalu lembahnya diukir (`sim/rivers.ts`).
5. **Landmark**: dipindah ke tempat yang cocok lalu tanahnya diratakan (`sim/map.ts`).
6. **Aturan main**: daratan utama, sel tempat kastil boleh berdiri, letak altar naga (`sim/map.ts`).
7. **Tampilan tanah**: mesh low-poly dengan warna per segitiga (`render/terrain.ts`).
8. **Laut, sungai, vegetasi, altar** (`render/terrain.ts`), **landmark** (`render/landmarks.ts`).
9. **Tema dan suasana**: palet dan cahaya per fase ronde (`render/theme.ts`, `render/atmosphere.ts`).
10. **Atmosfer hidup**: kabut lembah, burung, partikel (`render/life.ts`).

## 2. Grid bioma

Peta adalah grid huruf. Satu sel = 2,25 m.

| Huruf | Bioma | Arti di peta gelap |
|---|---|---|
| `~` | water | laut dan danau |
| `b` | beach | pantai |
| `s` | plains | padang terbuka (kliring di hutan) |
| `d` | desert | gurun di peta 1, moor kering di peta 2 dan 3 |
| `f` | forest | hutan |
| `m` | mountain | gunung |

**Kenapa grid huruf?** Mudah dibaca dan dicek dengan mata, deterministik, dan simulasi butuh
grid untuk navigasi (pencarian jalur BFS) dan pembagian wilayah. Ketinggian, warna, dan pohon semua
diturunkan dari grid ini, jadi cukup satu sumber kebenaran.

**Dua cara membuat grid:**

- **Dijiplak dari gambar** (peta 1, `tools/sample-map.ps1` lalu `tools/classify.mjs` dan
  `tools/build-map.mjs`): gambar referensi diambil sampelnya, tiap piksel digolongkan ke bioma
  menurut warnanya, lalu dibersihkan dengan filter mayoritas (sel yang dikepung bioma lain ikut
  bioma tetangganya) supaya bintik dari gambar pohon dan tulisan hilang. Grid lalu diperbesar dan
  dihaluskan lagi supaya tepinya tidak bertangga.
- **Prosedural** (peta 2 dan 3, `tools/gen-map.mjs`, seed tetap 20261116):
  - **Garis pantai:** elips yang dibengkokkan oleh noise, lalu dipotong teluk dan selat di titik
    yang ditentukan.
  - **Gunung:** lima barisan bernama digambar sebagai garis punggung dengan lebar yang berubah,
    sehingga tiap barisan punya celah dan ujung yang mengecil. Ditambah beberapa massif lepas.
  - **Danau:** empat danau di dalam benua.
  - **Hutan dan padang:** hutan menutup sebagian besar dataran rendah, padang menjadi kliring.
  - **Moor:** ditaruh di sisi timur barisan tengah (bayangan hujan).

Ukuran penting peta 2 dan 3: 384 x 288 sel (864 x 648 m). Daratan 52% grid; dari daratan itu 56%
hutan, 21% gunung, 16% padang, 4% moor, 3% pantai.

Menjalankan ulang pembuat peta:

```bash
node tools/gen-map.mjs
```

## 3. Definisi peta

`sim/maps.ts` berisi tiga peta. Satu peta aktif per muat halaman (`?map=1|2|3`) atau per proses
(`EMPIRE_MAP=3`).

| Peta | Grid | Relief | Tema | Sungai | Landmark | Atmosfer | Pohon detail |
|---|---|---|---|---|---|---|---|
| 1 Benua Klasik | 256 x 192 (576 x 432 m) | classic | bright | tidak | tidak | tidak | tidak |
| 2 Hutan Gelap | 384 x 288 (864 x 648 m) | wild | dark | tidak | tidak | tidak | tidak |
| 3 Hutan Sungai | 384 x 288 | wild | dark | 4 sungai | 7 | ya | ya |

Prinsipnya: **peta baru tidak menimpa peta lama**. Fitur baru dipasang lewat bendera di
`MapDef`, jadi peta lama tetap bisa dimainkan dan dibandingkan.

`WORLD_SCALE` (lebar dunia dibanding peta pertama) dipakai kamera, kabut, dan kubah langit,
sehingga semuanya ikut membesar kalau peta membesar.

## 4. Ketinggian

Ketinggian dihitung per sel di `WorldMap` (`sim/map.ts`). Bahan bakunya adalah empat medan jarak
(BFS dari sumber tertentu): jarak ke air, jarak ke gunung, kedalaman di dalam gunung, dan
kedalaman dasar laut.

| Bioma | Rumus (relief "wild") |
|---|---|
| Laut | -1,2 m lalu turun 0,55 m per sel menjauhi pantai (maks 9 sel) |
| Pantai | sekitar 0,15 m dengan riak kecil |
| Dataran | naik pelan menjauhi air, ditambah bukit bergelombang dari noise yang mendatar di pantai |
| Moor | ditambah gundukan dari fungsi `ridge` |
| Kaki bukit | jalur selebar 26 sel (sekitar 60 m) di sekeliling setiap gunung, naik sampai 8,5 m |
| Gunung | naik mengikuti kedalaman di dalam barisan, penuh di 20 sel, sampai 27 m di atas kaki bukit, ditambah punggung bukit dan taji |

**Alasan di baliknya:**

- **Tinggi dari kedalaman, bukan dari noise.** Bagian barisan yang lebar otomatis jadi puncak
  tinggi (sampai 47 m), bagian sempit tetap bukit. Bentuk gunung mengikuti gambar barisannya, jadi
  bisa dirancang.
- **Kaki bukit wajib.** Gunung tidak boleh menjulang langsung dari tanah datar; itu keluhan
  terhadap peta pertama. Lereng rata-rata 30 sampai 35 derajat.
- **Detail hanya di tempat tinggi.** Punggung bukit dan taji dikalikan kedalaman, jadi kaki gunung
  tetap halus dan puncaknya bergerigi.
- **Mendatar ke arah air.** Bukit dikalikan `inland`, sehingga pantai dan tepi danau berupa tebing
  landai, bukan lubang.

Relief "classic" (peta 1) lebih kasar: tonjolan pendek di kaki gunung lalu inti tinggi yang
bergerigi. Rumus lamanya disimpan apa adanya supaya peta 1 tidak berubah.

`heightAt(x, z)` mengambil tinggi di titik mana pun dengan interpolasi bilinear dari empat sel
terdekat. Tanah tidak pernah di bawah nol, kecuali di alur sungai dekat muara.

## 5. Sungai

`sim/rivers.ts`. Sungai hanya bentuk tanah dan pita air. **Bioma sel sungai tidak diubah**, jadi
semuanya tetap bisa dilewati; pasukan mengarungi air setinggi lutut tanpa jembatan dan tanpa
melambat. Tes membuktikan medan navigasi peta 3 sama persis dengan peta 2.

**Dari mana sampai mana.** Tiap ruas sungai punya:

- `from`: titik sumber, dikunci ke sel darat terdekat (`"l"`) atau ke sel air terdekat (`"w"`,
  untuk sungai yang keluar dari danau);
- `to`: muaranya di danau atau laut;
- `via`: titik yang harus dilewati (opsional);
- `width`: lebar di hulu dan hilir.

**Cara mencari jalurnya.**

1. Cari jalur termurah 8 arah di atas medan ketinggian. Naik dibuat mahal, tanah tinggi tidak
   disukai, dan sedikit noise membuat alirannya berkelok. Hasilnya sungai mengikuti lembah dan
   celah gunung dengan sendirinya.
2. Paksa dasar sungai selalu turun dari hulu ke muara.
3. Ukir lembah di sekitarnya: makin dalam potongan, makin lebar lembahnya, supaya tidak ada parit
   bertebing tegak.
4. Hitung `riverBank` per sel: jarak ke tepi sungai, dipakai untuk menjauhkan kastil, pohon, dan
   landmark dari air.

**Menyatu dengan danau.** Danau dan laut berada di -0,25 m, dasar sungai boleh turun sampai
-0,45 m dan menurun bertahap di 30 m terakhir. Pita air diperpanjang empat sel ke dalam danau.
Jadi air danau masuk ke alur tanpa pita pasir di muara.

Peta 3 punya empat sungai dalam delapan ruas, lebar 3 sampai 9,5 m, dalam air 0,38 m.

## 6. Landmark

Landmark adalah hiasan bernama (Kerangka Naga, Menara Pengawas, Reruntuhan, Pohon Raksasa,
Lingkaran Batu, Mercusuar Tanjung). Mereka tidak pernah menghalangi pasukan.

Cara penempatannya (`sim/map.ts`):

1. Tiap landmark punya titik yang diinginkan dan syarat tempat: `low` (dataran terbuka), `foot`
   (kaki gunung), atau `shore` (pantai).
2. Dicari sel dalam radius 30 sel yang memenuhi syarat, di daratan utama, jauh dari sungai, dan
   paling dekat ke titik yang diinginkan dengan tanah paling rata.
3. Tanah di bawahnya diratakan ke tinggi sel itu, dengan peralihan halus ke sekelilingnya.
4. Landmark diputar menghadap tengah benua supaya bagian depannya terlihat dari kamera overview.
5. Kastil dan pohon dijauhkan dari tapaknya.

Modelnya dibuat dengan alat yang sama dengan pasukan dan kastil (`render/landmarks.ts`), lalu
dipanggang menjadi satu mesh per jenis.

## 7. Aturan main dari peta

Setelah ketinggian selesai, `WorldMap` menghitung:

- **Daratan utama:** komponen darat terhubung (4 arah) yang paling besar. Pulau kecil tidak bisa
  dipakai untuk spawn.
- **Sel tempat kastil:** di daratan utama, bukan air, gunung, atau pantai, cukup jauh dari kaki
  gunung (8 sel di relief wild) dan air (3 sel), tidak di sungai, tidak di landmark.
- **Altar naga:** sel tempat kastil yang paling dekat ke pusat massa benua, jauh dari gunung, air,
  dan sungai.
- **Kecepatan:** `speedFactor` per bioma (hutan dan gunung memperlambat).
- **Panah di hutan:** serangan jarak jauh ke unit di hutan berkurang 20%.

## 8. Tampilan tanah

`render/terrain.ts`, fungsi `buildTerrain`.

**Mesh.** Satu titik per sudut grid, tingginya rata-rata sel di sekitarnya. Segitiga dibuat tanpa
indeks, jadi tiap segitiga punya normal sendiri dan terlihat sebagai bidang datar: inilah gaya
low-poly-nya.

**Warna per segitiga**, dihitung sekali di CPU dari titik tengah segitiga:

| Lapisan | Aturan |
|---|---|
| Bioma | dua nada per bioma dari tema; noise 40 m memilih di antaranya (rumput muda dan tua) |
| Tepi bioma | bioma diambil dari titik yang digeser sedikit oleh noise, supaya tepinya tidak lurus |
| Lereng | permukaan curam berubah jadi batu |
| Gunung | lereng bawah berwarna lantai hutan, batu baru mulai dekat garis pohon |
| Salju | di atas garis salju (36 m di peta gelap), dengan tepi bergerigi |
| Pantai | pasir basah di dekat air |
| Dasar laut | lebih terang di perairan dangkal |
| Lembah | sel yang lebih rendah dari rata-rata 5 x 5 tetangganya dibuat lebih gelap |
| Sungai | tanah lembap gelap di alur dan tepinya |
| Variasi | geseran terang-gelap dan sedikit acak per bidang supaya bidang tetap terbaca |

**Kenapa di CPU?** Warna dihitung sekali saat peta dimuat dan tidak berubah, jadi biayanya nol
per frame. Shader hanya menambah dua hal yang memang bergerak: warna wilayah kerajaan dan bayangan
awan.

**Wilayah kerajaan.** Tekstur RGBA kecil (satu piksel per 4 m) diwarnai ulang tiap 0,5 detik
(`paintTerritory` di `main.ts`). Filter linear membuat kotak 4 m itu menjadi gumpalan halus
dengan pinggiran bercahaya di perbatasan.

## 9. Laut, sungai, dan vegetasi

**Laut** (`buildWater`): bidang air dengan warna yang lebih terang di perairan dangkal, buih yang
maju-mundur di sepanjang pantai dan dipecah noise, serta gelombang kecil di shader.

**Pita sungai** (`buildRivers`): mengikuti titik-titik sungai dengan lebar dan tinggi permukaan
masing-masing. Garis-garis air yang lebih terang meluncur ke hilir, lebih cepat dan lebih putih di
jeram.

**Vegetasi** (`buildVegetation`):

- **Kepadatan tetap per meter persegi.** Jumlah tanaman dihitung dari luas sel, jadi tidak berubah
  kalau ukuran sel berubah. `?veg=0.5` mengurangi tanaman untuk PC lemah.
- **Rumpun dan kliring:** noise 26 m menentukan tebal tipisnya hutan, noise 55 m menentukan jenis
  pohon yang dominan.
- **Per bioma:**
  - Hutan: cemara dominan di peta gelap, kantong pohon daun lebar, lantai hutan berisi pakis,
    tunggul, dan batang tumbang.
  - Padang: bunga dan rumput.
  - Gurun: palem di dekat air, kaktus.
  - Moor: semak, pohon mati, batu.
  - Gunung: pohon menipis di atas garis pohon (24 m), hanya batu di puncak.
  - Pantai: kayu hanyut.
  - Tepi sungai: alang-alang dan batu, tidak ada apa pun di alur.
- **Pohon detail (peta 3):** cemara empat sampai lima tingkat yang diputar dan dimiringkan dengan
  batang terlihat di bawah; pohon daun lebar dengan tiga gumpal tajuk dan dahan; birch bergelang.
  Bagian bawah lebih gelap dan pucuk lebih terang. `?trees=simple` mengembalikan pohon lama.
- **Ukuran:** pohon hutan cukup tinggi untuk menutup kanopi, tapi kastil (sekitar 10 m) tetap
  menjulang di atasnya. Pohon dibersihkan di sekitar kastil (radius 7 m) dan desa (9 m).
- **Gerak:** satu material instanced dengan shader angin; titik atas bergoyang, batang dan batu
  diam.

## 10. Tema dan suasana

`render/theme.ts` menyimpan semua warna peta di satu tempat: dua nada per bioma, batu, pasir
basah, daun per jenis, air, garis salju, garis pohon, warna minimap, dan suasana per fase.

| Tema | Kesan |
|---|---|
| bright (peta 1) | siang terang, gurun, palem |
| dark (peta 2, 3) | sedikit lebih gelap dan dingin, supaya warna kerajaan menonjol |

Suasana per fase ronde (`atmosphere.ts`) mengatur arah dan kekuatan matahari, cahaya langit,
kabut, warna langit, bayangan awan, dan eksposur. Di peta gelap: fajar berkabut di lobi, siang
mendung saat perang, sore merah di fase final, senja ungu di hasil.

## 11. Atmosfer hidup (peta 3)

`render/life.ts`, murni hiasan dan tidak dibaca simulasi. `?atmo=0` mematikannya.

- **Kabut lembah:** dua lapis kabut yang hanya menutupi tanah di bawah ketinggiannya, jadi kabut
  diam di lembah dan di atas danau. Ketebalannya berubah per fase.
- **Burung:** kawanan yang beterbangan dan menyebar saat ada pertempuran di dekatnya; gagak
  berputar di atas yang mati di fase final.
- **Partikel dekat kamera:** debu saat fajar, daun saat perang, bara dan abu di akhir, kunang-kunang
  saat senja.

## 12. Prinsip yang dipegang

1. **Satu sumber kebenaran.** Semua diturunkan dari grid bioma; tidak ada data yang dicatat dua
   kali.
2. **Simulasi tidak tahu tampilan.** Pohon, warna, kabut, dan pita sungai tidak memengaruhi
   pertandingan. Sungai dan landmark hanya mengubah ketinggian.
3. **Deterministik.** Seed tetap, tanpa `Math.random` di simulasi; peta yang sama selalu keluar
   sama.
4. **Skala nyata.** Pohon 5 sampai 7 m, kastil sekitar 10 m, gunung sampai 47 m, sungai 3 sampai
   9,5 m. Ukuran landmark disesuaikan supaya terbaca dari kamera overview tapi jauh lebih kecil dari
   gunung.
5. **Biaya per frame mendekati nol.** Warna dipanggang ke mesh, tanaman dan landmark digambar
   instanced, shader hanya mengerjakan yang bergerak.
6. **Peta lama tetap hidup.** Fitur baru masuk lewat bendera `MapDef` dan tema, bukan dengan
   menimpa.

## 13. Daftar periksa peta baru

1. Buat grid: jalankan `tools/gen-map.mjs` dengan seed atau bentuk baru, atau jiplak gambar.
2. Tambah entri di `MAPS` (`sim/maps.ts`): ukuran, relief, tema, sungai, landmark, bendera.
3. Jalankan tes peta (`tests/maps.test.ts`): daratan utama cukup besar, cukup tempat kastil,
   sungai turun terus, landmark terpasang, navigasi utuh.
4. Lihat di browser: `?map=<id>&free` untuk kamera bebas.
5. Jalankan beberapa ronde tanpa layar (`EMPIRE_MAP=<id>`) dan cek ada pemenang di berbagai seed.
6. Ukur FPS pada tampilan overview dan tampilan dekat.
7. Catat keputusan di `notes/keputusan.md`.

## 14. Kesalahan yang pernah terjadi

- **Gunung menjulang dari tanah datar** (peta 1): diatasi dengan kaki bukit selebar 60 m.
- **Pita pasir dan garis buih di muara sungai:** dasar sungai dibiarkan turun di bawah permukaan
  danau dan buih dimatikan di muara.
- **Pohon menutupi efek spell di hutan:** belum diatasi; efek di hutan lebat sebagian tertutup.
- **Lingkaran sihir tenggelam di tanah miring:** lingkaran kini diangkat ke titik tertinggi tanah
  di bawahnya.
