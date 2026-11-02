import React, { useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { nextPathFromHash } from "../lib/navigation.js";

function AuthLoading() {
  return (
    <section className="container auth-loading" aria-busy="true">
      <span className="auth-skeleton auth-skeleton--title" />
      <span className="auth-skeleton" />
      <span className="auth-skeleton auth-skeleton--button" />
      <span className="visually-hidden" role="status">Memeriksa sesi akun…</span>
    </section>
  );
}

function Redirect({ href, message }) {
  useEffect(() => {
    window.location.hash = href;
  }, [href]);

  return (
    <section className="container auth-loading" role="status">
      <p>{message}</p>
    </section>
  );
}

// Route guards improve navigation UX; authorization is enforced by the API.
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) {
    const next = encodeURIComponent(nextPathFromHash());
    return (
      <Redirect
        href={`/login?next=${next}`}
        message="Alihkan ke halaman masuk…"
      />
    );
  }
  if (user.mustChangePassword && !window.location.hash.startsWith("#/ganti-password")) {
    const next = encodeURIComponent(nextPathFromHash());
    return (
      <Redirect
        href={`/ganti-password?next=${next}`}
        message="Ganti password sementara untuk melanjutkan…"
      />
    );
  }
  return children;
}

export function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) return <RequireAuth>{children}</RequireAuth>;
  if (user.mustChangePassword && !window.location.hash.startsWith("#/ganti-password")) {
    return <RequireAuth>{children}</RequireAuth>;
  }
  if (!roles.includes(user.role)) {
    return (
      <section className="container auth-access-denied" role="alert">
        <h1>Akses tidak tersedia</h1>
        <p>Akun ini tidak memiliki izin untuk membuka halaman tersebut.</p>
        <a className="button-secondary" href="#/beranda">Kembali ke beranda</a>
      </section>
    );
  }
  return children;
}

export function AuthLoadingFallback() {
  return <AuthLoading />;
}
