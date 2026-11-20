---
tags: [empire, gift, like, ekonomi, rencana]
---

# Rencana mekanik donasi, like, dan event milestone

Status: **usulan**. Yang sudah dibuat: tiga event dunia (Hujan Meteor Dunia, Titan Neraka sebagai Boss Jempol untuk semua peta, Naga Purba), lihat D-034. Sistem milestone dan meteran like belum. Angka di sini titik awal, disetel lagi setelah tes di LIVE nyata.
Mekanik yang sudah jalan ada di `pemetaan-gift.md` dan `config/events.config.json`.

## 1. Kenapa orang mau donate di game LIVE

Penonton jarang donate untuk "menang". Mereka donate karena empat hal ini, jadi semua mekanik di
bawah harus memicu paling tidak satu:

| Pemicu | Artinya di EMPIRE |
|---|---|
| **Dilihat** | Nama pengirim besar di layar, kamera menyorot kastilnya, mahkota di atas kastil |
| **Saingan** | Ada musuh jelas yang bisa dibalas: buronan, perang gift antar dua kerajaan |
| **Takut kalah** | Kastil hampir runtuh, ada tombol "selamatkan" yang jelas: gift sekarang |
| **Momen terbatas** | Jendela waktu singkat: Jam Emas, target bersama hampir penuh, babak final |

Penonton yang tidak donate juga harus punya jalan lewat like, komentar, share. Penonton yang
ramai membuat live naik di FYP, dan dari keramaian itulah donatur datang.

## 2. Masalah di sistem sekarang

1. **Batas pasukan.** Satu kerajaan maksimal 140 unit, seluruh peta 360. Dengan 40 kerajaan,
   gift besar sering masuk antrean lalu jadi buff 30 dtk. Donatur besar merasa uangnya hilang.
2. **Like hanya pribadi.** 30 like = 1 Spearman, maksimal 10 per menit. Tidak ada tujuan bersama,
   jadi tidak ada alasan untuk ramai-ramai tap layar.
3. **Tidak ada status.** Siapa donatur terbesar ronde ini tidak terlihat.
4. **Tidak ada momen genting.** Kastil runtuh begitu saja tanpa kesempatan diselamatkan.

## 3. Gift

### 3.1 Tetap: tangga tier
Tier koin di `events.config.json` tetap jadi dasar. Hal yang diubah adalah apa yang terjadi
sesudahnya.

### 3.2 Gift tidak pernah terbuang: pasukan jadi Veteran
Kalau kerajaan sudah penuh, unit yang tidak muat tidak lagi diantrekan 60 dtk. Unit itu diubah
menjadi **bintang Veteran** untuk seluruh pasukan kerajaan tersebut:

- Setiap 100 koin yang tidak muat = 1 bintang, maksimal 5 bintang.
- 1 bintang = +6% HP dan +6% damage untuk semua unit kerajaan itu sampai ronde selesai.
- Bintang tampil di bendera kastil: ⭐⭐⭐.

Hasilnya, donatur besar tetap merasa makin kuat walau jumlah unit sudah mentok. Jumlah unit
di peta juga tetap aman untuk FPS.

### 3.3 Sultan Ronde
- Papan kecil di HUD: **3 donatur teratas ronde ini** (total koin, bukan jumlah gift).
- Peringkat 1 mendapat **mahkota** di atas kastilnya dan julukan "Sultan".
- Saat posisi Sultan direbut orang lain: toast besar "👑 X merebut mahkota dari Y!".
  Momen ini paling sering memancing perang gift.
- Mahkota tidak memberi kekuatan. Murni status, supaya tidak terasa *pay to win*.

### 3.4 Sorotan untuk gift besar
| Nilai satu gift | Yang terlihat |
|---|---|
| 1–29 | Toast biasa |
| 30–298 | Toast besar + suara |
| 299–999 | Kamera terbang ke kastil pengirim 3 dtk, nama di tengah layar |
| 1000+ | Sinematik 5 dtk, langit menggelap (pakai sistem cuaca: badai), nama masuk **Hall of Fame** |

Kamera hanya boleh "dibajak" paling sering sekali tiap 8 dtk. Kalau ada dua gift besar
berdekatan, gift berikutnya cukup dapat banner.

