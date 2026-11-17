---
tags: [empire, model, rig, animasi, gaya]
terkait: unit-pasukan.md, keputusan.md
---

# Cara merancang dan membangun model

Catatan ini menjelaskan cara berpikir di balik setiap model di EMPIRE: pasukan, kastil, desa, dan
landmark seperti mercusuar. Isinya urutan kerja, alasan tiap keputusan, dan aturan yang menjaga
semua model terasa satu keluarga.

Semua model dibuat dari kode (prosedural), tanpa berkas 3D dan tanpa tekstur. Satu model adalah
satu fungsi `build()` yang menyusun bentuk dasar (kotak, silinder, kerucut, bola kasar) menjadi
sosok utuh.

## 1. Batasan yang menentukan segalanya

Sebelum merancang apa pun, saya pegang empat batasan ini karena semuanya membatasi bentuk:

| Batasan | Akibat ke rancangan |
|---|---|
| Kamera jauh di atas, ratusan pasukan sekaligus | Siluet dan warna lebih penting daripada detail halus |
| Tiap tulang digambar sebagai satu `InstancedMesh` | Jumlah tulang sedikit (11 sampai 15), tanpa kulit yang melentur |
| Warna kerajaan diganti saat digambar | Bagian berwarna kerajaan harus besar dan jelas, dicat `#ff00ff` di model |
| Tanpa tekstur, bayangan rata (flat shading) | Detail dibuat dari bentuk, bukan dari gambar di permukaan |

## 2. Urutan kerja

Urutannya selalu dari besar ke kecil. Saya tidak pindah ke langkah berikut sebelum langkah
sekarang terbaca dari jarak kamera permainan.

1. **Peran.** Apa tugas unit ini di pertempuran, dan apa yang harus langsung terbaca? Contoh:
   Shieldbearer adalah tembok berjalan, jadi perisainya setinggi badan.
2. **Referensi.** Cari bentuk nyata atau konvensi fantasi yang cocok dengan peran itu (bagian 3).
3. **Siluet.** Tentukan satu ciri yang membedakannya dari unit lain dalam bayangan hitam saja:
   topi lebar Wizard, tanduk Necromancer, tombak 1,5 kali tinggi badan Spearman.
4. **Rig.** Pilih kerangka dan tentukan letak sendi (bagian 4).
5. **Blok kasar.** Badan, kepala, anggota gerak, senjata. Sampai sini modelnya sudah harus bisa
   dikenali.
6. **Lapisan detail.** Tambah detail lapis demi lapis dengan kosakata yang sama untuk semua unit
   (bagian 6).
7. **Warna.** Tentukan bagian warna kerajaan, logam, kulit, kain, dan bagian yang menyala.
8. **Tier.** Tambah hiasan untuk level kastil tinggi tanpa mengubah siluet atau kerangka.
9. **Soket dan animasi.** Pasang titik efek (ujung senjata, mulut, dada) dan pilih gerak serang.
10. **Uji.** Jalankan kontrak model, lihat di Kodeks Pasukan, lalu lihat di pertempuran.

## 3. Referensi

Saya tidak menjiplak gambar. Referensi dipakai untuk tahu bagian apa saja yang dimiliki suatu
benda dan bagaimana proporsinya, lalu bentuknya disederhanakan.

Sumber yang dipakai:

- **Deskripsi unit di `notes/unit-pasukan.md`** (bagian "Penanda visual"), warisan dari prototipe.
- **Persenjataan Eropa abad pertengahan** untuk pasukan manusia. Nama bagiannya menjadi daftar
  periksa detail:
  - helm: kettle helm (Spearman), great helm (Knight), sallet (Halberdier), barbute (Shieldbearer)
  - perisai: heater, kite, tower shield, pavise (papan pelindung di depan Ballista)
  - senjata galah: mata tombak, langet (pelat besi di bawah mata), lilitan pegangan, sepatu besi di pangkal
  - zirah: gorget, pauldron, vambrace (lengan bawah), greave (tulang kering), fauld (pinggul)
- **Mesin kepung nyata:** pegas puntir dan kerekan pada ballista, rangka A dan pemberat pada trebuchet.
- **Konvensi fantasi:** atap kerucut melebar ("topi penyihir"), kristal menyala, rune, inti magma.
- **Arsitektur:** penopang dinding (buttress), korbel, merlon, menara tangga, rangka kayu (half-timber).

Aturan pakainya: ambil dua atau tiga ciri paling khas dari referensi, besarkan, dan buang sisanya.
Kettle helm cukup "kubah rendah dan pinggiran lebar". Detail lain baru masuk di lapisan detail.

## 4. Merancang rig

Rig adalah kerangka: kumpulan tulang yang bisa diputar. Aturannya ada di
`game/src/render/units/contract.ts` dan dipaksakan oleh tes.

