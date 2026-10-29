import React, { useState } from "react";
import { SITE } from "../data/class-data.js";

const navigation = [
  ["beranda", "Beranda", "#/beranda"],
  ["siswa", "Siswa", "#/siswa"],
  ["guru", "Guru", "#/guru"],
  ["galeri", "Galeri", "#/galeri"],
  ["video", "Video", "#/video"],
];

function getInitialTheme() {
  try {
    return (
      localStorage.getItem("xirpl1-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );
  } catch {
    return "light";
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);
  const dark = theme === "dark";

  function toggleTheme() {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("xirpl1-theme", next);
    } catch {
      // Theme still works for this page view when storage is unavailable.
    }
    setTheme(next);
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={dark ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
      aria-pressed={dark}
      onClick={toggleTheme}
    >
      <svg className="icon-sun" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
      </svg>
      <svg className="icon-moon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
      </svg>
    </button>
  );
}

export function SiteHeader({ activePage }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="navwrap">
        <a href="#/beranda" className="brand">
          <span className="brand-mark" aria-hidden="true">&lt;/&gt;</span>
          <span>
            XI RPL 1
            <small>SMK PGRI 2 Ponorogo</small>
          </span>
        </a>
        <nav className={`tabbar${menuOpen ? " open" : ""}`} aria-label="Navigasi utama">
          {navigation.map(([page, label, href]) => (
            <a
              className={`tab${page === activePage ? " active" : ""}`}
              data-page={page}
              href={href}
              key={page}
              aria-current={page === activePage ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <button
            className="menu-toggle"
            type="button"
            aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <i className="hamburger" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-mark" aria-hidden="true">&lt;/&gt;</span>
          <span>{SITE.className}<small>{SITE.schoolName}</small></span>
        </div>
        <p className="footer-message">Belajar bersama, bertumbuh lewat karya.</p>
        <nav className="footer-links" aria-label="Navigasi footer">
          {navigation.map(([, label, href]) => (
            <a href={href} key={href}>{label}</a>
          ))}
        </nav>
        <img
          className="footer-slogan"
          src="asset/logo/slogan.webp"
          alt='Logo SMK PGRI 2 Ponorogo dengan slogan "Tidak tertib, tidak baik"'
          loading="lazy"
          decoding="async"
        />
        <span className="footer-stack">Dibuat dengan semangat RPL</span>
      </div>
    </footer>
  );
}
