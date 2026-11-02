# Langkah Pengerjaan Fitur Terpilih

Dokumen ini menjadi urutan implementasi berdasarkan [`PILIH-FITUR.md`](PILIH-FITUR.md), dengan aturan keamanan pada [`00-ikhtisar-dan-aturan-global.md`](00-ikhtisar-dan-aturan-global.md). **Ini rencana; belum berarti fitur telah dibuat.**

## Lingkup dan keputusan akun

- Dikerjakan: akun, autentikasi/role, card siswa MongoDB, daftar siswa, edit card sendiri, halaman profil, penguatan keamanan, pengujian dan persiapan rilis.
- Ditunda: mengubah diskusi menjadi chat/komentar beridentitas serta seluruh fitur background/upload gambar.
- Supabase hanya digunakan untuk komentar anonim, balasan, PostgreSQL, dan Realtime yang sudah ada.
- Login memakai username/password. Signup mandiri hanya membuat akun `member`; akun `student` dan `admin` dibuat lewat proses admin tepercaya.
- `member` boleh login tetapi hanya dapat membaca konten dan profilnya sendiri; tidak dapat mengubah data apa pun di website dan tidak masuk daftar siswa/guru. Perubahan data/credential member dilakukan admin melalui jalur tepercaya.
- `student` dapat mengedit hanya field yang diizinkan pada card yang ditautkan secara tepercaya ke akunnya.
- Tidak ada migrasi production, akun sungguhan, pencatatan secret, atau deployment production tanpa persetujuan.

## Tahap 0 — Audit dan rancangan sebelum coding

1. Audit repository dan dokumentasi lama. Tandai prompt yang sudah tidak berlaku; rencana ini dan `00-ikhtisar-dan-aturan-global.md` menjadi acuan arsitektur.
2. Audit semua field aktual pada `SISWA` dan `GURU` di `js/data.js`, ID dan urutan tampilan, field motto yang ada/tidak, URL, foto, jadwal, dan referensi nama siswa.
3. Tentukan schema MongoDB: `users`, `sessions`, `cards`, dan `rate_limits` bila diperlukan. Simpan hanya data yang diperlukan; email tidak diperlukan jika akun memang username/password.
4. Tetapkan allowlist field card yang dapat diedit siswa; field nama resmi/ID, role, owner, publikasi, dan relasi tidak dapat diubah lewat form siswa.
5. Tetapkan siapa admin, proses pembuatan/reset/nonaktif akun, dan penyimpanan credential admin sementara. Jangan menggunakan daftar nama siswa yang ada sebagai credential atau menebak password.
6. Catat arsitektur preview terpisah dari production dan siapkan MongoDB database/credential development yang tidak berisi data production.
7. Catat baseline `npm run check` dan `npm run build`.

**Gerbang tahap:** schema, data mapping, role, allowlist field edit, prosedur admin, dan lingkungan uji telah ditinjau sebelum database production disentuh.

## Tahap 1 — Fondasi backend Vercel dan MongoDB

1. Tambahkan fungsi API Vercel dengan struktur kecil dan jelas untuk auth, profil, dan card; pertahankan frontend static Vite.
2. Tambahkan pembacaan/validasi environment server-side. `MONGODB_URI`, nama database, dan credential lain jangan memakai prefix `VITE_`, `REACT_APP_`, atau `NEXT_PUBLIC_`, dan jangan masuk bundle frontend.
3. Implementasikan `getDb()` dengan `MongoClient` yang di-cache untuk runtime serverless, pool kecil, timeout eksplisit, dan tanpa mencetak URI ke log.
4. Buat utilitas response/error generik dan parsing body dengan batas ukuran. Client tidak menerima stack trace, detail database, query, maupun secret.
5. Tetapkan satu router API yang mengikuti batas jumlah functions Vercel yang berlaku; sediakan endpoint health minimal tanpa info versi/environment.
6. Uji build frontend dan invocation API secara lokal/preview tanpa konfigurasi production.

**Kriteria selesai:** API berjalan tanpa membocorkan konfigurasi, gagal dengan pesan server yang aman jika environment wajib belum tersedia, dan situs publik tetap dapat dibangun.

## Tahap 2 — Schema, indeks, dan data migration

