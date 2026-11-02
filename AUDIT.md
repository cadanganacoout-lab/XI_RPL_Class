# Audit Kondisi Awal

Audit read-only awal untuk pekerjaan fitur akun dan card. Fitur aplikasi belum dimodifikasi. Data siswa dan guru diperiksa secara lokal; tidak ada database production yang diakses.

## 1. Stack

- Frontend React 19 + Vite 7.
- Entry HTML `index.html`; halaman dirender oleh satu entry `src/main.jsx`.
- Navigasi menggunakan hash (`#/beranda`, `#/siswa`, `#/guru`, `#/galeri`, `#/video`, `#/komentar`), tanpa router tambahan.
- CSS native modular melalui `css/style.css`; tidak ada library komponen UI yang terpasang.
- Supabase JS dimuat browser dari CDN untuk komentar; konfigurasi URL dan publishable/anon key ada di `js/supabase-config.js`.

## 2. Struktur dan halaman

- `src/main.jsx`: pemetaan halaman hash dan shell aplikasi.
- `src/pages/`: beranda, siswa, guru, galeri, video, dan komentar/ruang diskusi.
- `src/components/`: shell situs, card orang, avatar, dan logika komentar.
- `src/data/class-data.js`: adapter ke `window.XIRPL1_DATA`.
- `js/data.js`: sumber data situs, siswa, guru, jadwal, piket, galeri, dan video.
- `css/`: token, base, shell, komponen, halaman, media, komentar, dan responsive.
- `supabase/comments.sql`: tabel dan kebijakan komentar.
- `scripts/`: runtime dan browser check.
- `vercel.json`: konfigurasi build Vite statis (`dist`); belum ada route API/backend.

## 3. Fitur komentar

- UI utama: `src/pages/CommentsPage.jsx`; data/feed dan kartu komentar: `src/components/Comments.jsx`; SQL: `supabase/comments.sql`.
- Disimpan di Supabase PostgreSQL tabel `public.comments`, dengan kolom `id`, `content`, `parent_id`, dan `created_at`; balasan memakai `parent_id`.
- Supabase Realtime menyiarkan insert. Pembacaan serta penulisan komentar diizinkan anonim dan authenticated; tidak ada identitas akun, rate limit aplikasi, laporan, atau moderasi UI.
- Isi komentar dirender sebagai teks oleh React, bukan sebagai HTML. Form membatasi teks maksimal 500 karakter.
- Penanganan error masih menampilkan sebagian `error.message` mentah dari Supabase kepada pengguna.
- Komentar **tetap berada di Supabase**. Tidak dimigrasikan ke MongoDB dan tidak diubah menjadi chat beridentitas.

## 4. Card siswa dan skema aktual

`src/pages/StudentsPage.jsx` membaca `SISWA` dari `src/data/class-data.js`, yang mengambil sumber `js/data.js`; `src/components/PersonCard.jsx` merender card. Data saat audit memiliki 33 siswa, dengan field:

| Field | Tipe aktual | Tampil/digunakan |
|---|---|---|
| `id` | string | key dan nomor card |
| `nama` | string | nama dan inisial/foto |
| `jabatan` | string | role dan filter pengurus |
| `hobi` | string | metadata card |
| `catatan` | string | metadata card |
| `foto` | string | sumber foto lokal/fallback avatar |
| `portfolio` | string, opsional | tautan eksternal jika URL HTTP(S) lolos pemeriksaan UI |

Tidak ada field `motto` pada record siswa saat audit. Field editable, nama resmi, urutan, dan pengaitan akun ke card harus diputuskan/diuji sebelum migrasi. ID sumber sebaiknya dipertahankan sebagai identifier migrasi.

## 5. Halaman siswa

Halaman melakukan pencarian nama/jabatan dan filter siswa dengan jabatan selain “Siswa”. Jumlah hasil, urutan array, tampilan kosong, dan card tetap berasal dari data statis. Belum ada loading/error API maupun fungsi edit card.