### 3.5 Jam Emas (jendela gift ganda)
- Dua kali per ronde, selama 45 dtk, semua gift memberi **pasukan x1,5**.
- Jadwal dibaca dari `roundId`, sama seperti cuaca, jadi deterministik.
  Contoh: satu di menit ke-4 sampai 8 perang, satu lagi selalu di awal FINAL.
- Diumumkan 10 dtk sebelumnya dengan hitung mundur di HUD, supaya penonton siap-siap.

### 3.6 Penyelamatan kastil (Last Stand)
- Saat HP kastil turun di bawah 25%, muncul banner berkedip:
  "⚠️ Kastil X terkepung! Kirim gift untuk bala bantuan".
- Selama 20 dtk itu, gift ke kerajaan tersebut mendapat **pasukan x1,5 + perisai kastil 5 dtk**.
- Hanya sekali per kerajaan per ronde.

### 3.7 Bangkit dari Abu
- Kerajaan yang hancur punya waktu 30 dtk. Gift senilai 30 koin atau lebih membangun kastil baru
  di dekat posisi lama, dengan level lama dikurangi 2 dan setengah modal awal.
- Bisa sekali per ronde. Gift ini melewati cooldown ikut ulang yang 60 dtk.
- Di babak FINAL tidak berlaku, supaya akhir ronde tetap tegang.

### 3.8 Buronan
- Kerajaan peringkat 1 yang unggul jauh (skor lebih dari 1,5x peringkat 2) menjadi **Buronan**:
  muncul tanda tengkorak di kastilnya.
- Kerajaan lain yang menyerangnya mendapat +30% EXP.
- Siapa pun yang menghancurkan kastil Buronan mendapat **hadiah buronan**: 1 Golem + 1 level.
- Ini memberi alasan bagi kerajaan lain untuk donate melawan si kuat, dan alasan bagi si kuat
  untuk donate bertahan. Bobot `hunted` yang sudah ada bisa dipakai di sini.

## 4. Like

### 4.1 Like pribadi (tetap, ditambah tangga per ronde)
30 like = 1 Spearman, maksimal 10 per menit, tetap seperti sekarang. Ditambah hadiah bertingkat
yang dihitung per orang per ronde:

| Like dari satu orang dalam satu ronde | Hadiah sekali |
|---|---|
| 300 | +3 Knight |
| 1.000 | +2 Cavalry + lencana 💪 "Pejuang Jempol" di nama |
| 3.000 | +1 Paladin + 1 Ranger |
| 5.000 | 1 mantra Cahaya Suci (heal) untuk kerajaannya |

Penonton yang rajin tap merasa terus naik walau tidak donate. Hadiahnya sengaja lebih kecil dari
gift termurah yang setara, supaya gift tetap lebih menarik.

### 4.2 Meteran like bersama per ronde
Bar kecil terisi oleh like semua orang. Setiap **5.000 like** dalam satu ronde terjadi
**Gelombang Rakyat**:

- Semua kerajaan yang ikut menyumbang like sejak gelombang terakhir mendapat +2 Spearman.
- **Penyumbang like terbanyak** di gelombang itu mendapat +3 Knight dan namanya disebut.
- Setiap gelombang juga membawa satu efek kecil, bergiliran:

| Gelombang ke- | Efek |
|---|---|
| 1 | 🎺 **Panji Berkibar**: musik naik satu tingkat, semua kerajaan +3 Spearman |
| 2 | 🛒 **Pasar Perang**: 30 dtk produksi pasif x2 |
| 3 | 🏹 **Hujan Panah Rakyat**: 30 dtk menara kastil dan desa menembak 2x lebih cepat |
| 4 | 🗳️ **Restu Langit** (Suara Rakyat): 1 = semua unit heal penuh, 2 = petir menyambar 3 kastil teratas |
| 5 | 🗳️ **Gencatan atau Darah** (Suara Rakyat): 1 = gencatan 30 dtk, tidak ada damage dan semua sembuh. 2 = damage +30% selama 30 dtk |
| 6 dan seterusnya | Mulai lagi dari 1 |

- Bar kembali kosong lalu terisi lagi. Bar ini di-reset tiap ronde, terpisah dari total like LIVE.
- Angka 5.000 ada di config. Untuk LIVE yang lebih sepi, angkanya bisa diturunkan tanpa mengubah
  milestone besar.

