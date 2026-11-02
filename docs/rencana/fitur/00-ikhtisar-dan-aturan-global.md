# Arsitektur dan Aturan Global

Dokumen ini menggantikan asumsi arsitektur di prompt rencana lama. Rencana kerja utama adalah [`LANGKAH-PENGERJAAN.md`](LANGKAH-PENGERJAAN.md); fitur yang dipilih ada di [`PILIH-FITUR.md`](PILIH-FITUR.md).

## Pembagian layanan

- **Frontend:** React 19 + Vite, tetap menggunakan `index.html` dan navigasi hash.
- **Backend akun dan card:** Vercel Serverless Functions di `/api`, Node.js.
- **Database akun dan konten:** MongoDB Atlas; simpan user, session (token yang di-hash), role, profil publik, relasi user/card, card siswa, dan rate-limit yang dibutuhkan.
- **Autentikasi:** username + password yang diverifikasi server; hash password dengan bcrypt; cookie session opaque `HttpOnly`, `Secure` di production, `SameSite=Lax`, dan `Path=/`. Jangan memakai Supabase Auth atau menyimpan token autentikasi di localStorage.
- **Komentar:** fitur komentar yang sekarang tetap menggunakan Supabase PostgreSQL dan Supabase Realtime. Supabase hanya digunakan untuk komentar; jangan pindahkan akun/card ke Supabase atau mengubah komentar menjadi chat pada lingkup ini.
- **Storage:** upload background card ditunda; jangan membuat bucket atau integrasi Supabase Storage sebagai bagian pekerjaan terpilih.

## Keamanan wajib

1. Identitas dan role selalu berasal dari session yang diverifikasi server. Jangan percaya `userId`, `role`, atau `cardId` dari request client.
2. Semua endpoint mutasi memeriksa autentikasi, otorisasi, Origin/CSRF, skema input ketat, batas ukuran request, dan rate limit sesuai risiko.
3. Hash password; jangan menyimpan atau mencatat password, token session mentah, cookie, secret, maupun data autentikasi sensitif.
4. Session disimpan berdasarkan hash token, dapat dicabut saat logout/nonaktif/reset password, memiliki TTL, dan cookie produksi memakai konfigurasi aman.
5. Semua query MongoDB memvalidasi tipe/nilai input dan menggunakan projection allowlist. Jangan mengembalikan dokumen mentah atau menjalankan operator query dari input client.
6. Username role `member` boleh mendaftar sendiri jika pendaftaran mandiri diaktifkan. Akun `student` dan `admin` hanya dibuat melalui proses admin tepercaya; client tidak dapat memilih atau menaikkan role.
7. Member boleh login dan membaca situs/profilnya, tetapi tidak dapat mengubah profil, konten, atau card apa pun, serta tidak pernah masuk daftar siswa/guru. Perubahan data/credential akun member dilakukan admin melalui jalur tepercaya.
8. Pemilik akun student hanya dapat mengubah field card miliknya yang secara eksplisit diizinkan. Identitas, role, owner, ID, dan status publikasi dilindungi server.
9. Supabase tetap memakai publishable/anon key hanya untuk komentar. Periksa RLS komentar dan jangan mencetak error backend mentah sebagai pesan publik. Tidak ada service-role key di frontend.
10. Secret MongoDB hanya berada di environment server/Vercel. Jangan memakai prefix `VITE_`, `REACT_APP_`, atau `NEXT_PUBLIC_` untuk secret; `.env*` dan `.vercel` tetap di-ignore.
11. Teks profil/card selalu dirender sebagai teks biasa. Tautan eksternal divalidasi sebagai URL HTTPS yang aman.
12. Tidak menjalankan migrasi produksi, membuat akun nyata, memublikasikan deployment, atau menulis secret tanpa persetujuan yang sesuai.

## Fitur di luar lingkup

- Peningkatan komentar anonim menjadi komentar beridentitas/chat: dilewati; Supabase tetap hanya dipakai untuk komentar yang ada.
- Background card, upload gambar oleh siswa, dan Storage: dilewati; bukan bagian halaman profil atau edit card.
