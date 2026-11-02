# Roadmap Pengembangan Fitur

Roadmap ini disesuaikan dengan aplikasi yang benar-benar ada. **Dokumen ini merencanakan pekerjaan; tidak ada fitur di bawah yang berarti sudah diimplementasikan.** Situs memakai React 19 + Vite, data kelas lokal di `js/data.js`, dan Supabase PostgreSQL/Realtime untuk komentar. Akun dan data card yang direncanakan memakai MongoDB melalui backend Vercel.

Lingkup yang dipilih dan urutan pengerjaannya ada di [`PILIH-FITUR.md`](PILIH-FITUR.md) dan [`LANGKAH-PENGERJAAN.md`](LANGKAH-PENGERJAAN.md). Pilihan tersebut belum mengimplementasikan fitur atau mengizinkan deployment produksi.

## Arsitektur acuan

- Pertahankan frontend React/Vite, entry `index.html`, dan navigasi hash di `src/main.jsx`.
- Gunakan Vercel Serverless Functions untuk API autentikasi, akun, profil, dan card siswa.
- Gunakan MongoDB Atlas untuk akun, sesi, role, profil publik, relasi user/card, card siswa, dan rate limit persisten yang diperlukan.
- Gunakan session opaque pada cookie aman; simpan hash token session, bukan token mentah. Hash password di server. Tidak menggunakan Supabase Auth untuk akun.
- Supabase PostgreSQL/Realtime tetap khusus fitur komentar anonim yang sudah ada. Jangan memindahkan komentar menjadi chat beridentitas atau mengubah skemanya pada lingkup ini.
- Jangan gunakan Supabase Storage untuk fitur terpilih. Background card dan semua upload terkait dilewati.
- MongoDB URI dan secret lain hanya berada di environment server/Vercel; jangan gunakan prefix env yang dibundel frontend.
- Migrasikan data siswa dengan pemetaan yang terverifikasi; jangan membuat salinan data yang mengubah nama/urutan tanpa alasan.
- Otorisasi harus ditegakkan pada setiap API, bukan hanya melalui route guard frontend.

## Fitur yang direncanakan

| Urutan | Fitur | Yang akan dibangun | Status |
|---|---|---|---|
| 1 | Akun, autentikasi, dan peran | Akun/session di MongoDB lewat backend Vercel; login/logout dengan username dan password yang di-hash; signup mandiri hanya untuk `member`; akun `student`/`admin` dibuat lewat proses tepercaya. Member hanya membaca, tidak mengedit data apa pun, dan tidak muncul sebagai siswa/guru. | Belum ada; alur dipilih, backend dan provisioning belum dibuat. |
| 2 | Penyimpanan data card siswa | Koleksi MongoDB yang memetakan data siswa dari `js/data.js` (nama, jabatan, hobi, catatan, motto bila tersedia, foto, portofolio), ownership, dan migrasi idempoten. | Belum ada; sumber siswa masih statis. |
| 3 | Daftar siswa dari data tersimpan | Halaman siswa membaca card yang dipublikasikan lewat API MongoDB; pertahankan pencarian/filter/tampilan/urutan. Member tidak ditampilkan. | Belum ada; halaman membaca adapter lokal. |
| 4 | Edit card milik sendiri | Form dan pratinjau untuk student saja; API memvalidasi field serta ownership; member, anonim, dan student lain ditolak. Field identitas/publikasi dilindungi. | Belum ada; card read-only. |
| 5 | **Halaman profil pengguna** | Profil publik `#/profil/:username` dan sendiri `#/profil`, data MongoDB dengan allowlist field publik; profil member sederhana, profil student dapat menampilkan card; aksi pemilik sesuai role. | Belum ada; tidak ada route atau model akun. |
| 6 | Diskusi dengan identitas akun | Mengubah komentar anonim menjadi komentar beridentitas/chat. | **Dilewati.** Komentar anonim dan balasan tetap pada Supabase seperti sekarang. |
| 7 | **Background card (fitur terpisah)** | Upload/ganti/hapus background card dan kebijakan storage. | **Dilewati.** Tidak ada upload, field, bucket, atau integrasi storage. |
| 8 | Penguatan keamanan dan privasi | Validasi API, autentikasi/otorisasi, cookie/session aman, rate limit, minimisasi data, logging aman, audit akses MongoDB; tinjau keamanan komentar Supabase tanpa mengubah ruang lingkup. | Keamanan API/MongoDB belum dibangun. |
| 9 | Deploy, pengujian, dan operasional | Vercel Functions + MongoDB Atlas; pengujian API/akses per role; environment Preview/Production terpisah; migrasi/rollback, pemulihan akun, backup, checklist rilis. | Vercel saat ini hanya build statis; backend belum ada. |

