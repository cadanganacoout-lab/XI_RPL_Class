> **FITUR DITUNDA — JANGAN JALANKAN PROMPT INI.** Komentar anonim dan balasan tetap pada Supabase PostgreSQL/Realtime; tidak diubah menjadi chat beridentitas dalam lingkup terpilih.

# 07 — Chat Publik (Pengganti Komentar, Tampil di Popup)

**Prasyarat:** file 06 selesai dan lolos audit. Data komentar lama sudah dimigrasi ke `messages` (file 02).

**Tujuan:** mengubah fitur komentar menjadi ruang chat publik yang dibuka lewat tombol → popup. **Baca terbuka untuk semua pengunjung, kirim pesan hanya untuk user yang login** (pilihan default demi anti-spam; ubah hanya jika kamu sadar risikonya).

**Catatan teknis:** Vercel serverless tidak cocok untuk WebSocket persisten, jadi chat memakai *polling* ringan (3–5 detik) yang **hanya berjalan saat popup terbuka dan tab aktif**.

---

## Langkah 7.1 — API chat

```text
Buat api/_routes/messages.js:

GET /api/messages?after=<ISO-date|ObjectId>&limit=<n>   (publik)
- limit: integer 1-50 (default 30), divalidasi zod; after: opsional, divalidasi sebagai ObjectId valid. Tanpa after -> kembalikan N pesan terbaru (urut lama→baru). Dengan after -> hanya pesan yang lebih baru dari itu.
- Hanya pesan dengan deletedAt = null. Field keluar: id, authorName, authorUsername (jika ada), authorRole, text, createdAt. TIDAK ada authorId mentah jika tidak perlu.
- Cache-Control: no-store (atau s-maxage sangat pendek 2 detik jika ingin menghemat DB; pilih yang aman dan jelaskan alasannya).
- Rate limit pembacaan: 60 request/menit per IP.

POST /api/messages   (login, requireSameOrigin)
- Body strict: { text }. text: string, trim, 1-500 karakter, normalisasi Unicode NFC, buang karakter kontrol & zero-width berlebihan, tolak pesan yang hanya berisi spasi.
- Rate limit ketat: maks 1 pesan per 2 detik dan 20 pesan/menit per user, 100 pesan/jam per IP. Tolak pesan identik berturut-turut dari user yang sama dalam 30 detik (anti-spam).
- authorId, authorName, authorRole diambil dari session/DB, BUKAN dari body.
- Respons: pesan yang tersimpan.

DELETE /api/messages/:id   (login, requireSameOrigin)
- :id divalidasi ObjectId. Pemilik pesan boleh menghapus pesannya sendiri; admin boleh menghapus pesan siapa pun. Implementasi soft delete (deletedAt = now). Pesan orang lain oleh non-admin -> 404 (bukan 403, agar tidak membocorkan keberadaan).

Tidak ada endpoint edit pesan pada tahap ini.
```

---

## Langkah 7.2 — UI popup chat

