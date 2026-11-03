import React from "react";
import { PersonCard, isHttpUrl } from "./PersonCard.jsx";

export function isClassOfficer(student) {
  return student.jabatan.trim().toLowerCase() !== "siswa";
}

export function StudentCard({ student }) {
  const portfolio = (student.portfolio || "").trim();

  return (
    <PersonCard
      number={student.id.match(/\d+/)?.[0] || ""}
      name={student.nama}
      photo={student.avatar?.url || student.foto}
      background={student.background?.url}
      role={student.jabatan}
      lead={isClassOfficer(student)}
      rows={[
        ["Hobi", student.hobi],
        ["Catatan", student.catatan],
      ]}
      emptyNote="Profil belum dilengkapi."
      action={
        isHttpUrl(portfolio)
          ? { href: portfolio, label: "Buka portofolio" }
          : {
              disabledLabel: "Portofolio belum tersedia",
              disabledAria: "Portofolio belum tersedia",
            }
      }
    />
  );
}
