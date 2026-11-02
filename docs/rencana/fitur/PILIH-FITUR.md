# Pilihan Penerapan Fitur

Dokumen ini mencatat fitur yang dipilih untuk dikerjakan. Beri tanda pada **satu** pilihan:

- `[ ] Terapkan sekarang`
- `[ ] Lewati terlebih dahulu`

Pilihan ini menentukan lingkup pengembangan, bukan persetujuan untuk menjalankan migrasi produksi atau deploy.

## 1. Akun, autentikasi, dan peran

- [x] Terapkan sekarang
- [ ] Lewati terlebih dahulu

Simpan akun dan session di MongoDB lewat backend tepercaya. Implementasikan login/logout dengan username dan password yang di-hash, profil akun dengan username unik dan role, serta signup mandiri hanya untuk role `member`. Akun `student` dan `admin` dibuat lewat proses admin tepercaya; client tidak dapat memilih/menaikkan role atau menautkan card.

Anggota non-siswa boleh login dan membaca situs/profilnya sendiri, tetapi tidak dapat mengedit data apa pun di website, tidak masuk daftar siswa/guru, dan tidak mendapat akses edit card. Perubahan data/credential akun member dilakukan admin melalui jalur tepercaya.

## 2. Penyimpanan data card siswa

- [x] Terapkan sekarang
- [ ] Lewati terlebih dahulu

Rancang koleksi card di MongoDB dari field siswa yang benar-benar ada di `js/data.js` (nama, jabatan, hobi, catatan, foto, portofolio; motto hanya jika tersedia). Tautkan card ke akun siswa dengan ownership yang aman dan migrasi yang dapat ditinjau/diulang.

## 3. Daftar siswa dari data tersimpan

- [x] Terapkan sekarang
- [ ] Lewati terlebih dahulu

Ambil daftar siswa dari MongoDB lewat API; pertahankan desain, urutan, pencarian, filter pengurus, jumlah hasil, dan tampilan kosong. Akun `member` tidak pernah muncul di daftar siswa atau guru.

## 4. Edit card milik sendiri

- [x] Terapkan sekarang
- [ ] Lewati terlebih dahulu

Buat halaman edit dan pratinjau untuk siswa yang terhubung ke card. Batasi field yang dapat diedit, validasi input, tunjukkan status simpan/error, dan tegakkan ownership pada API/server. Lindungi ID, role, owner, identitas, dan status publikasi.

## 5. Halaman profil pengguna

- [x] Terapkan sekarang
- [ ] Lewati terlebih dahulu

Buat profil publik `#/profil/:username` dan profil sendiri `#/profil` dari data MongoDB. Profil menampilkan informasi publik minimum, dengan card untuk student dan tampilan dasar yang read-only untuk member. Member tidak memiliki aksi edit; student dapat membuka edit card miliknya. Perubahan data/credential member hanya melalui admin tepercaya.

**Batas:** halaman profil dan editor background card adalah dua fitur terpisah.

## 6. Diskusi dengan identitas akun

- [ ] Terapkan sekarang
- [x] Lewati terlebih dahulu

Jangan ubah komentar anonim menjadi chat/komentar beridentitas. Pertahankan komentar, balasan, PostgreSQL, dan Realtime yang saat ini menggunakan Supabase; Supabase tetap khusus komentar.

## 7. Background card

- [ ] Terapkan sekarang
- [x] Lewati terlebih dahulu

Jangan membangun field/background card, UI upload, Storage bucket, atau integrasi Supabase Storage pada lingkup ini.

## 8. Penguatan keamanan dan privasi

- [x] Terapkan sekarang
- [ ] Lewati terlebih dahulu

Bangun validasi dan otorisasi pada API, sesi/cookie aman, hash password, rate limit, minimisasi data, perlindungan IDOR/XSS, logging yang tidak sensitif, backup dan audit akses MongoDB. Tinjau keamanan komentar Supabase tanpa mengubah fitur komentar.

## 9. Deploy, pengujian, dan operasional

- [x] Terapkan sekarang
- [ ] Lewati terlebih dahulu

Siapkan Vercel Functions dan MongoDB Atlas; uji API serta hak setiap role; pisahkan konfigurasi Preview/Production; dokumentasikan migrasi, rollback, pemulihan akun, rotasi secret, backup, dan rilis. Tidak termasuk deploy production tanpa persetujuan tersendiri.

## Pilihan arsitektur yang berlaku

- Frontend React/Vite dan navigasi hash tetap dipertahankan.
- Akun, hash password, sesi, role, profil, dan card siswa disimpan di MongoDB Atlas, hanya diakses lewat backend Vercel.
- Supabase digunakan **hanya untuk fitur komentar yang ada**; bukan autentikasi, akun, atau penyimpanan card.
- Signup publik hanya dapat membuat `member`. Pembuatan `student`/`admin` dan pengaitan akun ke card dilakukan melalui jalur admin tepercaya.
- Background card, upload gambar, dan perubahan diskusi beridentitas dilewati.
- Detail pelaksanaan serta kriteria selesai ada di [`LANGKAH-PENGERJAAN.md`](LANGKAH-PENGERJAAN.md).