1. Implementasikan koleksi `users` dengan username unik ternormalisasi, `passwordHash`, role, status aktif, metadata waktu minimum, dan referensi card jika student.
2. Implementasikan koleksi `sessions`: ID/session token disimpan sebagai hash SHA-256, expiry, userId, dan metadata minimum. Tambahkan TTL index dan index yang diperlukan.
3. Implementasikan koleksi `cards` berdasarkan pemetaan terverifikasi dari `js/data.js`; pertahankan ID dan urutan tampilan. Jangan menambah background atau file upload.
4. Buat indeks unik username/slug/ownership yang sesuai; handle benturan duplikat tanpa membocorkan detail internal.
5. Tulis migrasi idempoten dengan `--dry-run`, ringkasan hitungan, validasi data, serta rollback. Migrasi siswa tidak membuat akun atau password untuk siswa secara otomatis.
6. Bandingkan hasil dry-run dengan data sumber; minta persetujuan sebelum menerapkan ke database yang berisi data nyata.

**Kriteria selesai:** pemetaan data sesuai sumber, indeks aktif, session token mentah tidak disimpan, dan migrasi aman diulang.

## Tahap 3 — Auth, session, role, dan endpoint akun

1. Validasi request dengan schema ketat; tolak properti tambahan, tipe salah, input terlalu panjang, dan objek query di tempat yang harus string.
2. Implementasikan hash/verify password dengan bcrypt, kebijakan password dan pemeriksaan byte-length.
3. Implementasikan signup hanya untuk role `member`; normalisasi username, tangani duplikasi secara generik, dan beri rate limit.
4. Implementasikan login dengan pesan gagal seragam, rate limit IP/username persisten, dan verifikasi hash palsu saat username tidak ditemukan untuk mengurangi enumerasi.
5. Buat session opaque acak; simpan hanya hash. Cookie produksi `HttpOnly; Secure; SameSite=Lax; Path=/`, tanpa `Domain`, dan prefix `__Host-` jika sesuai; sediakan cookie development yang aman dan tidak keliru dipakai di production.
6. Implementasikan endpoint session/me/logout, revoke saat logout, dan hapus sesi saat password reset/nonaktif akun.
7. Lindungi setiap endpoint mutasi dengan verifikasi Origin/Referer, header CSRF yang disepakati, metode HTTP yang benar, rate limit, dan Cache-Control sesuai sensitivitas.
8. Buat script admin lokal yang tidak dapat dipanggil melalui web untuk membuat student/admin, menautkan student ke card, reset password, dan menonaktifkan akun. Gunakan mode dry-run dan konfirmasi sebelum menulis.
9. Uji brute-force limit, user enumeration, CSRF, session fixation/revoke, mass assignment, NoSQL injection, akun nonaktif, dan penyimpanan credential.

**Kriteria selesai:** API tidak pernah mempercayai role/userId/cardId dari client; member tidak bisa memperoleh privilege; logout dan reset mencabut session terkait.

## Tahap 4 — API profil dan card dengan otorisasi

1. Buat helper serialisasi publik ber-allowlist untuk user/card; jangan pernah mengirim dokumen Mongo mentah, hash password, session, ID internal yang tidak diperlukan, atau data autentikasi.
2. Buat API baca card publik dengan filter published dan field minimal. Urutkan sesuai urutan sumber yang disepakati.
3. Buat API profil publik berdasar username; profil `member` hanya menampilkan data dasar, profil `student` boleh memuat field card publik terkait.
4. Buat API baca profil sendiri dan publik. Member tidak memiliki endpoint untuk mengubah data profil; student hanya dapat mengubah field card yang diizinkan. Admin mengelola perubahan data/credential member melalui jalur tepercaya.
5. Buat API baca/edit `/cards/me` untuk role student. Tentukan card melalui session dan relasi database—bukan ID yang dikirim client.
6. Validasi semua parameter, slug, body, URL eksternal, batas karakter dan request size. Gunakan filter database dengan tipe yang sudah tervalidasi.
7. Uji akses anonim/member/student A/student B/admin, IDOR, mass assignment, stored XSS, invalid URL, dan kebocoran field.

**Kriteria selesai:** member hanya dapat membaca; hanya siswa yang dapat mengubah field card miliknya; role lain mendapat penolakan server.

## Tahap 5 — Frontend auth, profil, dan edit card