```text
Ubah fitur komentar yang ada (lihat AUDIT.md poin 3) menjadi chat publik:

1. Hapus/ganti UI komentar lama (jangan hapus data). Tambahkan tombol mengambang "Chat" (atau di navbar) yang membuka popup/modal ruang diskusi. Di mobile popup tampil hampir layar penuh (bottom sheet), di desktop sebagai panel di pojok kanan bawah.
2. Isi popup:
   - Header: judul "Ruang Diskusi RPL 42", jumlah pesan terbaru (opsional), tombol tutup.
   - Daftar pesan dengan scroll otomatis ke bawah HANYA bila pengguna sedang berada di bawah (jangan loncat saat membaca pesan lama). Tampilkan nama (menaut ke /profil/:username), badge role kecil, waktu relatif, dan tombol hapus pada pesan milik sendiri (atau semua pesan jika admin).
   - Input pesan dengan penghitung 500 karakter, Enter = kirim, Shift+Enter = baris baru, tombol kirim disable saat mengirim.
   - Jika belum login: input diganti ajakan "Masuk untuk ikut mengobrol" yang mengarah ke /login?next=<halaman sekarang>.
3. Polling: gunakan parameter `after` dengan ID pesan terakhir. Interval 4 detik saat popup terbuka dan tab terlihat (Page Visibility API); berhenti total saat popup ditutup atau tab tersembunyi; backoff bertahap (mis. 4s → 8s → 15s) saat error/429; lanjut normal ketika berhasil. Batalkan request yang tertunda saat popup ditutup (AbortController).
4. Optimistic UI untuk pengiriman: tampilkan pesan sementara, ganti dengan data server atau tampilkan status gagal + tombol kirim ulang.
5. Semua teks pesan dirender sebagai TEKS BIASA (React default). Dilarang dangerouslySetInnerHTML dan dilarang auto-link/markdown pada tahap ini. Pertahankan baris baru dengan CSS white-space: pre-wrap.
6. Batasi jumlah pesan di memori (mis. 200 terbaru) agar halaman tetap ringan.
7. Aksesibilitas: popup memakai role="dialog", aria-modal, fokus terkunci di dalam popup, tutup dengan Escape, fokus kembali ke tombol pembuka.
```

**Kriteria selesai:** dua browser berbeda bisa saling melihat pesan dalam hitungan detik; pengunjung tanpa login bisa membaca tapi tidak mengirim; polling berhenti saat popup ditutup.

---

## Audit Keamanan — Langkah 07 (WAJIB)

```text
Audit keamanan langkah 07 dan laporkan dalam tabel (Temuan | Lokasi | Risiko | Perbaikan | Status). Buktikan dengan pengujian nyata:

1. Stored XSS: kirim pesan `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `"><svg onload=alert(1)>`, `javascript:alert(1)`, serta teks bertipe Unicode aneh (RTL override, zero-width). Pastikan semuanya tampil sebagai teks di popup, profil, dan di mana pun pesan ditampilkan.
2. Spoofing identitas: kirim POST dengan { text, authorName:"Admin", authorRole:"admin", authorId:"..." } -> field tambahan ditolak/diabaikan; nama pengirim tetap dari session.
3. Otorisasi: POST tanpa login (401). DELETE pesan orang lain sebagai non-admin (404) dan sebagai admin (berhasil). DELETE tanpa login (401).
4. Spam/flood: kirim 30 pesan dalam 10 detik -> terblokir 429; pesan identik berturut-turut ditolak; pastikan limit tidak dapat dihindari dengan banyak tab (limit per user & per IP di DB, bukan di memori).
5. Validasi parameter: after=<bukan ObjectId>, limit=-1/0/9999/abc, after={"$gt":""} -> 400, tidak ada error server/stack trace.
6. DoS ringan: pastikan query GET memakai index (createdAt/_id) dan selalu ber-limit; pastikan polling klien berhenti saat popup tertutup (cek tab Network).
7. CSRF: POST/DELETE dari origin lain atau tanpa X-Requested-With -> 403.
8. Kebocoran data: respons GET /api/messages tidak berisi authorId mentah, email, passwordHash, atau field internal.
9. Pastikan tidak ada auto-link/markdown/HTML parsing pada pesan.
10. Pastikan data komentar lama yang dimigrasi tidak mengandung HTML aktif yang dirender (render tetap sebagai teks).
11. Periksa moderasi minimal: admin bisa menghapus pesan lewat API; catat prosedur menghapus pesan abusif dan menonaktifkan akun (script set-active).
```

**Checklist manual:**
- [ ] Payload XSS tampil sebagai teks
- [ ] Spam diblokir, tidak bisa menyamar sebagai admin
- [ ] Polling berhenti saat popup ditutup
- [ ] Pengunjung anonim tidak bisa mengirim
