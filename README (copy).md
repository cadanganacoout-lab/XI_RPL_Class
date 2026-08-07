# Website Kelas XI RPL 1

## Cara membuka
Buka `index.html` langsung di browser (double click), atau upload semua file ke hosting statis mana pun (GitHub Pages, Netlify, hosting sekolah, dll). Tidak perlu server/database — murni HTML, CSS, JS.

## Struktur file
```
index.html    → Beranda
siswa.html    → Daftar Siswa
guru.html     → Daftar Guru
galeri.html   → Galeri
video.html    → Video
motto.html    → Motto Siswa
style.css     → Semua styling (1 file, dipakai 6 halaman)
script.js     → Semua logika (render kartu, jadwal, motto melayang, dll)
data.js       → SEMUA KONTEN ADA DI SINI (data contoh/dummy)
foto-manifest.md → daftar nama file foto yang dikenali situs (siswa, guru & galeri)
foto/siswa/   → taruh foto siswa di sini
foto/guru/    → taruh foto guru di sini
foto/galeri/  → taruh foto kegiatan di sini
```

## Cara mengganti data (paling penting!)
Buka `data.js` dengan text editor apa saja (Notepad, VS Code, dll). Semua konten yang tampil di 6 halaman diambil dari file ini. **Jangan ubah nama field** (misalnya `nama`, `jabatan`, `hobi`), cukup ganti isinya.

- `SITE` → nama sekolah, nama kelas, wali kelas, jumlah siswa & guru
- `MOTIVASI` → daftar kalimat motivasi yang berjalan di beranda
- `GURU` → 18 guru (nama, mapel)
- `SISWA` → 33 siswa (nama, jabatan, hobi, catatan)
- `PIKET` → daftar piket per hari (Senin–Jumat)
- `JADWAL` → jadwal pelajaran, dipisah `ganjil` dan `genap`, per hari
- `GALERI` → 30 foto (saat ini pakai foto placeholder dari picsum.photos, ganti field `seed` atau ubah ke URL foto asli di `script.js` fungsi `initGaleri`)
- `VIDEO` → 16 video, isi `youtubeId` dengan ID video YouTube asli (bagian setelah `watch?v=` di URL)
- `MOTTO` → motto tiap siswa

## Tentang foto siswa/guru/galeri
Situs sudah otomatis mencoba memuat foto asli dari folder `foto/siswa/`, `foto/guru/`, dan `foto/galeri/`. Caranya:

1. Buka `foto-manifest.md` — di situ ada daftar nama file persis untuk tiap siswa, guru, dan foto galeri (misalnya `foto/siswa/elok-saputra.jpg` atau `foto/galeri/01-kegiatan-praktik-pemrograman-web.jpg`).
2. Simpan foto Anda ke folder yang sesuai dengan **nama file persis seperti di manifest**, format `.jpg`.
3. Selesai — tidak perlu ubah kode apa pun. Refresh halaman terkait, foto langsung tampil.

Kalau untuk item tertentu fotonya belum ada atau nama filenya salah, situs **otomatis jatuh ke gambar cadangan** (avatar inisial untuk siswa/guru, foto placeholder untuk galeri) — tidak akan muncul gambar rusak/kosong. Jadi aman untuk diisi bertahap.

Field `foto` juga sudah ada di `data.js` pada tiap objek siswa/guru/galeri — kalau mau pakai nama folder/file yang beda dari manifest, tinggal ubah value field `foto`-nya langsung di `data.js`.

## Tentang jadwal minggu ganjil/genap
Sistem otomatis menghitung ganjil/genap berdasarkan **nomor minggu kalender (ISO week number)** — minggu ganjil → jadwal `ganjil`, minggu genap → jadwal `genap`. Ini dihitung otomatis oleh browser setiap hari, tidak perlu diubah manual. Kalau pembagian minggu di sekolah Anda berbeda (misalnya dimulai dari tanggal tertentu), beri tahu saya dan bisa disesuaikan.

## Responsive
Sudah responsive untuk HP, tablet, dan desktop (navbar berubah jadi menu hamburger di layar kecil).

## Tema terang & gelap
Ada tombol ikon matahari/bulan di pojok kanan navbar (di semua halaman) untuk beralih tema terang ⇄ gelap. Pilihan tema otomatis tersimpan di browser (localStorage) sehingga tetap konsisten walau pindah halaman atau membuka situs lagi nanti. Kalau browser belum pernah menyimpan pilihan, situs akan mengikuti pengaturan terang/gelap sistem operasi pengguna secara otomatis.

Kalau ingin mengubah warna tema gelap, cari blok `[data-theme="dark"]{ ... }` di bagian paling atas `style.css`.
