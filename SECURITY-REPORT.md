# Laporan Keamanan Pra-Deploy

**Status:** pemeriksaan lokal selesai; audit Preview/Production belum dilakukan.

Tidak ada koneksi MongoDB Atlas, migrasi apply, provisioning akun nyata, atau deployment dalam pemeriksaan ini. Bukti API berasal dari fixture database mock dan browser test lokal; karena itu laporan ini bukan hasil penetration test terhadap deployment.

## Temuan

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟡 MEDIUM | `api/_lib/repos/cards.js` | 67-75 | Endpoint detail card semula dapat membaca card milik akun nonaktif jika slug diketahui. Filter pemilik aktif telah diterapkan dan tes memastikan respons 404. | 8/10 |

Audit langkah 06 tidak menemukan temuan keamanan pada kode profil yang ditinjau. Pengujian dengan dua akun nyata dan data akun admin/nonaktif di Atlas belum dapat dilakukan.

## Hasil lokal

| Area | Status | Bukti / batasan |
|---|---|---|
| Auth, session, password, cookie | Lulus lokal | Tes unit mencakup session hash, cookie, login/logout, password reset, dan akses akun nonaktif; deployment belum diuji. |
| Otorisasi card/profil | Lulus pada fixture | Tes mencakup role member/student, ownership, strict body, card nonaktif, dan filter database; belum menggantikan uji IDOR dua akun nyata. |
| XSS dan injeksi | Lulus pada UI/API lokal | React merender teks biasa; schema menolak field tambahan dan tipe/operator input yang salah. Tidak ada uji live. |
| CSRF/Origin | Lulus pada fixture | Request mutasi tanpa origin yang sesuai ditolak sebelum database dibuka. |
| Batas request dan rate limit | Lulus pada fixture | Tes mencakup batas body 100 KiB dan limit endpoint auth/card/profil; lonjakan trafik live belum diuji. |
| Upload/background | Dilewati | Fitur background dan Supabase Storage tidak dipilih; tidak ada endpoint upload atau service-role key. |
| Header dan CSP | Disiapkan | HSTS dan header keamanan dikonfigurasi. CSP masih `Report-Only`; header aktual dan pelanggaran browser belum diperiksa pada Preview. |
| Bundle dan source map | Lulus lokal | Hash CSP cocok dengan HTML build; pemindaian bundle tidak menemukan identifier server-only dan tidak ada source map. Ulangi setelah perubahan build menjelang rilis. |
| Dependency | Lulus untuk production | `npm audit --omit=dev` menemukan 0 kerentanan saat validasi terakhir. |
| Privasi | Lulus pada serializer lokal | Respons profil/card memakai allowlist; isi akun/database nyata dan log deployment belum ditinjau. |

## Sebelum rilis

- Jalankan pemeriksaan ini kembali pada deployment Preview dengan database dan akun uji terpisah dari Production.
- Uji matriks role dan IDOR menggunakan minimal dua akun student nyata di Preview.
- Tinjau laporan CSP di browser, perbaiki pelanggaran yang valid, lalu putuskan secara terpisah kapan CSP aman diaktifkan dalam mode enforce.
- Verifikasi header HTTP, cookie Production, isolasi environment, bundle hasil build, log, backup, dan pemulihan.
- Jangan melakukan migrasi Production, membuat akun nyata, atau deploy Production tanpa persetujuan eksplisit.
