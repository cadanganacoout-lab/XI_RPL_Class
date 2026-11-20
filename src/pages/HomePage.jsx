import React, { useEffect, useRef, useState } from "react";
import {
  GURU,
  GURU_JADWAL,
  HARI_AKTIF,
  HARI_LIST,
  JADWAL,
  MOTIVASI,
  PIKET,
  SITE,
  UI,
} from "../data/class-data.js";
import { HomeSpotlights } from "../components/HomeSpotlights.jsx";
import { initialsOf } from "../components/Avatar.jsx";
import { apiRequest } from "../lib/api.js";
import "../../css/welcome-room.css";

const GALLERY_SLICES = 16;
const GALLERY_CAMERA = 1.6;
const GALLERY_TILE_HEIGHT = 52;
const GALLERY_TILE_WIDTH = 68;
const GALLERY_ASPECT = 16 / 9;
const GALLERY_GAP = 16;
const GALLERY_CURVE = (80 * Math.PI) / 180;
const GALLERY_SPEED = 5;

function galleryArc(bend) {
  return (
    (GALLERY_CAMERA - 1 + Math.cos(bend)) /
    (2 * GALLERY_CAMERA * Math.sin(bend))
  );
}

function measureGallery(width, height) {
  const tileHeight = Math.min(
    (GALLERY_TILE_HEIGHT / 100) * height,
    ((GALLERY_TILE_WIDTH / 100) * width) / GALLERY_ASPECT,
  );
  const radius = width * galleryArc(GALLERY_CURVE);
  if (!(tileHeight > 0) || !(radius > 0)) {
    return { columns: 2, sweep: 0, unit: 0, limit: 0 };
  }

  const degrees = radians => (radians * 180) / Math.PI;
  const unit = degrees(tileHeight / radius);
  const pitch = (GALLERY_ASPECT + GALLERY_GAP / 100) * unit;
  const limit = degrees(GALLERY_CURVE) + (GALLERY_ASPECT * unit) / 2;
  const columns = Math.min(60, Math.max(2, Math.ceil((2 * limit) / pitch)));
  const round = value => Number(value.toFixed(4));
  const sweep = round((columns * pitch) / 2);

  return {
    columns,
    sweep,
    unit: round(unit),
    limit: round(Math.min(sweep, limit)),
  };
}