Daftar guru juga masih lokal: 15 record dengan field `id`, `nama`, `mapel`, `foto`, dan `linktree` opsional. Lingkup migrasi akun/card yang dipilih adalah siswa; daftar guru tidak boleh berubah tanpa rencana terpisah.

## 6. Deployment

- `vercel.json` mengatur framework Vite, `npm ci`, build `npm run build`, dan output `dist`.
- Source berisi `vite.config.js` untuk menyalin asset dan data ke build.
- Tidak ada folder/API function sebelum pekerjaan dimulai dan Vercel CLI tidak terpasang pada mesin audit.
- Tidak ditemukan `.env`/`.env.local`; belum ada credential MongoDB yang dikonfigurasi untuk pengembangan. Tidak ada koneksi/database production yang diuji.
- Untuk implementasi, MongoDB Atlas diakses hanya dari Vercel Functions server-side. Preview harus memakai database terpisah dari production.

## 7. Dependency dan audit

Dependency langsung saat audit: `react`, `react-dom`; dev dependency: `jsdom`, `puppeteer`, `vite`. Lockfile `package-lock.json` ter-track.

- `npm audit --omit=dev`: **0 kerentanan** pada dependency production saat audit.
- `npm audit`: **12 temuan** (11 high, 1 moderate), berada dalam dependency pengembangan/browser-test, melalui rantai Puppeteer dan package terkait. Laporan audit menyebut beberapa perbaikan memerlukan perubahan mayor Puppeteer; jangan memakai `npm audit fix --force` tanpa verifikasi kompatibilitas test runner.
- Dependensi dan lockfile tidak diubah dalam audit ini.

## 8. Pemeriksaan keamanan awal

- Pencarian `src/`, `js/`, dan HTML tidak menemukan `dangerouslySetInnerHTML`, manipulasi `innerHTML`/`outerHTML`, `document.write`, `new Function`, atau `eval` pada kode aplikasi. `scripts/runtime-check.js` menjalankan `jsdom` `eval` untuk tes data lokal; bukan kode browser production.
- Publishable/anon key Supabase di `js/supabase-config.js` dikirim ke browser dan memang bersifat publik; bukan service-role key. Akses komentar bergantung pada konfigurasi RLS.
- Pencarian pola secret sebelumnya menemukan kecocokan nama secret/pola audit pada dokumentasi, bukan nilai credential. Pemindaian riwayat Git juga menemukan kecocokan nama pola di `README.md`; ini bukan bukti secret pernah bocor. File lokal `atlas-credentials.env` tidak dibuka atau ditampilkan secara manual; Node memuatnya sebagai environment server pada script dev/database. Keberadaan `MONGODB_URI` dikonfirmasi tanpa menampilkan nilainya, tetapi `MONGODB_DB` dan `MONGODB_ENVIRONMENT` belum tersedia. File dicakup `.gitignore` dan dikecualikan dari watcher browser-test. Database belum dihubungi; jangan commit atau menyalin nilai credential ke chat/log.
- Semua URI eksternal pada data/UI yang ditemukan bersifat statis (font/CDN Supabase, YouTube, Picsum, Linktree, dan portfolio). Tautan `target="_blank"` di card/video memakai `rel="noopener noreferrer"`. Nilai data eksternal tetap perlu validasi sebelum disimpan sebagai input yang dapat diedit pengguna.
- Tidak ada API auth, session, password, role, atau MongoDB saat baseline audit; karena itu belum ada endpoint yang dapat diuji untuk IDOR/CSRF/rate-limit.

## 9. Lokasi data teks pengguna

- Komentar dan balasan: dikirim dari `src/pages/CommentsPage.jsx`, disimpan/dibaca dari Supabase melalui `src/components/Comments.jsx`, ditampilkan di `CommentCard`.
- Teks dari `js/data.js` (nama, jabatan, hobi, catatan, caption, judul/deskripsi video) adalah data proyek, bukan input live dari pengguna.
- Data komentar dirender sebagai teks React. Penanganan pesan error mentah Supabase perlu diperbaiki sebagai bagian hardening yang dipilih.
- Belum ada nama tampilan profil atau data akun pengguna.

## 10. Usulan pemetaan data

