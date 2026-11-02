import React from "react";
import { createRoot } from "react-dom/client";
import { StudentsPage } from "./pages/StudentsPage.jsx";
import { TeachersPage } from "./pages/TeachersPage.jsx";
import { GalleryPage } from "./pages/GalleryPage.jsx";
import { VideosPage } from "./pages/VideosPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { SiteFooter, SiteHeader } from "./components/SiteShell.jsx";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("React root element is missing.");
}

const root = createRoot(rootElement);
const pages = {
  beranda: HomePage,
  siswa: StudentsPage,
  guru: TeachersPage,
  galeri: GalleryPage,
  video: VideosPage,
  komentar: HomePage,
};
const pageTitles = {
  beranda: "Beranda",
  siswa: "Daftar Siswa",
  guru: "Daftar Guru",
  galeri: "Galeri Kegiatan",
  video: "Video Kegiatan",
  komentar: "Ruang Diskusi",
};

let previousPage = null;

function currentPage() {
  const route = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  return Object.hasOwn(pages, route) ? route : "beranda";
}

function skipToContent(event) {
  // Navigasi memakai hash, jadi tautan "#main" biasa akan memindahkan halaman.
  event.preventDefault();
  const main = document.getElementById("main");
  main?.focus({ preventScroll: true });
  main?.scrollIntoView({ block: "start" });
}

function renderPage() {
  const page = currentPage();
  const Page = pages[page];
  document.body.dataset.page = page;
  document.title = `${pageTitles[page]} — Kelas XI RPL`;

  // Pindah halaman selalu mulai dari atas (kecuali menuju bagian diskusi).
  if (previousPage !== null && page !== previousPage && page !== "komentar") {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
  previousPage = page;

  root.render(
    <React.StrictMode>
      <a className="skip-link" href="#main" onClick={skipToContent}>
        Lewati ke konten utama
      </a>
      <SiteHeader activePage={page === "komentar" ? "beranda" : page} />
      <main id="main" tabIndex={-1} key={Page === HomePage ? "home" : page}>
        <Page route={page} />
      </main>
      <SiteFooter />
    </React.StrictMode>,
  );
}

window.addEventListener("hashchange", renderPage);
renderPage();
