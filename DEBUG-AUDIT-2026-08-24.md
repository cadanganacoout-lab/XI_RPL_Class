# 🔍 DEBUG AUDIT: Kelas XI RPL 1 Website
**Tanggal:** 2026-08-24  
**Total Temuan:** 17 (1 Kritis, 5 High, 5 Medium, 6 Low)

---

## 📊 Ringkasan Eksekutif

| Severity | Count | Status |
|----------|-------|--------|
| ⛔ KRITIS | 1 | Harus diperbaiki sekarang |
| 🔴 HIGH | 5 | Penting, dampak besar |
| 🟡 MEDIUM | 5 | Penting, tapi bisa ditunda |
| 🟢 LOW | 6 | Minor, improvement |
| **TOTAL** | **17** | |

---

## ⛔ MASALAH KRITIS

### [C01] Duplikat Video ID 'v16' di Array VIDEO
**File:** `data.js` (baris ~1520, 1526, 1532, 1538)  
**Severity:** KRITIS  
**Status:** ❌ BELUM DIPERBAIKI

**Detail:**
- Ada 5 video dengan ID `v16` (seharusnya unik: v16, v17, v18, v19, v20)
- Video yang affected:
  - v16 @ baris 1520: "TUGAS SENAM IRAMA PJOK, –KELOMPOK 3–"
  - v16 @ baris 1526: "TUGAS SENAM IRAMA PJOK, –KELOMPOK 5–"
  - v16 @ baris 1532: "TUGAS SENAM IRAMA PJOK, –KELOMPOK 2–"
  - v16 @ baris 1538: "TUGAS SENAM IRAMA PJOK, –KELOMPOK 4–"

**Impact:**
- Script render akan corrupt
- Video tidak akan muncul dengan benar
- Array lookup akan ambil entry pertama v16 saja

**Fix:**
```javascript
// BEFORE (SALAH):
{
  "id": "v16",  // ← Duplikat!
  "youtubeId": "lY4tZ2UVyQ4",
  ...
}

// AFTER (BENAR):
{
  "id": "v17",  // ← Unik!
  "youtubeId": "lY4tZ2UVyQ4",
  ...
}
```

### [H02-H05] YouTube ID dengan Parameter Query
**File:** `data.js` (VIDEO array)  
**Severity:** HIGH  
**Status:** ❌ BELUM DIPERBAIKI

Beberapa YouTube ID mengandung parameter query (`&t=...`) yang akan menyebabkan error di embed:

| ID | Baris | Current | Issue | Fix |
|----|----|---------|-------|-----|
| v05 | 1455 | `Vk_uDWUSOuo&t=31s` | Query param `&t=31s` | `Vk_uDWUSOuo` |
| v07 | 1467 | `mdycE2tlPX4&t=117s` | Query param `&t=117s` | `mdycE2tlPX4` |
| v11 | 1491 | `eZfZ70p2d40&t=109s` | Query param `&t=109s` | `eZfZ70p2d40` |
| v73 | 1539 | `meDKTZ1YdEo&t=7s` | Query param `&t=7s` | `meDKTZ1YdEo` |

**Detail:**
```javascript
// SEBELUM (SALAH):
"youtubeId": "Vk_uDWUSOuo&t=31s"

// SESUDAH (BENAR):
"youtubeId": "Vk_uDWUSOuo"
```

**Impact:** YouTube embed akan gagal load atau menampilkan error.

---

## 🟡 MASALAH MEDIUM PRIORITY

### [M01] Total Siswa Mismatch
**File:** `data.js`  
**Severity:** MEDIUM  
**Status:** ✅ SUDAH BENAR (tapi monitor)

- `SITE.totalStudents = 33` ✓
- Array SISWA: s01 - s33 = 33 siswa ✓
- **Status:** Sinkron. Tapi perlu monitor saat ada perubahan.

---

### [M02] Total Guru Mismatch
**File:** `data.js`  
**Severity:** MEDIUM  
**Status:** ✅ SUDAH BENAR (tapi monitor)

- `SITE.totalTeachers = 15` ✓
- Array GURU: g01 - g15 = 15 guru ✓
- **Status:** Sinkron. Tapi perlu monitor saat ada perubahan.

---

### [M03] Foto Manifest Tidak Ada
**File:** Belum ada  
**Severity:** MEDIUM  
**Status:** ❌ BELUM DIBUAT

**Masalah:**
Tidak ada dokumentasi mapping foto siswa/guru ke file di `asset/profil/`. Ini menyulitkan maintenance ketika:
- Ada penambahan siswa/guru baru
- Perlu update foto
- Onboarding developer baru

**Rekomendasi:**
Buat file `foto-manifest.md` yang berisi:

