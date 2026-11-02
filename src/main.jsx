import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { SiteFooter, SiteHeader } from "./components/SiteShell.jsx";
import {
  AuthLoadingFallback,
  RequireAuth,
  RequireRole,
} from "./components/RequireAuth.jsx";
import { GalleryPage } from "./pages/GalleryPage.jsx";
import {
  ChangePasswordPage,
  LoginPage,
  RegisterPage,
} from "./pages/AuthPages.jsx";
import { CardEditorPage } from "./pages/CardEditorPage.jsx";
import { AdminDataPage } from "./pages/AdminDataPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { StudentsPage } from "./pages/StudentsPage.jsx";
import { TeachersPage } from "./pages/TeachersPage.jsx";
import { VideosPage } from "./pages/VideosPage.jsx";
import {
  authSearchParams,
  hashPathFromNext,
  nextPathFromHash,
  safeNextPath,
} from "./lib/navigation.js";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("React root element is missing.");
}

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
  login: "Masuk",
  daftar: "Daftar",
  "ganti-password": "Ganti Password",
  profil: "Profil Saya",
  "card-saya": "Edit Card Saya",
  admin: "Kelola Data",
};

function readRoute() {
  const hash = window.location.hash.replace(/^#/, "") || "/beranda";
  const [rawPath, ...queryParts] = hash.split("?");
  const pathname = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const page = pathname.split("/").filter(Boolean)[0] || "beranda";
  return {
    page,
    pathname,
    search: queryParts.length ? `?${queryParts.join("?")}` : "",
    key: `${pathname}${queryParts.length ? `?${queryParts.join("?")}` : ""}`,
  };
}

function HashRedirect({ href, message }) {
  useEffect(() => {
    window.location.hash = href;
  }, [href]);

  return (
    <section className="container auth-loading" role="status">
      <p>{message}</p>
    </section>
  );
}

function EnforcePasswordChange({ page, children }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoadingFallback />;
  if (user?.mustChangePassword && page !== "ganti-password") {
    const next = encodeURIComponent(nextPathFromHash());
    return (
      <HashRedirect
        href={`/ganti-password?next=${next}`}
        message="Ganti password sementara untuk melanjutkan…"
      />
    );
  }
  return children;
}

function GuestOnly({ children, next }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoadingFallback />;
  if (user) {
    if (user.mustChangePassword) {
      return (
        <HashRedirect
          href={`/ganti-password?next=${encodeURIComponent(safeNextPath(next))}`}
          message="Ganti password sementara untuk melanjutkan…"
        />
      );
    }
    return (
      <HashRedirect
        href={hashPathFromNext(next)}
        message="Anda sudah masuk. Mengalihkan…"
      />
    );
  }
  return children;
}

function AuthSessionStatus() {
  const { error, loading, refresh } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  if (loading || !error) return null;

  async function retry() {
    setRetrying(true);
    setRetryError("");
    try {
      await refresh();
    } catch (requestError) {
      setRetryError(requestError.message);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="auth-service-status" role="status" aria-live="polite">
      <span>{retryError || "Status sesi belum dapat diperiksa."}</span>
      <button type="button" disabled={retrying} onClick={retry}>
        {retrying ? "Memeriksa…" : "Coba lagi"}
      </button>
    </div>
  );
}

function RouteContent({ route }) {
  if (route.page === "login") {
    return (
      <GuestOnly next={safeNextPath(authSearchParams().get("next"))}>
        <LoginPage />
      </GuestOnly>
    );
  }
  if (route.page === "daftar") {
    return (
      <GuestOnly next={safeNextPath(authSearchParams().get("next"))}>
        <RegisterPage />
      </GuestOnly>
    );
  }
  if (route.page === "ganti-password") {
    return (
      <RequireAuth>
        <ChangePasswordPage />
      </RequireAuth>
    );
  }
  if (route.page === "profil") {
    const segments = route.pathname.split("/").filter(Boolean);
    if (segments.length === 1) {
      return (
        <RequireAuth>
          <ProfilePage />
        </RequireAuth>
      );
    }
    if (segments.length === 2) {
      let username = segments[1];
      try {
        username = decodeURIComponent(username);
      } catch {
        username = "invalid-profile-name";
      }
      return <ProfilePage username={username} />;
    }
    return (
      <section className="container profile-unavailable" role="alert">
        <h1>Profil tidak ditemukan</h1>
        <p>Alamat profil tidak valid.</p>
        <a className="button-secondary" href="#/siswa">Kembali ke daftar siswa</a>
      </section>
    );
  }
  if (route.page === "card-saya") {
    return (
      <RequireRole roles={["student", "admin"]}>
        <CardEditorPage />
      </RequireRole>
    );
  }
  if (route.page === "admin") {
    return (
      <RequireRole roles={["admin"]}>
        <AdminDataPage />
      </RequireRole>
    );
  }
  const Page = Object.hasOwn(pages, route.page) ? pages[route.page] : HomePage;
  return <Page route={route.page} />;
}

function SiteApplication() {
  const [route, setRoute] = useState(readRoute);
  const previousPage = useRef(null);

  useEffect(() => {
    function updateRoute() {
      setRoute(readRoute());
    }
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  useEffect(() => {
    document.body.dataset.page = route.page;
    document.title = `${pageTitles[route.page] || "Beranda"} — Kelas XI RPL`;
    if (
      previousPage.current !== null &&
      route.page !== previousPage.current &&
      route.page !== "komentar"
    ) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    previousPage.current = route.page;
  }, [route.page]);

  const activePage = route.page === "komentar"
    ? "beranda"
    : Object.hasOwn(pages, route.page)
      ? route.page
      : null;

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={event => {
          event.preventDefault();
          const main = document.getElementById("main");
          main?.focus({ preventScroll: true });
          main?.scrollIntoView({ block: "start" });
        }}
      >
        Lewati ke konten utama
      </a>
      <SiteHeader activePage={activePage} />
      <AuthSessionStatus />
      <main id="main" tabIndex={-1} key={route.key}>
        <EnforcePasswordChange page={route.page}>
          <RouteContent route={route} />
        </EnforcePasswordChange>
      </main>
      <SiteFooter />
    </>
  );
}

createRoot(rootElement).render(
  <React.StrictMode>
    <AuthProvider>
      <SiteApplication />
    </AuthProvider>
  </React.StrictMode>,
);
