import React, { useEffect, useState } from "react";
import { Avatar } from "../components/Avatar.jsx";
import { MediaUploader } from "../components/MediaUploader.jsx";
import { StudentCard } from "../components/StudentCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";

const roleLabels = {
  admin: "Admin",
  student: "Siswa RPL 42",
  member: "Anggota",
};

function ProfileLoading() {
  return (
    <section className="container profile-loading" aria-busy="true">
      <span className="student-skeleton student-skeleton--avatar" />
      <span className="student-skeleton student-skeleton--name" />
      <span className="student-skeleton" />
      <span className="visually-hidden" role="status">Memuat profil…</span>
    </section>
  );
}

function ProfileUnavailable({ notFound, onRetry }) {
  return (
    <section className="container profile-unavailable" role={notFound ? undefined : "alert"}>
      <h1>{notFound ? "Profil tidak ditemukan" : "Profil belum dapat dimuat"}</h1>
      <p>
        {notFound
          ? "Profil ini tidak tersedia atau sudah tidak aktif."
          : "Periksa koneksi Anda, lalu coba muat profil kembali."}
      </p>
      {notFound ? (
        <a className="button-secondary" href="#/siswa">Kembali ke daftar siswa</a>
      ) : (
        <button className="button-secondary" type="button" onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </section>
  );
}

export function ProfilePage({ username }) {
  const { user: authUser, logout, refresh } = useAuth();
  const owner = Boolean(authUser && (!username || authUser.username === username));
  const profileUsername = username || authUser?.username || "";
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading");
  const [retry, setRetry] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameNotice, setNameNotice] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    if (!profileUsername) return undefined;
    let active = true;
    setStatus("loading");
    const endpoint = owner
      ? "/api/profile/me"
      : `/api/profile/${encodeURIComponent(profileUsername)}`;

    apiRequest(endpoint)
      .then(payload => {
        if (!payload.user || typeof payload.user !== "object") {
          throw new Error("Respons profil tidak valid.");
        }
        if (active) {
          setProfile(payload);
          setNameDraft(payload.user.displayName);
          setStatus("ready");
        }
      })
      .catch(requestError => {
        if (active) {
          setStatus(
            requestError.status === 400 || requestError.status === 404
              ? "not-found"
              : "error",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [profileUsername, owner, retry]);

  async function saveDisplayName(event) {
    event.preventDefault();
    setNameError("");
    setNameNotice("");
    const displayName = nameDraft.trim();
    if (!displayName) {
      setNameError("Nama tampilan wajib diisi.");
      return;
    }

    setSavingName(true);
    try {
      const payload = await apiRequest("/api/profile/me", {
        method: "PATCH",
        body: { displayName },
      });
      setProfile(current => ({ ...current, user: payload.user }));
      setNameDraft(payload.user.displayName);
      setEditingName(false);
      setNameNotice("Nama tampilan berhasil diperbarui.");
      await refresh();
    } catch (requestError) {
      setNameError(requestError.message);
    } finally {
      setSavingName(false);
    }
  }

  async function signOut() {
    setLogoutError("");
    setLoggingOut(true);
    try {
      await logout();
      window.location.hash = "#/beranda";
    } catch (requestError) {
      setLogoutError(requestError.message);
    } finally {
      setLoggingOut(false);
    }
  }

  if (status === "loading") return <ProfileLoading />;
  if (status !== "ready" || !profile) {
    return (
      <ProfileUnavailable
        notFound={status === "not-found"}
        onRetry={() => setRetry(value => value + 1)}
      />
    );
  }

  const profileUser = profile.user;
  const joinedAt = new Date(profileUser.joinedAt);
  const joinedText = Number.isNaN(joinedAt.getTime())
    ? "Tanggal bergabung tidak tersedia"
    : new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(joinedAt);
  const canEditName = owner && ["student", "admin"].includes(profileUser.role);

  return (
    <section className="container profile-page">
      <header className="profile-header">
        <Avatar
          name={profileUser.displayName}
          src={profile.card?.avatar?.url || profile.card?.foto}
          size={96}
          round
        />
        <div className="profile-identity">
          <span className="route-label">/profil/{profileUser.username}</span>
          <h1>{profileUser.displayName}</h1>
          <p className="profile-username">@{profileUser.username}</p>
          <span className="role-tag role-tag--lead">
            {roleLabels[profileUser.role] || "Akun"}
          </span>
        </div>
      </header>

      <div className="profile-content">
        <section className="profile-details" aria-labelledby="profile-details-heading">
          <h2 id="profile-details-heading">Informasi profil</h2>
          <dl className="account-details">
            <div><dt>Username</dt><dd>@{profileUser.username}</dd></div>
            <div><dt>Bergabung</dt><dd>{joinedText}</dd></div>
          </dl>

          {owner && profileUser.role === "student" && profile.card && (
            <div className="profile-media-tools">
              <MediaUploader
                targetType="students"
                targetId={profile.card.id}
                mediaType="avatar"
                currentUrl={profile.card.avatar?.url || profile.card.foto}
                removable={Boolean(profile.card.avatar)}
                onChanged={media => setProfile(current => ({
                  ...current,
                  card: { ...current.card, avatar: media },
                }))}
              />
            </div>
          )}

          {owner && (
            <div className="profile-actions">
              {canEditName && (
                <>
                  <button
                    className="button-secondary"
                    type="button"
                    aria-expanded={editingName}
                    aria-controls="profile-name-editor"
                    onClick={() => {
                      setNameDraft(profileUser.displayName);
                      setNameError("");
                      setEditingName(value => !value);
                    }}
                  >
                    {editingName ? "Batal edit nama" : "Edit Nama Tampilan"}
                  </button>
                  <form
                    id="profile-name-editor"
                    className="profile-name-form"
                    hidden={!editingName}
                    onSubmit={saveDisplayName}
                    aria-busy={savingName}
                  >
                    <label htmlFor="profile-display-name">Nama tampilan</label>
                    <input
                      id="profile-display-name"
                      name="displayName"
                      type="text"
                      autoComplete="name"
                      minLength={1}
                      maxLength={40}
                      required
                      value={nameDraft}
                      aria-invalid={Boolean(nameError)}
                      aria-describedby={nameError ? "profile-name-error" : "profile-name-help"}
                      onChange={event => {
                        setNameDraft(event.target.value);
                        setNameError("");
                      }}
                    />
                    <small id="profile-name-help">Maksimal 40 karakter.</small>
                    {nameError && <p id="profile-name-error" className="auth-error" role="alert">{nameError}</p>}
                    <button className="auth-submit" type="submit" disabled={savingName}>
                      {savingName ? "Menyimpan…" : "Simpan nama"}
                    </button>
                  </form>
                </>
              )}
              {nameNotice && <p className="card-editor-notice" role="status">{nameNotice}</p>}
              {profileUser.role !== "member" && (
                <a className="button-secondary" href="#/ganti-password">Ganti password</a>
              )}
              {profileUser.role === "student" && (
                <a className="button-secondary" href="#/card-saya">Edit Card</a>
              )}
              <button
                className="button-secondary"
                type="button"
                disabled={loggingOut}
                onClick={signOut}
              >
                {loggingOut ? "Keluar…" : "Keluar"}
              </button>
              {logoutError && <p className="auth-error" role="alert">{logoutError}</p>}
            </div>
          )}
        </section>

        {profileUser.role === "student" && profile.card && (
          <section className="profile-card" aria-labelledby="profile-card-heading">
            <h2 id="profile-card-heading">Profil siswa</h2>
            <StudentCard student={profile.card} />
          </section>
        )}
      </div>
    </section>
  );
}
