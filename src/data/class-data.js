const classData = window.XIRPL1_DATA;

if (!classData) {
  throw new Error("Class data script must load before the React application.");
}

export const {
  SITE,
  MOTIVASI,
  HARI_LIST,
  HARI_AKTIF,
  GURU,
  SISWA,
  PIKET,
  GURU_JADWAL,
  JADWAL_LAMA,
  JADWAL,
  GALERI,
  VIDEO,
} = classData;
