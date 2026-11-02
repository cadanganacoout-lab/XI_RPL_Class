> **ARSIP PROMPT LAMA — IMPLEMENTASIKAN HANYA SESUAI RENCANA BARU.** Akun/sesi memakai MongoDB melalui backend Vercel; bukan Supabase Auth. Ikuti keputusan keamanan dan role pada [`00-ikhtisar-dan-aturan-global.md`](00-ikhtisar-dan-aturan-global.md) dan tahapan pada [`LANGKAH-PENGERJAAN.md`](LANGKAH-PENGERJAAN.md).

# 03 — Autentikasi Backend (Register, Login, Logout, Session)

**Prasyarat:** file 02 selesai dan lolos audit.

**Tujuan:** sistem login yang aman berbasis session cookie, dengan rate limit, perlindungan CSRF, dan script pembuatan akun khusus.

---

## Langkah 3.1 — Fondasi keamanan (middleware)

```text
Implementasikan middleware & utilitas berikut di api/_lib/ (tanpa membuat endpoint dulu):

1. password.js
   - hashPassword(plain): bcryptjs cost 12.
   - verifyPassword(plain, hash).
   - Validasi password: panjang 10-72 BYTE (batas bcrypt; hitung dengan TextEncoder, jangan karakter), tolak password yang sama dengan username, tolak daftar password umum (sertakan daftar ~200 password paling umum di file lokal).
   - verifyPassword WAJIB tetap menjalankan perbandingan hash palsu (dummy hash) ketika user tidak ditemukan agar waktu respons tidak membocorkan keberadaan username.

2. session.js
   - createSession(userId): token = crypto.randomBytes(32) base64url; simpan SHA-256(token) sebagai _id di koleksi sessions; expiresAt = SESSION_TTL_DAYS hari.
   - Cookie: nama `__Host-session`, atribut HttpOnly; Secure; SameSite=Lax; Path=/; TANPA atribut Domain; Max-Age sesuai TTL. (Di localhost/development boleh tanpa prefix __Host- dan tanpa Secure, tapi di production WAJIB.)
   - getSession(req): baca cookie, hash, cari di DB, cek expiresAt dan user.isActive; perbarui lastSeenAt paling sering sekali per jam.
   - destroySession(req) dan destroyAllSessions(userId).

3. security.js
   - requireSameOrigin(req): untuk method POST/PUT/PATCH/DELETE, wajib header Origin (atau Referer) yang sama persis dengan APP_ORIGIN (di dev: origin localhost), DAN header `X-Requested-With: fetch`. Jika tidak, balas 403.
   - Semua endpoint yang mengubah data dilarang menerima GET.
   - Pasang header respons API: Cache-Control: no-store untuk endpoint auth/profil pribadi, X-Content-Type-Options: nosniff.

4. rateLimit.js (berbasis koleksi rate_limits dengan TTL)
   - rateLimit({ keyParts, limit, windowSec }) memakai $inc atomik (upsert). Key = SHA-256 dari gabungan bagian kunci.
   - IP diambil dari header x-forwarded-for/x-real-ip milik Vercel (ambil entri pertama yang valid; jangan percaya header lain buatan client).

5. auth.js
   - requireAuth(req) -> user atau 401.
   - requireRole(req, roles) -> 403 jika role tidak cocok.
   - Identitas HANYA dari session, tidak pernah dari body/query.

6. validators.js (zod .strict()): username, displayName, password. Tolak properti tambahan pada body.
```

---

## Langkah 3.2 — Endpoint autentikasi

```text
Buat route di api/_routes/auth.js:

POST /api/auth/register  (hanya membuat role 'member')
- Body strict: { username, displayName, password }. Role TIDAK boleh bisa diset dari client (properti role harus ditolak oleh skema strict).
- username dinormalisasi lowercase. Jika sudah dipakai -> 409 dengan pesan generik "Username tidak tersedia".
- Rate limit: 5 registrasi/jam per IP.
- Setelah sukses, buat session baru dan kembalikan toPublicUser.

POST /api/auth/login
- Body strict: { username, password }; keduanya WAJIB string.
- Rate limit ganda: (a) 10 percobaan/15 menit per IP, (b) 5 percobaan gagal/15 menit per username. Jika terlampaui -> 429 dengan header Retry-After. Reset penghitung username setelah login sukses.
- Pesan gagal SELALU sama: "Username atau password salah" (baik user tidak ada, password salah, maupun akun nonaktif).
- Saat sukses: hapus session lama milik cookie yang dikirim (cegah session fixation), buat session baru, perbarui lastLoginAt, kembalikan toPublicUser beserta flag mustChangePassword.

POST /api/auth/logout
- Wajib terautentikasi + requireSameOrigin. Hapus session di DB dan hapus cookie (Max-Age=0 dengan atribut sama). Idempoten.

GET /api/auth/me
- Mengembalikan toPublicUser dari session, atau {user:null} jika tidak login (bukan error). Cache-Control: no-store.

POST /api/auth/change-password
- Body strict: { currentPassword, newPassword }. Verifikasi password lama, validasi password baru, simpan hash, set mustChangePassword=false, HAPUS semua session lain milik user lalu buat session baru. Rate limit 5/15 menit per user.

Jika user.mustChangePassword = true, semua endpoint lain (kecuali me, logout, change-password) harus membalas 403 sampai password diganti.
```