```markdown
# Foto Manifest - Kelas XI RPL 1

## Naming Convention
- Gunakan **kebab-case** dan **lowercase**
- Format: `nama-siswa.jpg` atau `nama-siswa.jpeg`
- Contoh: `gilang-nur-maulida.jpg`, `bagas-ardiansyah.jpeg`

## Status Foto Siswa

### Sudah Ada Foto (16 siswa):
- s05: manda.jpeg
- s07: aretha.jpeg
- s12: dimas.jpeg
- s13: diva.jpeg
- s14: ena.jpeg
- s16: gita.jpeg
- s17: gilang.jpg
- s18: helcia.jpeg
- s19: hendri.jpeg
- s22: kenza.jpeg
- s25: akbar.jpeg
- s26: nabila.jpeg
- s28: ragilb.jpeg
- s31: rifki.jpeg
- s32: rofig.jpeg

### Belum Ada Foto (17 siswa - Pakai "sementara.png"):
- s01, s02, s03, s06, s10, s11, s14, s18, s22, s23, s24, s26, s29, s30, s31, s32, s33

## Guru Foto

### Sudah Ada Foto (3 guru):
- g11: pak andies.png
- g12: pak endy.jpg
- g15: pak ridwan.jpg

### Belum Ada Foto (12 guru - Pakai "sementara.png"):
- g01-g10, g13-g14
```

---

### [M04] Galeri Caption Hardcoded
**File:** `data.js` (GALERI array, p23-p40)  
**Severity:** MEDIUM  
**Status:** ⚠️ PERLU DIKUSTOMISASI

**Masalah:**
p23-p40 (18 foto) semua punya caption yang sama:
```javascript
"caption": "Pematerian oleh PT-astragraphia"
```

**Rekomendasi:**
- Sesuaikan dengan acara/dokumentasi sebenarnya
- Atau gunakan placeholder yang lebih jelas seperti `"[Dokumentasi Acara]"`
- Atau gunakan tanggal acara: `"Acara XXX - 15 Agustus 2024"`

---

### [M05] Video Deskripsi Kosong
**File:** `data.js` (VIDEO array)  
**Severity:** MEDIUM  
**Status:** ⚠️ KURANG INFORMATIF

**Masalah:**
Beberapa video hanya punya deskripsi `"-"`:

| ID | Judul | Deskripsi |
|----|-------|-----------|
| v09 | TUGAS INFORMATIKA, KOKURIKULER ECOPRINT-KELOMPOK 6 | `-` |
| v10 | TUGAS INFORMATIKA, KOKURIKULER ECOPRINT-KELOMPOK 4 | `-` |
| v14 | TUGAS INFORMATIKA, KOKURIKULER ECOPRINT-KELOMPOK 1 | `-` |
| v15 | TUGAS SENAM IRAMA PJOK, –KELOMPOK 3– | `-` |
| v16-v19 | TUGAS SENAM IRAMA PJOK, ... | `-` |

**Rekomendasi:**
- Isi dengan deskripsi yang meaningful (lihat v11, v12, v13 sebagai contoh)
- Atau biarkan kosong tapi **konsisten** (tidak mixing `-` dan deskripsi)

---

## 🟢 MASALAH LOW PRIORITY

### [L01] Eyebrow Text Galeri Tidak Sesuai
**File:** `galeri.html` (baris 45)  
**Severity:** LOW  
**Status:** ❌ BELUM DIPERBAIKI

**Current:** `"array(30) foto"`  
**Actual:** 40 foto di GALERI array (p01-p40)  
**Fix:** Ubah ke `"array(40) foto"`

---

### [L02] Eyebrow Text Video Sudah Benar (Tapi Ada Issue Lain)
**File:** `video.html` (baris 45)  
**Severity:** LOW  
**Status:** ⚠️ TERGANTUNG FIX C01

**Current:** `"array(16) video"`  
**Note:** Ini akan ketepatan saat C01 (duplikat v16) sudah diperbaiki.

---

### [L03] Encoding Issue di Video Deskripsi
**File:** `data.js` (VIDEO array)  
**Severity:** LOW  
**Status:** ⚠️ MINOR COSMETIC

**Problem:**
Beberapa deskripsi ada karakter corrupt dari copy-paste error:
- v01 (1433): "ðŸŽ™ï¸" (seharusnya emoji 🎙️)
- v04 (1451): "ðŸŽ™ï¸"

**Fix:** Re-encode UTF-8 atau copy-paste ulang dari source

---

### [L04] Smart Quotes di Video Title
**File:** `data.js` (VIDEO array)  
**Severity:** LOW  
**Status:** ⚠️ MINOR COSMETIC

**Problem:**
Beberapa judul pakai smart quotes `"` dan `"` alih-alih regular `"`:
- v15-v19 titles: "TUGAS SENAM IRAMA PJOK, **–KELOMPOK**–" (em dash seharusnya hyphen)

**Fix:** Standardize ke regular `"` dan `–` ke `-`

---

### [L05] Function getGuruName() Hardcoded untuk Genap
**File:** `script.js` (baris 183-196)  
**Severity:** LOW  
**Status:** ⚠️ TECHNICAL DEBT

**Problem:**
```javascript
function getGuruName (parity, hari, mapel, mulai, selesai) {
  if (parity === 'genap') {
    if (hari === 'Senin') return 'Andies Pramudiyantoro, S.Kom';
    if (hari === 'Selasa') return 'Endy Bagus Setyawan R. S.Kom';
    // ... hardcoded untuk setiap hari
  }
  // ...
}
```

