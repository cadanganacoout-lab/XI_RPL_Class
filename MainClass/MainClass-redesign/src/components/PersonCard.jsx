import React from "react";
import { Avatar } from "./Avatar.jsx";

export function isHttpUrl(value) {
  return /^https?:\/\/[^\s"'<>]+$/i.test((value || "").trim());
}

export function filledValue(value) {
  const text = typeof value === "string" ? value.trim() : "";
  return text && text !== "-" ? text : "";
}

function ExternalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

/**
 * Kartu profil yang dipakai halaman Siswa dan Guru.
 * rows: [[label, nilai]]; baris tanpa nilai tidak ditampilkan.
 */
export function PersonCard({
  number,
  name,
  photo,
  role,
  lead = false,
  rows,
  emptyNote,
  action,
}) {
  const visibleRows = rows.filter(([, value]) => filledValue(value));

  return (
    <article className="people-card">
      {number && <span className="card-number" aria-hidden="true">{number}</span>}
      <div className="people-top">
        <Avatar name={name} src={photo} size={68} />
        <div className="people-id">
          <h2 className="people-name">{name}</h2>
          <span className={`role-tag${lead ? " role-tag--lead" : ""}`}>{role}</span>
        </div>
      </div>
      <div className="people-body">
        <div className="people-meta">
          {visibleRows.length > 0 ? (
            visibleRows.map(([label, value]) => (
              <div className="row" key={label}>
                <b>{label}</b>
                <span>{filledValue(value)}</span>
              </div>
            ))
          ) : (
            <p className="people-empty">{emptyNote}</p>
          )}
        </div>
        {action.href ? (
          <a
            className="portfolio-link button-secondary"
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {action.label}
            <ExternalIcon />
          </a>
        ) : (
          <button
            className="portfolio-link button-secondary"
            type="button"
            aria-label={action.disabledAria}
            disabled
          >
            {action.disabledLabel}
          </button>
        )}
      </div>
    </article>
  );
}
