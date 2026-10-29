import React, { useMemo, useState } from "react";
import { SISWA, SITE } from "../data/class-data.js";

function StudentCard({ student }) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    student.nama,
  )}&background=1D5FD1&color=fff&size=256&font-size=0.36&bold=true`;
  const photo =
    student.foto && !student.foto.endsWith("/sementara.png")
      ? student.foto
      : fallback;
  const validPortfolio = /^https?:\/\/[^\s"'<>]+$/i.test(
    (student.portfolio || "").trim(),
  );
  const details = [
    ["Hobi", student.hobi],
    ["Catatan", student.catatan],
    ["Motto", student.motto],
  ];

  return (
    <article className="people-card frame-cell">
      <div className="people-card-meta">
        <span className="card-number" aria-hidden="true">{student.id.match(/\d+/)?.[0] || ""}</span>
        <span className="role-tag">{student.jabatan}</span>
      </div>
      <div className="people-main">
        <div className="people-photo">
          <img
            src={photo}
            alt={`Foto ${student.nama}`}
            loading="lazy"
            onError={(event) => {
              if (event.currentTarget.src !== fallback) {
                event.currentTarget.src = fallback;
              }
            }}
          />
        </div>
        <h2 className="people-name">{student.nama}</h2>
      </div>
      <div className="people-body">
        <div className="people-meta">
          {details.map(([label, value]) => (
            <div className="row" key={label}>
              <b>{label}</b>
              <span>{value?.trim() && value.trim() !== "-" ? value : "Belum diisi"}</span>
            </div>
          ))}
        </div>
        {validPortfolio ? (
          <a
            className="portfolio-link button-primary"
            href={student.portfolio.trim()}
            target="_blank"
            rel="noopener noreferrer"
          >
            Buka portofolio
          </a>
        ) : (
          <button
            className="portfolio-link button-primary"
            type="button"
            aria-label="Portofolio belum tersedia"
            disabled
          >
            Belum tersedia
          </button>
        )}
      </div>
    </article>
  );
}

export function StudentsPage() {
  const [query, setQuery] = useState("");
  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return SISWA.filter(
      (student) =>
        student.nama.toLowerCase().includes(normalizedQuery) ||
        student.jabatan.toLowerCase().includes(normalizedQuery),
    );
  }, [query]);

  return (
    <>
      <section className="container page-hero">
          <span className="route-label">/siswa</span>
          <h1>Daftar Siswa</h1>
          <p>
            Seluruh siswa aktif kelas XI RPL. Ketuk kolom pencarian untuk menemukan siswa
            berdasarkan nama atau jabatan.
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
                placeholder="Cari nama atau jabatan siswa..."
                aria-label="Cari nama atau jabatan siswa"
              />
            </label>
            <span className="count-pill" aria-live="polite">
              {filteredStudents.length} siswa
            </span>
          </div>
          <div className="people-grid frame-grid">
            {filteredStudents.map((student) => (
              <StudentCard key={student.id} student={student} />
            ))}
            {filteredStudents.length === 0 && (
              <p className="empty-note">Tidak ada siswa yang cocok dengan pencarian.</p>
            )}
          </div>
      </section>
    </>
  );
}
