const SITE = {
  "schoolName": "SMK PGRI 2 PONOROGO",
  "schoolShort": "STERIDA",
  "className": "XI RPL 1",
  "majorName": "Rekayasa Perangkat Lunak",
  "totalStudents": 33,
  "totalTeachers": 15,
  "waliKelas": "Andies Pramudiyantoro, S.Kom"
};

const MOTIVASI = [
  "Kode yang bersih lahir dari niat yang jujur.",
  "Debug hari ini adalah cerita sukses developer esok hari.",
  "Setiap error adalah petunjuk, bukan jalan buntu.",
  "RPL bukan soal menghafal sintaks, tapi soal cara berpikir.",
  "Belajar logika hari ini, bangun sistem besar suatu hari nanti.",
  "Satu baris kode, satu langkah lebih dekat ke solusi.",
  "Programmer hebat lahir dari ribuan kali mencoba lagi.",
  "Jangan takut merah di terminal, takutlah tidak pernah mencoba.",
  "Kolaborasi seperti git merge: butuh komunikasi, bukan ego.",
  "Fitur boleh selesai, belajar tidak pernah 'commit' terakhir."
];

const HARI_LIST = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu"
];
const HARI_AKTIF = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu"
];

const GURU = [
  {
    "id": "g01",
    "nama": "Ema Dwi Novita, S.Pd",
    "mapel": "Matematika",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "g02",
    "nama": "Edlin Vivi Muratrie, S.Pd",
    "mapel": "Sejarah Indonesia",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "g03",
    "nama": "Linda Savitri, S.Pd",
    "mapel": "Kewirausahaan",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "g04",
    "nama": "Afrida Vidiyastuti, S.Pd",
    "mapel": "Bahasa Inggris",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "g05",
    "nama": "Zainul Arifin, S. Ag, M.PdI",
    "mapel": "Pendidikan Agama",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "g06",
    "nama": "Viska Kholifatul Ummah, S.Pd",
    "mapel": "Bahasa Indonesia",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "g07",
    "nama": "Anies Kurniawati, S.Pd",
    "mapel": "Bahasa Jawa",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "g08",
    "nama": "Samsu Nur Zamaniyanto, S.Pd",
    "mapel": "PJOK",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "g09",
    "nama": "Mita Argawati, S.Pd",
    "mapel": "Pendidikan Pancasila",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "g10",
    "nama": "Mutia Dwi Zulfana, S. Pd.",
    "mapel": "Bimbingan Konseling",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "g11",
    "nama": "Andies Pramudiyantoro, S.Kom",
    "mapel": "Pemrograman Perangkat Bergerak",
    "foto": "asset/profil/pak andies.png"
  },
  {
    "id": "g12",
    "nama": "Endy Bagus Setyawan R. S.Kom",
    "mapel": "Administrasi Infrastruktur Jaringan",
    "foto": "asset/profil/pak endy.jpg"
  },
  {
    "id": "g13",
    "nama": "Muh. Faqihuddin Assholih, S.Kom",
    "mapel": "Basis Data",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "g14",
    "nama": "Hendrik Dwi Yusyanto, S.Kom",
    "mapel": "Pemrograman Berorientasi Objek",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "g15",
    "nama": "Ridwan Mudakir, S.Kom",
    "mapel": "Pemrograman Dasar",
    "foto": "asset/profil/pak ridwan.jpg"
  }
];

const SISWA = [
  {
    "id": "s01",
    "nama": "Affandi Fathufrahman",
    "jabatan": "Siswa",
    "hobi": "Basket",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s02",
    "nama": "Ahmad Barak Neilfadli Hardiansyah",
    "jabatan": "Siswa",
    "hobi": "",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s03",
    "nama": "Alecia Poppy Shakira Ayu Kirana",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s04",
    "nama": "Alexa Aditya Cindra Dewi",
    "jabatan": "Seketaris",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s05",
    "nama": "Amanda Cinthya Kasih",
    "jabatan": "Seketaris dan presensi",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/manda.jpeg"
  },
  {
    "id": "s06",
    "nama": "Ardila Wahyuning Putri",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s07",
    "nama": "Aretha Maulina Noviatin",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/aretha.jpeg"
  },
  {
    "id": "s08",
    "nama": "Atha Tandagra Suryansyah",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s09",
    "nama": "Bagas Ardiansyah",
    "jabatan": "Siswa",
    "hobi": "PENCOLI KARAKTER ANIME",
    "catatan": "-",
    "foto": "asset/profil/bagas.jpeg"
  },
  {
    "id": "s10",
    "nama": "Candy Al Azka",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s11",
    "nama": "Celsia Ramadhani",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s12",
    "nama": "Dimas Riang Ilham Saputra",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/dimas.jpeg"
  },
  {
    "id": "s13",
    "nama": "Diva Ayu Permata",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/diva.jpeg"
  },
  {
    "id": "s14",
    "nama": "Ena Zivana Idelia Gita",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/ena.jpeg"
  },
  {
    "id": "s15",
    "nama": "Ficko Adiputra Perdana",
    "jabatan": "Ketua Kelas",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s16",
    "nama": "Gayuh Gita Yulia Natasya",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/gita.jpeg"
  },
  {
    "id": "s17",
    "nama": "Gilang Nur Maulida Faid",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/gilang.jpg"
  },
  {
    "id": "s18",
    "nama": "Helcia Andika Putri",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/helcia.jpeg"
  },
  {
    "id": "s19",
    "nama": "Hedri Setiawan",
    "jabatan": "Persensi Kelas",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/hendri.jpeg"
  },
  {
    "id": "s20",
    "nama": "Ilham Rofig Ananda Barocta",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/rofig.jpeg"
  },
  {
    "id": "s21",
    "nama": "Julian Tri Pratama",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/julian.jpeg"
  },
  {
    "id": "s22",
    "nama": "Kenza Pratama",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/kenza.jpeg"
  },
  {
    "id": "s23",
    "nama": "Khaula Nendra Sukma Athafarel",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s24",
    "nama": "Meta Evilya Giovany",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s25",
    "nama": "Muhamad Akbar Fikriansyah",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/akbar.jpeg"
  },
  {
    "id": "s26",
    "nama": "Nabila' Atha Nur Al Fiyah",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/nabila.jpeg"
  },
  {
    "id": "s27",
    "nama": "Nurul Safika",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/narji.jpg"
  },
  {
    "id": "s28",
    "nama": "Ragil Bagus Nugroho",
    "jabatan": "Bendahara",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/ragilb.jpeg"
  },
  {
    "id": "s29",
    "nama": "Ragil Satria Risdiyanto",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s30",
    "nama": "Relyta Triya Ayu Lestari",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "- mencatat rangkuman pelajaran.",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s31",
    "nama": "Rifky Aditya Saputra",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/rifki.jpeg"
  },
  {
    "id": "s32",
    "nama": "Satria Pradika Bayu Pratama",
    "jabatan": "Siswa",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  },
  {
    "id": "s33",
    "nama": "Sultan Pasha Ibrahim Sukarno",
    "jabatan": "Seketaris",
    "hobi": "-",
    "catatan": "-",
    "foto": "asset/profil/foto_awal/sementara.png"
  }
];

