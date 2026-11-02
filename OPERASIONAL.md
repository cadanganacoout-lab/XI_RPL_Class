# Panduan Operasional

## Menonaktifkan akun

Gunakan `scripts/set-active.js` dari lingkungan lokal tepercaya. Tentukan username dan status nonaktif, lalu ikuti konfirmasi target database. Menonaktifkan akun mencabut sesi; jangan menjalankan perintah pada Production tanpa persetujuan dan verifikasi database.

## Reset password

Gunakan `scripts/reset-password.js` dengan target database dan username yang telah diverifikasi. Password sementara dicetak sekali; bagikan lewat kanal pribadi, minta pemilik menggantinya saat masuk, dan jangan menyimpan atau mengirimkannya ke grup.

## Moderasi komentar

Komentar dan balasan tetap dikelola di Supabase. Tinjau dan hapus konten penyalahgunaan melalui mekanisme admin Supabase yang tersedia; fitur chat, identitas pengirim, dan moderasi dalam website tidak termasuk tahap ini. Jika penyalahgunaan berulang terkait akun, nonaktifkan akun melalui jalur tepercaya.

## Rotasi credential

1. Rotasi password/user `MONGODB_URI` di Atlas, lalu perbarui environment Vercel yang sesuai.
2. Tinjau bahwa Preview dan Production memakai user/database berbeda; jangan menyalin nilai credential ke log, commit, atau chat.
3. Redeploy environment terkait dan verifikasi API health serta operasi dasar.
4. Jika ada kemungkinan sesi bocor, cabut sesi aktif dengan prosedur yang disetujui admin dan minta pengguna login kembali. Jangan mengosongkan collection `sessions` tanpa memastikan target database dan dampak logout massal.
5. Supabase service-role key tidak digunakan dalam lingkup saat ini; jangan membuat atau memasangnya hanya untuk fitur komentar.

## Backup dan pemulihan

- Aktifkan backup/retensi Atlas sesuai kebutuhan dan kebijakan pemilik data.
- Uji restore ke database terpisah/non-production terlebih dahulu.
- Sebelum pemulihan Production, catat titik waktu dan dampak perubahan terbaru, minta persetujuan pemilik, lalu verifikasi data dan autentikasi setelah restore.
- Jangan menjalankan migrasi ulang pada data hasil restore tanpa dry-run dan pemeriksaan idempotensi.

## Pemeriksaan rutin

- Tinjau Dependabot, `npm audit --omit=dev`, hasil CI, dan error API setidaknya setiap bulan.
- Tinjau log Vercel untuk error berdasarkan request ID; jangan mencatat password, token, cookie, secret, atau isi pesan/komentar.
- Tinjau backup, hak akses MongoDB, pemisahan Preview/Production, serta konfigurasi RLS komentar.
- Catat siapa yang berhak membuat admin dan menyetujui operasi database Production; batasi akses CLI dan credential ke maintainer tepercaya.
