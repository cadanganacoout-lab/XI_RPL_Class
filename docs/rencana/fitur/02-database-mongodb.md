> **ARSIP PROMPT LAMA — JANGAN JALANKAN LANGKAH DI BAWAH TANPA MENYESUAIKANNYA.** MongoDB sekarang memang direncanakan untuk akun dan card, tetapi prompt migrasi ini juga mencampur data komentar. Komentar tetap di Supabase. Ikuti schema/lingkup pada [`LANGKAH-PENGERJAAN.md`](LANGKAH-PENGERJAAN.md).

# 02 — Database MongoDB: Skema, Index, Koneksi, Migrasi

**Prasyarat:** file 01 selesai dan lolos audit. Sudah punya cluster MongoDB Atlas.

**Tujuan:** menyiapkan koneksi aman, skema koleksi, index, dan memindahkan data card & komentar lama ke database.

---

## Langkah 2.0 — Persiapan manual di MongoDB Atlas (kerjakan sendiri)

1. Buat **database user khusus aplikasi** (bukan akun admin Atlas) dengan peran `readWrite` **hanya** pada database proyek ini.
2. Password user database harus acak & panjang (generate, simpan di Vercel/`.env.local`).
3. **Network Access:** Vercel memakai IP dinamis sehingga umumnya perlu `0.0.0.0/0`. Karena itu, perlindungan utamanya adalah: password DB kuat, user DB berhak minimal, dan URI tidak pernah bocor. (Alternatif: integrasi MongoDB Atlas dari Vercel Marketplace / fitur IP tetap berbayar jika diperlukan.)
4. Aktifkan backup (snapshot) jika tersedia di tier yang dipakai.

---

## Langkah 2.1 — Koneksi & skema

```text
Implementasikan lapisan database sesuai keputusan di file 00.

1. api/_lib/db.js: koneksi MongoClient yang di-cache di variabel global (pola serverless), dengan opsi: maxPoolSize kecil (mis. 5), serverSelectionTimeoutMS 5000, tls default. Ekspor fungsi getDb(). Jangan log URI.

2. Definisikan koleksi dan validasi (gunakan zod di aplikasi, dan JSON Schema validator di MongoDB bila memungkinkan):

   users:
   - _id, username (huruf kecil, unik, regex ^[a-z0-9_]{3,20}$), displayName (1-40 karakter),
   - passwordHash, role: 'member' | 'student' | 'admin',
   - cardId: ObjectId | null (hanya terisi untuk student/admin),
   - mustChangePassword: boolean, isActive: boolean,
   - createdAt, updatedAt, lastLoginAt.
   (Tidak ada email pada tahap ini. Reset password dilakukan admin lewat script.)

   sessions:
   - _id = SHA-256 dari token session (token mentah hanya ada di cookie, TIDAK PERNAH disimpan),
   - userId, createdAt, expiresAt, lastSeenAt, userAgent (dipotong 200 karakter).

   cards:
   - _id, ownerUserId (ObjectId | null), slug (unik), serta field-field card sesuai daftar di AUDIT.md poin 4,
   - background: { url, path, updatedAt } | null,
   - isPublished: boolean, createdAt, updatedAt.

   messages:
   - _id, authorId (ObjectId), authorName (snapshot displayName), authorRole, text (1-500 karakter),
   - createdAt, deletedAt (soft delete) | null.

   rate_limits:
   - _id (key hash), count, expiresAt.

3. Buat script `scripts/create-indexes.js` yang idempoten untuk:
   - users: unique pada username; index pada role.
   - sessions: TTL pada expiresAt (expireAfterSeconds: 0); index pada userId.
   - cards: unique pada slug; unique sparse pada ownerUserId.
   - messages: index pada createdAt (desc) dan authorId.
   - rate_limits: TTL pada expiresAt.

4. Buat helper repository (mis. api/_lib/repos/*.js) yang membungkus query, SEMUA query memakai projection allowlist, dan SEMUA parameter query dipastikan bertipe string/ObjectId yang valid (gunakan zod + ObjectId.isValid) agar operator seperti {"$ne": ...} tidak bisa disisipkan.

5. Buat fungsi `toPublicUser(user)` dan `toPublicCard(card)` yang menjadi SATU-SATUNYA jalur data keluar ke client (hanya field yang diizinkan; tanpa passwordHash, tanpa ownerUserId mentah jika tidak perlu).
```

---

## Langkah 2.2 — Migrasi data lama

```text
Berdasarkan AUDIT.md, buat script migrasi `scripts/migrate-legacy.js` yang:

1. Membaca data card siswa yang sekarang di-hardcode/JSON dan memasukkannya ke koleksi `cards` (ownerUserId null, isPublished true). Slug dibuat dari nama (kebab-case, unik).
2. Jika ada komentar lama yang ingin dipertahankan, masukkan ke `messages` dengan authorId null, authorName sesuai data lama (atau "Anonim"), authorRole 'legacy'. Bersihkan teks: potong 500 karakter, buang karakter kontrol.
3. Mendukung mode `--dry-run` (hanya mencetak ringkasan tanpa menulis) dan idempoten (tidak duplikat jika dijalankan ulang).
4. Mencetak ringkasan jumlah data yang dimigrasi tanpa mencetak isi sensitif.
Jalankan dry-run dulu, tunjukkan ringkasannya, baru jalankan sungguhan setelah saya setujui.
```

**Kriteria selesai:** index terbuat, data card lama ada di `cards`, kode koneksi tidak mencetak URI.

---

## Audit Keamanan — Langkah 02 (WAJIB)

```text
Audit keamanan langkah 02 dan laporkan dalam tabel (Temuan | Lokasi | Risiko | Perbaikan | Status):

1. NoSQL injection: telusuri SEMUA query ke MongoDB. Pastikan tidak ada nilai dari req.body/req.query/req.params yang masuk ke filter tanpa divalidasi sebagai string/ObjectId. Uji dengan payload {"$ne":null}, {"$gt":""}, {"$where":"..."} dan buktikan ditolak.
2. Pastikan tidak ada penggunaan $where, mapReduce, atau eval di query.
3. Pastikan toPublicUser/toPublicCard adalah satu-satunya jalur keluar data, dan tidak ada endpoint yang mengembalikan dokumen mentah.
4. Pastikan sessions menyimpan HASH token, bukan token mentah.
5. Pastikan index unik username bekerja pada kondisi race (dua register bersamaan) dan error duplikat ditangani tanpa membocorkan detail internal.
6. Pastikan MONGODB_URI tidak muncul di log, error message, atau bundle.
7. Pastikan script migrasi tidak menyimpan data sensitif ke file lokal yang ter-commit.
8. Pastikan user database Atlas berhak minimal (readWrite pada satu database saja).
```

**Checklist manual:**
- [ ] Payload NoSQL injection diuji dan ditolak
- [ ] User DB berhak minimal
- [ ] Token session tidak pernah disimpan mentah
- [ ] Backup Atlas aktif / dicatat risikonya