const PIKET = {
  "Senin": [
    "Alexa Aditya Cindra Dewi",
    "Aretha Maulina Noviatin",
    "Atha Tandagra Suryansyah",
    "Gilang Nur Maulida Faid",
    "Nurul Safika"
  ],
  "Selasa": [
    "Relyta Triya Ayu Lestari",
    "Celsia Ramadhani",
    "Ragil Satria Risdiyanto",
    "Julian Tri Pratama",
    "Satria Pradika Bayu Pratama",
    "Rifky Aditya Saputra"
  ],
  "Rabu": [
    "Alecia Poppy Shakira Ayu Kirana",
    "Diva Ayu Permata",
    "Meta Evilya Giovany",
    "Muhamad Akbar Fikriansyah",
    "Dimas Riang Ilham Saputra",
    "Ragil Bagus Nugroho"
  ],
  "Kamis": [
    "Gayuh Gita Yulia Natasya",
    "Helcia Andika Putri",
    "Hedri Setiawan",
    "Sultan Pasha Ibrahim Sukarno",
    "Kenza Pratama"
  ],
  "Jumat": [
    "Ardila Wahyuning Putri",
    "Candy Al Azka",
    "Ahmad Barak Neilfadli Hardiansyah",
    "Bagas Ardiansyah",
    "Ficko Adiputra Perdana"
  ],
  "Sabtu": [
    "Amanda Cinthya Kasih",
    "Ena Zivana Idelia Gita",
    "Nabila' Atha Nur Al Fiyah",
    "Affandi Fathufrahman",
    "Ilham Rofig Ananda Barocta",
    "Khaula Nendra Sukma Athafarel"
  ]
};

const GURU_JADWAL = {
  "genap": {
    "Senin": "Andies Pramudiyantoro, S.Kom",
    "Selasa": "Endy Bagus Setyawan R. S.Kom",
    "Rabu": {
      "sebelum": "Endy Bagus Setyawan R. S.Kom",
      "mulai": "10:15",
      "sesudah": "Muh. Faqihuddin Assholih, S.Kom"
    },
    "Kamis": "Hendrik Dwi Yusyanto, S.Kom",
    "Jumat": "Ridwan Mudakir, S.Kom",
    "Sabtu": "Muh. Faqihuddin Assholih, S.Kom"
  }
};

