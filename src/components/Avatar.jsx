import React, { useState } from "react";

// Gelar seperti "S.Pd", "S.Kom", "M.PdI", atau awalan "Dr.", "Drs.", "H.". Singkatan nama ("Muh.") tidak ikut dibuang.
const TITLE_PATTERN = /^(?:[A-Za-z]{1,4}\.[A-Za-z]+\.?|(?:Dr|Drs|Ir|Prof|H|Hj)\.)$/;

export function initialsOf(name = "") {
  // Buang gelar di belakang koma ("Ema Dwi Novita, S.Pd") dan kata gelar yang berdiri sendiri.
  const words = name
    .replace(/,.*$/, "")
    .trim()
    .split(/\s+/)
    .filter((word) => word && !TITLE_PATTERN.test(word));
  if (!words.length) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function hasRealPhoto(src) {
  return typeof src === "string" && src.trim() !== "" && !src.endsWith("/sementara.png");
}

/**
 * Foto profil bila tersedia, jika tidak (atau gagal dimuat) tampil inisial.
 * Tidak memakai layanan avatar eksternal, jadi tetap jalan saat offline.
 */
export function Avatar({ name, src, size = 64, round = false }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = hasRealPhoto(src) && !failed;

  return (
    <span
      className={`avatar${round ? " avatar--round" : ""}`}
      style={{ "--avatar-size": `${size}px` }}
    >
      {showPhoto ? (
        <img
          src={src}
          alt={`Foto ${name}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="avatar-initials" aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
}
