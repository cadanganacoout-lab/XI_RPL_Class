# Website Kelas XI RPL

Website untuk kelas XI RPL SMK PGRI 2 Ponorogo. Jalankan lokal dengan Vite atau build ke situs statis untuk deployment.

## Struktur Folder

```text
.
├── asset/              # Logo, foto profil, dan foto galeri
├── css/                # Gaya situs
├── js/                 # Sumber data dan konfigurasi Supabase
├── src/                # Halaman React, komponen bersama, dan adapter data
│   ├── components/     # Header/footer bersama
│   ├── data/           # Adapter ke sumber data js/data.js
│   └── pages/          # Implementasi halaman React
├── docs/               # Referensi jadwal dan manifest foto
├── scripts/            # Pemeriksaan runtime dan browser
├── reports/            # Hasil pemeriksaan lokal (tidak untuk deployment)
├── supabase/           # SQL schema dan kebijakan akses komentar
├── index.html           # Satu-satunya HTML entry point
└── vite.config.js       # Konfigurasi build statis
```

## Aplikasi React

Semua halaman menggunakan React melalui satu entry `index.html`. Navigasi memakai hash (`#/siswa`, `#/guru`, `#/galeri`, `#/video`, `#/komentar`) agar bisa digunakan pada hosting statis tanpa konfigurasi rewrite. Tampilan mengikuti desain saat ini; redesign pada `docs/DESIGN-SYSTEM.md` belum diterapkan. Header/footer bersama berada di `src/components/SiteShell.jsx`, sedangkan data tetap bersumber dari `js/data.js`.

```bash
npm install
npm run dev
```

Buka `http://localhost:5173/` melalui Vite untuk menjalankan situs. Beranda dan ruang diskusi memakai konfigurasi Supabase dari `js/supabase-config.js`. `npm run build` menyiapkan `dist/index.html` beserta stylesheet, data, konfigurasi komentar, dan aset gambar yang dibutuhkan.

## Maintenance

- Ubah data siswa, guru, jadwal, galeri, atau video hanya di `js/data.js`.
- Komentar pengunjung disimpan di Supabase PostgreSQL dan disiarkan melalui Supabase Realtime. Halaman Ruang Diskusi memakai panel gulir dengan pemuatan bertahap komentar lama; Beranda menampilkan tiga komentar terbaru.
- Untuk mengaktifkan komentar bersama, jalankan `supabase/comments.sql` di SQL Editor project Supabase, lalu isi URL project dan publishable/anon key pada `js/supabase-config.js`. Jika tabel sudah dibuat dengan versi SQL sebelumnya, jalankan ulang file SQL yang sudah diperbarui untuk menambahkan dukungan balasan.
- Publishable/anon key memang digunakan di browser; kebijakan Row Level Security pada SQL membatasi akses. Jangan pernah masukkan `service_role` key ke situs.
- **Deploy ke Vercel:** impor repository GitHub ini di Vercel, gunakan root directory `.` dan biarkan konfigurasi proyek menentukan instalasi `npm ci`, build `npm run build`, serta output `dist`. Setelah deploy pertama, setiap push ke branch yang terhubung akan memicu deployment baru. Situs memakai navigasi hash, jadi tidak memerlukan rewrite rute.
- Komentar anonim bersifat publik; pengunjung dapat membaca dan menambahkan komentar, tetapi hanya pemilik project yang dapat menghapusnya dari Supabase Dashboard. Form membatasi 500 karakter; untuk mencegah spam lebih lanjut, tambahkan CAPTCHA/rate limiting sebelum situs dibuka luas.
- Simpan aset baru di subfolder yang sesuai di `asset/` dan sesuaikan field `foto` di `js/data.js`.
- Gunakan `docs/foto-manifest.md` untuk mencatat pemetaan foto profil.
- Jalankan `npm run check` setelah perubahan untuk memeriksa seluruh rute React.

## Pemeriksaan

```bash
npm install
npm run check:runtime
npm run check:browser
```

Hasil pemeriksaan disimpan di `reports/`. Folder tersebut hanya berisi artefak lokal dan tidak diperlukan saat deployment.