function WelcomeGallery({ photos, status }) {
  const ref = useRef(null);
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const orbitClass = `welcome-gallery-orbit-${id}`;
  const tileClass = `welcome-gallery-tile-${id}`;
  const [layout, setLayout] = useState(() => measureGallery(1200, 360));
  const [shownPhotos, setShownPhotos] = useState({});
  const [loadedPhotos, setLoadedPhotos] = useState(() => new Set());
  const [failedPhotos, setFailedPhotos] = useState(() => new Set());

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver !== "function") return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const next = measureGallery(width, height);
      setLayout(previous =>
        previous.columns === next.columns &&
        previous.sweep === next.sweep &&
        previous.unit === next.unit
          ? previous
          : next
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const gallery = ref.current;
    const hero = gallery?.closest(".welcome-hero");
    const room = hero?.querySelector(".welcome-room");
    if (!gallery || !hero || typeof IntersectionObserver !== "function") {
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      const paused = !entry.isIntersecting;
      gallery.classList.toggle("is-paused", paused);
      room?.classList.toggle("is-paused", paused);
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const { columns, sweep, unit, limit } = layout;
  const radius = `${Number((100 * galleryArc(GALLERY_CURVE)).toFixed(3))}cqw`;
  const size = value =>
    `calc(${Number(value.toFixed(4))} * min(${GALLERY_TILE_HEIGHT}cqh, ${Number(
      (GALLERY_TILE_WIDTH / GALLERY_ASPECT).toFixed(4),
    )}cqw))`;
  const turn = degrees =>
    `translateZ(${radius}) rotateY(${Number(degrees.toFixed(4))}deg) translateZ(-${radius})`;
  const duration = columns * GALLERY_SPEED;
  const hide = Number((((sweep - limit) / (2 * sweep || 1)) * 100).toFixed(4));
  const animation = `@keyframes ${orbitClass}{from{transform:${turn(-sweep)}}to{transform:${turn(sweep)}}0%,${hide}%,${100 - hide}%,100%{visibility:hidden}${hide + 0.001}%,${100 - hide - 0.001}%{visibility:visible}}`;

  return (
    <div
      ref={ref}
      className="welcome-gallery"
      role="region"
      aria-label="Foto kegiatan kelas XI RPL"
      aria-busy={status === "loading"}
      style={{ containerType: "size" }}
    >
      {status === "loading" ? (
        <div className="welcome-gallery-loading" role="status">
          {[0, 1, 2].map(position => (
            <span
              className={`home-photo-skeleton welcome-gallery-loading-card welcome-gallery-loading-card--${position}`}
              key={position}
              aria-hidden="true"
            />
          ))}
          <span className="visually-hidden">Memuat foto kegiatan…</span>
        </div>
      ) : status === "error" || photos.length === 0 ? (
        <p
          className="welcome-gallery-message"
          role={status === "error" ? "alert" : "status"}
        >
          {status === "error"
            ? "Foto kegiatan belum dapat dimuat."
            : "Belum ada foto kegiatan."}
        </p>
      ) : (
        <>
          <style>{animation}</style>
          <div
            className="welcome-gallery-stream"
            style={{
              perspective: `${Number((100 * galleryArc(GALLERY_CURVE) * GALLERY_CAMERA).toFixed(3))}cqw`,
              perspectiveOrigin: "50% 50%",
              maskImage: "linear-gradient(90deg, transparent, var(--color-canvas) 12%, var(--color-canvas) 88%, transparent)",
              WebkitMaskImage: "linear-gradient(90deg, transparent, var(--color-canvas) 12%, var(--color-canvas) 88%, transparent)",
            }}
          >
        {Array.from({ length: columns }, (_, tileIndex) => {
          const firstPhoto = columns - 1 - tileIndex;
          const photoIndex = (shownPhotos[tileIndex] ?? firstPhoto) % photos.length;
          const photo = photos[photoIndex];
          const imageReady = loadedPhotos.has(photo.url);
          const imageFailed = failedPhotos.has(photo.url);

          return (
            <div
              className={[
                "welcome-gallery-tile",
                tileClass,
                imageReady && "is-image-ready",
                imageFailed && "is-image-error",
                !imageReady && !imageFailed && "is-image-loading",
              ].filter(Boolean).join(" ")}
              key={tileIndex}
              role="img"
              aria-label={photo.caption || "Kegiatan kelas XI RPL"}
              style={{
                left: `calc(50% - ${size(GALLERY_ASPECT / 2)})`,
                top: `calc(50% - ${size(0.5)})`,
                width: size(GALLERY_ASPECT),
                height: size(1),
                transformStyle: "preserve-3d",
                animation: `${orbitClass} ${duration}s linear ${-tileIndex * GALLERY_SPEED}s infinite`,
              }}
              onAnimationIteration={event => {
                const lap = Math.round(event.elapsedTime / duration);
                const nextPhoto = lap * columns + firstPhoto;
                setShownPhotos(previous =>
                  previous[tileIndex] === nextPhoto
                    ? previous
                    : { ...previous, [tileIndex]: nextPhoto }
                );
              }}
            >
              <span className="home-photo-skeleton welcome-gallery-tile-skeleton" aria-hidden="true" />
              {Array.from({ length: GALLERY_SLICES }, (_, sliceIndex) => {
                const share = GALLERY_ASPECT / GALLERY_SLICES;
                const radiusOffset =
                  (GALLERY_ASPECT / 2 - (sliceIndex + 0.5) * share) * unit;

                return (
                  <div
                    key={sliceIndex}
                    className="welcome-gallery-slice"
                    aria-hidden="true"
                    style={{
                      left: size((GALLERY_ASPECT - share) / 2),
                      width: sliceIndex === GALLERY_SLICES - 1
                        ? size(share)
                        : `calc(${size(share)} + 1px)`,
                      height: size(1),
                      transform: turn(radiusOffset),
                      borderRadius: sliceIndex === 0
                        ? "10px 0 0 10px"
                        : sliceIndex === GALLERY_SLICES - 1
                          ? "0 10px 10px 0"
                          : undefined,
                    }}
                  >
                    <img
                      src={photo.url}
                      alt=""
                      draggable={false}
                      loading="eager"
                      decoding="async"
                      onLoad={() => {
                        setLoadedPhotos(current => (
                          current.has(photo.url)
                            ? current
                            : new Set(current).add(photo.url)
                        ));
                      }}
                      onError={() => {
                        setFailedPhotos(current => (
                          current.has(photo.url)
                            ? current
                            : new Set(current).add(photo.url)
                        ));
                      }}
                      style={{
                        left: size(-sliceIndex * share),
                        width: size(GALLERY_ASPECT),
                        height: size(1),
                      }}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
          </div>
        </>
      )}
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
          <h2 id="agenda-heading" tabIndex="-1">Jadwal &amp; piket</h2>
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

const exploreLinks = UI.home.explore;

export function HomePage() {
  const [motivationIndex, setMotivationIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [gallery, setGallery] = useState({ photos: [], status: "loading" });
  const dashboardRef = useRef(null);

  useEffect(() => {
    let active = true;
    apiRequest("/api/gallery")
      .then(payload => {
        if (!Array.isArray(payload?.photos)) {
          throw new Error("Respons galeri tidak valid.");
        }
        const photos = payload.photos
          .filter(photo => photo && typeof photo.url === "string" && photo.url.trim())
          .map(photo => ({
            id: typeof photo.id === "string" ? photo.id : photo.url.trim(),
            url: photo.url.trim(),
            caption: typeof photo.caption === "string" ? photo.caption.trim() : "",
          }));
        if (active) setGallery({ photos, status: "ready" });
      })
      .catch(error => {
        console.error("Could not load gallery photos for the home page.", error);
        if (active) setGallery({ photos: [], status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

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
      <section id="home-hero" className="welcome-hero hero-beranda" aria-labelledby="welcome-title" tabIndex="-1">
        <div className="welcome-room" aria-hidden="true">
          <div className="welcome-room-ceiling" />
          <div className="welcome-room-wall" />
          <div className="welcome-room-side welcome-room-side--left" />
          <div className="welcome-room-side welcome-room-side--right" />
          <div className="welcome-room-floor" />
        </div>
        <div className="welcome-content">
          <h1 id="welcome-title">{UI.home.welcomeTitle}</h1>
        </div>
        <WelcomeGallery photos={gallery.photos} status={gallery.status} />
        <div className="welcome-tagline">
          <p className="welcome-slogan">{UI.home.welcomeSlogan}</p>
          <p className="welcome-class">{UI.home.welcomeDescription}</p>
        </div>
      </section>

      <HomeSpotlights photos={gallery.photos} status={gallery.status} />

      <section className="dashboard-reveal" id="dashboard" ref={dashboardRef} tabIndex="-1">
        <div className="container">
          <AgendaDashboard now={now} />

          <h2 className="group-title">{UI.home.summaryTitle}</h2>
          <div className="stat-row">
            <div className="stat-item stat-card">
              <span className="stat-icon"><Icon name="users" /></span>
              <div className="stat-body">
                <span className="stat-value">{SITE.totalStudents}</span>
                <span className="stat-label">{UI.home.summary.studentLabel}</span>
              </div>
            </div>
            <div className="stat-item stat-card">
              <span className="stat-icon"><Icon name="book" /></span>
              <div className="stat-body">
                <span className="stat-value">{SITE.totalTeachers}</span>
                <span className="stat-label">{UI.home.summary.teacherLabel}</span>
              </div>
            </div>
            <div className="stat-item stat-card">
              <span className="stat-icon"><Icon name="badge" /></span>
              <div className="stat-body">
                <span className="stat-value stat-value--name">{SITE.waliKelas}</span>
                <span className="stat-label">{UI.home.summary.homeroomLabel}</span>
              </div>
            </div>
          </div>

          <h2 className="group-title">{UI.home.exploreTitle}</h2>
          <nav className="explore-grid" aria-label={UI.home.exploreAriaLabel}>
            {exploreLinks.map(({ href, title, text, icon }) => (
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

          <h2 className="group-title">{UI.home.motivationTitle}</h2>
          <section className="home-motivation" aria-label={UI.home.motivationAriaLabel}>
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
      </section>
    </div>
  );
}
