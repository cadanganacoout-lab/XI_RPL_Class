> **ARSIP PROMPT LAMA — IKUTI RENCANA BARU.** Vercel Functions/MongoDB sekarang menjadi arsitektur terpilih, tetapi beberapa checklist lama mengasumsikan Supabase untuk layanan selain komentar. Ikuti [`00-ikhtisar-dan-aturan-global.md`](00-ikhtisar-dan-aturan-global.md) dan [`LANGKAH-PENGERJAAN.md`](LANGKAH-PENGERJAAN.md).

# 09 — Hardening, Deploy ke Vercel & Uji Keamanan Menyeluruh

**Prasyarat:** file 01–08 selesai dan semuanya lolos audit masing-masing.

**Tujuan:** menambahkan header keamanan, memastikan konfigurasi produksi aman, deploy ke Vercel, lalu melakukan uji keamanan menyeluruh sebelum dibuka ke teman-teman.

---

## Langkah 9.1 — Header keamanan & konfigurasi

```text
Perbarui vercel.json dan konfigurasi terkait:

1. Tambahkan header untuk semua route (lewat "headers" di vercel.json):
   - Content-Security-Policy yang ketat, disesuaikan dengan aset nyata proyek: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' (hanya jika benar-benar diperlukan oleh library UI; jelaskan alasannya); img-src 'self' data: https://<project-ref>.supabase.co; font-src 'self' (tambah host font yang dipakai jika ada); connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests.
     Mulai dengan mode Content-Security-Policy-Report-Only untuk melihat pelanggaran, perbaiki, lalu aktifkan mode enforce.
   - Strict-Transport-Security: max-age=63072000; includeSubDomains (tambahkan preload hanya jika semua subdomain sudah HTTPS dan kamu paham dampaknya).
   - X-Content-Type-Options: nosniff
   - Referrer-Policy: strict-origin-when-cross-origin
   - Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
   - Cross-Origin-Opener-Policy: same-origin
   - X-Frame-Options: DENY (cadangan untuk frame-ancestors)
2. Pastikan semua respons /api/* yang bersifat privat memakai Cache-Control: no-store.
3. Pastikan environment production memakai cookie `__Host-session` dengan Secure, dan environment development tidak bocor ke production (cek NODE_ENV/VERCEL_ENV).
4. Pastikan source map produksi dinonaktifkan atau tidak dipublikasikan.
5. Tambahkan GitHub Dependabot (atau Renovate) untuk update dependency, dan workflow CI sederhana yang menjalankan `npm audit --omit=dev` serta lint pada setiap pull request.
6. Pastikan error handler global di API tidak pernah mengirim stack trace dan mencatat error ke log Vercel tanpa data sensitif (password, token, cookie, isi pesan penuh).
7. (Direkomendasikan) Tambahkan Cloudflare Turnstile pada form /daftar dan verifikasi tokennya di server sebelum membuat akun, untuk mencegah bot. Secret key Turnstile disimpan di env server.
8. Tulis file DEPLOY-CHECKLIST.md berisi daftar env var yang harus diisi di Vercel beserta lingkungannya (Production/Preview), dan catat bahwa Preview deployment TIDAK boleh memakai database/bucket production (gunakan database & bucket terpisah).
```

---

## Langkah 9.2 — Deploy

Kerjakan sendiri (manual):

1. Di dashboard Vercel: **Settings → Environment Variables** → isi semua variabel dari file 00 untuk *Production*. Gunakan database dan bucket **terpisah** untuk *Preview*.
2. Pastikan domain `rpl42sterida.web.id` mengarah ke project Vercel dan HTTPS aktif.
3. Jalankan `scripts/create-indexes.js` terhadap database production.
4. Buat akun admin dengan `scripts/create-admin.js`, lalu akun siswa dengan `scripts/create-student.js`. Berikan password sementara ke tiap teman **lewat kanal pribadi** (bukan grup publik) dan minta mereka segera menggantinya.
5. Deploy ke Preview dulu, uji, baru promote ke Production.

---

## Langkah 9.3 — Uji keamanan menyeluruh (penetration test mandiri)

