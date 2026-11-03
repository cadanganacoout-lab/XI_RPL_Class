import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  authSearchParams,
  hashPathFromNext,
  safeNextPath,
} from "../lib/navigation.js";

function AuthFrame({ eyebrow, title, description, children }) {
  return (
    <section className="container auth-page">
      <div className="auth-card">
        <span className="route-label">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
      </div>
    </section>
  );
}

function AuthError({ message }) {
  if (!message) return null;
  return (
    <p className="auth-error" id="auth-form-error" role="alert" aria-live="assertive">
      {message}
    </p>
  );
}

function navigateAfterAuth(user, nextPath) {
  const next = safeNextPath(nextPath);
  if (user?.mustChangePassword) {
    window.location.hash = `#/ganti-password?next=${encodeURIComponent(next)}`;
    return;
  }
  window.location.hash = `#${hashPathFromNext(next)}`;
}

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const next = safeNextPath(authSearchParams().get("next"));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await login({ username, password });
      navigateAfterAuth(user, next);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="akun"
      title="Masuk ke akun"
      description="Gunakan username dan password akun kelas Anda."
    >
      <form
        className="auth-form"
        onSubmit={submit}
        aria-busy={submitting}
        aria-describedby={error ? "auth-form-error" : undefined}
      >
        <div className="auth-field">
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]{3,20}"
            required
            value={username}
            onChange={event => setUsername(event.target.value)}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
        </div>
        <AuthError message={error} />
        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? "Memeriksa akun…" : "Masuk"}
        </button>
        <p className="auth-switch">
          Belum memiliki akun? <a href={`#/daftar?next=${encodeURIComponent(next)}`}>Daftar</a>
        </p>
        <p className="auth-switch">
          Penghuni kelas ini? WA admin kelas untuk mendapatkan akun khusus Siswa/i.
        </p>
      </form>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const next = safeNextPath(authSearchParams().get("next"));

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await register({ displayName, username, password });
      navigateAfterAuth(user, next);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="akun baru"
      title="Daftar sebagai member"
      description="Pendaftaran mandiri membuat akun member yang hanya dapat membaca situs."
    >
      <form
        className="auth-form"
        onSubmit={submit}
        aria-busy={submitting}
        aria-describedby={error ? "auth-form-error" : undefined}
      >
        <div className="auth-field">
          <label htmlFor="register-name">Nama tampilan</label>
          <input
            id="register-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={40}
            required
            value={displayName}
            onChange={event => setDisplayName(event.target.value)}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="register-username">Username</label>
          <input
            id="register-username"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck="false"
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]{3,20}"
            required
            value={username}
            onChange={event => setUsername(event.target.value)}
          />
          <small id="register-username-help">3–20 karakter: huruf, angka, atau garis bawah.</small>
        </div>
        <div className="auth-field">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={72}
            aria-describedby="register-password-help"
            required
            value={password}
            onChange={event => setPassword(event.target.value)}
          />
          <small id="register-password-help">Gunakan password yang kuat dan tidak umum.</small>
        </div>
        <AuthError message={error} />
        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? "Membuat akun…" : "Buat akun member"}
        </button>
        <p className="auth-switch">
          Sudah memiliki akun? <a href={`#/login?next=${encodeURIComponent(next)}`}>Masuk</a>
        </p>
        <p className="auth-switch">
          Penghuni kelas ini? WA admin kelas untuk mendapatkan akun khusus Siswa/i.
        </p>
      </form>
    </AuthFrame>
  );
}

export function ChangePasswordPage() {
  const { changePassword, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const next = safeNextPath(authSearchParams().get("next"));

  if (user.role === "member" && !user.mustChangePassword) {
    return (
      <AuthFrame
        eyebrow="keamanan akun"
        title="Perubahan password melalui admin"
        description="Hubungi admin kelas untuk memperbarui credential akun member."
      >
        <p className="auth-switch">
          <a href="#/profil">Kembali ke profil</a>
        </p>
      </AuthFrame>
    );
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await changePassword({ currentPassword, newPassword });
      navigateAfterAuth(user, next);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthFrame
      eyebrow="keamanan akun"
      title="Ganti password"
      description="Perbarui password akun sebelum melanjutkan."
    >
      <form
        className="auth-form"
        onSubmit={submit}
        aria-busy={submitting}
        aria-describedby={error ? "auth-form-error" : undefined}
      >
        <div className="auth-field">
          <label htmlFor="current-password">Password saat ini</label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={event => setCurrentPassword(event.target.value)}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="new-password">Password baru</label>
          <input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={72}
            aria-describedby="change-password-help"
            required
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
          />
          <small id="change-password-help">Panjang 10–72 byte UTF-8 dan bukan password umum.</small>
        </div>
        <AuthError message={error} />
        <button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? "Memperbarui password…" : "Simpan password baru"}
        </button>
      </form>
    </AuthFrame>
  );
}
