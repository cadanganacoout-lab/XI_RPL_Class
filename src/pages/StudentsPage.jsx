import React, { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { isClassOfficer, StudentCard } from "../components/StudentCard.jsx";

function StudentListLoading() {
  return (
    <div className="people-grid student-loading-grid" aria-busy="true">
      {[0, 1, 2].map(item => (
        <div className="student-skeleton-card" key={item}>
          <span className="student-skeleton student-skeleton--avatar" />
          <span className="student-skeleton student-skeleton--name" />
          <span className="student-skeleton" />
          <span className="student-skeleton" />
        </div>
      ))}
      <span className="visually-hidden" role="status">Memuat daftar siswa…</span>
    </div>
  );
}

export function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [onlyOfficers, setOnlyOfficers] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");

    apiRequest("/api/cards")
      .then(payload => {
        if (!Array.isArray(payload.cards)) {
          throw new Error("Respons daftar siswa tidak valid.");
        }
        if (active) {
          setStudents(payload.cards);
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

  const officerCount = students.filter(isClassOfficer).length;
  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return students.filter(
      student =>
        (!onlyOfficers || isClassOfficer(student)) &&
        (student.nama.toLowerCase().includes(normalizedQuery) ||
          student.jabatan.toLowerCase().includes(normalizedQuery)),
    );
  }, [students, query, onlyOfficers]);

  return (
    <>
      <section className="container page-hero">
        <span className="route-label">/siswa</span>
        <h1>Daftar Siswa</h1>
        <p>Temukan profil siswa kelas XI RPL berdasarkan nama atau jabatan.</p>
      </section>
      <section className="container" aria-busy={status === "loading"}>
        {status === "loading" && <StudentListLoading />}
        {status === "error" && (
          <div className="student-list-message" role="alert">
            <p>{error}</p>
            <button type="button" className="button-secondary" onClick={() => setRetry(value => value + 1)}>
              Coba muat ulang
            </button>
          </div>
        )}
        {status === "ready" && students.length === 0 && (
          <div className="student-list-message">
            <p>Belum ada card siswa yang dapat ditampilkan.</p>
            <button type="button" className="button-secondary" onClick={() => setRetry(value => value + 1)}>
              Muat ulang daftar
            </button>
          </div>
        )}
        {status === "ready" && students.length > 0 && (
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
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Cari nama atau jabatan siswa..."
                    aria-label="Cari nama atau jabatan siswa"
                  />
                </label>
                <div className="chip-row" role="group" aria-label="Filter jabatan">
                  <button className="chip" type="button" aria-pressed={!onlyOfficers} onClick={() => setOnlyOfficers(false)}>
                    Semua <small>{students.length}</small>
                  </button>
                  <button className="chip" type="button" aria-pressed={onlyOfficers} onClick={() => setOnlyOfficers(true)}>
                    Pengurus kelas <small>{officerCount}</small>
                  </button>
                </div>
              </div>
              <span className="count-pill" aria-live="polite">
                {filteredStudents.length} siswa
              </span>
            </div>
            <div className="people-grid" aria-live="polite">
              {filteredStudents.map(student => (
                <StudentCard key={student.id} student={student} />
              ))}
              {filteredStudents.length === 0 && (
                <div className="empty-note student-search-empty">
                  <p>Tidak ada siswa yang cocok dengan pencarian ini.</p>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setOnlyOfficers(false);
                    }}
                  >
                    Hapus pencarian dan filter
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}