**Impact:**
- Jika ada perubahan guru untuk minggu genap, harus update function ini
- Tidak scalable untuk long-term

**Rekomendasi (Long-term):**
Migrate ke dynamic lookup dari JADWAL atau GURU array. Tapi ini low priority karena jarang berubah.

---

### [L06] Foto Siswa Belum Lengkap
**File:** `asset/profil/`  
**Severity:** LOW  
**Status:** ⚠️ INCOMPLETE

**Problem:**
17 siswa masih pakai placeholder `sementara.png`:

```
s01, s02, s03, s06, s10, s11, s14, s18, s22, s23, s24, s26, s29, s30, s31, s32, s33
```

**Rekomendasi:**
- Pasang foto actual untuk 17 siswa tersebut, atau
- Ganti `sementara.png` dengan fallback yang lebih jelas (misalnya avatar dari initials)
- Update data.js dengan foto path yang benar

---

## 📁 File Struktur & Status

```
new - class/
├── index.html              ✅ OK - Halaman beranda
├── siswa.html              ✅ OK - Halaman daftar siswa
├── guru.html               ✅ OK - Halaman daftar guru (perlu check)
├── galeri.html             ⚠️  OK tapi counter salah (L01)
├── video.html              ⚠️  OK tapi ada issue di data (C01, H02-H05)
├── motto.html              ✅ OK - Halaman motto siswa
├── data.js                 ❌ BANYAK ISSUE - Duplikat, encoding, parameter query
├── script.js               ✅ OK - Logic bersama
├── style.css               ✅ OK - Styling responsive
├── readme.md               ✅ OK - Dokumentasi jadwal
└── asset/
    ├── profil/             ⚠️  Foto belum lengkap (L06)
    ├── galeri/             ✅ OK - 41 foto (tapi caption hardcoded)
    └── logo/               ✅ OK - 3 logo
```

---

## 🎯 Prioritas Perbaikan

### 🔴 URGENT (Harus dikerjakan hari ini)
1. **[C01]** Fix duplikat ID v16 → v16-v20 (5 video PJOK)
2. **[H02-H05]** Bersihkan YouTube ID parameter (v05, v07, v11, v73)


### 🟡 HIGH (Minggu ini)
4. **[M03]** Buat `foto-manifest.md` untuk dokumentasi
5. **[M04]** Sesuaikan galeri caption p23-p40
6. **[M05]** Standardize video deskripsi kosong

### 🟢 MEDIUM (Bulan ini)
7. **[L01]** Fix eyebrow galeri ke "array(40)"
8. **[L03, L04]** Fix encoding & smart quotes
9. **[L06]** Lengkapi foto siswa atau ganti fallback

### 💡 NICE-TO-HAVE (Jangka panjang)
10. **[L05]** Refactor `getGuruName()` to dynamic lookup

---

## ✅ Checklist Perbaikan

Gunakan checklist ini untuk tracking progress:

```markdown
## FIX CHECKLIST

### URGENT
- [ ] C01: Fix duplikat v16 (rename ke v17, v18, v19, v20)
- [ ] H02: Clean v05 youtubeId: "Vk_uDWUSOuo&t=31s" → "Vk_uDWUSOuo"
- [ ] H03: Clean v07 youtubeId: "mdycE2tlPX4&t=117s" → "mdycE2tlPX4"
- [ ] H04: Clean v11 youtubeId: "eZfZ70p2d40&t=109s" → "eZfZ70p2d40"
- [ ] H05: Clean v73 youtubeId: "meDKTZ1YdEo&t=7s" → "meDKTZ1YdEo"

### HIGH
- [ ] M03: Create foto-manifest.md
- [ ] M04: Update GALERI p23-p40 caption
- [ ] M05: Standardize VIDEO deskripsi

### MEDIUM
- [ ] L01: Update galeri.html eyebrow ke "array(40)"
- [ ] L03: Fix emoji corrupt di v01, v04
- [ ] L04: Standardize quotes & dashes

### NICE-TO-HAVE
- [ ] L05: Refactor getGuruName() function
- [ ] L06: Collect & add remaining student photos
```

---

## 📝 Kesimpulan

**Strengths:**
- ✅ Arsitektur solid dengan single-source-of-truth (data.js)
- ✅ HTML/CSS/JS responsif dan clean
- ✅ Pattern yang baik untuk maintenance
- ✅ 33 siswa + 15 guru + 40 galeri + 16 video sudah terkompilasi

**Weaknesses:**
- ❌ Data quality issues (duplikat, encoding, parameter)
- ❌ Beberapa foto siswa/guru belum lengkap
- ❌ Dokumentasi foto belum ada
- ⚠️ Catatan siswa ada yang tidak pantas

**Rekomendasi:**
1. Fix semua URGENT issues sebelum deploy
2. Buat `foto-manifest.md` untuk dokumentasi
3. Implementasikan data validation di data.js (sebelum build)
4. Review semua catatan siswa sebelum publish
5. Buat process checklist untuk data quality di masa depan

---

**Generated:** 2026-08-24 11:00 UTC+7  
**Auditor:** Copilot CLI  
**Status:** Draft - Pending Review