**MongoDB `cards`** (siswa saja): `legacyId` dari ID `sXX` yang unik, `slug`, `nama`, `jabatan`, `hobi`, `catatan`, `foto`, `portfolio` (opsional), `sortOrder`, `ownerUserId` (null sampai akun siswa ditautkan oleh proses tepercaya), `isPublished`, `createdAt`, `updatedAt`. Jangan tambahkan `motto` atau `background` yang tidak ada/dilewati tanpa keputusan baru.

**MongoDB `users`**: username ternormalisasi unik, display name, hash password, role (`member`/`student`/`admin`), status akun, referensi card hanya untuk role yang berhak, serta timestamp minimum. **Jangan simpan password plaintext.**

**MongoDB `sessions`**: ID berupa hash SHA-256 token, userId, expiry dan timestamp minimum. Token mentah hanya di cookie HttpOnly.

**Supabase `public.comments`**: tetap seperti schema saat ini, khusus komentar anonim dan balasan. Tidak ada koleksi MongoDB `messages` pada lingkup yang dipilih.

## Status pemeriksaan baseline (sebelum setup backend)

- `npm run check`: lulus (runtime dan browser) sebelum implementasi.
- `npm audit --omit=dev`: 0 temuan.
- `npm audit` penuh: 12 temuan dependency pengembangan (11 high, 1 moderate), menunggu remediasi terverifikasi.
- Vercel CLI dan environment MongoDB belum tersedia; integrasi lokal/serverless terhadap Atlas belum dapat dibuktikan.

## Hasil langkah 01–04 (implementasi lokal; integrasi Atlas belum dijalankan)

- API catch-all `api/[...path].js` memiliki `GET /api/health` minimal; error response tidak memuat stack trace/detail database. JSON body dibatasi 100 KiB dan hanya menerima `application/json`.
- Auth API menyediakan register khusus `member`, login/logout/me, dan change-password; sesi memakai token opaque, hanya hash tersimpan di MongoDB, cookie `HttpOnly`/`SameSite=Lax`, serta `Secure` dan prefix `__Host-` pada production. Request mutasi memeriksa `Origin`/`Referer`, `APP_ORIGIN`, dan `X-Requested-With`; rate limit menyimpan hash key.
- API baca daftar/card terbit dan profil publik/`me` memakai projection serta serializer allowlist. Profil admin tidak dipublikasikan; sesi yang wajib mengganti password ditolak oleh API konten. UI login/daftar/ganti-password, navigasi akun, profil publik/akun sendiri, dan editor card sudah tersedia.
- Fetch mutasi frontend memakai `X-Requested-With: fetch`, same-origin credentials, dan tidak menyimpan state akun ke browser storage. Redirect `next` dibatasi ke path internal.
- CLI lokal menyediakan pembuatan akun admin/student, reset password, dan pengaktifan akun. Setiap operasi mewajibkan nama database eksplisit (`--confirm-db`), konfirmasi interaktif `ya`, dan flag tambahan untuk target production; password sementara hanya dicetak satu kali.
- Local development memakai Vite middleware dengan handler API yang sama. Vercel CLI tidak ditambahkan sebagai dependency karena audit uji menunjukkan dependency tree CLI membawa temuan high/critical; Vercel dapat mengenali function melalui file `api/` tanpa rewrite API khusus.
- Script dev/index/migrasi memuat `atlas-credentials.env` hanya di environment Node server-side; file tetap di-ignore dan tidak masuk bundle. URI tersedia tetapi `MONGODB_DB`/`MONGODB_ENVIRONMENT` belum tersedia. Set `APP_ORIGIN=https://www.rpl42sterida.web.id` di environment Vercel Production; development lokal memakai `http://localhost:3000`.
- Schema collection dan index didefinisikan untuk `users`, `sessions`, `cards`, dan `rate_limits`. `cards` mempertahankan field sumber `nama`, `jabatan`, `hobi`, `catatan`, `foto`, `portfolio`, ID legacy dan urutan; tidak ada `motto`, `background`, atau collection `messages`.
- Migrasi siswa bersifat idempotent dengan `$setOnInsert`; dry-run berhasil memetakan 33 siswa tanpa menulis database. Mode apply memerlukan nama database yang dikonfirmasi dan konfirmasi tambahan untuk target production.
- Tidak ada koneksi Atlas, pembuatan index, migrasi apply, akun nyata, atau perubahan database production. File credential tidak dibuka/ditampilkan; hanya keberadaan variabel URI yang diverifikasi.