**Aturan dasar**

- Tulang adalah sebuah `Group` yang titik asalnya tepat di sendi. Rotasi nol berarti pose diam.
- Bagian tubuh digantung di bawah atau di luar sendinya, sehingga memutar tulang memutar bagian itu.
- Hadap ke +Z, atas +Y, sisi kanan unit adalah -X, telapak kaki di y = 0.
- `hips` adalah induk `spine` dan kedua kaki. Naik-turun dan condong badan dilakukan di `hips`.
- Soket adalah penanda kosong (ujung senjata, mulut, dada). Tulang di atasnya yang membawanya.

**Enam jenis rig**

| Rig | Dipakai oleh | Tulang wajib |
|---|---|---|
| humanoid | prajurit, penyihir, skeleton, demon | spine, head, armR, armL, legR, legL |
| golem | golem | sama dengan humanoid, proporsi lain |
| rider | kavaleri | body, empat kaki, armR |
| quadruped | gajah | body, head, empat kaki |
| dragon | naga, griffin | body, head, wingR, wingL |
| siege | ballista, trebuchet | base |

**Cara memilih jumlah tulang.** Saya tanya: gerakan apa yang harus terlihat dari kamera jauh?
Lengan butuh dua ruas (bahu dan siku) karena ayunan senjata terbaca jelas. Kaki cukup satu ruas
karena langkah kecil tidak terbaca. Naga butuh leher dua ruas, rahang, sayap dua ruas, dan ekor
tiga ruas, karena justru bagian itulah yang membuatnya hidup.

**Pose diam.** Lengan dibuka sedikit dari badan dan siku ditekuk. Senjata diberi rotasi diam di
tulang tangan, sehingga animasi hanya perlu menambah gerak, bukan menyusun pose dari nol.

## 5. Alat bangun (kit)

`models/kit.ts` berisi bentuk dasar, `models/kit-human.ts` berisi badan manusia bersama.

| Alat | Kegunaan |
|---|---|
| `box`, `cyl`, `cone`, `ico` | balok, silinder bersisi sedikit, kerucut, bola kasar |
| `taperBox` | balok yang atas dan bawahnya beda ukuran: dada, bilah, perisai, atap pelana |
| `seg` | batang meruncing dari titik A ke B: tanduk, busur, tulang sayap, tali |
| `sheet` | segitiga bebas: selaput sayap, panji, kain sobek |
| `ring` | cincin: halo, rantai, ban besi roda |
| `lambert` / `tintMat` / `glow` | warna biasa / warna kerajaan / bagian menyala |
| `pivot`, `part`, `socketAt` | tulang, bagian, soket |
| `human()` | kerangka dan badan manusia; tiap unit tinggal memakaikan baju dan senjata |

Silinder dibuat 5 sampai 10 sisi dan bola memakai icosahedron. Sudut yang terlihat itu disengaja:
itulah gaya low-poly-nya, dan bayangan rata membuat tiap bidang terbaca sebagai satu warna.

## 6. Standar detail: supaya tidak jomplang

Dulu detail tiap model bergantung pada seberapa lama model itu dikerjakan. Golem hanya 392
segitiga, griffin 1.280. Di layar, golem terlihat seperti mainan di sebelah griffin.

Sekarang detail diatur dengan **lapisan yang sama untuk semua unit**. Sebuah unit selesai kalau
semua lapisan yang berlaku untuknya sudah terisi.

| Lapisan | Isi | Di mana |
|---|---|---|
| 1. Anatomi | lutut, manset sepatu, siku, manset tangan, ibu jari, wajah (mata, alis, hidung, telinga) | otomatis di `human()` |
| 2. Perlengkapan | sabuk dengan gesper dan kantong, pelindung lengan atau tulang kering, sarung pedang, gulungan selimut | pembantu `beltKit`, `vambraces`, `greaves`, `legWraps`, `scabbard`, `bedroll`, `pauldrons` |
| 3. Tutup kepala | minimal tiga bagian: bentuk utama, pinggiran, satu ciri khas | per unit |
| 4. Senjata | minimal lima bagian: gagang, lilitan, pelindung, bilah atau mata, ujung | per unit |
| 5. Lambang | bidang warna kerajaan yang besar ditambah satu lambang warna panji | per unit |
| 6. Tepian | pinggir kain (`hem`), keling, pita besi | per unit |

Untuk makhluk dan mesin, lapisannya disesuaikan: anatomi menjadi lutut, kuku, mata, lubang
hidung, sisik, dan lipatan kulit; perlengkapan menjadi pelana, tali kekang, sanggurdi, dan tas;
senjata menjadi pegas, kerekan, amunisi cadangan, dan ban besi roda.