Penonton punya alasan tap bersama ("ayo dikit lagi!"), dan hadiahnya hanya untuk yang ikut,
jadi tidak ada yang numpang.

### 4.3 Like total LIVE: dunia yang digerakkan jempol

Total like dihitung sepanjang LIVE dan tidak di-reset tiap ronde, karena angka itulah yang
terlihat di layar TikTok. Mekaniknya terdiri dari lima lapis yang saling mengisi:

| Lapis | Pertanyaan yang dijawab untuk penonton |
|---|---|
| A. Tangga milestone | "Kalau kita tembus angka X, apa yang terjadi?" |
| B. Suara Rakyat | "Aku ikut menentukan apa yang terjadi" |
| C. MVP Jempol | "Namaku muncul, dan aku yang memegang kendali event" |
| D. Boss Jempol | "Tap-ku langsung memukul musuh" |
| E. Semangat Rakyat | "Kalau kita tap lebih cepat, dunia ikut panas" |

#### A. Tangga milestone
Milestone pertama ada di 10.000 like, dan setiap milestone adalah event besar. Kejadian kecil di
sela milestone diisi oleh Gelombang Rakyat per ronde (4.2).

| Total like | Kelas | Event | Efek |
|---|---|---|---|
| **10.000** | Besar | ☄️ **Hujan Meteor Dunia** | 20 dtk meteor. **MVP memilih kerajaan sasaran utama**, sisanya jatuh acak berbobot peringkat |
| **50.000** | Besar | 👹 **Boss Jempol** (lihat D) | Monster peta muncul, dan like penonton menjadi serangan |
| **100.000** | Legenda | 🐉 **Kebangkitan Naga Purba** | Naga Dunia muncul dengan HP x1,5, hadiah membunuhnya dobel |
| 200.000 | Besar | 🐪 **Karavan Emas** | Tiga karavan netral melintasi peta. Tiap karavan yang dirampas memberi 5 Cavalry + 1 level. Semua pasukan berebut ke jalurnya |
| 300.000 | Besar | 🌑 **Gerhana** | 60 dtk: langit malam (siklus hari dipaksa malam), setiap unit yang mati bangkit sekali sebagai Skeleton untuk pembunuhnya |
| **500.000** | Legenda | ⚔️ **Perang Besar** | 60 dtk: produksi pasif x3, cuaca badai, musik perang |
| 750.000 | Besar | 🗳️ **Pilihan Rakyat** (Suara Rakyat) | Chat menyebut nama kerajaan. Yang paling banyak disebut dapat +2 level dan perisai 20 dtk |
| **1.000.000** | Legenda | 👑 **Mahkota Langit** | Penyumbang like terbanyak sepanjang LIVE mendapat gelar dan +1 level kastil |
| 1.500.000 | Besar | 🏛️ **Gerbang Kuno Terbuka** | Semua landmark reruntuhan memunculkan Golem penjaga harta. Tiap Golem yang dikalahkan memberi 1 Dragon |
| **2.000.000** | Legenda | 🔥 **Kiamat Kecil** | Meteor, badai, dan Naga sekaligus selama 45 dtk |
| 3.000.000 | Legenda | 🗺️ **Era Baru** (Suara Rakyat) | Chat memilih peta 1–5 untuk ronde berikutnya |
| **5.000.000** | Legenda | 🏆 **Legenda LIVE** | 10 penyumbang like teratas masuk Hall of Fame, bendera semua kerajaan jadi emas sampai LIVE selesai |
| setelah 5 juta, tiap +1.000.000 | Bergiliran | Meteor, Boss Jempol, Naga Purba, Perang Besar, Era Baru | Diulang bergantian |

#### B. Suara Rakyat (voting)
- Pilihan muncul di layar dengan dua bar. Chat mengetik `1` atau `2` selama **20 dtk**.
- Satu orang satu suara. Suara orang yang ikut like di segmen milestone itu dihitung **2**,
  jadi tap layar tetap ada gunanya saat voting.
- Kalau tidak ada yang memilih, opsi 1 yang dipakai.
- Untuk "Pilihan Rakyat" dan "Era Baru", chat mengetik nama kerajaan atau nomor peta.
- Voting membuat kolom komentar ramai, dan komentar juga ikut menaikkan LIVE di FYP.

#### C. MVP Jempol
- MVP adalah orang dengan like terbanyak **sejak milestone sebelumnya**. Namanya tampil di banner
  event: "☄️ Hujan Meteor, dipersembahkan oleh Budi".
