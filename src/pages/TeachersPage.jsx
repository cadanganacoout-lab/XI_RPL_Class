import React, { useEffect, useMemo, useState } from "react";
import { PersonCard, isHttpUrl } from "../components/PersonCard.jsx";
import { apiRequest } from "../lib/api.js";

function TeacherCard({ teacher }) {
  const linktree = (teacher.linktree || "").trim();

  return (
    <PersonCard
      number={teacher.id.match(/\d+/)?.[0] || ""}
      name={teacher.nama}
      photo={teacher.foto}
      role={teacher.role}
      rows={[["Mapel", teacher.mapel]]}
      emptyNote="Mata pelajaran belum diisi."
      action={
        isHttpUrl(linktree)
          ? { href: linktree, label: "Buka Linktree" }
          : { disabledLabel: "Linktree belum tersedia", disabledAria: "Linktree guru belum tersedia" }
      }
    />
  );
}

export function TeachersPage() {
  const [query, setQuery] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");
    apiRequest("/api/teachers")
      .then(payload => {
        if (!Array.isArray(payload.teachers)) {
          throw new Error("Respons daftar guru tidak valid.");
        }
        if (active) {
          setTeachers(payload.teachers);
          setStatus("ready");
        }
      })
      .catch(requestError => {
        if (active) {
          setError(requestError.message);
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [retry]);

  const filteredTeachers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return teachers.filter(
      (teacher) =>
        teacher.nama.toLowerCase().includes(normalizedQuery) ||
        teacher.mapel.toLowerCase().includes(normalizedQuery),
    );
  }, [teachers, query]);

  return (
    <>
      <section className="container page-hero">
        <span className="route-label">/guru</span>
        <h1>Daftar Guru</h1>
        <p>Kenali guru yang mengajar di kelas XI RPL dan mata pelajaran yang diampu.</p>
      </section>
      <section className="container" aria-busy={status === "loading"}>
        {status === "loading" && (
          <p className="admin-data-status" role="status">Memuat daftar guru…</p>
        )}
        {status === "error" && (
          <div className="student-list-message" role="alert">
            <p>{error}</p>
            <button type="button" className="button-secondary" onClick={() => setRetry(value => value + 1)}>
              Coba muat ulang
            </button>
          </div>
        )}
        {status === "ready" && (
          <>
            <div className="toolbar-row">
              <div className="toolbar-main">
                <label className="search-box">
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
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
              </div>
              <span className="count-pill" aria-live="polite">
                {filteredTeachers.length} guru
              </span>
            </div>
            <div className="people-grid">
              {filteredTeachers.map((teacher) => (
                <TeacherCard key={teacher.id} teacher={teacher} />
              ))}
              {filteredTeachers.length === 0 && (
                <p className="empty-note">Tidak ada guru yang cocok. Coba kata kunci lain.</p>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