**Ukuran yang dijaga.** Jumlah segitiga tier 1 semua unit harus berada dalam satu rentang, dan
tes akan gagal kalau ada yang keluar:

- paling sederhana minimal 1.200 segitiga
- perbandingan paling ramai dengan paling sederhana maksimal 1,75

Hasil perombakan (tier 1):

| Unit | v1 | v2 | | Unit | v1 | v2 |
|---|---|---|---|---|---|---|
| spearman | 656 | 1.456 | | necromancer | 968 | 1.380 |
| swordsman | 792 | 1.416 | | skeleton | 795 | 1.315 |
| archer | 812 | 1.460 | | demon | 1.108 | 1.488 |
| halberdier | 635 | 1.319 | | golem | 392 | 1.484 |
| shieldbearer | 720 | 1.312 | | cavalry | 1.096 | 1.760 |
| berserker | 724 | 1.416 | | elephant | 1.098 | 1.852 |
| assassin | 662 | 1.334 | | dragon | 824 | 1.532 |
| engineer | 772 | 1.432 | | griffin | 1.280 | 1.472 |
| wizard | 798 | 1.326 | | ballista | 801 | 1.825 |
| paladin | 848 | 1.348 | | trebuchet | 838 | 2.026 |

Perbandingan paling ramai dengan paling sederhana turun dari 3,27 menjadi 1,54. Mesin kepung dan
hewan besar sengaja sedikit lebih ramai karena ukurannya di layar lebih besar. Anggaran segitiga
mesin kepung dinaikkan dari 1.800 menjadi 2.200 supaya awaknya bisa ikut didetailkan.

Tabel ini bisa dicetak ulang kapan saja:

```bash
npx tsx scripts/model-stats.mts v2
```

## 7. Gaya

- **Tiga jarak baca.** Dari jauh terbaca siluet dan warna kerajaan. Dari jarak sedang terbaca
  senjata dan tutup kepala. Dari dekat baru terbaca gesper, keling, dan tepian. Detail kecil tidak
  boleh mengubah bacaan jarak jauh.
- **Proporsi dilebihkan.** Kepala, tangan, dan senjata sedikit lebih besar dari aslinya. Tombak
  1,5 kali tinggi badan. Bahu golem dua kali lebar pinggangnya.
- **Palet bersama** (`PAL` di `kit-human.ts`): besi, baja, emas, kulit, kayu, kain krem, tulang.
  Unit baru memakai warna dari palet ini dulu, baru menambah satu atau dua warna khasnya sendiri.
- **Warna kerajaan** dipasang di bidang besar yang terlihat dari atas: tunik, jubah, perisai,
  jambul, kain pelana. Lambang kecil memakai warna panji (`crest`).
- **Menyala** hanya untuk yang memang bercahaya: mata, sihir, api, magma, jendela. Kalau semua
  menyala, tidak ada yang menonjol.
- **Tier** menambah hiasan (emas, jambul, panji, rune) tetapi tidak mengubah siluet atau kerangka.
- **Bangunan** mengikuti aturan yang sama: batu abu-abu hangat, atap kerucut melebar, jendela
  menyala, kayu gelap.

## 8. Mekanik pertarungan (gerak)

Gerak punya dua lapis.

**Lapis klip** (`anims.ts`). Tiap klip adalah data kunci waktu per tulang. Setiap jenis unit punya
gerak serang sendiri yang sesuai senjatanya:

| Gerak | Unit | Ciri |
|---|---|---|
| tusuk | spearman, skeleton | lengan lurus ke depan, badan ikut maju |
| tebas | swordsman | ayun dari atas kanan ke kiri bawah, badan memutar |
| tembak | archer | tarik tali, lepas, lengan busur diam |
| rapal | wizard, necromancer | tongkat diangkat lalu dihentak ke depan |
| hantam | paladin, engineer | dua tangan dari atas kepala ke bawah |
| tinju | golem | satu lengan menghantam, badan memutar berat |
| belah | demon | ayun mendatar lebar dengan putaran badan besar |
| bacok | halberdier | dua tangan menurunkan bilah dari atas |
| dorong perisai | shieldbearer | lengan perisai menghantam ke depan |
| amuk | berserker | dua kapak bergantian |
| tikam | assassin | terjang lalu dua belati ke depan |
| serbu, seruduk, sambar | kavaleri, gajah, griffin | gerak khas tunggangan |

**Lapis rasa tempur** (`animator.ts`, fungsi `feel`). Lapis ini dihitung langsung dari keadaan
unit, tanpa data klip, dan ditambahkan di atas klip:

