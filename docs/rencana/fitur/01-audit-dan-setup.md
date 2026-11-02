> **ARSIP PROMPT LAMA — JANGAN JALANKAN LANGKAH DI BAWAH.** Sebagian isi mengasumsikan penyimpanan komentar di MongoDB. Supabase tetap khusus komentar. Ikuti [`00-ikhtisar-dan-aturan-global.md`](00-ikhtisar-dan-aturan-global.md) dan [`LANGKAH-PENGERJAAN.md`](LANGKAH-PENGERJAAN.md).

# 01 — Audit Kode yang Ada & Setup Dasar

**Prasyarat:** sudah membaca `00-ikhtisar-dan-aturan-global.md`. Repo website sudah di-clone di lokal dan di-backup (commit/branch baru, mis. `feat/auth-chat-profile`).

**Tujuan:** memahami struktur website sekarang (komentar, card, halaman Siswa) sebelum mengubah apa pun, lalu menyiapkan kerangka backend serverless dan tooling keamanan.

---

## Langkah 1.1 — Audit kode (JANGAN ubah kode dulu)

```text
[Tempel Konteks Global dari file 00 terlebih dahulu]

Tugas: lakukan audit read-only terhadap repo ini dan buat file AUDIT.md di root berisi:

1. Stack frontend: bundler (Vite/CRA/lainnya), versi React, router yang dipakai, library UI/CSS.
2. Struktur folder penting dan daftar route/halaman yang ada.
3. Fitur komentar saat ini: komponen apa saja, data disimpan di mana (hardcode / API pihak ketiga / localStorage / database), field pesan, apakah ada moderasi, apakah mengizinkan anonim.
4. Komponen "card" siswa: lokasi file, SEMUA field yang tampil di card (nama, foto, quote, sosmed, dll.) beserta tipe datanya, dan bagaimana datanya dimuat (hardcode/JSON/API).
5. Halaman "Siswa": bagaimana daftar card dirender.
6. Cara deploy saat ini (hosting apa, apakah sudah di Vercel, ada vercel.json atau tidak).
7. Daftar dependency dan hasil `npm audit`.
8. Temuan keamanan awal pada kode yang sudah ada: penggunaan dangerouslySetInnerHTML, innerHTML, eval, secret/API key yang ter-hardcode, URL eksternal tidak tepercaya, dsb.
9. Daftar semua tempat yang menampilkan input pengguna (agar kita tahu titik risiko XSS).
10. Rencana pemetaan: field card -> field di koleksi MongoDB `cards` (usulan), dan field komentar -> koleksi `messages`.

Jangan memodifikasi file apa pun selain membuat AUDIT.md.
```

**Kriteria selesai:** `AUDIT.md` ada dan **kamu baca sendiri**. Periksa terutama daftar field card (poin 4) dan apakah ada secret yang bocor (poin 8). Gunakan hasil ini sebagai acuan di file 02, 05, dan 07.

---

## Langkah 1.2 — Setup kerangka backend & tooling

```text
Berdasarkan AUDIT.md, lakukan setup berikut tanpa mengubah tampilan yang sudah ada:

1. Buat folder /api dengan satu catch-all handler `api/[...path].js` dan router internal sederhana (tanpa framework besar). Buat struktur:
   - api/_lib/db.js        (koneksi MongoDB ter-cache untuk serverless; dibuat di file 02)
   - api/_lib/env.js       (membaca & memvalidasi env wajib dengan zod; aplikasi gagal start dengan pesan jelas jika ada yang kosong; JANGAN mencetak nilai secret)
   - api/_lib/http.js      (helper response JSON, error handler generik, pembatas ukuran body 100KB default, parsing JSON aman)
   - api/_lib/security.js  (cek Origin/Referer + header X-Requested-With untuk request yang mengubah data, dibuat lengkap di file 03)
   - api/_routes/          (satu file per kelompok endpoint: auth, cards, messages, profile, uploads)
2. Install dependency backend: mongodb, zod, bcryptjs, busboy atau formidable (untuk upload di file 08), sharp (file 08), @supabase/supabase-js (file 08). Gunakan versi stabil terbaru dan jangan tambah paket lain tanpa alasan.
3. Buat `.env.example` berisi nama variabel dari file 00 TANPA nilai asli. Pastikan `.env`, `.env.local`, `.env*.local`, `.vercel` masuk ke `.gitignore`.
4. Buat `vercel.json` minimal: rewrites agar semua `/api/*` ke handler, dan SPA fallback untuk route React. (Header keamanan akan ditambahkan di file 09.)
5. Tambahkan script npm: "dev": jalankan frontend dan backend lokal (vercel dev), "audit": `npm audit --omit=dev`, "lint".
6. Tambahkan file `SECURITY.md` singkat berisi aturan global dari file 00 sebagai pengingat kontributor.
7. Buat endpoint uji `GET /api/health` yang hanya mengembalikan {ok:true} (tanpa info versi/stack/env).
```

**Kriteria selesai:** `vercel dev` berjalan, `/api/health` merespons, tampilan website lama tidak berubah, `.env.example` ada, tidak ada secret di repo.

---

## Audit Keamanan — Langkah 01 (WAJIB)

```text
Lakukan audit keamanan untuk langkah 01 dan laporkan dalam tabel (Temuan | Lokasi | Risiko | Perbaikan | Status):

1. Pindai seluruh repo DAN riwayat git untuk secret yang pernah ter-commit (API key, URI database, token). Gunakan gitleaks atau trufflehog jika bisa dijalankan; jika tidak, cari manual pola umum (mongodb+srv://, service_role, sk_, eyJ...). Jika ada secret pernah ter-commit, tulis langkah rotasi secret tersebut.
2. Pastikan .gitignore melindungi semua file .env dan folder .vercel.
3. Jalankan `npm audit --omit=dev`; laporkan kerentanan high/critical dan perbaiki dengan upgrade yang aman.
4. Pastikan tidak ada variabel env sensitif dengan prefix yang terekspos ke browser (VITE_, REACT_APP_, NEXT_PUBLIC_).
5. Pastikan /api/health tidak membocorkan informasi (versi, env, stack trace).
6. Pastikan pembatas ukuran body aktif dan error handler tidak mengirim stack trace ke client.
7. Cek lockfile (package-lock.json) ter-commit dan tidak ada dependency dari sumber tidak jelas (git URL, tarball).
8. Rangkum risiko yang tersisa sebelum lanjut ke langkah 02.
```

**Checklist manual:**
- [ ] Tidak ada secret di repo maupun riwayat git (atau sudah dirotasi)
- [ ] `npm audit` tanpa high/critical
- [ ] `.env` tidak ikut ter-commit
- [ ] Website lama masih tampil normal
