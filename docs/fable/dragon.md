# Brief: Ancient Red Dragon (rig `dragon`)

Unit: **Ancient Red Dragon** (`dragon`). Output file: `game/src/render/units/models/dragon.ts`.

## Peran
Unit gift paling besar. Terbang di atas pasukan dan **menyemburkan api dari mulut** ke sasaran. Versi skala 2,6 dipakai sebagai Naga Dunia (tanpa tint, merah-emas). Penonton melihatnya dari kamera tinggi dan dari HP, jadi siluet harus terbaca dari jauh.

## Siluet kunci (harus terlihat dari jauh)
1. Dua sayap kelelawar besar, jari-jari tulang terlihat, membran di antaranya.
2. Leher berbentuk S yang naik ke kepala bertanduk melengkung ke belakang.
3. Ekor panjang berduri yang menyempit ke ujung.

## Orientasi
- Menghadap +Z, atas +Y, sisi kanan naga = -X (sayap kanan di x negatif).
- Titik asal: di bawah badan, titik terendah (ujung cakar) di y = 0. Tinggi badan sampai punggung sekitar 3,2, kepala boleh lebih tinggi karena leher naik.
- Rentang sayap terbentang sekitar 9 unit (±4,5), panjang badan + leher + ekor sekitar 9 unit.
- Pose istirahat: sayap setengah terbuka dan sedikit terangkat (sudut kepak 0 = posisi tengah kepakan), leher S santai, kepala menghadap +Z, rahang tertutup.

## Tulang (nama persis, semua pivot di sendi)
```
body (akar badan; induk semua)
├─ neck1 ─ neck2 ─ head ─ jaw
├─ wingR ─ wingR2     (wingR di bahu x negatif, wingR2 di tekukan "siku" tulang sayap)
├─ wingL ─ wingL2     (kebalikannya, x positif)
├─ legR, legL         (kaki belakang pendek bercakar, menggantung ke bawah)
└─ tail1 ─ tail2 ─ tail3
```
Wajib ada: `body`, `head`, `wingR`, `wingL`. Disarankan semua yang di atas, karena klip `breath` memakai `neck1`, `neck2`, `jaw`, dan klip `fly` memakai `wingR2`, `wingL2`, `tail1`–`tail3`.

Aturan sayap: pivot `wingR`/`wingL` ada di bahu. Sayap terentang ke samping sepanjang sumbu X, dan **rotasi Z** pada `wingR`/`wingL` adalah gerak kepak (positif untuk `wingL` = ujung naik). Jadi bangun tulang sayap datar horizontal pada pose istirahat, bukan menjuntai.

## Socket
| Socket | Letak | Catatan |
|---|---|---|
| `mouth` (**wajib**) | Di antara rahang, di ujung depan mulut, anak dari bone `head` (atau `jaw`) | Dari sini api disemburkan. Sumbu +Z lokal kepala = arah semburan |
| `chest` (wajib) | Tengah dada | Titik kena dan sumber cahaya napas |
| `headTop` (wajib) | Di atas kepala, di antara tanduk | Posisi label |

## Warna
- Badan: merah tua `#8f1d1d`, perut krem `#d9b27c`, tanduk dan cakar gading `#e8dcc0`, duri punggung `#5a1212`.
- **Tint (kerajaan) `tintMat()`**: sisi dalam membran sayap dan sisik perut. Pastikan luasnya terlihat.
- **Bercahaya `glow()`**: mata (kuning `#ffcc33`), celah sisik di dada (oranye `#ff7a1a`, tempat napas api berkumpul), bagian dalam mulut (`#ff5a10`).
- Naga Dunia memakai model yang sama; tint-nya hanya digantikan warna merah-emas di luar file ini, jadi tidak perlu perlakuan khusus.

## Tier (rangka dan siluet sama, hanya detail bertambah)
- Tier 1: badan, 2 tanduk, sayap dengan 3 jari.
- Tier 2: tambah duri punggung dan 4 duri di ekor.
- Tier 3: tanduk lebih banyak dan lebih panjang, jari sayap bercakar, duri punggung besar, retakan bercahaya di dada lebih lebar.

## Anggaran
LOD0 ≤ **2600** segitiga (semua tier). Gunakan `ico(r, 0)` (20 segitiga) atau `cone`/`cyl` dengan 5–7 sisi. Membran sayap dibuat dari beberapa segitiga datar (BufferGeometry sendiri atau `PlaneGeometry` yang dirotasi), bukan permukaan yang rumit.

## Catatan untuk animasi (supaya klip nanti pas)
- Kepala dan rahang: `jaw` berotasi sumbu X saat membuka (positif membuka ke bawah). Rahang bawah dibangun menempel di bawah kepala saat tertutup.
- Leher: `neck1`, `neck2` berotasi sumbu X untuk menarik kepala ke belakang (napas) dan maju (semburan).
- Dada: celah `glow()` bagian dari `body` (atau `chest` jika dipisah). Jangan dibuat sebagai tulang sendiri.
- Ekor bergelombang: rotasi sumbu Y pada `tail1`–`tail3`.
