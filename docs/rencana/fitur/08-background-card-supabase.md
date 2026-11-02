> **FITUR DITUNDA — JANGAN JALANKAN PROMPT INI.** Background card dan upload gambar dilewati; jangan membuat bucket/integrasi Supabase Storage atau field background pada lingkup terpilih.

# 08 — Background Card dengan Foto (Supabase Storage)

**Prasyarat:** file 07 selesai dan lolos audit. Sudah membuat project Supabase.

**Tujuan:** siswa bisa mengunggah foto sebagai background card miliknya. File disimpan di Supabase Storage; MongoDB hanya menyimpan `url` dan `path`.

**Desain keamanan:** frontend **tidak pernah** berbicara langsung ke Supabase. Frontend mengirim file ke API kita → server memvalidasi, **mengencode ulang gambar** (membuang metadata dan payload tersembunyi), lalu mengunggah ke Supabase memakai service role key yang hanya ada di server.

---

## Langkah 8.0 — Persiapan manual di Supabase (kerjakan sendiri)

1. Buat bucket bernama `card-backgrounds`, **Public** (hanya untuk *baca*/menampilkan gambar). Atur batas ukuran file bucket (mis. 2 MB) dan **allowed MIME types**: `image/webp` saja.
2. **Jangan membuat policy tulis untuk `anon`/`authenticated`.** Pastikan tidak ada policy INSERT/UPDATE/DELETE publik pada `storage.objects` untuk bucket ini. Penulisan hanya lewat service role dari server.
3. Salin `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` ke Vercel Environment Variables dan `.env.local`. **Jangan** pakai anon key dan jangan masukkan service role key ke frontend.

---

## Langkah 8.1 — API upload

```text
Buat api/_routes/uploads.js dan api/_lib/storage.js:

storage.js
- Klien Supabase dibuat di server memakai SUPABASE_SERVICE_ROLE_KEY, dengan opsi auth.persistSession=false. Tidak diekspor ke frontend.
- uploadBackground(userId, buffer) -> { url, path }: path = `${userId}/${randomUUID()}.webp` (nama file TIDAK pernah dari client), contentType image/webp, cacheControl panjang, upsert=false.
- deleteObject(path).
- Validasi bahwa `path` yang akan dihapus selalu diawali `${userId}/` milik user yang sedang login.

POST /api/cards/me/background   (login, role student/admin, requireSameOrigin)
- Terima multipart/form-data dengan SATU field file (busboy/formidable) dengan batas keras: ukuran file maks 4 MB (batas body serverless Vercel ~4,5 MB), hanya 1 file, tanpa field tambahan. Hentikan stream segera jika melewati batas.
- Validasi isi file berdasarkan magic bytes (bukan ekstensi atau Content-Type dari client): hanya JPEG, PNG, WebP. Tolak GIF animasi, SVG, HEIC, dan lainnya.
- Proses dengan sharp: batasi limitInputPixels (mis. 24 megapiksel), rotate sesuai EXIF lalu BUANG semua metadata, resize agar lebar maks 1600px (tidak diperbesar), encode ulang ke WebP kualitas ~80. Jika sharp gagal -> 400 generik.
- Unggah hasil ke Supabase lewat uploadBackground. Setelah sukses, perbarui card: background = { url, path, updatedAt } dengan filter { _id: user.cardId, ownerUserId: user._id }. Setelah update DB berhasil, hapus file lama (path sebelumnya) dari Supabase; jika langkah DB gagal, hapus file baru (rollback) agar tidak ada file yatim.
- Rate limit: 5 unggahan/jam per user.
- Respons: toPublicCard terbaru.

DELETE /api/cards/me/background   (login, role student/admin, requireSameOrigin)
- Hapus file di Supabase dan set background = null untuk card milik user.

Pastikan url yang disimpan di MongoDB selalu dibangun server dari SUPABASE_URL + bucket + path; client tidak boleh mengirim URL atau path apa pun.
```

---

## Langkah 8.2 — UI