## Hasil langkah 05–06 (lokal; database nyata belum diuji)

- `GET /api/cards` hanya menampilkan card terbit yang belum bertuan atau dimiliki akun student/admin aktif. `GET /api/cards/:slug` menerapkan filter pemilik aktif yang sama; `GET/PATCH /api/cards/me` menggunakan `cardId` dari session dan filter ownership di database.
- Field edit card dibatasi ke `hobi`, `catatan`, dan `portfolio` HTTPS. `StudentsPage` kini membaca API dengan loading/error/empty state; editor memakai komponen card yang sama untuk live preview, konfirmasi perubahan belum disimpan, dan placeholder background nonaktif.
- `GET /api/profile/:username` dan alias lama `/api/profiles/:username` menserialisasi profil publik minimum. Profil member hanya berisi informasi dasar; profil admin disembunyikan sebagai 404. `GET /api/profile/me` memakai session. `PATCH /api/profile/me` membatasi perubahan nama tampilan ke student/admin, strict body, pemeriksaan origin/CSRF, dan limit 10/jam.
- Halaman `#/profil/:username` dan alias `#/profil` menyediakan profil publik/akun sendiri, role, tanggal bergabung, serta card siswa yang terbit. Aksi edit nama dan card hanya muncul untuk pemilik yang berhak; member tidak melihat form edit nama maupun tautan edit card. UI menampilkan teks melalui React tanpa HTML mentah.
- Audit keamanan langkah 05 menemukan satu masalah: detail card ber-slug yang diketahui tetap dapat dibaca setelah pemilik dinonaktifkan. Filter slug diperbaiki agar memakai daftar pemilik aktif yang sama dengan endpoint daftar, dan tes endpoint membuktikan card tersebut memberi 404. Tidak ada temuan pada audit profil langkah 06.

| Temuan | Lokasi | Risiko | Perbaikan | Status |
|---|---|---|---|---|
| Slug card milik akun nonaktif masih dapat dibaca | `api/_lib/repos/cards.js` | MEDIUM — informasi card tetap dapat diakses melalui slug langsung setelah akun nonaktif | Filter pemilik aktif diterapkan pada pencarian slug; ditambah tes 404 untuk akun nonaktif | Selesai |

- Tes API memakai database mock dan tidak membuktikan IDOR dua akun nyata; akun uji dan MongoDB target tidak tersedia. Tidak ada koneksi Atlas atau perubahan data yang dilakukan.
- Pemeriksaan profil tidak menemukan kerentanan pada kode yang ditinjau. Keberadaan akun admin/nonaktif, konsistensi relasi card, dan hasil deployment live belum dapat diverifikasi.
- Vercel kini mengatur security headers; CSP masih Report-Only sampai hasil Preview ditinjau. Source map build dinonaktifkan. CI menjalankan check, build, dan audit dependency production; Dependabot memeriksa npm bulanan.
- `DEPLOY-CHECKLIST.md` dan `OPERASIONAL.md` mendokumentasikan environment Preview/Production, moderasi komentar, reset akun, rotasi credential, dan backup/restore. Deploy dan pengujian live tetap menunggu konfigurasi serta persetujuan.
- Validasi terakhir: `npm run check` lulus (42 tes API/schema/auth/session/rate-limit/migrasi/profil/CLI, runtime, dan Puppeteer); `npm run build` lulus; `npm audit --omit=dev` menemukan 0 kerentanan; migrasi dry-run memetakan 33 card dan 0 akun tanpa menulis database. Audit seluruh dependency masih menemukan 5 moderate pada toolchain ESLint/minimatch; perbaikan paksa akan menurunkan ESLint secara breaking dan tidak diterapkan.
