> **ARSIP PROMPT LAMA — IMPLEMENTASIKAN HANYA SESUAI RENCANA BARU.** Profil membaca data MongoDB lewat API; fitur background/upload dilewati. Ikuti [`LANGKAH-PENGERJAAN.md`](LANGKAH-PENGERJAAN.md).

# 06 — Halaman Profil Baru

**Prasyarat:** file 05 selesai dan lolos audit.

**Tujuan:** halaman profil dengan UI/UX yang mengambil gaya dari card siswa, dipakai oleh **student** (isi lengkap) dan **member** (info dasar, UI sama), tanpa membocorkan data pribadi.

---

## Langkah 6.1 — API profil

```text
Buat api/_routes/profile.js:

GET /api/profile/:username   (publik)
- username divalidasi regex ^[a-z0-9_]{3,20}$.
- Mengembalikan HANYA field publik:
  * semua role: username, displayName, role (untuk badge), joinedAt (createdAt);
  * student/admin: ditambah toPublicCard dari card miliknya (jika isPublished).
- Tidak pernah mengembalikan: passwordHash, mustChangePassword, isActive, lastLoginAt, userAgent, session, _id user.
- Akun nonaktif atau tidak ada -> 404 generik (sama bentuk).

PATCH /api/profile/me   (login, requireSameOrigin)
- Body strict: { displayName } (1-40 karakter, trim, tanpa karakter kontrol). Untuk member ini satu-satunya info yang bisa diedit selain password. Perubahan displayName tidak mengubah username.
- Rate limit 10/jam per user.
- (Opsional) Perbarui authorName pada pesan chat baru ikut displayName baru; pesan lama tetap snapshot.
```

---

## Langkah 6.2 — UI halaman profil

```text
Buat halaman baru:

1. Route /profil/:username (publik) dan /profil (alias ke profil saya, RequireAuth).
2. Desain: gunakan ulang komponen/gaya card yang sudah ada (tipografi, warna, radius, bayangan, efek hover) sebagai header profil agar konsisten. Layout:
   - Header besar bergaya card: avatar/inisial, displayName, @username, badge role ("Siswa RPL 42" untuk student, "Anggota" untuk member).
   - Untuk student/admin: seluruh isi card ditampilkan lebih besar (bio, quote, sosmed, dll.) dan, bila ada, background card (file 08) sebagai latar header.
   - Untuk member: bagian info dasar saja (nama tampilan, tanggal bergabung) dengan gaya yang sama, tanpa bagian card.
   - Responsif mobile-first, skeleton loading, dan halaman 404 yang ramah jika profil tidak ditemukan.
3. Jika yang melihat adalah pemilik profil: tampilkan tombol "Edit Nama Tampilan", "Ganti Password" (ke /ganti-password), "Keluar", dan untuk student tombol "Edit Card" (ke /card-saya).
4. Member TIDAK ditampilkan di halaman "Siswa" (pastikan query GET /api/cards tidak pernah menyertakan mereka).
5. Di chat (file 07) nama pengirim akan menaut ke /profil/:username.
6. Jangan menampilkan atau menyimpan email, nomor HP, atau data pribadi lain.
```

**Kriteria selesai:** profil student tampil lengkap bergaya card; profil member tampil sederhana dengan UI yang konsisten; pemilik melihat tombol aksi, orang lain tidak.

---

## Audit Keamanan — Langkah 06 (WAJIB)

```text
Audit keamanan langkah 06 dan laporkan dalam tabel (Temuan | Lokasi | Risiko | Perbaikan | Status):

1. Kebocoran data: panggil GET /api/profile/<username> untuk student, member, admin, dan akun nonaktif; periksa JSON mentah, pastikan tidak ada passwordHash, _id user, lastLoginAt, isActive, mustChangePassword, atau field internal.
2. Enumerasi: bandingkan respons username tidak ada vs akun nonaktif -> identik (404 generik).
3. Otorisasi: PATCH /api/profile/me tanpa login (401); coba kirim { username, role, cardId } di body -> ditolak.
4. XSS: displayName berisi HTML/script tampil sebagai teks di profil, navbar, dan chat.
5. Pastikan tombol aksi pemilik hanya soal UX dan semua aksi tetap dicek di server.
6. Pastikan member tidak muncul di GET /api/cards maupun halaman Siswa.
7. Pastikan background (bila ada) hanya ditampilkan jika URL-nya berasal dari host Supabase proyek (cek di komponen: parse URL dan bandingkan hostname dengan konfigurasi yang diterima dari API, bukan dari input bebas).
8. Pastikan tidak ada data pribadi baru yang disimpan tanpa kebutuhan jelas (data minimization).
9. Periksa aksesibilitas dasar yang berdampak keamanan/penyalahgunaan: link eksternal memakai rel="noopener noreferrer".
```

**Checklist manual:**
- [ ] JSON respons profil bersih dari field internal
- [ ] Member tidak muncul di halaman Siswa
- [ ] Tombol edit hanya muncul pada profil sendiri
