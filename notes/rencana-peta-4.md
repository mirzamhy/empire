# Rencana Peta 4: Tiga Alam

Peta baru berdasarkan gambar referensi `attachments/peta4-referensi.jpg`: satu benua dengan tiga
alam yang langsung terbaca dari kamera overview.

## Konsep

| Alam | Letak | Isi |
|---|---|---|
| Utara Beku | utara | padang salju, cemara bersalju, puncak tertinggi, fjord |
| Tanah Hijau | barat, tengah, selatan | padang terang, hutan cemara, barisan gunung tajam, danau, teluk |
| Gurun Merah | timur laut | pasir, bukit pasir, mesa merah berundak, kaktus, oasis |

## Keputusan

1. **Dijiplak, bukan digambar ulang.** `tools/trace-map4.py` membaca warna gambar dan menjadikannya
   grid bioma, jadi bentuk pantai dan letak alam mengikuti referensi.
2. **Grid tetap 384 x 288 (864 x 648 m).** Gambar dimampatkan ke ukuran peta 2 dan 3. Pulau jadi
   lebih cocok untuk layar potret, dan kamera, kabut, serta beban render tidak perlu diubah.
3. **Dua bioma baru.** `snow` bisa ditempati kastil dan memperlambat 10%. `mesa` tidak bisa
   ditempati kastil dan memperlambat 40%, sama seperti gunung.
4. **Relief "alpine".** Punggung gunung lebih tajam dan cepat tinggi, karena barisan di referensi
   sempit. Mesa dibuat berundak.
5. **Sungai tetap hanya bentuk tanah.** Semua sel tetap bisa dilewati, seperti peta 3.
6. **Peta lama tidak berubah.** Semua lewat bendera `MapDef` dan tema baru `vivid`.

## Detail tambahan

- Tema `vivid`: laut biru dalam, rumput terang, pasir hangat, dengan palet pagi sampai malam sendiri.
- Awan yang melayang di atas gunung, memudar saat kamera mendekat, dan meredup saat malam.
- Landmark baru: **Gerbang Batu Merah** di gurun dan **Mahkota Es** di utara, ditambah landmark lama
  yang disebar ke ketiga alam.
- Sungai dari pegunungan ke danau dan laut, termasuk aliran menuju oasis gurun.
- Vegetasi per alam: cemara salju, kaktus dan palem oasis, hutan cemara dengan kantong pohon daun lebar.

## Urutan kerja

1. Jiplak grid dari gambar dan bersihkan.
2. Tambah bioma, relief, sungai, dan landmark di simulasi.
3. Tambah tema, warna tanah, vegetasi, awan, dan model landmark.
4. Jadikan peta 4 sebagai peta bawaan, lalu jalankan tes dan beberapa ronde tanpa layar.
5. Cek visual dan ukur beban render.

Peta dibuka dengan `?map=4`. Peta lama tetap ada di `?map=1`, `?map=2`, dan `?map=3`.