const JADWAL = {
  "ganjil": {
    "Senin": [
      {
        "jamKe": 0,
        "mulai": "06:45",
        "selesai": "07:30",
        "mapel": "Upacara Bendera"
      },
      {
        "jamKe": 1,
        "mulai": "07:30",
        "selesai": "08:05",
        "mapel": "Matematika"
      },
      {
        "jamKe": 2,
        "mulai": "08:05",
        "selesai": "08:40",
        "mapel": "Matematika"
      },
      {
        "jamKe": 0,
        "mulai": "08:40",
        "selesai": "09:15",
        "istirahat": true,
        "label": "Istirahat I"
      },
      {
        "jamKe": 3,
        "mulai": "09:15",
        "selesai": "09:55",
        "mapel": "Sejarah Indonesia"
      },
      {
        "jamKe": 4,
        "mulai": "09:55",
        "selesai": "10:35",
        "mapel": "Sejarah Indonesia"
      },
      {
        "jamKe": 5,
        "mulai": "10:35",
        "selesai": "11:15",
        "mapel": "Kreativitas Inovasi & Kewirausahaan"
      },
      {
        "jamKe": 6,
        "mulai": "11:15",
        "selesai": "11:55",
        "mapel": "Kreativitas Inovasi & Kewirausahaan"
      },
      {
        "jamKe": 0,
        "mulai": "11:55",
        "selesai": "12:40",
        "istirahat": true,
        "label": "Istirahat II"
      },
      {
        "jamKe": 7,
        "mulai": "12:40",
        "selesai": "13:20",
        "mapel": "Bahasa Inggris"
      },
      {
        "jamKe": 8,
        "mulai": "13:20",
        "selesai": "14:00",
        "mapel": "Bahasa Inggris"
      }
    ],
    "Selasa": [
      {
        "jamKe": 1,
        "mulai": "06:45",
        "selesai": "07:30",
        "mapel": "Pendidikan Agama Budi Pekerti"
      },
      {
        "jamKe": 2,
        "mulai": "07:30",
        "selesai": "08:15",
        "mapel": "Pendidikan Agama Budi Pekerti"
      },
      {
        "jamKe": 0,
        "mulai": "08:15",
        "selesai": "08:50",
        "istirahat": true,
        "label": "Istirahat I"
      },
      {
        "jamKe": 3,
        "mulai": "08:50",
        "selesai": "09:33",
        "mapel": "Bahasa Indonesia"
      },
      {
        "jamKe": 4,
        "mulai": "09:33",
        "selesai": "10:16",
        "mapel": "Bahasa Indonesia"
      },
      {
        "jamKe": 5,
        "mulai": "10:16",
        "selesai": "11:00",
        "mapel": "Matematika"
      },
      {
        "jamKe": 6,
        "mulai": "11:00",
        "selesai": "11:45",
        "mapel": "Matematika"
      },
      {
        "jamKe": 0,
        "mulai": "11:45",
        "selesai": "12:30",
        "istirahat": true,
        "label": "Istirahat II"
      },
      {
        "jamKe": 7,
        "mulai": "12:30",
        "selesai": "13:15",
        "mapel": "Bahasa Inggris"
      },
      {
        "jamKe": 8,
        "mulai": "13:15",
        "selesai": "14:00",
        "mapel": "Bahasa Inggris"
      }
    ],
    "Rabu": [
      {
        "jamKe": 1,
        "mulai": "06:45",
        "selesai": "07:30",
        "mapel": "Bahasa Indonesia"
      },
      {
        "jamKe": 2,
        "mulai": "07:30",
        "selesai": "08:15",
        "mapel": "Bahasa Indonesia"
      },
      {
        "jamKe": 0,
        "mulai": "08:15",
        "selesai": "08:50",
        "istirahat": true,
        "label": "Istirahat I"
      },
      {
        "jamKe": 3,
        "mulai": "08:50",
        "selesai": "09:33",
        "mapel": "Pendidikan Agama Budi Pekerti"
      },
      {
        "jamKe": 4,
        "mulai": "09:33",
        "selesai": "10:16",
        "mapel": "Pendidikan Agama Budi Pekerti"
      },
      {
        "jamKe": 5,
        "mulai": "10:16",
        "selesai": "11:00",
        "mapel": "Bahasa Inggris"
      },
      {
        "jamKe": 6,
        "mulai": "11:00",
        "selesai": "11:45",
        "mapel": "Bahasa Inggris"
      },
      {
        "jamKe": 0,
        "mulai": "11:45",
        "selesai": "12:30",
        "istirahat": true,
        "label": "Istirahat II"
      },
      {
        "jamKe": 7,
        "mulai": "12:30",
        "selesai": "13:15",
        "mapel": "Bahasa Jawa"
      },
      {
        "jamKe": 8,
        "mulai": "13:15",
        "selesai": "14:00",
        "mapel": "Bahasa Jawa"
      }
    ],
    "Kamis": [
      {
        "jamKe": 1,
        "mulai": "06:45",
        "selesai": "07:30",
        "mapel": "Bahasa Indonesia"
      },
      {
        "jamKe": 2,
        "mulai": "07:30",
        "selesai": "08:15",
        "mapel": "Bahasa Indonesia"
      },
      {
        "jamKe": 0,
        "mulai": "08:15",
        "selesai": "08:50",
        "istirahat": true,
        "label": "Istirahat I"
      },
      {
        "jamKe": 3,
        "mulai": "08:50",
        "selesai": "09:33",
        "mapel": "Pendidikan Jasmani Olahraga Kesehatan"
      },
      {
        "jamKe": 4,
        "mulai": "09:33",
        "selesai": "10:16",
        "mapel": "Pendidikan Jasmani Olahraga Kesehatan"
      },
      {
        "jamKe": 5,
        "mulai": "10:16",
        "selesai": "11:00",
        "mapel": "Matematika"
      },
      {
        "jamKe": 6,
        "mulai": "11:00",
        "selesai": "11:45",
        "mapel": "Matematika"
      },
      {
        "jamKe": 0,
        "mulai": "11:45",
        "selesai": "12:30",
        "istirahat": true,
        "label": "Istirahat II"
      },
      {
        "jamKe": 7,
        "mulai": "12:30",
        "selesai": "13:15",
        "mapel": "Sejarah Indonesia"
      },
      {
        "jamKe": 8,
        "mulai": "13:15",
        "selesai": "14:00",
        "mapel": "Sejarah Indonesia"
      }
    ],
    "Jumat": [
      {
        "jamKe": 1,
        "mulai": "06:45",
        "selesai": "07:10",
        "mapel": "Pendidikan Pancasila"
      },
      {
        "jamKe": 2,
        "mulai": "07:10",
        "selesai": "07:35",
        "mapel": "Pendidikan Pancasila"
      },
      {
        "jamKe": 3,
        "mulai": "07:35",
        "selesai": "08:00",
        "mapel": "Bahasa Jawa"
      },
      {
        "jamKe": 4,
        "mulai": "08:00",
        "selesai": "08:25",
        "mapel": "Bahasa Jawa"
      },
      {
        "jamKe": 0,
        "mulai": "08:25",
        "selesai": "09:00",
        "istirahat": true,
        "label": "Istirahat"
      },
      {
        "jamKe": 5,
        "mulai": "09:00",
        "selesai": "09:30",
        "mapel": "Kreativitas Inovasi & Kewirausahaan"
      },
      {
        "jamKe": 6,
        "mulai": "09:30",
        "selesai": "10:00",
        "mapel": "Kreativitas Inovasi & Kewirausahaan"
      },
      {
        "jamKe": 7,
        "mulai": "10:00",
        "selesai": "10:30",
        "mapel": "Bimbingan Konseling"
      },
      {
        "jamKe": 8,
        "mulai": "10:30",
        "selesai": "11:00",
        "mapel": "Bimbingan Konseling"
      }
    ],
    "Sabtu": [
      {
        "jamKe": 1,
        "mulai": "06:45",
        "selesai": "07:15",
        "mapel": "Pendidikan Jasmani Olahraga Kesehatan"
      },
      {
        "jamKe": 2,
        "mulai": "07:15",
        "selesai": "07:45",
        "mapel": "Pendidikan Jasmani Olahraga Kesehatan"
      },
      {
        "jamKe": 3,
        "mulai": "07:45",
        "selesai": "08:15",
        "mapel": "Pendidikan Pancasila"
      },
      {
        "jamKe": 4,
        "mulai": "08:15",
        "selesai": "08:45",
        "mapel": "Pendidikan Pancasila"
      },
      {
        "jamKe": 0,
        "mulai": "08:45",
        "selesai": "09:00",
        "istirahat": true,
        "label": "Istirahat"
      },
      {
        "jamKe": 5,
        "mulai": "09:00",
        "selesai": "09:30",
        "mapel": "Bahasa Inggris"
      },
      {
        "jamKe": 6,
        "mulai": "09:30",
        "selesai": "10:00",
        "mapel": "Bahasa Inggris"
      }
    ]
  },
  "genap": {
    "Senin": [
      {
        "jamKe": 0,
        "mulai": "06:45",
        "selesai": "07:30",
        "mapel": "Upacara Bendera"
      },
      {
        "jamKe": 1,
        "mulai": "07:30",
        "selesai": "08:05",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 2,
        "mulai": "08:05",
        "selesai": "08:40",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 0,
        "mulai": "08:40",
        "selesai": "09:15",
        "istirahat": true,
        "label": "Istirahat I"
      },
      {
        "jamKe": 3,
        "mulai": "09:15",
        "selesai": "09:55",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 4,
        "mulai": "09:55",
        "selesai": "10:35",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 5,
        "mulai": "10:35",
        "selesai": "11:15",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 6,
        "mulai": "11:15",
        "selesai": "11:55",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 0,
        "mulai": "11:55",
        "selesai": "12:40",
        "istirahat": true,
        "label": "Istirahat II"
      },
      {
        "jamKe": 7,
        "mulai": "12:40",
        "selesai": "13:20",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 8,
        "mulai": "13:20",
        "selesai": "14:00",
        "mapel": "Konsentrasi Keahlian RPL"
      }
    ],
    "Selasa": [
      {
        "jamKe": 1,
        "mulai": "06:45",
        "selesai": "07:30",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 2,
        "mulai": "07:30",
        "selesai": "08:15",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 0,
        "mulai": "08:15",
        "selesai": "08:50",
        "istirahat": true,
        "label": "Istirahat I"
      },
      {
        "jamKe": 3,
        "mulai": "08:50",
        "selesai": "09:33",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 4,
        "mulai": "09:33",
        "selesai": "10:16",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 5,
        "mulai": "10:16",
        "selesai": "11:00",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 6,
        "mulai": "11:00",
        "selesai": "11:45",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 0,
        "mulai": "11:45",
        "selesai": "12:30",
        "istirahat": true,
        "label": "Istirahat II"
      },
      {
        "jamKe": 7,
        "mulai": "12:30",
        "selesai": "13:15",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 8,
        "mulai": "13:15",
        "selesai": "14:00",
        "mapel": "Konsentrasi Keahlian RPL"
      }
    ],
    "Rabu": [
      {
        "jamKe": 1,
        "mulai": "06:45",
        "selesai": "07:30",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 2,
        "mulai": "07:30",
        "selesai": "08:15",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 0,
        "mulai": "08:15",
        "selesai": "08:50",
        "istirahat": true,
        "label": "Istirahat I"
      },
      {
        "jamKe": 3,
        "mulai": "08:50",
        "selesai": "09:33",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 4,
        "mulai": "09:33",
        "selesai": "10:16",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 5,
        "mulai": "10:16",
        "selesai": "11:00",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 6,
        "mulai": "11:00",
        "selesai": "11:45",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 0,
        "mulai": "11:45",
        "selesai": "12:30",
        "istirahat": true,
        "label": "Istirahat II"
      },
      {
        "jamKe": 7,
        "mulai": "12:30",
        "selesai": "13:15",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 8,
        "mulai": "13:15",
        "selesai": "14:00",
        "mapel": "Konsentrasi Keahlian RPL"
      }
    ],
    "Kamis": [
      {
        "jamKe": 1,
        "mulai": "06:45",
        "selesai": "07:30",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 2,
        "mulai": "07:30",
        "selesai": "08:15",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 0,
        "mulai": "08:15",
        "selesai": "08:50",
        "istirahat": true,
        "label": "Istirahat I"
      },
      {
        "jamKe": 3,
        "mulai": "08:50",
        "selesai": "09:33",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 4,
        "mulai": "09:33",
        "selesai": "10:16",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 5,
        "mulai": "10:16",
        "selesai": "11:00",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 6,
        "mulai": "11:00",
        "selesai": "11:45",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 0,
        "mulai": "11:45",
        "selesai": "12:30",
        "istirahat": true,
        "label": "Istirahat II"
      },
      {
        "jamKe": 7,
        "mulai": "12:30",
        "selesai": "13:15",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 8,
        "mulai": "13:15",
        "selesai": "14:00",
        "mapel": "Konsentrasi Keahlian RPL"
      }
    ],
    "Jumat": [
      {
        "jamKe": 1,
        "mulai": "06:45",
        "selesai": "07:10",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 2,
        "mulai": "07:10",
        "selesai": "07:35",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 3,
        "mulai": "07:35",
        "selesai": "08:00",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 4,
        "mulai": "08:00",
        "selesai": "08:25",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 0,
        "mulai": "08:25",
        "selesai": "09:00",
        "istirahat": true,
        "label": "Istirahat"
      },
      {
        "jamKe": 5,
        "mulai": "09:00",
        "selesai": "09:30",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 6,
        "mulai": "09:30",
        "selesai": "10:00",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 7,
        "mulai": "10:00",
        "selesai": "10:30",
        "mapel": "Konsentrasi Keahlian RPL"
      },
      {
        "jamKe": 8,
        "mulai": "10:30",
        "selesai": "11:00",
        "mapel": "Konsentrasi Keahlian RPL"
      }
    ],
    "Sabtu": [
      {
        "jamKe": 1,
        "mulai": "06:45",
        "selesai": "07:15",
        "mapel": "Mata Pelajaran Pilihan RPL"
      },
      {
        "jamKe": 2,
        "mulai": "07:15",
        "selesai": "07:45",
        "mapel": "Mata Pelajaran Pilihan RPL"
      },
      {
        "jamKe": 3,
        "mulai": "07:45",
        "selesai": "08:15",
        "mapel": "Mata Pelajaran Pilihan RPL"
      },
      {
        "jamKe": 4,
        "mulai": "08:15",
        "selesai": "08:45",
        "mapel": "Mata Pelajaran Pilihan RPL"
      },
      {
        "jamKe": 0,
        "mulai": "08:45",
        "selesai": "09:00",
        "istirahat": true,
        "label": "Istirahat"
      },
      {
        "jamKe": 5,
        "mulai": "09:00",
        "selesai": "09:30",
        "mapel": "Mata Pelajaran Pilihan RPL"
      },
      {
        "jamKe": 6,
        "mulai": "09:30",
        "selesai": "10:00",
        "mapel": "Mata Pelajaran Pilihan RPL"
      }
    ]
  }
};

