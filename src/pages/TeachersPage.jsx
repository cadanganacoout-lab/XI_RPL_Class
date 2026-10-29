import React, { useMemo, useState } from "react";
import { GURU } from "../data/class-data.js";

function TeacherCard({ teacher }) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    teacher.nama,
  )}&background=1D5FD1&color=fff&size=256&font-size=0.36&bold=true`;
  const photo =
    teacher.foto && !teacher.foto.endsWith("/sementara.png")
      ? teacher.foto
      : fallback;
  const validLinktree = /^https?:\/\/[^\s"'<>]+$/i.test(
    (teacher.linktree || "").trim(),
  );

  return (
    <article className="people-card frame-cell">
      <div className="people-card-meta">
        <span className="card-number" aria-hidden="true">{teacher.id.match(/\d+/)?.[0] || ""}</span>
        <span className="role-tag">Pengajar</span>
      </div>
      <div className="people-main">
        <div className="people-photo">
          <img
            src={photo}
            alt={`Foto ${teacher.nama}`}
            loading="lazy"
            onError={(event) => {
              if (event.currentTarget.src !== fallback) {
                event.currentTarget.src = fallback;
              }
            }}
          />
        </div>
        <h2 className="people-name">{teacher.nama}</h2>
      </div>
      <div className="people-body">
        <div className="people-meta">
          <div className="row">
            <b>Mapel</b>
            <span>{teacher.mapel}</span>
          </div>
        </div>
        {validLinktree ? (
          <a
            className="portfolio-link button-primary"
            href={teacher.linktree.trim()}
            target="_blank"
            rel="noopener noreferrer"
          >
            Buka Linktree
          </a>
        ) : (
          <button
            className="portfolio-link button-primary"
            type="button"
            aria-label="Linktree guru belum tersedia"
            disabled
          >
            Linktree belum tersedia
          </button>
        )}
      </div>
    </article>
  );
}

export function TeachersPage() {
  const [query, setQuery] = useState("");
  const filteredTeachers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return GURU.filter(
      (teacher) =>
        teacher.nama.toLowerCase().includes(normalizedQuery) ||
        teacher.mapel.toLowerCase().includes(normalizedQuery),
    );
  }, [query]);

  return (
    <>
      <section className="container page-hero">
          <span className="route-label">/guru</span>
          <h1>Daftar Guru</h1>
          <p>
            Guru-guru yang mengajar di kelas XI RPL, lengkap dengan mata pelajaran
            yang diampu.
          </p>
      </section>
      <section className="container">
          <div className="toolbar-row">
            <label className="search-box">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 5 5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama guru atau mata pelajaran..."
                aria-label="Cari nama guru atau mata pelajaran"
              />
            </label>
            <span className="count-pill" aria-live="polite">
              {filteredTeachers.length} guru
            </span>
          </div>
          <div className="people-grid frame-grid">
            {filteredTeachers.map((teacher) => (
              <TeacherCard key={teacher.id} teacher={teacher} />
            ))}
            {filteredTeachers.length === 0 && (
              <p className="empty-note">Tidak ada guru yang cocok dengan pencarian.</p>
            )}
          </div>
      </section>
    </>
  );
}
