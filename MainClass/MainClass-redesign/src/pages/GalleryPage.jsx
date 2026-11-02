import React, { useCallback, useEffect, useRef, useState } from "react";
import { GALERI } from "../data/class-data.js";

function galleryImage(photo, size) {
  return photo.foto || `https://picsum.photos/seed/${photo.seed}/${size}`;
}

const FOCUSABLE = "button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

function Arrow({ direction }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "prev" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
    </svg>
  );
}

export function GalleryPage() {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const openerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const isOpen = selectedIndex !== null;
  const selectedPhoto = isOpen ? GALERI[selectedIndex] : null;

  const close = useCallback(() => setSelectedIndex(null), []);
  const step = useCallback(
    (direction) => setSelectedIndex((index) => (index + direction + GALERI.length) % GALERI.length),
    [],
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
        // Jaga fokus tetap berada di dalam dialog.
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

  return (
    <>
      <section className="container page-hero">
        <span className="route-label">/galeri</span>
        <h1>Galeri Kegiatan</h1>
        <p>Dokumentasi kegiatan kelas XI RPL. Pilih foto untuk melihatnya lebih besar.</p>
      </section>
      <section className="container">
        <p className="gallery-hint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          {GALERI.length} foto · pilih foto untuk memperbesar, gunakan ← → untuk berpindah
        </p>
        <div className="gallery-grid">
          {GALERI.map((photo, index) => (
            <button
              className="gallery-item"
              key={photo.id}
              type="button"
              aria-label={`Perbesar foto: ${photo.caption}`}
              onClick={(event) => {
                openerRef.current = event.currentTarget;
                setSelectedIndex(index);
              }}
            >
              <img
                src={galleryImage(photo, "500/420")}
                alt={photo.caption}
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  const fallback = `https://picsum.photos/seed/${photo.seed}/500/420`;
                  if (event.currentTarget.src !== fallback) {
                    event.currentTarget.src = fallback;
                  }
                }}
              />
              <span className="cap">{photo.caption}</span>
            </button>
          ))}
        </div>
      </section>
      {selectedPhoto && (
        <div
          className="modal-backdrop open"
          role="presentation"
          onClick={(event) => {
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
                Foto {selectedIndex + 1} / {GALERI.length}
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
                onError={(event) => {
                  const fallback = `https://picsum.photos/seed/${selectedPhoto.seed}/900/700`;
                  if (event.currentTarget.src !== fallback) {
                    event.currentTarget.src = fallback;
                  }
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