1. Buat API client same-origin untuk endpoint `/api` dengan error publik yang aman dan tanpa menyimpan token autentikasi di localStorage/sessionStorage.
2. Tambahkan auth context untuk `user`, `profile`, status loading, login/signup/logout, refresh, dan clear state. Cookie HttpOnly menjadi tempat credential session.
3. Tambahkan halaman login/signup member; label, autocomplete, validasi UX, feedback field, loading/error state, dan navigasi hash aman.
4. Tambahkan menu akun sesuai session. `member` hanya melihat profil sendiri dan opsi logout; hanya student melihat tautan edit card. Jangan ubah atau mengganti diskusi anonim.
5. Tambahkan route profil publik `#/profil/:username` dan profil sendiri `#/profil` dengan loading, error/not-found, role/member/student states, dan field publik minimum.
6. Tambahkan form edit card student dengan pratinjau card yang sama, field allowlist, validasi karakter/URL, dirty state, sukses/error, serta konfirmasi meninggalkan perubahan jika sesuai.
7. Pastikan role guard frontend hanya untuk UX; semua otorisasi tetap enforced API.
8. Terapkan skill aksesibilitas untuk nama kontrol, label input, `aria-describedby`/`aria-invalid`, keyboard, focus-visible, dan pesan loading/error. Pertahankan komponen/CSS tema yang sudah dipakai.
9. Tambahkan tes UI untuk akun anonim/member/student dan semua state halaman.

**Kriteria selesai:** navigasi dan card publik tetap bekerja; member tidak melihat aksi edit dan endpoint juga menolak tulis; profil tidak mengungkap data internal.

## Tahap 6 — Daftar siswa dan guru memakai sumber yang tepat

1. Ubah halaman siswa agar daftar card terbit berasal dari API MongoDB; pertahankan pencarian, filter pengurus, jumlah, urutan, desain, dan fallback gambar.
2. Verifikasi 33 record siswa dan semua field terhadap `js/data.js`; tidak ada member yang masuk daftar.
3. Tentukan lingkup daftar guru: roadmap ini memigrasikan **data siswa**, bukan mengubah data guru menjadi akun yang dapat diedit. Pertahankan daftar guru dari sumber lokal kecuali ada persetujuan/rencana terpisah yang eksplisit.
4. Pastikan halaman home, jadwal, piket, dan komponen lain yang memakai `js/data.js` tetap benar; jangan mengganti seluruh sumber data global secara membabi buta.
5. Tambahkan loading/error/empty state yang jelas; jangan gunakan fallback sukses saat API gagal.

**Kriteria selesai:** daftar siswa konsisten dengan data lama, fungsi search/filter utuh, data guru dan fitur jadwal tidak berubah, member tidak ditampilkan.

## Tahap 7 — Audit keamanan, pengujian akhir, dan rilis

1. Audit seluruh endpoint MongoDB untuk NoSQL injection, IDOR, mass assignment, validasi, projection allowlist, rate limit, CSRF, cookie/session, cache, dan log.
2. Audit Supabase hanya pada fitur komentar yang ada: RLS dan risiko komentar anonim dicatat. Jangan menautkan komentar ke user dan jangan mengubah schema komentar.
3. Audit bundle produksi agar tidak berisi MongoDB URI, credential admin, token session, atau secret; publishable Supabase config komentar tetap dapat diakses browser sesuai RLS.
4. Perluas browser/runtime checks untuk login, signup hanya member, logout, profil member/student, daftar siswa, edit ownership, tampilan mobile, dan error/loading.
5. Jalankan `npm audit --omit=dev`, `npm run build`, dan `npm run check`; bereskan temuan high/critical yang diperkenalkan atau ditemukan pada area yang disentuh.
6. Uji Preview memakai database/akun uji yang terpisah dari Production, lalu dokumentasikan migration/rollback, provisioning/reset/nonaktif akun, backup, dan rotasi MongoDB credential.
7. Minta persetujuan eksplisit sebelum menjalankan migrasi production, membuat akun nyata, atau deploy Production.

**Kriteria rilis:** tes relevan lulus, tidak ada temuan kritis/tinggi terbuka pada auth/ownership/data pribadi, secrets tidak berada di bundle/log, preview terisolasi, dan rollback siap.

## Fitur yang ditunda

- **Chat/komentar beridentitas:** tidak termasuk pekerjaan ini. Pertahankan komentar anonim, balasan, serta Supabase PostgreSQL/Realtime.
- **Background card:** tidak termasuk pekerjaan ini. Jangan membuat field database, upload, bucket, Storage policy, atau UI background.