```text
Lakukan uji keamanan menyeluruh terhadap deployment Preview, lalu buat file SECURITY-REPORT.md berisi hasil per kategori (Lulus/Gagal/Catatan) dan bukti singkat. Kategori:

A. Autentikasi & Session
   - Brute force login & register (429 muncul), user enumeration (respons & waktu), session fixation, logout mencabut session, session kedaluwarsa ditolak, cookie atribut lengkap, password policy, paksa ganti password.
B. Otorisasi (matriks peran)
   - Buat tabel endpoint x peran (anonim, member, student A, student B, admin) dan uji SETIAP sel: yang diizinkan berhasil, yang tidak diizinkan ditolak. Fokus IDOR pada cards, background, messages, profile.
C. Injeksi
   - NoSQL injection di semua parameter (body, query, params, header), XSS tersimpan/pantulan/DOM pada card, profil, displayName, chat; HTML injection; header injection pada cookie/redirect.
D. CSRF & Origin
   - Semua endpoint mutasi dari origin lain, tanpa header X-Requested-With, dan lewat form HTML dari situs lain -> ditolak.
E. Upload
   - Seluruh uji berkas berbahaya di file 08; periksa tidak ada file yatim di bucket.
F. Konfigurasi
   - Periksa header respons (securityheaders.com atau curl -I), CSP tanpa pelanggaran di konsol, tidak ada secret di bundle/source map, tidak ada endpoint debug, /api/health tidak membocorkan info, HTTP -> HTTPS redirect, error 404/500 generik.
G. Ketersediaan
   - Uji payload besar, parameter ekstrem, dan lonjakan request ke endpoint publik (GET /api/messages, /api/cards); pastikan rate limit/limit query melindungi database.
H. Rantai pasok
   - npm audit, lockfile terkunci, tidak ada paket mencurigakan/typosquatting, GitHub secret scanning & Dependabot aktif.
I. Privasi
   - Pastikan hanya data minimal yang disimpan dan dibuka ke publik; tidak ada data sensitif di log.

Untuk setiap temuan: tingkat risiko (Kritis/Tinggi/Sedang/Rendah), langkah reproduksi, dan perbaikan. Perbaiki semua temuan Kritis/Tinggi sekarang juga, lalu ulangi pengujian kategori terkait dan perbarui laporan.
```

---

## Langkah 9.4 — Operasional setelah rilis (catat & siapkan)

```text
Buat file OPERASIONAL.md berisi prosedur singkat:
1. Menonaktifkan akun bermasalah (scripts/set-active.js) dan menghapus pesan abusif.
2. Reset password teman yang lupa (scripts/reset-password.js).
3. Rotasi secret jika dicurigai bocor: MONGODB_URI (ganti password DB user), SUPABASE_SERVICE_ROLE_KEY, lalu redeploy; setelah rotasi, hapus semua session (kosongkan koleksi sessions) agar semua pengguna login ulang.
4. Cara memulihkan data dari backup Atlas.
5. Jadwal rutin: cek Dependabot/npm audit tiap bulan, tinjau log error Vercel, cek kuota Supabase & MongoDB.
6. Daftar kontak/aturan jika ada penyalahgunaan (mis. siapa yang berhak menjadi admin).
```

---

## Audit Keamanan — Langkah 09 / Final (WAJIB)

```text
Audit akhir. Verifikasi dan laporkan (Temuan | Lokasi | Risiko | Perbaikan | Status):

1. Header: jalankan `curl -I https://rpl42sterida.web.id` dan `curl -I https://rpl42sterida.web.id/api/auth/me`; semua header di Langkah 9.1 hadir. CSP dalam mode enforce dan tidak ada pelanggaran pada penggunaan normal (login, chat, edit card, upload).
2. Secret: pindai ulang repo + riwayat git + bundle produksi + source map untuk secret. Pastikan Preview dan Production memakai kredensial terpisah.
3. Konfigurasi Vercel: tidak ada env sensitif bertanda "Exposed to browser"; Preview deployment tidak bisa menulis ke database production.
4. Verifikasi ulang SELURUH audit file 01–08 pada deployment nyata (bukan hanya lokal), terutama: rate limit login/chat/upload, IDOR card/background/pesan, XSS chat/profil, CSRF, upload berbahaya.
5. Pastikan akun admin memakai password kuat unik, dan tidak ada akun uji/default tersisa di production.
6. Pastikan backup, Dependabot, dan secret scanning aktif.
7. Rangkum: daftar risiko tersisa (diterima/ditunda) beserta alasannya, dan rekomendasi peningkatan berikutnya (mis. verifikasi email, 2FA untuk admin, moderasi otomatis chat, WebSocket/Supabase Realtime bila skala membesar).
```

**Checklist rilis akhir:**
- [ ] `SECURITY-REPORT.md` tidak punya temuan Kritis/Tinggi terbuka
- [ ] CSP mode enforce, HSTS aktif
- [ ] Preview & Production memakai DB/bucket terpisah
- [ ] Password sementara teman dibagikan lewat kanal pribadi
- [ ] `OPERASIONAL.md` dan `DEPLOY-CHECKLIST.md` ada