- Event yang punya sasaran dikendalikan MVP. Contohnya meteor: MVP mengetik `target <nama>`
  dalam 10 dtk. Kalau diam, sasaran otomatis peringkat 1.
- Kerajaan MVP kebal dari event merugikan yang dia picu.
- Orang yang sama tidak bisa jadi MVP dua kali berturut-turut. Kalau terjadi, MVP pindah ke
  peringkat 2, supaya satu orang tidak memborong semua.
- Di HUD selalu tampil calon MVP saat ini dan jumlah like-nya. Ini memicu adu tap:
  "Andi menyalip Budi!"

#### D. Boss Jempol
Boss muncul di milestone 50.000 dan di giliran ulang. Tahap pertama memakai satu boss untuk semua
peta, **Titan Neraka** (D-034). Boss per peta di bawah ini menyusul:

| Peta | Boss | Muncul di |
|---|---|---|
| 1–3 (hutan) | 🌳 Treant Purba | Pohon Purba |
| 4 Tiga Alam | ❄️ Raksasa Es | Mahkota Es |
| 5 Teluk Naga | 🐙 Kraken | Teluk terbesar, menyerang kastil di pantai |
| Peta bergurun | 🐛 Cacing Pasir | Gerbang Batu Merah |

Cara kerjanya:
- Pasukan kerajaan menyerang boss seperti biasa.
- **Setiap 50 like dari penonton = 1 tembakan ketapel rakyat** ke boss, atas nama kerajaan penonton
  itu. Penonton yang belum ikut tetap menembak dengan nama "Rakyat".
- Papan damage menampilkan 3 penyumbang damage teratas.
- Hadiah: damage terbanyak dapat 1 Dragon, pukulan terakhir dapat +1 level kastil.
- Boss punya waktu **90 dtk**. Kalau tidak mati, boss mengamuk dan menghantam kastil peringkat 1
  lalu pergi. Batas waktu ini yang membuat penonton tap secepat mungkin.
- HP boss mengikuti laju like 5 menit terakhir, jadi LIVE kecil dan LIVE besar sama-sama punya
  peluang menang.

#### E. Semangat Rakyat (laju like)
Milestone hanya sesekali. Semangat Rakyat membuat tap terasa setiap saat. Nilainya dihitung dari
jumlah like 60 dtk terakhir:

| Like per menit | Tingkat | Efek |
|---|---|---|
| di bawah 1.000 | 😐 Tenang | Normal |
| 1.000+ | 🙂 Bersemangat | Produksi pasif +20%, bendera berkibar kencang |
| 3.000+ | 🔥 Membara | Produksi pasif +40%, api di menara, musik lebih cepat |
| 8.000+ | 💥 FEVER | Produksi pasif +60%, hadiah like pribadi 2x (15 like = 1 Spearman), tepi layar menyala |

- Tingkat naik langsung, tapi turunnya ditahan 10 dtk, supaya tidak berkedip naik-turun.
- Ambang di atas adalah ambang awal. Lebih baik ada opsi **relatif**: Membara = 2x rata-rata laju
  like LIVE ini, FEVER = 4x. Dengan begitu, channel kecil tetap bisa mencapai FEVER.

#### F. Tampilan di HUD
- Bar milestone di atas layar dengan ikon event berikutnya dan sisa like: "☄️ Hujan Meteor:
  tinggal 812 like".
- Saat bar mencapai 90%, bar berdenyut dan muncul teks "Sedikit lagi!".
- Ikon tingkat Semangat Rakyat dan nama calon MVP ada di sebelah bar.

#### Aturan umum
- Kalau milestone tembus saat LOBBY atau RESULT, eventnya ditunda ke awal fase perang berikutnya,
  dengan pengumuman "event menunggu…".
- Setiap event diumumkan 5 dtk sebelum terjadi (banner + suara), supaya streamer bisa ikut hype.
- Kalau beberapa milestone tembus sekaligus (misalnya ada ledakan like), eventnya diantrekan
  dengan jarak minimal 20 dtk.
- Event yang merugikan, seperti meteor, paling keras ke peringkat atas, kecuali MVP memilih lain.
  Ini membantu pemain kecil dan membuat donatur besar ingin donate lagi untuk bertahan.

