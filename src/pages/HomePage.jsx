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

function minutesOfDay(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatAgendaDate(date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function guruName(parity, day, subject, start) {
  const schedule = GURU_JADWAL[parity]?.[day];
  if (typeof schedule === "string") return schedule;
  if (schedule) {
    return minutesOfDay(start) < minutesOfDay(schedule.mulai) ? schedule.sebelum : schedule.sesudah;
  }
  const aliases = {
    "Pendidikan Agama Budi Pekerti": "Pendidikan Agama",
    "Pendidikan Jasmani Olahraga Kesehatan": "PJOK",
    "Kreativitas Inovasi & Kewirausahaan": "Kewirausahaan",
  };
  return GURU.find(teacher => teacher.mapel === (aliases[subject] || subject))?.nama || "—";
}

function ScheduleList({ date, now, isToday }) {
  const day = HARI_LIST[date.getDay()];
  const parity = parityFor(date);
  if (!HARI_AKTIF.includes(day)) {
    return <p className="empty-note">Tidak ada jadwal pelajaran untuk hari {day}.</p>;
  }
  const rows = JADWAL[parity][day] || [];
  const nowInMinutes = now.getHours() * 60 + now.getMinutes();
  const currentIndex = isToday
    ? rows.findIndex(row =>
      typeof row !== "string" &&
      minutesOfDay(row.mulai) <= nowInMinutes &&
      nowInMinutes < minutesOfDay(row.selesai)
    )
    : -1;
  const nextIndex = isToday && currentIndex < 0
    ? rows.findIndex(row =>
      typeof row !== "string" && minutesOfDay(row.mulai) > nowInMinutes
    )
    : -1;

  return rows.map((row, index) => {
    if (typeof row === "string") {
      return <p className="empty-note" key={index}>{row}</p>;
    }
    const isCurrent = index === currentIndex;
    const isNext = index === nextIndex;
    const rowClassName = [
      "agenda-row",
      row.istirahat && "agenda-row--break",
      isCurrent && "agenda-row--current",
      isNext && "agenda-row--next",
    ].filter(Boolean).join(" ");

    return (
      <div className={rowClassName} key={`${row.jamKe}-${row.mulai}`} aria-current={isCurrent ? "time" : undefined}>
        <span className="agenda-row-marker" aria-hidden="true" />
        <time className="agenda-row-time">
          <span>{row.mulai}</span>
          <span>{row.selesai}</span>
        </time>
        <div className="agenda-row-content">
          <div className="agenda-row-title">
            <strong>{row.istirahat ? row.label : row.mapel}</strong>
            {(isCurrent || isNext) && (
              <span className="agenda-row-badge">
                {isCurrent ? row.istirahat ? "Istirahat" : "Berlangsung" : "Berikutnya"}
              </span>
            )}
          </div>
          {!row.istirahat && <small>{guruName(parity, day, row.mapel, row.mulai)}</small>}
        </div>
      </div>
    );
  });
}

function DutyList({ date }) {
  const day = HARI_LIST[date.getDay()];
  const names = HARI_AKTIF.includes(day) ? PIKET[day] : null;
  if (!names) return <p className="agenda-empty">Tidak ada jadwal piket untuk hari {day}.</p>;
  return (
    <ul className="duty-list piket-list">
      {names.map((name, index) => (
        <li key={name}>
          <span className="duty-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <span>{name}</span>
        </li>
      ))}
    </ul>
  );
}

function AgendaDashboard({ now }) {
  const [dayOffset, setDayOffset] = useState(0);
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  const day = HARI_LIST[date.getDay()];
  const parity = parityFor(date);
  const isToday = dayOffset === 0;
  const options = [0, 1].map(offset => {
    const optionDate = new Date(now);
    optionDate.setDate(optionDate.getDate() + offset);
    return { offset, date: optionDate };
  });
  const rows = HARI_AKTIF.includes(day) ? JADWAL[parity][day] || [] : [];
  const nowInMinutes = now.getHours() * 60 + now.getMinutes();
  const currentRow = isToday
    ? rows.find(row =>
      typeof row !== "string" &&
      minutesOfDay(row.mulai) <= nowInMinutes &&
      nowInMinutes < minutesOfDay(row.selesai)
    )
    : null;
  const nextRow = isToday && !currentRow
    ? rows.find(row => typeof row !== "string" && minutesOfDay(row.mulai) > nowInMinutes)
    : null;
  const scheduleStatus = !HARI_AKTIF.includes(day)
    ? "Tidak ada jadwal pelajaran"
    : currentRow
      ? currentRow.istirahat ? "Waktu istirahat" : "Pelajaran sedang berlangsung"
      : nextRow ? "Menunggu pelajaran berikutnya" : "Jadwal hari ini selesai";

  return (
    <section className="agenda-dashboard" aria-labelledby="agenda-heading">
      <div className="agenda-heading">
        <div>
          <span className="route-label">AGENDA KELAS</span>
          <h2 id="agenda-heading">Jadwal &amp; piket</h2>
          <p>Rencana belajar dan petugas kelas dalam satu tampilan.</p>
        </div>
        <div className="agenda-day-picker" aria-label="Pilih hari jadwal">
          {options.map(({ offset, date: optionDate }) => (
            <button
              className="agenda-day-button"
              type="button"
              key={offset}
              aria-pressed={dayOffset === offset}
              onClick={() => setDayOffset(offset)}
            >
              <span>{offset === 0 ? "Hari ini" : "Besok"}</span>
              <small>{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(optionDate)}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="agenda-layout">
        <section className="agenda-card agenda-card--schedule" aria-labelledby="schedule-heading">
          <header className="agenda-card-header">
            <div>
              <span className="agenda-eyebrow">{formatAgendaDate(date)}</span>
              <h3 id="schedule-heading">Jadwal pelajaran</h3>
            </div>
            <span className="agenda-week">Minggu {parity}</span>
          </header>
          {isToday && (
            <div className={`agenda-status${currentRow ? " agenda-status--active" : ""}`} aria-live="polite">
              <span className="agenda-status-dot" aria-hidden="true" />
              <span>{scheduleStatus}</span>
              <time>{new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(now)}</time>
            </div>
          )}
          <div className="agenda-timeline">
            <ScheduleList date={date} now={now} isToday={isToday} />
          </div>
        </section>

        <section className="agenda-card agenda-card--duty" aria-labelledby="duty-heading">
          <header className="agenda-card-header">
            <div>
              <span className="agenda-eyebrow">{day}</span>
              <h3 id="duty-heading">Petugas piket</h3>
            </div>
            {HARI_AKTIF.includes(day) && (
              <span className="duty-count">{PIKET[day]?.length || 0} siswa</span>
            )}
          </header>
          <p className="duty-intro">Tim yang bertugas menjaga kelas tetap nyaman.</p>
          <DutyList date={date} />
        </section>
      </div>
    </section>
  );
}

export function HomePage({ route }) {
  const [motivationIndex, setMotivationIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());

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

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

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

      <div className="container">
        <AgendaDashboard now={now} />
      </div>

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
