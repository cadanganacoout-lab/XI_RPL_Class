# Website Kelas XI RPL 1

Website statis untuk kelas XI RPL 1 SMK PGRI 2 Ponorogo. Situs dapat dibuka langsung melalui `index.html` atau dipublikasikan ke hosting statis.

## Struktur Folder

```text
.
├── asset/              # Logo, foto profil, dan foto galeri
├── docs/               # Referensi jadwal dan manifest foto
├── scripts/            # Pemeriksaan runtime dan browser
├── reports/            # Hasil pemeriksaan lokal (tidak untuk deployment)
├── data.js             # Satu-satunya sumber data konten
├── script.js           # Logika dan rendering halaman
├── style.css           # Gaya bersama seluruh halaman
└── *.html              # Halaman situs
```

## Maintenance

- Ubah data siswa, guru, jadwal, galeri, video, atau motto hanya di `data.js`.
- Simpan aset baru di subfolder yang sesuai di `asset/` dan sesuaikan field `foto` di `data.js`.
- Gunakan `docs/foto-manifest.md` untuk mencatat pemetaan foto profil.
- Jalankan `npm run check` setelah perubahan untuk memeriksa semua halaman.

## Pemeriksaan

```bash
npm install
npm run check:runtime
npm run check:browser
```

Hasil pemeriksaan disimpan di `reports/`. Folder tersebut hanya berisi artefak lokal dan tidak diperlukan saat deployment.
