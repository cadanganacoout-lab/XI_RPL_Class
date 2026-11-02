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
  VIDEO,
} from "../data/class-data.js";
import { CommentsSection } from "./CommentsPage.jsx";
import { initialsOf } from "../components/Avatar.jsx";
import { apiRequest } from "../lib/api.js";

const welcomePhotos = [...new Set(
  GALERI
    .map(photo => typeof photo.foto === "string" ? photo.foto.trim() : "")
    .filter(Boolean),
)];
const photoHoldDuration = 4000;
const photoTransitionDuration = 1100;

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
        const showPhoto = () => {
          if (cancelled) return;
          setImages([welcomePhotos[index], null]);
          setActivePhotoIndex(index);
        };
        if (typeof image.decode === "function") {
          image.decode().then(showPhoto, () => loadNextPhoto(index + 1));
        } else {
          showPhoto();
        }
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
        const showPhoto = () => {
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
        if (typeof image.decode === "function") {
          image.decode().then(showPhoto, () => preloadNextPhoto(nextIndex, remaining - 1));
        } else {
          showPhoto();
        }
      };
      image.onerror = () => preloadNextPhoto(nextIndex, remaining - 1);
      image.src = welcomePhotos[nextIndex];
    }

    timeoutId = window.setTimeout(
      () => preloadNextPhoto(activePhotoIndex, welcomePhotos.length - 1),
      photoHoldDuration + photoTransitionDuration,
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

function guruName(parity, day, subject, start, teachers) {
  const schedule = GURU_JADWAL[parity]?.[day];
  let originalName;
  if (typeof schedule === "string") originalName = schedule;
  if (schedule) {
    if (typeof schedule !== "string") {
      originalName = minutesOfDay(start) < minutesOfDay(schedule.mulai)
        ? schedule.sebelum
        : schedule.sesudah;
    }
  }
  if (originalName) {
    const originalTeacher = GURU.find(teacher => teacher.nama === originalName);
    return teachers.find(teacher => teacher.id === originalTeacher?.id)?.nama || originalName;
  }
  const aliases = {
    "Pendidikan Agama Budi Pekerti": "Pendidikan Agama",
    "Pendidikan Jasmani Olahraga Kesehatan": "PJOK",
    "Kreativitas Inovasi & Kewirausahaan": "Kewirausahaan",
  };
  const originalTeacher = GURU.find(
    teacher => teacher.mapel === (aliases[subject] || subject),
  );
  return teachers.find(teacher => teacher.id === originalTeacher?.id)?.nama ||
    originalTeacher?.nama ||
    "—";
}

function ScheduleList({ date, now, isToday, teachers }) {
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
    const isPast = isToday && minutesOfDay(row.selesai) <= nowInMinutes;
    const start = minutesOfDay(row.mulai);
    const end = minutesOfDay(row.selesai);
    const progress = isCurrent
      ? Math.min(100, Math.max(0, ((nowInMinutes - start) / (end - start)) * 100))
      : 0;
    const rowClassName = [
      "agenda-row",
      row.istirahat && "agenda-row--break",
      isCurrent && "agenda-row--current",
      isNext && "agenda-row--next",
      isPast && "agenda-row--past",
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
          {!row.istirahat && (
            <small>{guruName(parity, day, row.mapel, row.mulai, teachers)}</small>
          )}
          {isCurrent && (
            <>
              <div
                className="agenda-progress"
                role="progressbar"
                aria-label="Progres pelajaran berlangsung"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              <small>Sisa {end - nowInMinutes} menit</small>
            </>
          )}
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
      {names.map((name) => (
        <li key={name}>
          <span className="duty-avatar" aria-hidden="true">{initialsOf(name)}</span>
          <span>{name}</span>
        </li>
      ))}
    </ul>
  );
}

function AgendaDashboard({ now }) {
  const [dayOffset, setDayOffset] = useState(0);
  const [teachers, setTeachers] = useState([]);
  const [teacherDataError, setTeacherDataError] = useState("");
  const date = new Date(now);

  useEffect(() => {
    let active = true;
    apiRequest("/api/teachers")
      .then(payload => {
        if (!Array.isArray(payload.teachers)) {
          throw new Error("Respons daftar guru tidak valid.");
        }
        if (active) setTeachers(payload.teachers);
      })
      .catch(() => {
        if (active) setTeacherDataError("Nama guru mungkin belum menggunakan data terbaru.");
      });
    return () => {
      active = false;
    };
  }, []);
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
      <div className="section-head agenda-heading">
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
            {teacherDataError && <p className="empty-note" role="status">{teacherDataError}</p>}
            <ScheduleList
              date={date}
              now={now}
              isToday={isToday}
              teachers={teachers}
              teacherDataError={teacherDataError}
            />
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

const icons = {
  users: "M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1.5a4 4 0 0 0-3-3.87M15 4.13a3.5 3.5 0 0 1 0 6.74",
  book: "M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2V4ZM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7V4Z",
  badge: "M12 3 4 6v5.5c0 4.7 3.2 8.2 8 9.5 4.8-1.3 8-4.8 8-9.5V6l-8-3ZM9 12l2 2 4-4",
  image: "M3 5h18v14H3V5ZM3 16l5-5 4 4 3-3 6 6M8.5 9.5h.01",
  play: "M5 4.5v15l14-7.5-14-7.5Z",
  arrow: "M7 17 17 7M8 7h9v9",
};

function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}

const exploreLinks = [
  ["#/siswa", "Siswa", "Kenali teman sekelas", "users"],
  ["#/guru", "Guru", "Pengajar & mata pelajaran", "book"],
  ["#/galeri", "Galeri", `${GALERI.length} foto kegiatan`, "image"],
  ["#/video", "Video", `${VIDEO.length} video kelas`, "play"],
];

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
    const timeoutId = window.setTimeout(() => {
      setMotivationIndex(index => (index + 1) % MOTIVASI.length);
    }, 6000);
    return () => window.clearTimeout(timeoutId);
  }, [motivationIndex]);

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
          <span className="welcome-eyebrow"><i className="welcome-dot" aria-hidden="true" />WEBSITE · {SITE.className}</span>
          <h1 id="welcome-title">WELCOME</h1>
          <p className="welcome-slogan">RPL! JAYA JAYA JAYA</p>
          <p className="welcome-class">{SITE.majorName} · {SITE.schoolShort}</p>
          <div className="welcome-actions">
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
              Lihat agenda hari ini <span aria-hidden="true">↓</span>
            </a>
            <a className="welcome-ghost" href="#/siswa">Kenali teman sekelas</a>
          </div>
        </div>
        <div className="welcome-footer">
          <span className="welcome-scroll-cue">
            <span aria-hidden="true">↓</span>
            Scroll untuk melihat agenda
          </span>
        </div>
      </section>

      <section className="dashboard-reveal" id="dashboard" ref={dashboardRef} tabIndex="-1">
        <div className="container">
          <AgendaDashboard now={now} />

          <h2 className="group-title">Ringkasan kelas</h2>
          <div className="stat-row">
            <div className="stat-item stat-card">
              <span className="stat-icon"><Icon name="users" /></span>
              <div className="stat-body">
                <span className="stat-value">{SITE.totalStudents}</span>
                <span className="stat-label">Siswa</span>
              </div>
            </div>
            <div className="stat-item stat-card">
              <span className="stat-icon"><Icon name="book" /></span>
              <div className="stat-body">
                <span className="stat-value">{SITE.totalTeachers}</span>
                <span className="stat-label">Guru</span>
              </div>
            </div>
            <div className="stat-item stat-card">
              <span className="stat-icon"><Icon name="badge" /></span>
              <div className="stat-body">
                <span className="stat-value stat-value--name">{SITE.waliKelas}</span>
                <span className="stat-label">Wali kelas</span>
              </div>
            </div>
          </div>

          <h2 className="group-title">Jelajahi</h2>
          <nav className="explore-grid" aria-label="Pintasan halaman">
            {exploreLinks.map(([href, title, text, icon]) => (
              <a className="explore-card" href={href} key={href}>
                <span className="explore-icon"><Icon name={icon} /></span>
                <div className="explore-text">
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <span className="explore-arrow"><Icon name="arrow" size={18} /></span>
              </a>
            ))}
          </nav>

          <h2 className="group-title">Motivasi</h2>
          <section className="home-motivation" aria-label="Motivasi kelas">
            <svg className="motivation-mark" width="96" height="96" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9.6 6C6.5 7 4 9.8 4 13.6V18h6v-6H7c.1-2 1.2-3.4 3.3-4L9.6 6Zm9 0c-3.1 1-5.6 3.8-5.6 7.6V18h6v-6h-3c.1-2 1.2-3.4 3.3-4L18.6 6Z" />
            </svg>
            <blockquote key={motivationIndex} className="motivation-quote">
              {featuredMotivation}
            </blockquote>
            <div className="motivation-footer">
              <span className="motivation-label">
                Motivasi {motivationIndex + 1} dari {MOTIVASI.length}
              </span>
              <div className="motivation-dots" role="group" aria-label="Pilih motivasi">
                {MOTIVASI.map((_, index) => (
                  <button
                    className="motivation-dot"
                    type="button"
                    key={index}
                    aria-label={`Motivasi ${index + 1}`}
                    aria-current={index === motivationIndex}
                    onClick={() => setMotivationIndex(index)}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
        <CommentsSection />
      </section>
    </div>
  );
}