| Gerak | Pemicu | Yang terlihat |
|---|---|---|
| Napas | selalu saat diam | dada dan bahu naik turun; lebih lambat untuk golem |
| Ayunan jalan | saat berjalan | badan turun dua kali per langkah, bahu melawan arah kaki, kepala tetap lurus |
| Kuda-kuda | 2,5 detik setelah serangan terakhir | badan merendah dan condong, satu kaki di depan |
| Terjang | setiap serangan jarak dekat | berat badan maju bersama pukulan lalu kembali |
| Terdorong | 0,28 detik setelah kena pukul | badan atas tersentak ke belakang, unit terdorong sedikit |
| Tersetrum | selama terpaku oleh Petir Berantai | kepala tertunduk, badan gemetar |

Waktunya datang dari simulasi (`attackAt`, `hitAt`, `stunUntil`), sehingga gerak selalu cocok
dengan angka damage yang muncul. Lapis ini hanya menyentuh tulang yang dimiliki rig, jadi naga dan
mesin kepung otomatis hanya mendapat bagian yang cocok (misalnya mesin kepung hanya bergetar saat
kena).

Lapis ini murni tampilan. Aturan pertempuran di simulasi (damage, jangkauan, kemampuan khusus)
tidak berubah.

## 9. Contoh bangunan: mercusuar

Mercusuar lama hanya silinder pucat dengan dua garis merah dan lampu kuning. Bentuknya mercusuar
modern, bukan abad pertengahan. Rancangan barunya disusun dengan urutan yang sama:

1. **Peran:** penanda di tanjung yang terlihat dari seluruh peta, dan harus terasa satu dunia
   dengan kastil.
2. **Referensi:** menara batu berpenopang, galeri berkorbel dan bermerlon, menara tangga di sisi,
   atap "topi penyihir" seperti kastil.
3. **Siluet:** tiga tingkat yang makin ramping, galeri melebar, lalu atap runcing tinggi. Menara
   tangga kecil di samping membuatnya tidak simetris.
4. **Blok kasar:** dua tingkat menara, galeri, lentera, atap.
5. **Detail:** empat penopang, batu selang-seling, lumut di sisi angin, pintu berlengkung dengan
   dua lentera, jendela menyala yang melingkar naik, dua panji panjang.
6. **Unsur fantasi:** api diganti kristal biru yang melayang di atas mangkuk besi, dikelilingi dua
   cincin emas (armillary).
7. **Cerita kecil:** pondok penjaga berangka kayu di kaki menara, dengan cerobong, jendela menyala,
   dan dua tong.

## 10. Arsip model lama

Model sebelum perombakan tidak dihapus.

| Yang disimpan | Lokasi |
|---|---|
| 20 model pasukan v1 beserta kit-nya | `game/src/render/units/models-v1/` |
| Mercusuar v1 | fungsi `lighthouseV1()` di `game/src/render/landmarks.ts` |
| Daftar kedua set | `game/src/render/units/sets.ts` |

Cara melihat model lama: tambahkan `?models=v1` di alamat permainan atau Kodeks, misalnya
`units.html?models=v1`. Folder `models-v1/` dibekukan dan tidak boleh diubah. Tes memastikan kedua
set punya unit, tulang, dan soket yang sama, sehingga animasi berlaku untuk keduanya.

## 11. Daftar periksa model baru

1. Tulis satu kalimat peran dan satu ciri siluet di komentar atas berkas.
2. Mulai dari `human()` atau salin struktur `_reference.ts`.
3. Isi enam lapisan detail (bagian 6).
4. Pasang soket yang dibutuhkan efek: `weaponTip`, `muzzle` untuk penembak, `mouth` untuk naga.
5. Tambah hiasan tier 2 dan 3 tanpa mengubah kerangka.
6. Daftarkan di `models/index.ts` dan pilih gerak serang di `anims.ts`.
7. Jalankan `npx tsx scripts/model-stats.mts` dan pastikan angkanya masuk rentang.
8. Jalankan `npm run check`, lalu lihat di `units.html` dan di pertempuran.

## 12. Kesalahan yang pernah terjadi

- **Bagian menembus tanah.** Paku di pangkal tombak dan halberd membuat titik terendah model
  turun ke y = -0,07. Kontrak model menangkapnya. Paku diganti cincin besi yang tidak melewati
  ujung gagang.
- **Wajah menembus helm.** Hidung menonjol 3 cm lebih jauh dari pelindung hidung. Karena itu
  `human()` punya pilihan `face`: `full`, `eyes` (untuk topeng dan pelindung hidung), atau `none`
  (helm tertutup).
- **Berkas bukan model di folder model.** Tes menganggap setiap berkas di `models/` adalah model,
  jadi daftar set dipindah ke `units/sets.ts`.
- **Detail yang tidak terbaca.** Rantai di dada golem memakan 192 segitiga. Itu batas atas untuk
  satu hiasan; lebih dari itu lebih baik dipakai untuk bentuk yang mengubah siluet.
