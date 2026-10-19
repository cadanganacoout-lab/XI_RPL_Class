# Website Kelas XI RPL 1

Website statis untuk kelas XI RPL 1 SMK PGRI 2 Ponorogo. Situs dapat dibuka langsung melalui `index.html` atau dipublikasikan ke hosting statis.

## Struktur Folder

```text
.
├── asset/              # Logo, foto profil, dan foto galeri
├── css/                # Gaya situs
├── js/                 # Data, logika aplikasi, dan konfigurasi Supabase
├── docs/               # Referensi jadwal dan manifest foto
├── scripts/            # Pemeriksaan runtime dan browser
├── reports/            # Hasil pemeriksaan lokal (tidak untuk deployment)
├── supabase/           # SQL schema dan kebijakan akses komentar
└── *.html              # Halaman situs
```

## Maintenance

- Ubah data siswa, guru, jadwal, galeri, atau video hanya di `js/data.js`.
- Komentar pengunjung disimpan di Supabase PostgreSQL dan disiarkan melalui Supabase Realtime. Halaman Komentar menampilkan diskusi dengan pemuatan komentar sebelumnya; Beranda menampilkan tiga komentar terbaru.
- Untuk mengaktifkan komentar bersama, jalankan `supabase/comments.sql` di SQL Editor project Supabase, lalu isi URL project dan publishable/anon key pada `js/supabase-config.js`. Jika tabel sudah dibuat dengan versi SQL sebelumnya, jalankan ulang file SQL yang sudah diperbarui untuk menambahkan dukungan balasan.
- Publishable/anon key memang digunakan di browser; kebijakan Row Level Security pada SQL membatasi akses. Jangan pernah masukkan `service_role` key ke situs.
- Hubungkan repository GitHub ini ke Vercel dan deploy dari root project. Komentar anonim bersifat publik; pengunjung dapat membaca dan menambahkan komentar, tetapi hanya pemilik project yang dapat menghapusnya dari Supabase Dashboard. Form membatasi 500 karakter; untuk mencegah spam lebih lanjut, tambahkan CAPTCHA/rate limiting sebelum situs dibuka luas.
- Simpan aset baru di subfolder yang sesuai di `asset/` dan sesuaikan field `foto` di `js/data.js`.
- Gunakan `docs/foto-manifest.md` untuk mencatat pemetaan foto profil.
- Jalankan `npm run check` setelah perubahan untuk memeriksa semua halaman.

## Pemeriksaan

```bash
npm install
npm run check:runtime
npm run check:browser
```

Hasil pemeriksaan disimpan di `reports/`. Folder tersebut hanya berisi artefak lokal dan tidak diperlukan saat deployment.