### 4.4 Catatan teknis like
- Kontrak sekarang hanya membawa `like.count` per event. Untuk milestone LIVE, lebih baik kontrak
  juga membawa `totalLikeCount` dari TikTok. Kalau tidak ada, game menjumlah sendiri, dan hasilnya
  bisa beda dengan angka di layar TikTok kalau game baru dibuka di tengah LIVE.
- Total like LIVE harus disimpan di luar `Sim`, karena `Sim` di-reset tiap ronde.

## 5. Komentar, share, follow

| Aksi | Usulan |
|---|---|
| Follow | Tetap 5 Spearman, sekali per ronde |
| Share | Tetap 3 Ranger, cooldown 2 menit. Tambah meteran share: setiap 10 share dalam ronde, semua yang share dapat 1 Griffin |
| Komentar "dukung <nama>" | **Mode pendukung**: penonton yang tidak kebagian slot (40 penuh) bisa memilih satu kerajaan. Gift dan like mereka masuk ke kerajaan itu, dengan label "dari X" |

Mode pendukung penting. Saat slot penuh, penonton baru sekarang tidak punya alasan donate sama
sekali. Dengan mode ini, mereka tetap bisa ikut.

## 6. Target bersama (bar koin per ronde)

Satu bar koin di HUD, diisi semua gift di ronde itu:

| Total koin ronde | Terbuka |
|---|---|
| 300 | Jam Emas tambahan 30 dtk |
| 1.000 | Semua donatur ronde ini mendapat 1 Griffin |
| 3.000 | Naga Dunia dipanggil atas nama **Sultan Ronde** (damage +25% untuk kerajaannya) |

Bar yang hampir penuh adalah salah satu pendorong donasi terkuat di LIVE, karena penonton suka
menjadi orang yang "menuntaskan". Tampilkan nama penuntasnya besar-besar.

## 7. Gelar lintas LIVE (fase akhir)

Total koin seseorang disimpan antar-LIVE (butuh penyimpanan di bridge/server):

| Total koin sepanjang masa | Gelar di depan nama |
|---|---|
| 100 | Prajurit |
| 1.000 | Ksatria |
| 5.000 | Bangsawan |
| 20.000 | Raja |
| 100.000 | Kaisar |

