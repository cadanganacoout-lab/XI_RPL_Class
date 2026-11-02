> **ARSIP PROMPT LAMA — IMPLEMENTASIKAN HANYA SESUAI RENCANA BARU.** Frontend auth harus memakai API Vercel dan cookie session HttpOnly; Supabase Auth tidak digunakan. Ikuti [`LANGKAH-PENGERJAAN.md`](LANGKAH-PENGERJAAN.md).

# 04 — Autentikasi Frontend (React)

**Prasyarat:** file 03 selesai dan lolos audit.

**Tujuan:** UI login/register/logout, state auth global, route guard, dan integrasi navbar tanpa merusak tampilan lama.

---

## Langkah 4.1 — Fondasi frontend

```text
Di frontend React (ikuti gaya kode & CSS yang sudah ada di AUDIT.md), buat:

1. src/lib/api.js: wrapper fetch dengan aturan:
   - Hanya memanggil path relatif "/api/..." (same-origin), credentials: 'same-origin'.
   - Untuk method selain GET sertakan header 'X-Requested-With': 'fetch' dan 'Content-Type': 'application/json'.
   - Menangani 401 (reset state auth), 403, 429 (tampilkan pesan "terlalu banyak percobaan, coba lagi nanti"), dan error jaringan.
   - JANGAN menyimpan token/user apa pun di localStorage/sessionStorage.

2. src/context/AuthContext.jsx: state { user, loading }. Saat aplikasi mulai, panggil GET /api/auth/me. Sediakan login(), register(), logout(), refresh(). Setelah logout/401, kosongkan state dan cache data privat di memori.

3. Komponen RequireAuth dan RequireRole untuk route guard. CATATAN di komentar kode: guard ini hanya untuk UX; penegakan keamanan sebenarnya ada di server.

4. Halaman /login dan /daftar:
   - Form dengan label jelas, autocomplete yang benar (username, current-password, new-password), tombol disable saat loading.
   - Validasi sisi client hanya untuk UX (panjang/format), server tetap penentu.
   - Pesan error generik dari server ditampilkan apa adanya (jangan membedakan sebab).
   - Parameter redirect `?next=` HANYA boleh path internal yang diawali "/" dan bukan "//" atau skema lain (cegah open redirect); jika tidak valid, arahkan ke "/".

5. Halaman /ganti-password: dipaksa muncul jika user.mustChangePassword = true (semua route lain dialihkan ke sini sampai selesai).

6. Navbar: jika belum login tampilkan tombol "Masuk"/"Daftar"; jika sudah login tampilkan nama/avatar kecil dengan menu: "Profil Saya", "Keluar". Pertahankan desain navbar yang ada, tambahkan sewajarnya (responsif di mobile).

7. Pastikan seluruh teks dari user dirender sebagai teks biasa oleh React. Dilarang memakai dangerouslySetInnerHTML.
```

**Kriteria selesai:** bisa daftar sebagai member, login, logout; refresh halaman tetap login; user dengan mustChangePassword dipaksa ganti password; tampilan situs lama tidak rusak.

---

## Audit Keamanan — Langkah 04 (WAJIB)

```text
Audit keamanan langkah 04 dan laporkan dalam tabel (Temuan | Lokasi | Risiko | Perbaikan | Status):

1. Telusuri seluruh src/ untuk dangerouslySetInnerHTML, innerHTML, eval, new Function, document.write; semuanya harus tidak ada kecuali sudah ada sebelumnya dan terbukti aman (laporkan).
2. Pastikan tidak ada token/session/data user disimpan di localStorage, sessionStorage, atau cookie yang bisa dibaca JS.
3. Build produksi (`npm run build`) lalu cari di folder hasil build string: "mongodb", "service_role", "SUPABASE_SERVICE", "passwordHash"; tidak boleh ada.
4. Uji open redirect: buka /login?next=https://evil.com, /login?next=//evil.com, /login?next=javascript:alert(1); semuanya harus berakhir di "/".
5. Uji XSS pada displayName: daftar dengan displayName `<img src=x onerror=alert(1)>` (jika lolos validasi) dan pastikan tampil sebagai teks di navbar/profil, tidak mengeksekusi script.
6. Pastikan route guard tidak dianggap sebagai pengaman: panggil API privat langsung (tanpa UI) dan pastikan server tetap menolak.
7. Pastikan pesan error login tidak membedakan sebab kegagalan.
8. Pastikan link eksternal (jika ada) memakai rel="noopener noreferrer".
9. Periksa form: autocomplete benar, tidak ada password tercetak ke console.log.
10. npm audit untuk dependency frontend baru.
```

**Checklist manual:**
- [ ] DevTools → Application → Storage: tidak ada data sensitif
- [ ] `?next=` eksternal tidak bisa dipakai redirect
- [ ] Bundle produksi bersih dari secret