const GALERI = [
  {
    "id": "p01",
    "seed": "kelasrpl-1",
    "caption": "Kunjungan Industri, Tour Tempat Wisata. ",
    "foto": "asset/galeri/1.webp"
  },
  {
    "id": "p02",
    "seed": "kelasrpl-2",
    "caption": "Kunjungan ke Gamelab Indonesia",
    "foto": "asset/galeri/2.webp"
  },
  {
    "id": "p03",
    "seed": "kelasrpl-3",
    "caption": "Kerumah Wali Kelas XI RPL 1",
    "foto": "asset/galeri/3.webp"
  },
  {
    "id": "p04",
    "seed": "kelasrpl-4",
    "caption": "Bintalsik",
    "foto": "asset/galeri/4.webp"
  },
  {
    "id": "p05",
    "seed": "kelasrpl-5",
    "caption": "Mujahadah dan Doa Bersama",
    "foto": "asset/galeri/5.webp"
  },
  {
    "id": "p06",
    "seed": "kelasrpl-6",
    "caption": "Bintalsik",
    "foto": "asset/galeri/6.webp"
  },
  {
    "id": "p07",
    "seed": "kelasrpl-7",
    "caption": "Aststragraphia Kelas X RPL",
    "foto": "asset/galeri/7.webp"
  },
  {
    "id": "p08",
    "seed": "kelasrpl-8",
    "caption": "Foto bersama di lapangan",
    "foto": "asset/galeri/8.webp"
  },
  {
    "id": "p09",
    "seed": "kelasrpl-9",
    "caption": "Bintalsik",
    "foto": "asset/galeri/9.webp"
  },
  {
    "id": "p10",
    "seed": "kelasrpl-10",
    "caption": "With The Only One Pak Endy",
    "foto": "asset/galeri/10.webp"
  },
  {
    "id": "p11",
    "seed": "kelasrpl-11",
    "caption": "Foto bersama",
    "foto": "asset/galeri/11.webp"
  },
  {
    "id": "p12",
    "seed": "kelasrpl-12",
    "caption": "Mujahadah dan Doa Bersama",
    "foto": "asset/galeri/12.webp"
  },
  {
    "id": "p13",
    "seed": "kelasrpl-13",
    "caption": "Pondok Putri",
    "foto": "asset/galeri/13.webp"
  },
  {
    "id": "p14",
    "seed": "kelasrpl-14",
    "caption": "Orang-oraang Tantrum",
    "foto": "asset/galeri/14.webp"
  },
  {
    "id": "p15",
    "seed": "kelasrpl-15",
    "caption": "MPLS",
    "foto": "asset/galeri/15.webp"
  },
  {
    "id": "p16",
    "seed": "kelasrpl-16",
    "caption": "Buka Bersama Kelas X RPL",
    "foto": "asset/galeri/16.webp"
  },
  {
    "id": "p17",
    "seed": "kelasrpl-17",
    "caption": "Pondok Putra",
    "foto": "asset/galeri/17.webp"
  },
  {
    "id": "p18",
    "seed": "kelasrpl-18",
    "caption": "Lebaran di rumah wali kelas",
    "foto": "asset/galeri/18.webp"
  },
  {
    "id": "p19",
    "seed": "kelasrpl-19",
    "caption": "Lebaran di rumah wali kelas",
    "foto": "asset/galeri/19.webp"
  },
  {
    "id": "p20",
    "seed": "kelasrpl-20",
    "caption": "Lebaran di rumah wali kelas",
    "foto": "asset/galeri/20.webp"
  },
  {
    "id": "p21",
    "seed": "kelasrpl-21",
    "caption": "Lebaran di rumah wali kelas",
    "foto": "asset/galeri/21.webp"
  },
  {
    "id": "p22",
    "seed": "kelasrpl-22",
    "caption": "Orang-orang Stress",
    "foto": "asset/galeri/22.webp"
  },
  {
    "id": "p23",
    "seed": "kelasrpl-23",
    "caption": "Takbir Keliling",
    "foto": "asset/galeri/23.webp"
  },
  {
    "id": "p24",
    "seed": "kelasrpl-24",
    "caption": "Takbir Keliling",
    "foto": "asset/galeri/24.webp"
  },
  {
    "id": "p25",
    "seed": "kelasrpl-25",
    "caption": "Takbir Keliling",
    "foto": "asset/galeri/25.webp"
  },
  {
    "id": "p26",
    "seed": "kelasrpl-26",
    "caption": "Takbir Keliling",
    "foto": "asset/galeri/26.webp"
  },
  {
    "id": "p27",
    "seed": "kelasrpl-27",
    "caption": "With Bu emma",
    "foto": "asset/galeri/27.webp"
  },
  {
    "id": "p28",
    "seed": "kelasrpl-28",
    "caption": "The RPL Boys",
    "foto": "asset/galeri/28.webp"
  },
  {
    "id": "p29",
    "seed": "kelasrpl-29",
    "caption": "With Bu emma",
    "foto": "asset/galeri/29.webp"
  },
  {
    "id": "p30",
    "seed": "kelasrpl-30",
    "caption": "Fotbar",
    "foto": "asset/galeri/30.webp"
  },
  {
    "id": "p31",
    "seed": "kelasrpl-31",
    "caption": "Renang",
    "foto": "asset/galeri/31.webp"
  },
  {
    "id": "p32",
    "seed": "kelasrpl-32",
    "caption": "Fotbar",
    "foto": "asset/galeri/32.webp"
  },
  {
    "id": "p33",
    "seed": "kelasrpl-33",
    "caption": "Renang",
    "foto": "asset/galeri/33.webp"
  },
  {
    "id": "p34",
    "seed": "kelasrpl-34",
    "caption": "Renang",
    "foto": "asset/galeri/34.webp"
  },
  {
    "id": "p35",
    "seed": "kelasrpl-35",
    "caption": "Dokumentasi kegiatan bersama PT Astragraphia - foto 1",
    "foto": "asset/galeri/35.webp"
  },
  {
    "id": "p36",
    "seed": "kelasrpl-36",
    "caption": "Dokumentasi kegiatan bersama PT Astragraphia - foto 2",
    "foto": "asset/galeri/36.webp"
  },
  {
    "id": "p37",
    "seed": "kelasrpl-37",
    "caption": "Dokumentasi kegiatan bersama PT Astragraphia - foto 3",
    "foto": "asset/galeri/37.webp"
  },
  {
    "id": "p38",
    "seed": "kelasrpl-38",
    "caption": "Dokumentasi kegiatan bersama PT Astragraphia - foto 4",
    "foto": "asset/galeri/38.webp"
  },
  {
    "id": "p39",
    "seed": "kelasrpl-39",
    "caption": "Dokumentasi kegiatan bersama PT Astragraphia - foto 5",
    "foto": "asset/galeri/39.webp"
  },
  {
    "id": "p40",
    "seed": "kelasrpl-40",
    "caption": "Dokumentasi kegiatan bersama PT Astragraphia - foto 6",
    "foto": "asset/galeri/40.webp"
  }
];

