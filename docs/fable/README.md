# Fable kit: cara membuat model unit

Satu unit = satu percakapan dengan Fable. Mulai dari **Naga** (rig paling rumit, menguji kontrak).

## Alur
1. **Buat paket prompt.**
   ```bash
   npm run fable -- dragon
   ```
   Hasilnya `docs/fable/out/dragon.txt`: aturan, brief, kontrak tipe, helper `kit.ts`, dan model contoh. Semuanya sudah di dalam, Fable tidak perlu membuka repo.
2. **Tempel isi file itu ke Fable**, simpan balasannya (isi file saja) sebagai `game/src/render/units/models/dragon.ts`.
3. **Jalankan tes.**
   ```bash
   npm run test
   ```
   `tests/models.test.ts` otomatis menguji setiap file di `models/`: tulang dan socket wajib, anggaran segitiga, kaki di tanah, ada bagian tint, tanpa NaN, deterministik, ketiga tier lolos. Kalau gagal, tempel pesan galatnya ke Fable di percakapan yang sama dan minta perbaikan.
4. **Pasang ke game.** Di `models/index.ts`:
   ```ts
   import { build as buildDragon } from "./dragon";
   export const MODELS = { dragon: buildDragon };
   ```
   Unit tanpa entri di sini tetap memakai model prototipe.
5. **Lihat hasilnya.** `http://127.0.0.1:5200/?studio` (semua model berjajar) dan `?demo=20` (ukuran di layar). Kodeks (`units.html`) belum menampilkan model baru sampai fase V1.
6. **Setelah lolos,** `npm run check`, lalu commit.

## Isi folder
| File | Fungsi |
|---|---|
| `rules.md` | Aturan wajib dan daftar cek mandiri (disisipkan ke setiap prompt) |
| `dragon.md` | Brief Naga. Brief unit lain dibuat dari `docs/rencana-visual.md` bagian 5–6 dengan bentuk yang sama |
| `out/` | Paket prompt hasil `npm run fable` (tidak di-commit) |

Kode terkait: `game/src/render/units/models/` (`kit.ts` helper, `_reference.ts` contoh humanoid, `index.ts` registry) dan `contract.ts`.

## Membuat brief unit baru
Salin `dragon.md`, ganti: peran, 3 siluet kunci, daftar tulang dan socket (dari `rencana-visual.md` 4.1), warna dan area tint, bagian bercahaya, tier 1/2/3, anggaran segitiga. Lalu `npm run fable -- <unit>`.

## Yang perlu diketahui
- **Animasi belum ikut.** Klip untuk tulang baru (leher, jaw, ekor naga, dst.) ditulis di fase V2/V3 sesudah model ada. Model hanya perlu pose istirahat yang benar dan pivot di sendi.
- Klip lama yang menyebut `wingR`, `armR`, `legR`, dst. tetap jalan pada model baru selama nama tulangnya sama.
