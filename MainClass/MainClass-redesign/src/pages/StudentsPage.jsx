import React, { useMemo, useState } from "react";
import { SISWA } from "../data/class-data.js";
import { PersonCard, isHttpUrl } from "../components/PersonCard.jsx";

const isOfficer = (student) => student.jabatan.trim().toLowerCase() !== "siswa";
const officerCount = SISWA.filter(isOfficer).length;

function StudentCard({ student }) {
  const portfolio = (student.portfolio || "").trim();

  return (
    <PersonCard
      number={student.id.match(/\d+/)?.[0] || ""}
      name={student.nama}
      photo={student.foto}
      role={student.jabatan}
      lead={isOfficer(student)}
      rows={[
        ["Hobi", student.hobi],
        ["Catatan", student.catatan],
        ["Motto", student.motto],
      ]}
      emptyNote="Profil belum dilengkapi."
      action={
        isHttpUrl(portfolio)
          ? { href: portfolio, label: "Buka portofolio" }
          : { disabledLabel: "Portofolio belum tersedia", disabledAria: "Portofolio belum tersedia" }
      }
    />
  );
}

export function StudentsPage() {
  const [query, setQuery] = useState("");
  const [onlyOfficers, setOnlyOfficers] = useState(false);
  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return SISWA.filter(
      (student) =>
        (!onlyOfficers || isOfficer(student)) &&
        (student.nama.toLowerCase().includes(normalizedQuery) ||
          student.jabatan.toLowerCase().includes(normalizedQuery)),
    );
  }, [query, onlyOfficers]);

  return (
    <>
      <section className="container page-hero">
        <span className="route-label">/siswa</span>
        <h1>Daftar Siswa</h1>
        <p>Temukan profil siswa kelas XI RPL berdasarkan nama atau jabatan.</p>
      </section>
      <section className="container">
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
                placeholder="Cari nama atau jabatan siswa..."
                aria-label="Cari nama atau jabatan siswa"
              />
            </label>
            <div className="chip-row" role="group" aria-label="Filter jabatan">
              <button className="chip" type="button" aria-pressed={!onlyOfficers} onClick={() => setOnlyOfficers(false)}>
                Semua <small>{SISWA.length}</small>
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
        <div className="people-grid">
          {filteredStudents.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
          {filteredStudents.length === 0 && (
            <p className="empty-note">Tidak ada siswa yang cocok. Coba kata kunci lain.</p>
          )}
        </div>
      </section>
    </>
  );
}