```text
Aktifkan tombol "Ganti Background" di /card-saya:

1. Input file (accept image/jpeg,image/png,image/webp) dengan tombol pilih/drag-drop. Validasi awal di client hanya untuk UX (tipe & ukuran).
2. Kompres/resize di browser (canvas) sebelum kirim agar ≤ ~3 MB, tampilkan pratinjau, lalu kirim sebagai FormData ke POST /api/cards/me/background (sertakan header X-Requested-With). Tampilkan progres/loading dan pesan error yang jelas.
3. Tombol "Hapus Background" (konfirmasi dulu).
4. Terapkan background pada card (halaman Siswa) dan header profil dengan CSS (background-size: cover, posisi tengah) serta lapisan gelap/gradien semi-transparan agar teks tetap terbaca (kontras minimal WCAG AA). Tambahkan lazy loading dan placeholder warna saat gambar dimuat.
5. Komponen card hanya memakai URL background jika hostname-nya sama dengan host Supabase proyek yang dikonfigurasi (jika tidak, abaikan dan tampilkan card tanpa background).
6. Peringatan kecil di UI: "Gunakan foto milikmu sendiri / yang pantas untuk publik."
```

**Kriteria selesai:** siswa mengunggah foto → muncul di card dan profil; ganti foto menghapus file lama; hapus background mengembalikan tampilan default; MongoDB hanya berisi URL/path.

---

## Audit Keamanan — Langkah 08 (WAJIB)

```text
Audit keamanan langkah 08 dan laporkan dalam tabel (Temuan | Lokasi | Risiko | Perbaikan | Status). Buktikan dengan pengujian nyata:

1. File berbahaya: unggah (a) file .php/.html/.js yang diganti nama menjadi .jpg, (b) SVG berisi <script>, (c) polyglot JPEG+HTML, (d) GIF animasi, (e) file 0 byte, (f) file > 4 MB, (g) gambar dengan dimensi gigantis (decompression bomb, mis. 30000x30000 piksel). Semuanya ditolak tanpa crash dan tanpa menyimpan file.
2. Re-encode: pastikan file yang tersimpan di Supabase selalu WebP hasil sharp; periksa metadata EXIF/GPS sudah terbuang (gunakan exiftool pada file hasil).
3. Path traversal & penimpaan: pastikan nama/path file TIDAK pernah berasal dari client; coba kirim field filename "../../x" dan field tambahan -> diabaikan/ditolak.
4. IDOR: siswa A tidak bisa mengganti/menghapus background siswa B (coba kirim cardId/path/url di body dan query). Pastikan penghapusan file hanya untuk path berawalan userId milik sendiri.
5. Kebocoran key: pastikan SUPABASE_SERVICE_ROLE_KEY tidak ada di bundle frontend, respons API, log, maupun error. Periksa folder build hasil `npm run build`.
6. Policy Supabase: dari luar (tanpa key) coba upload/hapus langsung ke bucket via REST API Supabase dengan anon key -> harus ditolak. Pastikan hanya baca publik yang terbuka.
7. Member/anonim: POST/DELETE background sebagai member dan tanpa login -> 403/401.
8. CSRF: request dari origin lain atau tanpa X-Requested-With -> 403.
9. Rate limit: 6 upload dalam 1 jam -> terblokir.
10. Konsistensi: simulasikan kegagalan DB setelah upload -> file baru terhapus (tidak ada file yatim); simulasikan kegagalan hapus file lama -> tercatat di log (tanpa data sensitif) dan tidak membuat card rusak.
11. Validasi tampilan: URL background di MongoDB yang bukan host Supabase proyek tidak dirender oleh frontend.
12. Biaya/penyalahgunaan: pastikan batas ukuran bucket dan rate limit mencegah pengisian storage berlebihan; catat kuota paket gratis Supabase.
```

**Checklist manual:**
- [ ] SVG/HTML/GIF/file raksasa ditolak
- [ ] Service role key tidak ada di bundle
- [ ] Upload langsung dari luar ke bucket ditolak
- [ ] File lama terhapus saat ganti background