Gelar **kosmetik saja**: warna nama, bingkai bendera, dan sapaan saat ikut ("👑 Raja Budi
memasuki medan perang!"). Jangan beri bonus pasukan permanen. Kalau ada, pemain baru akan kalah
sebelum mulai lalu pergi.

## 8. Rambu-rambu

- **Jangan ada hadiah acak dari gift** (gacha, peti misteri, roda putar). Itu mirip judi dan bisa
  melanggar aturan LIVE TikTok. Semua hadiah harus pasti dan terlihat di layar atau papan info.
- **Jangan menjanjikan uang atau barang nyata** untuk gift.
- Gift tetap kuat, tapi tidak boleh mutlak. Pengaman yang sudah ada tetap dipakai: batas unit,
  cooldown mantra 8 dtk, perisai 45 dtk untuk pemain baru. Ditambah Buronan dan meteor milestone
  yang menyasar peringkat atas.
- Semua angka masuk config, bukan hardcode, supaya bisa disetel di tengah musim.

## 9. Urutan pengerjaan

| Fase | Isi | Kenapa duluan |
|---|---|---|
| 1 | Meteran like ronde (4.2), tangga milestone dengan event yang memakai mantra dan unit yang sudah ada (4.3 A), MVP Jempol (4.3 C), Semangat Rakyat (4.3 E), HUD bar (4.3 F), tangga like pribadi (4.1), papan Sultan + mahkota (3.3) | Paling terasa buat penonton, hampir semuanya di router + HUD |
| 2 | Suara Rakyat (4.3 B dan gelombang 4–5), Boss Jempol (4.3 D), Karavan Emas, Gerhana, Veteran (3.2), Jam Emas (3.5), Last Stand (3.6), Bangkit dari Abu (3.7), sorotan kamera (3.4) | Butuh model dan perilaku baru di sim |
| 3 | Buronan (3.8), target bersama (6), mode pendukung (5), meteran share | Butuh penyetelan keseimbangan dari tes nyata |
| 4 | Gelar lintas LIVE (7), Hall of Fame | Butuh penyimpanan permanen di server |

## 10. Draf config

```json
{
  "likes": {
    "perUnit": 30, "unit": "spearman", "maxUnitsPerMinute": 10,
    "personalLadder": [
      { "likes": 300,  "units": { "swordsman": 3 } },
      { "likes": 1000, "units": { "cavalry": 2 }, "badge": "Pejuang Jempol" },
      { "likes": 3000, "units": { "paladin": 1, "archer": 1 } },
      { "likes": 5000, "spell": "heal" }
    ],
    "roundWave": {
      "every": 5000, "contributorUnits": { "spearman": 2 }, "topUnits": { "swordsman": 3 },
      "rotation": [
        { "event": "BANNER_RISE" },
        { "event": "WAR_MARKET", "seconds": 30 },
        { "event": "ARROW_RAIN", "seconds": 30 },
        { "event": "VOTE", "options": ["HEAL_ALL", "LIGHTNING_TOP3"] },
        { "event": "VOTE", "options": ["CEASEFIRE", "BLOODBATH"], "seconds": 30 }
      ]
    },
    "liveMilestones": [
      { "at": 10000,   "event": "METEOR_WORLD",  "seconds": 20, "mvpTargets": true },
      { "at": 50000,   "event": "LIKE_BOSS" },
      { "at": 100000,  "event": "ELDER_DRAGON",  "hpMultiplier": 1.5 },
      { "at": 200000,  "event": "GOLD_CARAVAN",  "count": 3 },
      { "at": 300000,  "event": "ECLIPSE",       "seconds": 60 },
      { "at": 500000,  "event": "GREAT_WAR",     "seconds": 60 },
      { "at": 750000,  "event": "VOTE_KINGDOM",  "levels": 2 },
      { "at": 1000000, "event": "SKY_CROWN" },
      { "at": 1500000, "event": "ANCIENT_GATE" },
      { "at": 2000000, "event": "APOCALYPSE",    "seconds": 45 },
      { "at": 3000000, "event": "VOTE_MAP" },
      { "at": 5000000, "event": "LIVE_LEGEND" }
    ],
    "repeatEvery": 1000000,
    "repeatEvents": ["METEOR_WORLD", "LIKE_BOSS", "ELDER_DRAGON", "GREAT_WAR", "VOTE_MAP"],
    "eventGapSeconds": 20,
    "announceSeconds": 5,
    "vote": { "seconds": 20, "likerWeight": 2 },
    "mvp": { "targetSeconds": 10, "noRepeat": true, "immuneToOwnEvent": true },
    "boss": { "likesPerShot": 50, "seconds": 90, "hpFromLikeRateMinutes": 5,
              "reward": { "topDamage": { "dragon": 1 }, "lastHitLevels": 1 } },
    "fever": {
      "windowSeconds": 60, "holdSeconds": 10, "mode": "relative",
      "levels": [
        { "name": "Bersemangat", "perMinute": 1000, "relative": 1.2, "passiveBonus": 0.2 },
        { "name": "Membara",     "perMinute": 3000, "relative": 2,   "passiveBonus": 0.4 },
        { "name": "FEVER",       "perMinute": 8000, "relative": 4,   "passiveBonus": 0.6, "likePerUnit": 15 }
      ]
    }
  },
  "gift": {
    "veteran": { "coinsPerStar": 100, "maxStars": 5, "bonusPerStar": 0.06 },
    "goldenHour": { "perRound": 2, "seconds": 45, "multiplier": 1.5, "warnSeconds": 10 },
    "lastStand": { "castleHpBelow": 0.25, "seconds": 20, "multiplier": 1.5, "shieldSeconds": 5 },
    "revive": { "windowSeconds": 30, "minCoins": 30, "levelLoss": 2 },
    "spotlight": { "cameraAt": 299, "cinematicAt": 1000, "minGapSeconds": 8 },
    "roundGoal": [
      { "coins": 300,  "event": "GOLDEN_HOUR", "seconds": 30 },
      { "coins": 1000, "giverUnits": { "griffin": 1 } },
      { "coins": 3000, "event": "WORLD_DRAGON_FOR_TOP" }
    ]
  },
  "bounty": { "leadRatio": 1.5, "expBonus": 0.3, "reward": { "units": { "golem": 1 }, "levels": 1 } },
  "supporter": { "keywords": ["dukung", "bantu"] }
}
```