const VIDEO = [
  {
    "id": "v01",
    "youtubeId": "m8PGMHXMstw",
    "judul": "TUGAS IPAS, PODCAST REMAJA STERIDA-KELOMPOK 2",
    "deskripsi": "Terima kasih telah menonton. Jangan lupa memberikan dukungan dan masukan yang membangun. Selamat menyaksikan! 🎙️"
  },
  {
    "id": "v02",
    "youtubeId": "fomuBMTB5hs",
    "judul": "TUGAS IPAS, PODCAST REMAJA STERIDA-KELOMPOK 3",
    "deskripsi": "Pada video podcast kali ini, kelompok kami membahas topik yang menarik dan bermanfaat untuk menambah wawasan. Melalui diskusi santai namun informatif, kami saling bertukar pendapat, memberikan penjelasan, serta menyampaikan informasi terkait materi yang telah dipelajari."
  },
  {
    "id": "v03",
    "youtubeId": "4Mul3bb4_WI",
    "judul": "TUGAS IPAS, PODCAST REMAJA STERIDA-KELOMPOK 5",
    "deskripsi": "Podcast ini dibuat sebagai bagian dari tugas kelompok untuk melatih kemampuan komunikasi, kerja sama tim, serta pemahaman materi. Semoga pembahasan yang kami sajikan dapat memberikan manfaat dan menambah pengetahuan bagi para penonton."
  },
  {
    "id": "v04",
    "youtubeId": "9ujA_ZNEcRc",
    "judul": "TUGAS IPAS, PODCAST REMAJA STERIDA-KELOMPOK 1",
    "deskripsi": "Terima kasih telah menonton. Jangan lupa memberikan dukungan dan masukan yang membangun. Selamat menyaksikan! 🎙️"
  },
  {
    "id": "v05",
    "youtubeId": "Vk_uDWUSOuo",
    "judul": "TUGAS IPAS, PODCAST REMAJA STERIDA-KELOMPOK 6",
    "deskripsi": "Podcast ini dibuat sebagai bagian dari tugas kelompok untuk melatih kemampuan komunikasi, kerja sama tim, serta pemahaman materi. Semoga pembahasan yang kami sajikan dapat memberikan manfaat dan menambah pengetahuan bagi para penonton."
  },
  {
    "id": "v06",
    "youtubeId": "4rU3nFkvipQ",
    "judul": "TUGAS IPAS, PODCAST REMAJA STERIDA-KELOMPOK 7",
    "deskripsi": "Pada video podcast kali ini, kelompok kami membahas topik yang menarik dan bermanfaat untuk menambah wawasan. Melalui diskusi santai namun informatif, kami saling bertukar pendapat, memberikan penjelasan, serta menyampaikan informasi terkait materi yang telah dipelajari."
  },
  {
    "id": "v07",
    "youtubeId": "mdycE2tlPX4",
    "judul": "TUGAS IPAS, PODCAST REMAJA STERIDA-KELOMPOK 8",
    "deskripsi": "Podcast ini dibuat sebagai bagian dari tugas kelompok untuk melatih kemampuan komunikasi, kerja sama tim, serta pemahaman materi. Semoga pembahasan yang kami sajikan dapat memberikan manfaat dan menambah pengetahuan bagi para penonton."
  },
  {
    "id": "v08",
    "youtubeId": "meDKTZ1YdEo",
    "judul": "TUGAS IPAS, PODCAST REMAJA STERIDA-KELOMPOK 4",
    "deskripsi": "Terima kasih telah menonton. Jangan lupa memberikan dukungan dan masukan yang membangun. Selamat menyaksikan! 🎙️"
  },
  {
    "id": "v09",
    "youtubeId": "JSjp0qdOrhU",
    "judul": "TUGAS INFORMATIKA, KOKURIKULER ECOPRINT-KELOMPOK 6",
    "deskripsi": "Dokumentasi tugas ecoprint kelompok 6 dalam kegiatan kokurikuler Informatika."
  },
  {
    "id": "v10",
    "youtubeId": "1dzLr_jYjSk",
    "judul": "TUGAS INFORMATIKA, KOKURIKULER ECOPRINT-KELOMPOK 4",
    "deskripsi": "Dokumentasi tugas ecoprint kelompok 4 dalam kegiatan kokurikuler Informatika."
  },
  {
    "id": "v11",
    "youtubeId": "eZfZ70p2d40",
    "judul": "TUGAS INFORMATIKA, KOKURIKULER ECOPRINT-KELOMPOK 2",
    "deskripsi": "Ecoprint adalah teknik mencetak motif pada kain dengan memanfaatkan bahan-bahan alami seperti daun, bunga, batang, atau bagian tumbuhan lainnya. Proses ini dilakukan dengan cara menempelkan bahan alami ke permukaan kain, kemudian ditekan atau dipukul, dikukus, atau direbus agar warna dan bentuk alaminya berpindah ke kain."
  },
  {
    "id": "v12",
    "youtubeId": "PjFZoJ6tjcE",
    "judul": "TUGAS INFORMATIKA, KOKURIKULER ECOPRINT-KELOMPOK 3",
    "deskripsi": "Ecoprint termasuk dalam kerajinan ramah lingkungan karena tidak menggunakan bahan kimia berbahaya, melainkan memanfaatkan pigmen alami dari tumbuhan. Setiap hasil ecoprint bersifat unik karena bentuk, warna, dan susunan daun tidak pernah sama."
  },
  {
    "id": "v13",
    "youtubeId": "RBJ51JXEsCE",
    "judul": "TUGAS INFORMATIKA, KOKURIKULER ECOPRINT-KELOMPOK 5",
    "deskripsi": "Secara umum, ecoprint tidak hanya menghasilkan karya seni yang indah, tetapi juga menjadi bentuk pemanfaatan alam secara bijak serta mendukung konsep keberlanjutan"
  },
  {
    "id": "v14",
    "youtubeId": "as5K6CLsZ3U",
    "judul": "TUGAS INFORMATIKA, KOKURIKULER ECOPRINT-KELOMPOK 1",
    "deskripsi": "Dokumentasi tugas ecoprint kelompok 1 dalam kegiatan kokurikuler Informatika."
  },
  {
    "id": "v16",
    "youtubeId": "_37Q372oCN0",
    "judul": "TUGAS SENAM IRAMA PJOK, -KELOMPOK 3-",
    "deskripsi": "Dokumentasi tugas senam irama PJOK kelompok 3."
  },
  {
    "id": "v17",
    "youtubeId": "4d_gBm2nfeE",
    "judul": "TUGAS SENAM IRAMA PJOK, -KELOMPOK 1-",
    "deskripsi": "Dokumentasi tugas senam irama PJOK kelompok 1."
  },
  {
    "id": "v18",
    "youtubeId": "lY4tZ2UVyQ4",
    "judul": "TUGAS SENAM IRAMA PJOK, -KELOMPOK 5-",
    "deskripsi": "Dokumentasi tugas senam irama PJOK kelompok 5."
  },
  {
    "id": "v19",
    "youtubeId": "WTjDbSP8ra4",
    "judul": "TUGAS SENAM IRAMA PJOK, -KELOMPOK 2-",
    "deskripsi": "Dokumentasi tugas senam irama PJOK kelompok 2."
  },
  {
    "id": "v20",
    "youtubeId": "TWaH1cEmxS4",
    "judul": "TUGAS SENAM IRAMA PJOK, -KELOMPOK 4-",
    "deskripsi": "Dokumentasi tugas senam irama PJOK kelompok 4."
  }
  
];

