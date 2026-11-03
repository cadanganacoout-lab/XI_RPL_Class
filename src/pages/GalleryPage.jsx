import React, { useCallback, useEffect, useRef, useState } from "react";
import { MediaUploader } from "../components/MediaUploader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";
import { GALERI } from "../data/class-data.js";

function galleryImage(photo, size) {
  return photo.url || photo.foto || `https://picsum.photos/seed/${photo.seed}/${size}`;
}

function galleryFallback(photo, size) {
  return `https://picsum.photos/seed/${encodeURIComponent(photo.id || photo.seed || "kelas-rpl")}/${size}`;
}

const FOCUSABLE = "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

function Arrow({ direction }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "prev" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
    </svg>
  );
}

function GalleryAdminItem({
  photo,
  onUpdated,
  onArchived,
  onMove,
  canMoveUp,
  canMoveDown,
  reordering,
}) {
  const [caption, setCaption] = useState(photo.caption);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputId = `gallery-caption-${photo.id}`;
  const changed = caption.trim() !== photo.caption;

  useEffect(() => setCaption(photo.caption), [photo.caption]);

  async function saveCaption(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await apiRequest(`/api/admin/gallery/${encodeURIComponent(photo.id)}`, {
        method: "PATCH",
        body: { caption: caption.trim() },
      });
      onUpdated(result.photo);
      setNotice("Deskripsi foto berhasil diperbarui.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function archivePhoto() {
    if (!photo.isPublished || busy || !window.confirm("Hapus foto ini dari galeri?")) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await apiRequest(`/api/admin/gallery/${encodeURIComponent(photo.id)}`, {
        method: "DELETE",
      });
      onArchived(photo.id);
      setNotice(
        result.cleanupPending
          ? "Foto dihapus dari galeri. Pembersihan file masih tertunda."
          : "Foto berhasil dihapus dari galeri.",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`gallery-admin-item${photo.isPublished ? "" : " is-archived"}`}>
      <img
        src={photo.url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={event => {
          const fallback = galleryFallback(photo, "400/300");
          if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
        }}
      />
      <form className="gallery-admin-form" onSubmit={saveCaption} aria-busy={busy}>
        <label htmlFor={inputId}>Deskripsi foto</label>
        <input
          id={inputId}
          value={caption}
          maxLength={500}
          required
          aria-describedby={`${inputId}-count`}
          onChange={event => setCaption(event.target.value)}
          disabled={busy || !photo.isPublished}
        />
        <small id={`${inputId}-count`}>{caption.length}/500 karakter</small>
        {!photo.isPublished && <span>Foto telah diarsipkan.</span>}
        {error && <p className="media-uploader-error" role="alert">{error}</p>}
        {notice && <p className="media-uploader-notice" role="status">{notice}</p>}
        <div className="gallery-admin-actions">
          <button className="button-primary" type="submit" disabled={!changed || busy || !photo.isPublished}>
            {busy ? "Memproses…" : "Simpan deskripsi"}
          </button>
          {photo.isPublished && (
            <>
              <button
                className="button-secondary"
                type="button"
                aria-label={`Naikkan urutan ${photo.caption}`}
                disabled={busy || reordering || !canMoveUp}
                onClick={() => onMove(-1)}
              >
                Naikkan
              </button>
              <button
                className="button-secondary"
                type="button"
                aria-label={`Turunkan urutan ${photo.caption}`}
                disabled={busy || reordering || !canMoveDown}
                onClick={() => onMove(1)}
              >
                Turunkan
              </button>
              <button className="button-secondary" type="button" disabled={busy} onClick={archivePhoto}>
                Hapus foto
              </button>
            </>
          )}
        </div>
      </form>
    </article>
  );
}

export function GalleryPage() {
  const { user } = useAuth();
  const canManageMedia = user?.role === "admin" && user?.username === "admin";
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [reordering, setReordering] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const openerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");
    apiRequest(canManageMedia ? "/api/admin/gallery" : "/api/gallery")
      .then(payload => {
        if (!Array.isArray(payload.photos)) {
          throw new Error("Respons galeri tidak valid.");
        }
        if (active) {
          setPhotos(payload.photos);
          setStatus("ready");
        }
      })
      .catch(requestError => {
        if (active) {
          setError(requestError.message);
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [canManageMedia, retry]);

  const publishedPhotos = photos.filter(photo => photo.isPublished !== false);
  const archivedPhotos = photos.filter(photo => photo.isPublished === false);
  const displayPhotos = canManageMedia
    ? publishedPhotos
    : publishedPhotos.length > 0
      ? publishedPhotos
      : status === "loading"
        ? []
        : GALERI;
  const isOpen = selectedIndex !== null && selectedIndex < displayPhotos.length;
  const selectedPhoto = isOpen ? displayPhotos[selectedIndex] : null;

  const close = useCallback(() => setSelectedIndex(null), []);
  const step = useCallback(
    direction => setSelectedIndex(index => (
      index === null || displayPhotos.length === 0
        ? null
        : (index + direction + displayPhotos.length) % displayPhotos.length
    )),
    [displayPhotos.length],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        close();
      } else if (event.key === "ArrowLeft") {
        step(-1);
      } else if (event.key === "ArrowRight") {
        step(1);
      } else if (event.key === "Tab") {
        const items = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus?.();
    };
  }, [isOpen, close, step]);

  function addPhoto(photo) {
    setPhotos(current => [...current, photo].sort((left, right) => left.sortOrder - right.sortOrder));
  }

  function updatePhoto(updated) {
    setPhotos(current => current.map(photo => photo.id === updated.id ? updated : photo));
  }

  function archivePhoto(id) {
    setPhotos(current => current.map(photo => (
      photo.id === id ? { ...photo, isPublished: false } : photo
    )));
  }

  async function movePhoto(id, direction) {
    if (reordering) return;
    const ordered = [...publishedPhotos].sort((left, right) => left.sortOrder - right.sortOrder);
    const index = ordered.findIndex(photo => photo.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const nextOrder = [...ordered];
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    setReordering(true);
    setError("");
    try {
      const result = await apiRequest("/api/admin/gallery/order", {
        method: "PATCH",
        body: { photoIds: nextOrder.map(photo => photo.id) },
      });
      setPhotos(current => [
        ...result.photos,
        ...current.filter(photo => photo.isPublished === false),
      ]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setReordering(false);
    }
  }

  return (
    <>
      <section className="container page-hero">
        <span className="route-label">/galeri</span>
        <h1>Galeri Kegiatan</h1>
        <p>Dokumentasi kegiatan kelas XI RPL. Pilih foto untuk melihatnya lebih besar.</p>
      </section>
      <section className="container" aria-busy={status === "loading"}>
        {canManageMedia && (
          <section className="gallery-admin-panel" aria-labelledby="gallery-admin-heading">
            <h2 id="gallery-admin-heading">Kelola galeri</h2>
            <MediaUploader
              targetType="gallery"
              mediaType="gallery"
              onChanged={addPhoto}
            />
            <div className="gallery-admin-list">
              {[...publishedPhotos, ...archivedPhotos].map((photo, index) => (
                <GalleryAdminItem
                  key={photo.id}
                  photo={photo}
                  onUpdated={updatePhoto}
                  onArchived={archivePhoto}
                  onMove={direction => movePhoto(photo.id, direction)}
                  canMoveUp={index > 0}
                  canMoveDown={index < publishedPhotos.length - 1}
                  reordering={reordering}
                />
              ))}
              {status === "ready" && photos.length === 0 && (
                <p className="empty-note">Belum ada foto yang dikelola di galeri.</p>
              )}
            </div>
          </section>
        )}
        {error && (
          <div className="student-list-message" role="alert">
            <p>{error}</p>
            <button type="button" className="button-secondary" onClick={() => setRetry(value => value + 1)}>
              Coba muat ulang
            </button>
          </div>
        )}
        {status === "loading" && <p className="admin-data-status" role="status">Memuat galeri…</p>}
        {status === "ready" && displayPhotos.length === 0 && !canManageMedia && (
          <p className="empty-note">Belum ada foto galeri.</p>
        )}
        {displayPhotos.length > 0 && (
          <>
            <p className="gallery-hint">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              {displayPhotos.length} foto · pilih foto untuk memperbesar, gunakan ← → untuk berpindah
            </p>
            <div className="gallery-grid">
              {displayPhotos.map((photo, index) => (
                <button
                  className="gallery-item"
                  key={photo.id}
                  type="button"
                  aria-label={`Perbesar foto: ${photo.caption}`}
                  onClick={event => {
                    openerRef.current = event.currentTarget;
                    setSelectedIndex(index);
                  }}
                >
                  <img
                    src={galleryImage(photo, "500/420")}
                    alt={photo.caption}
                    loading="lazy"
                    decoding="async"
                    onError={event => {
                      const fallback = galleryFallback(photo, "500/420");
                      if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
                    }}
                  />
                  <span className="cap">{photo.caption}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
      {selectedPhoto && (
        <div
          className="modal-backdrop open"
          role="presentation"
          onClick={event => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            className="modal-box gallery-modal"
            role="dialog"
            aria-modal="true"
            aria-label={selectedPhoto.caption}
            ref={dialogRef}
          >
            <div className="modal-head">
              <span aria-live="polite">
                Foto {selectedIndex + 1} / {displayPhotos.length}
              </span>
              <button
                className="modal-close"
                type="button"
                aria-label="Tutup"
                ref={closeButtonRef}
                onClick={close}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="lightbox-stage">
              <button className="lightbox-nav lightbox-nav--prev" type="button" aria-label="Foto sebelumnya" onClick={() => step(-1)}>
                <Arrow direction="prev" />
              </button>
              <img
                key={selectedPhoto.id}
                src={galleryImage(selectedPhoto, "900/700")}
                alt={selectedPhoto.caption}
                onError={event => {
                  const fallback = galleryFallback(selectedPhoto, "900/700");
                  if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
                }}
              />
              <button className="lightbox-nav lightbox-nav--next" type="button" aria-label="Foto berikutnya" onClick={() => step(1)}>
                <Arrow direction="next" />
              </button>
            </div>
            <div className="cap-line">{selectedPhoto.caption}</div>
          </div>
        </div>
      )}
    </>
  );
}