---

## Langkah 3.3 — Script admin untuk akun khusus

```text
Buat script CLI di folder scripts/ (dijalankan lokal dengan env dari .env.local, TIDAK dapat diakses lewat web):

1. scripts/create-student.js --username <u> --name <nama> --card <slug>
   - Membuat user role 'student', menautkan ke card dengan slug tersebut (cardId pada user, ownerUserId pada card). Tolak jika card sudah punya pemilik.
   - Membuat password sementara acak 16 karakter (crypto), set mustChangePassword=true, dan mencetaknya SEKALI ke terminal (tidak ke file/log).
2. scripts/create-admin.js --username <u> --name <nama> (password acak, mustChangePassword=true).
3. scripts/reset-password.js --username <u> (password acak baru, mustChangePassword=true, hapus semua session user itu).
4. scripts/set-active.js --username <u> --active true|false (nonaktifkan akun + hapus semua session bila false).
Semua script mendukung --dry-run dan meminta konfirmasi ketik "ya" sebelum menulis.
```

**Kriteria selesai:** register/login/logout/me/change-password berfungsi lewat tes `curl`/Postman; cookie ber-atribut benar; script bisa membuat akun student.

---

## Audit Keamanan — Langkah 03 (WAJIB)

```text
Audit keamanan langkah 03 dan laporkan dalam tabel (Temuan | Lokasi | Risiko | Perbaikan | Status). Buktikan dengan pengujian nyata (curl/script), bukan hanya membaca kode:

1. Brute force: kirim 20 login salah berturut-turut ke satu username dan ke satu IP; pastikan 429 muncul dan Retry-After ada. Pastikan limit tidak bisa dihindari dengan mengubah huruf besar/kecil username atau menambah spasi.
2. User enumeration: bandingkan isi respons DAN waktu respons untuk (a) username tidak ada, (b) password salah, (c) akun nonaktif. Harus identik secara praktis.
3. Mass assignment: kirim register dengan {"role":"admin"}, {"cardId":"..."}, {"isActive":true}; pastikan ditolak.
4. NoSQL injection di login: kirim {"username":{"$ne":null},"password":{"$ne":null}}; pastikan ditolak 400.
5. Cookie: verifikasi atribut HttpOnly, Secure, SameSite, Path=/, tanpa Domain, prefix __Host- di production. Pastikan token tidak ada di body respons maupun localStorage.
6. Session: verifikasi token mentah tidak tersimpan di DB; logout benar-benar menghapus session (cookie lama tidak bisa dipakai lagi); login membuat session baru; change-password mematikan session lain.
7. CSRF: kirim POST /logout dan /change-password dari Origin berbeda dan tanpa header X-Requested-With; pastikan 403.
8. Bypass role: panggil endpoint yang memerlukan auth tanpa cookie (401) dan dengan role salah (403).
9. Password: uji password 5 karakter, 73+ byte, sama dengan username, dan password umum; semuanya ditolak. Pastikan bcrypt tidak memotong diam-diam.
10. Log: pastikan tidak ada password, token, atau cookie yang tercetak di log/error.
11. mustChangePassword: pastikan endpoint lain terkunci sampai password diganti.
12. Script admin: pastikan password sementara tidak tertulis ke file atau riwayat shell yang ter-commit.
```

**Checklist manual:**
- [ ] 20 login gagal → diblokir 429
- [ ] Cookie atribut lengkap (cek DevTools → Application → Cookies)
- [ ] CSRF dari origin lain ditolak
- [ ] Tidak bisa mendaftar sebagai admin/student lewat API