const MOTTO = [
  {
    "nama": "Affandi Fathufrahman",
    "motto": "Belajar hari ini, berkarya esok hari."
  },
  {
    "nama": "Ahmad Barak Neilfadli Hardiansyah",
    "motto": "Error bukan akhir, tapi awal dari solusi."
  },
  {
    "nama": "Alecia Poppy Shakira Ayu Kirana",
    "motto": "Konsisten itu lebih penting dari cepat."
  },
  {
    "nama": "Alexa Aditya Cindra Dewi",
    "motto": "Kode boleh rumit, semangat harus tetap jernih."
  },
  {
    "nama": "Amanda Cinthya Kasih",
    "motto": "Gagal compile bukan berarti gagal total."
  },
  {
    "nama": "Ardila Wahyuning Putri",
    "motto": "Setiap baris kode adalah langkah kecil menuju mimpi besar."
  },
  {
    "nama": "Aretha Maulina Noviatin",
    "motto": "Jangan takut salah, takutlah tidak pernah mencoba."
  },
  {
    "nama": "Atha Tandagra Suryansyah",
    "motto": "Logika kuat, hasil pun kuat."
  },
  {
    "nama": "Bagas Ardiansyah",
    "motto": "Belajar dari bug, tumbuh jadi tangguh."
  },
  {
    "nama": "Candy Al Azka",
    "motto": "Ide sekecil apapun layak dicoba jadi kode."
  },
  {
    "nama": "Celsia Ramadhani",
    "motto": "Fokus pada progres, bukan kesempurnaan."
  },
  {
    "nama": "Dimas Riang Ilham Saputra",
    "motto": "Coding itu seni menyelesaikan masalah."
  },
  {
    "nama": "Diva Ayu Permata",
    "motto": "Hari ini belajar, besok jadi ahli."
  },
  {
    "nama": "Ena Zivana Idelia Gita",
    "motto": "Kesabaran adalah compiler terbaik untuk mimpi."
  },
  {
    "nama": "Ficko Adiputra Perdana",
    "motto": "Satu fitur selesai, satu langkah lebih dekat."
  },
  {
    "nama": "Gayuh Gita Yulia Natasya",
    "motto": "Semangat belajar tidak pernah out of scope."
  },
  {
    "nama": "Gilang Nur Maulida Faid",
    "motto": "Ilmu RPL bekal masa depan yang nyata."
  },
  {
    "nama": "Helcia Andika Putri",
    "motto": "Jangan copy paste hidup, tulis sendiri ceritamu."
  },
  {
    "nama": "Hedri Setiawan",
    "motto": "Berani mencoba, berani memperbaiki."
  },
  {
    "nama": "Ilham Rofig Ananda Barocta",
    "motto": "Kegagalan hanyalah warning, bukan error fatal."
  },
  {
    "nama": "Julian Tri Pratama",
    "motto": "Terus belajar walau signal lemah, semangat tetap kuat."
  },
  {
    "nama": "Kenza Pratama",
    "motto": "Detail kecil menentukan kualitas besar."
  },
  {
    "nama": "Khaula Nendra Sukma Athafarel",
    "motto": "Kolaborasi adalah kunci proyek yang sukses."
  },
  {
    "nama": "Meta Evilya Giovany",
    "motto": "Mimpi besar dimulai dari baris kode pertama."
  },
  {
    "nama": "Muhamad Akbar Fikriansyah",
    "motto": "Jangan pernah berhenti nge-push diri sendiri."
  },
  {
    "nama": "Nabila' Atha Nur Al Fiyah",
    "motto": "Belajar itu proses looping tanpa henti."
  },
  {
    "nama": "Nurul Safika",
    "motto": "Kesalahan hari ini, pelajaran untuk versi diri yang baru."
  },
  {
    "nama": "Ragil Bagus Nugroho",
    "motto": "Semangat belajar adalah variabel yang harus selalu di-update."
  },
  {
    "nama": "Ragil Satria Risdiyanto",
    "motto": "Rajin praktik, teori pun jadi nyata."
  },
  {
    "nama": "Relyta Triya Ayu Lestari",
    "motto": "Ilmu yang dibagikan tidak pernah berkurang."
  },
  {
    "nama": "Rifky Aditya Saputra",
    "motto": "Konsisten kecil lebih baik dari niat besar tanpa aksi."
  },
  {
    "nama": "Satria Pradika Bayu Pratama",
    "motto": "Cintai proses, hasil akan mengikuti."
  },
  {
    "nama": "Sultan Pasha Ibrahim Sukarno",
    "motto": "Kelas XI RPL 1, belajar bersama menuju hebat."
  }
];
