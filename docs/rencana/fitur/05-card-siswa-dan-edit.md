> **ARSIP PROMPT LAMA — IMPLEMENTASIKAN HANYA SESUAI RENCANA BARU.** Card memang direncanakan di MongoDB; verifikasi field sumber dan ikuti ketentuan ownership/role pada [`LANGKAH-PENGERJAAN.md`](LANGKAH-PENGERJAAN.md).

# 05 — Card Siswa dari Database & Edit Card Sendiri

**Prasyarat:** file 04 selesai dan lolos audit. Minimal satu akun `student` sudah dibuat lewat script (file 03) untuk pengujian, ditambah satu akun `member` dan satu akun `student` lain untuk uji IDOR.

**Tujuan:** halaman "Siswa" membaca card dari database, dan siswa yang login bisa mengedit **hanya card miliknya sendiri**.

---

## Langkah 5.1 — API card

```text
Buat api/_routes/cards.js dengan endpoint:

GET /api/cards   (publik)
- Mengembalikan daftar card yang isPublished=true DAN yang pemiliknya berrole student/admin atau yang belum punya pemilik (card legacy). Urutan sesuai urutan tampil di halaman Siswa saat ini.
- Hanya field publik hasil toPublicCard (projection allowlist). Dilarang mengembalikan ownerUserId, passwordHash, atau data user.
- Cache-Control: public, max-age=30, stale-while-revalidate=60.

GET /api/cards/:slug   (publik)
- slug divalidasi regex ^[a-z0-9-]{1,60}$. Jika tidak ditemukan/tidak dipublikasikan -> 404 generik.

GET /api/cards/me   (login, role student/admin)
- Mengembalikan card milik user, ditentukan dari user.cardId di session — BUKAN dari parameter apa pun.

PATCH /api/cards/me   (login, role student/admin, requireSameOrigin)
- Body skema zod .strict() dengan allowlist field yang boleh diedit, sesuai daftar field card di AUDIT.md. Contoh aturan (sesuaikan dengan field nyata):
  * teks pendek (nama panggilan, julukan): trim, 1-40 karakter, tanpa karakter kontrol;
  * teks panjang (bio, quote): maks 300 karakter;
  * URL sosial media (Instagram/GitHub/dll.): hanya skema https, hostname harus ada di allowlist domain resmi platform tersebut, panjang maks 200;
  * field yang TIDAK boleh diubah lewat endpoint ini: _id, slug, ownerUserId, isPublished, background (diatur di file 08), createdAt.
- Pembaruan memakai filter { _id: user.cardId, ownerUserId: user._id } agar tetap aman walaupun ada bug lain.
- Set updatedAt di server. Kembalikan toPublicCard terbaru.
- Rate limit 30 perubahan/jam per user.

Pastikan tidak ada endpoint lain yang bisa mengubah card orang lain. Tidak ada endpoint DELETE card pada tahap ini.
```

---

## Langkah 5.2 — UI

```text
1. Ubah halaman "Siswa" agar mengambil data dari GET /api/cards (dengan state loading, error, dan kosong). Tampilan card TIDAK boleh berubah dari desain yang sekarang.
2. Buat halaman /card-saya (RequireRole student/admin):
   - Form edit berisi field-field yang boleh diedit, dengan batas karakter dan penghitung sisa karakter.
   - Pratinjau langsung (live preview) memakai komponen card yang sama dengan halaman Siswa.
   - Tombol Simpan (disabled bila tidak ada perubahan), notifikasi sukses/gagal, peringatan jika keluar halaman dengan perubahan belum tersimpan.
   - Tombol "Ganti Background" disiapkan sebagai placeholder yang dinonaktifkan (akan diaktifkan di file 08).
3. Tambahkan menu "Edit Card" di navbar hanya untuk student/admin.
4. Semua teks card dirender sebagai teks biasa. Link sosial media dirender dengan rel="noopener noreferrer nofollow" dan target="_blank", dan hanya jika URL lolos validasi https.
```

**Kriteria selesai:** siswa A bisa mengedit card A; hasilnya muncul di halaman Siswa; member tidak bisa membuka `/card-saya`.

---

## Audit Keamanan — Langkah 05 (WAJIB)

```text
Audit keamanan langkah 05 dan laporkan dalam tabel (Temuan | Lokasi | Risiko | Perbaikan | Status). Buktikan dengan pengujian nyata:

1. IDOR: login sebagai siswa A, kirim PATCH /api/cards/me sambil menyisipkan { "_id": <id card B>, "ownerUserId": <id B>, "slug": "..." } di body dan sebagai query; pastikan ditolak (400) atau diabaikan dan card B tidak berubah. Coba juga memanggil /api/cards/<slug B> dengan metode PATCH/PUT/DELETE -> harus 404/405.
2. Otorisasi: PATCH /api/cards/me tanpa login (401), sebagai member (403).
3. Mass assignment: kirim field terlarang (isPublished, ownerUserId, slug, background, role) -> ditolak.
4. Stored XSS: simpan bio berisi `<script>alert(1)</script>`, `<img onerror>`, dan `javascript:alert(1)` pada field URL; pastikan tampil sebagai teks dan URL berbahaya ditolak server.
5. Validasi URL sosmed: coba `http://`, `//evil.com`, `https://evil.com` pada kolom Instagram, `https://instagram.com.evil.com`; semuanya ditolak (cek hostname dengan parsing URL yang benar, bukan startsWith).
6. NoSQL injection pada :slug dan body.
7. Data berlebih: periksa respons GET /api/cards tidak mengandung ownerUserId, passwordHash, role, atau field internal lain.
8. Batas ukuran: kirim body > 100KB dan string sangat panjang -> ditolak.
9. Rate limit PATCH bekerja.
10. Pastikan caching publik tidak pernah dipakai untuk /api/cards/me (harus no-store).
```

**Checklist manual:**
- [ ] Siswa A tidak bisa mengubah card siswa B (uji dengan 2 akun)
- [ ] Member tidak bisa mengakses halaman/API edit card
- [ ] Respons publik tidak berisi data internal
