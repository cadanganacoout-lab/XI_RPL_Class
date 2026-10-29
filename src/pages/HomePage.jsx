import React, { useEffect, useState } from "react";
import {
  GURU,
  GURU_JADWAL,
  HARI_AKTIF,
  HARI_LIST,
  JADWAL,
  MOTIVASI,
  PIKET,
  SITE,
} from "../data/class-data.js";
import { CommentsSection } from "./CommentsPage.jsx";

function getISOWeek(date) {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return Math.ceil(((day - yearStart) / 86400000 + 1) / 7);
}

function parityFor(date) {
  return getISOWeek(date) % 2 === 1 ? "genap" : "ganjil";
}

function guruName(parity, day, subject, start) {
  const schedule = GURU_JADWAL[parity]?.[day];
  if (typeof schedule === "string") return schedule;
  if (schedule) {
    const toMinutes = time => time.split(":").map(Number).reduce((hours, minutes) => hours * 60 + minutes);
    return toMinutes(start) < toMinutes(schedule.mulai) ? schedule.sebelum : schedule.sesudah;
  }
  const aliases = {
    "Pendidikan Agama Budi Pekerti": "Pendidikan Agama",
    "Pendidikan Jasmani Olahraga Kesehatan": "PJOK",
    "Kreativitas Inovasi & Kewirausahaan": "Kewirausahaan",
  };
  return GURU.find(teacher => teacher.mapel === (aliases[subject] || subject))?.nama || "—";
}

function ScheduleList({ date, label }) {
  const day = HARI_LIST[date.getDay()];
  const parity = parityFor(date);
  if (!HARI_AKTIF.includes(day)) {
    return <p className="empty-note">{label} {day}, tidak ada jadwal pelajaran.</p>;
  }
  const rows = JADWAL[parity][day] || [];
  return rows.map((row, index) => {
    if (typeof row === "string") return <p className="empty-note" key={index}>{row}</p>;
    if (row.istirahat) {
      return (
        <div className="schedule-row schedule-row--break" key={index}>
          <span className="schedule-row-number" aria-hidden="true">{index + 1}</span>
          <span>{row.label}</span>
          <time>{row.mulai}–{row.selesai}</time>
        </div>
      );
    }
    return (
      <div className="schedule-row" key={`${row.jamKe}-${row.mulai}`}>
        <span className="schedule-row-number" aria-hidden="true">{index + 1}</span>
        <time>{row.mulai}–{row.selesai}</time>
        <span className="schedule-subject">
          <strong>{row.mapel}</strong>
          <small>{guruName(parity, day, row.mapel, row.mulai)}</small>
        </span>
      </div>
    );
  });
}

function DutyList({ date, label }) {
  const day = HARI_LIST[date.getDay()];
  const names = HARI_AKTIF.includes(day) ? PIKET[day] : null;
  if (!names) return <p className="empty-note">Tidak ada jadwal piket {label.toLowerCase()}.</p>;
  return (
    <ul className="duty-list piket-list">
      {names.map(name => <li key={name}>{name}</li>)}
    </ul>
  );
}

function DaySchedule({ date, label, today = false }) {
  const day = HARI_LIST[date.getDay()];
  const parity = parityFor(date);
  return (
    <section className={`home-cell home-schedule${today ? " home-schedule--today" : ""}`}>
      <div className="panel-head">
        <h2>{label}</h2>
        <span className="label-mono">{day} · minggu {parity}</span>
      </div>
      <div className="schedule-list sched-list"><ScheduleList date={date} label={label} /></div>
    </section>
  );
}

function DayDuty({ date, label, today = false }) {
  return (
    <section className={`home-cell home-duty${today ? " home-duty--today" : ""}`}>
      <div className="panel-head">
        <h2>Piket {label}</h2>
      </div>
      <div className="duty-list-wrap"><DutyList date={date} label={label} /></div>
    </section>
  );
}

export function HomePage({ route }) {
  const [motivationIndex, setMotivationIndex] = useState(0);

  useEffect(() => {
    if (route === "komentar") {
      document.getElementById("diskusi")?.scrollIntoView({ block: "start" });
    }
  }, [route]);

  useEffect(() => {
    if (MOTIVASI.length < 2) return undefined;
    const intervalId = window.setInterval(() => {
      setMotivationIndex(index => (index + 1) % MOTIVASI.length);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const featuredMotivation = MOTIVASI[motivationIndex] || "";

  return (
    <>
      <section className="container hero-beranda">
        <div className="hero-copy">
          <span className="route-label">PORTAL DIGITAL · KELAS KAMI</span>
          <h1 className="hero-title">
            Belajar hari ini,<br /><span>membangun esok.</span>
          </h1>
          <p className="hero-major">{SITE.className} · {SITE.majorName}</p>
          <p className="hero-description">
            Ruang digital untuk mengenal warga kelas, melihat jadwal, dan menyimpan cerita perjalanan kami.
          </p>
          <a className="hero-cta" href="#/siswa">Kenali kelas kami <span aria-hidden="true">↗</span></a>
        </div>
        <div className="code-window" aria-hidden="true">
          <div className="code-window-bar">
            <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
            <span>kelas-xi-rpl.json</span>
            <span aria-hidden="true">•••</span>
          </div>
          <div className="code-window-body" aria-hidden="true">
            <span className="code-line"><i>01</i><b className="code-purple">const</b> kelas = {'{'}</span>
            <span className="code-line"><i>02</i>&nbsp; nama: <b className="code-green">"{SITE.className}"</b>,</span>
            <span className="code-line"><i>03</i>&nbsp; sekolah: <b className="code-green">"{SITE.schoolShort}"</b>,</span>
            <span className="code-line"><i>04</i>&nbsp; siswa: <b className="code-orange">{SITE.totalStudents}</b>,</span>
            <span className="code-line"><i>05</i>&nbsp; fokus: <b className="code-green">"berkarya bersama"</b></span>
            <span className="code-line"><i>06</i>{'}'}<b className="code-cursor">_</b></span>
          </div>
          <div className="code-window-foot"><span>●</span> Semangat belajar aktif</div>
        </div>
      </section>

      <section className="container home-grid frame-grid" aria-label="Ringkasan kelas">
        <div className="home-cell home-statistics">
          <div className="panel-head"><h2>Ringkasan kelas</h2></div>
          <div className="stat-row">
            <div className="stat-item stat-card">
              <span className="stat-value">{SITE.totalStudents}</span>
              <span className="stat-label">Siswa</span>
            </div>
            <div className="stat-item stat-card">
              <span className="stat-value">{SITE.totalTeachers}</span>
              <span className="stat-label">Guru</span>
            </div>
            <div className="stat-item stat-card">
              <span className="stat-value stat-value--name">{SITE.waliKelas}</span>
              <span className="stat-label">Wali kelas</span>
            </div>
          </div>
        </div>

        <DaySchedule date={now} label="Jadwal hari ini" today />
        <DayDuty date={now} label="Hari ini" today />
        <DaySchedule date={tomorrow} label="Jadwal besok" />
        <DayDuty date={tomorrow} label="Besok" />
        <section className="home-cell home-motivation">
          <div className="panel-head">
            <h2>Motivasi</h2>
            <span className="motivation-count" aria-hidden="true">
              {String(motivationIndex + 1).padStart(2, "0")} / {String(MOTIVASI.length).padStart(2, "0")}
            </span>
          </div>
          <blockquote key={motivationIndex} className="motivation-quote" aria-live="polite">
            {featuredMotivation}
          </blockquote>
        </section>
      </section>
      <CommentsSection />
    </>
  );
}
