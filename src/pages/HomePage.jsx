import React, { useEffect, useRef, useState } from "react";
import {
  GALERI,
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

const welcomePhotos = [...new Set(
  GALERI
    .map(photo => typeof photo.foto === "string" ? photo.foto.trim() : "")
    .filter(Boolean),
)];

function WelcomeBackground() {
  const [images, setImages] = useState([null, null]);
  const [activeLayer, setActiveLayer] = useState(0);
  const [activePhotoIndex, setActivePhotoIndex] = useState(null);
  const [isTabVisible, setIsTabVisible] = useState(() => document.visibilityState !== "hidden");

  useEffect(() => {
    let cancelled = false;

    function loadNextPhoto(index) {
      if (cancelled || index >= welcomePhotos.length) return;
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        setImages([welcomePhotos[index], null]);
        setActivePhotoIndex(index);
      };
      image.onerror = () => loadNextPhoto(index + 1);
      image.src = welcomePhotos[index];
    }

    loadNextPhoto(0);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const updateVisibility = () => setIsTabVisible(document.visibilityState !== "hidden");

    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (
      !isTabVisible ||
      activePhotoIndex === null ||
      welcomePhotos.length < 2
    ) return undefined;

    let cancelled = false;
    let animationFrame;
    let timeoutId;

    function preloadNextPhoto(fromIndex, remaining) {
      if (cancelled || remaining <= 0) return;
      const nextIndex = (fromIndex + 1) % welcomePhotos.length;
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        const nextLayer = 1 - activeLayer;
        setImages(currentImages => currentImages.map((source, index) =>
          index === nextLayer ? welcomePhotos[nextIndex] : source
        ));
        animationFrame = window.requestAnimationFrame(() => {
          if (cancelled) return;
          setActiveLayer(nextLayer);
          setActivePhotoIndex(nextIndex);
        });
      };
      image.onerror = () => preloadNextPhoto(nextIndex, remaining - 1);
      image.src = welcomePhotos[nextIndex];
    }

    timeoutId = window.setTimeout(
      () => preloadNextPhoto(activePhotoIndex, welcomePhotos.length - 1),
      4000,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [activeLayer, activePhotoIndex, isTabVisible]);

  return (
    <div className="welcome-background" aria-hidden="true">
      {images.map((source, index) => source && (
        <img
          className={`welcome-background-image${index === activeLayer ? " is-active" : ""}`}
          src={source}
          alt=""
          key={index}
          fetchPriority={index === activeLayer ? "high" : "auto"}
        />
      ))}
      <div className="welcome-overlay" />
    </div>
  );
}

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
  const dashboardRef = useRef(null);

  useEffect(() => {
    if (route === "komentar") {
      document.getElementById("diskusi")?.scrollIntoView({ block: "start" });
    }
  }, [route]);

  useEffect(() => {
    const dashboard = dashboardRef.current;
    if (!dashboard || typeof window.IntersectionObserver !== "function") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const observer = new window.IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        dashboard.classList.add("is-visible");
        observer.unobserve(dashboard);
      }
    }, { threshold: 0.05, rootMargin: "0px 0px -6% 0px" });

    observer.observe(dashboard);
    return () => observer.disconnect();
  }, []);

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
    <div className="home-unveil">
      <section className="welcome-hero hero-beranda" aria-labelledby="welcome-title">
        <WelcomeBackground />
        <div className="welcome-content">
          <span className="welcome-eyebrow">PORTAL DIGITAL · {SITE.className}</span>
          <h1 id="welcome-title">Selamat Datang</h1>
          <p className="welcome-slogan">RPL! JAYA JAYA JAYA</p>
          <p className="welcome-class">{SITE.majorName} · {SITE.schoolShort}</p>
        </div>
        <div className="welcome-footer">
          <span className="welcome-scroll-cue">
            <span aria-hidden="true">↓</span>
            Gulir untuk melihat agenda
          </span>
          <a
            className="hero-cta welcome-skip"
            href="#dashboard"
            onClick={event => {
              event.preventDefault();
              const dashboard = document.getElementById("dashboard");
              dashboard?.scrollIntoView({ block: "start" });
              dashboard?.focus({ preventScroll: true });
            }}
          >
            Lewati ke dashboard <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      <section className="dashboard-reveal" id="dashboard" ref={dashboardRef} tabIndex="-1">
        <div className="container">
          <AgendaDashboard now={now} />

          <section className="home-grid frame-grid" aria-label="Ringkasan kelas">
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
        </div>
        <CommentsSection />
      </section>
    </div>
  );
}