### Batas fitur profil dan background

Halaman profil hanya mengelola informasi akun publik dan menampilkan data card yang boleh dilihat. Mengubah nama tampilan bukan mengubah card siswa. Background card dan upload dilewati seluruhnya; bukan bagian profil ataupun edit card.

## Urutan dan prasyarat

1. Rancang alur akun username/password di MongoDB dan pembuatan akun student/admin secara tepercaya.
2. Audit field data siswa dan rancang skema MongoDB serta ownership card.
3. Implementasikan API auth, session, role, dan otorisasi MongoDB; uji anon/member/student/admin.
4. Migrasikan data dan tampilkan daftar siswa dari sumber baru.
5. Implementasikan edit card, kemudian halaman profil.
6. Pertahankan komentar anonim Supabase tanpa mengubahnya menjadi diskusi beridentitas.
7. Background card dilewati sesuai pilihan.
8. Jalankan pengujian keamanan, migrasi, dan persiapan deployment; production memerlukan persetujuan.

Setiap tahap harus punya migrasi yang dapat ditinjau, kriteria penerimaan, dan tes. Jangan menjalankan migrasi produksi atau mengaktifkan signup publik tanpa persetujuan.

## Masalah yang ditemukan pada dokumentasi/proyek

### Prioritas tinggi — perlu diputuskan sebelum fitur akun

- **Backend akun belum ada.** Situs saat ini dibangun sebagai aplikasi statis; akses MongoDB harus ditambahkan lewat API server tepercaya.
- **Provisioning akun student/admin perlu prosedur operasional.** Kredensial database tidak boleh berada di browser; akun dengan privilege tidak boleh dibuat lewat signup umum.
- **Field editable dan ownership card harus dikunci pada implementasi.** API harus menolak perubahan role, owner, identitas, dan card milik siswa lain.

### Masalah fitur yang sudah ada

- **Komentar anonim dapat ditulis siapa saja.** `supabase/comments.sql` mengizinkan `anon` dan `authenticated` membaca serta menambahkan komentar; tidak ada rate limit, identitas, laporan, atau mekanisme penghapusan/moderasi dari UI. RLS memvalidasi panjang teks, bukan frekuensi/konten penyalahgunaan.
- **Pesan error Supabase diteruskan ke tampilan.** `src/components/Comments.jsx` menampilkan `error.message` pada status. Pesan backend mentah sebaiknya diganti pesan publik yang aman dan detail tetap untuk logging yang tidak sensitif.
- **Data siswa/guru masih statis.** `src/data/class-data.js` membaca `window.XIRPL1_DATA` dari `js/data.js`; perubahan/edit akun tidak tersimpan ke database.
- **Foto profil masih mengandalkan nilai data lokal dan fallback eksternal.** Belum ada alur unggah milik pengguna, ownership, moderasi, atau background card.

### Masalah dokumentasi dan metadata

- **Dokumentasi sebelumnya dikecualikan Git.** Aturan `docs/` di `.gitignore` membuat roadmap tidak ikut perubahan repository; aturan itu sudah dihapus agar dokumen proyek dapat ditinjau dan dipelihara.
- **README sebelumnya tidak sesuai kondisi UI.** README menyebut redesign belum diterapkan dan menunjuk `docs/foto-manifest.md`, sementara isi folder docs yang ada tidak menyediakan file tersebut. README sekarang menjelaskan UI dan roadmap saat ini.
- **Metadata package belum mencerminkan repository utama.** `package.json` masih memakai nama package `new---class` dan URL repository `cadanganacoout-lab/new---class`, sedangkan repository proyek ini adalah `cadanganacoout-lab/XI_RPL_Class`. Perbaiki metadata terpisah agar tidak menimbulkan tautan/publikasi yang keliru.

## Kriteria selesai lintas fitur

- Tidak ada rahasia server di source, konfigurasi, atau bundle browser.
- Hak akses diuji dengan akun anonim dan setiap peran; tidak hanya disembunyikan melalui UI.
- Pengguna hanya dapat mengubah profil/card miliknya sesuai role dan kebijakan server.
- Teks pengguna tampil sebagai teks, bukan HTML aktif; kesalahan jaringan ditampilkan aman.
- Data publik dibatasi pada field yang memang perlu; email dan kredensial tidak pernah menjadi data profil publik.
- Tes browser dan pemeriksaan runtime lulus, dan migrasi/rollback terdokumentasi sebelum rilis.
