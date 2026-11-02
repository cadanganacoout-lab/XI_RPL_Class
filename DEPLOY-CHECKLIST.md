# Checklist Deploy

## Sebelum deploy

- [ ] Jalankan `npm ci`, `npm run check`, `npm run build`, dan `npm audit --omit=dev`.
- [ ] Pastikan tidak ada perubahan credential, akun nyata, atau data production pada commit.
- [ ] Tinjau hasil migrasi dengan `npm run db:migrate -- --dry-run`.
- [ ] Aktifkan backup Atlas dan pastikan pemulihan pernah diuji pada database non-production.

## Environment Vercel

Jangan gunakan prefix `VITE_`, `REACT_APP_`, atau `NEXT_PUBLIC_` untuk variabel server.

| Variabel | Production | Preview |
|---|---|---|
| `MONGODB_URI` | URI cluster dan user database khusus production | URI cluster/database preview yang terpisah dari production |
| `MONGODB_DB` | Nama database production | Nama database preview yang berbeda |
| `MONGODB_ENVIRONMENT` | `production` | `preview` |
| `APP_ORIGIN` | `https://www.rpl42sterida.web.id` | Origin preview tetap/alias yang tepat; aplikasi menolak origin yang tidak cocok |
| `SESSION_COOKIE_NAME` | Opsional; default `xirpl1_session` dan otomatis memakai prefix `__Host-` pada production | Opsional; default `xirpl1_session` |
| `SESSION_TTL_DAYS` | Opsional; default 7, rentang 1–30 | Opsional; default 7, rentang 1–30 |

`NODE_ENV` dan `VERCEL_ENV` disediakan platform. Gunakan user MongoDB dengan hak minimum pada database lingkungannya. Jangan menyalin URI Production ke Preview atau development.

Supabase tetap hanya dipakai untuk komentar. URL dan publishable/anon key komentar berada pada konfigurasi browser yang memang publik; pastikan RLS komentar telah ditinjau. Background card dan Supabase Storage tidak digunakan, sehingga `SUPABASE_SERVICE_ROLE_KEY` tidak diperlukan.

## Preview

- [ ] Isi environment Preview dengan cluster/database serta credential khusus Preview.
- [ ] Gunakan origin Preview yang stabil untuk `APP_ORIGIN`; jangan memakai wildcard.
- [ ] Deploy Preview dan uji login, logout, ganti password, profil, daftar siswa, edit card, komentar, dan tampilan mobile.
- [ ] Pastikan CSP Report-Only tidak menghasilkan pelanggaran yang tidak diharapkan sebelum mempertimbangkan mode enforce.
- [ ] Jalankan migrasi/index hanya terhadap database Preview yang telah dikonfirmasi.
- [ ] Pastikan seluruh pengujian role dan ownership lolos dengan akun uji terpisah.

## Production

- [ ] Minta persetujuan eksplisit sebelum membuat index, menerapkan migrasi, membuat akun nyata, atau memublikasikan Production.
- [ ] Konfirmasi backup, domain HTTPS, `APP_ORIGIN`, akses least-privilege, dan pemisahan Preview/Production.
- [ ] Terapkan index/migrasi secara bertahap dengan target database yang dikonfirmasi.
- [ ] Buat akun admin dan akun siswa melalui CLI lokal tepercaya; bagikan password sementara lewat kanal privat dan minta penggantian segera.
- [ ] Uji `/api/health`, cookie aman, respons error generik, header keamanan, dan alur situs setelah deploy.
- [ ] Catat versi rilis, ringkasan migrasi, hasil uji, dan rencana rollback.

## Batas verifikasi saat ini

Checklist ini tidak menyatakan deploy atau uji live telah dilakukan. Database target belum dikonfigurasi untuk sesi ini; tidak ada koneksi Atlas, migrasi apply, provisioning akun nyata, atau deploy Production yang dijalankan.
