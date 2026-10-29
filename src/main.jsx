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

function currentPage() {
  const route = window.location.hash.replace(/^#\/?/, "").split("/")[0];
  return Object.hasOwn(pages, route) ? route : "beranda";
}

function renderPage() {
  const page = currentPage();
  const Page = pages[page];
  document.body.dataset.page = page;

  root.render(
    <React.StrictMode>
      <SiteHeader activePage={page === "komentar" ? "beranda" : page} />
      <main><Page route={page} /></main>
      <SiteFooter />
    </React.StrictMode>,
  );
}

window.addEventListener("hashchange", renderPage);
renderPage();
