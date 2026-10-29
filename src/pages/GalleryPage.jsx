import React, { useEffect, useState } from "react";
import { GALERI } from "../data/class-data.js";

function galleryImage(photo, size) {
  return photo.foto || `https://picsum.photos/seed/${photo.seed}/${size}`;
}

export function GalleryPage() {
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    if (!selectedPhoto) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setSelectedPhoto(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedPhoto]);

  return (
    <>
      <section className="container page-hero">
          <span className="route-label">/galeri</span>
          <h1>Galeri Kegiatan</h1>
          <p>
            Dokumentasi kegiatan kelas XI RPL 1. Telusuri galeri dari atas ke bawah;
            ketuk foto untuk memperbesar.
          </p>
      </section>
      <section className="container">
          <p className="gallery-hint">
            Gulir ke bawah untuk melihat lebih banyak foto · klik foto untuk memperbesar
          </p>
          <div className="gallery-grid">
            {GALERI.map((photo) => (
              <button
                className="gallery-item"
                key={photo.id}
                type="button"
                aria-label={`Perbesar foto: ${photo.caption}`}
                onClick={() => setSelectedPhoto(photo)}
              >
                <img
                  src={galleryImage(photo, "500/420")}
                  alt={photo.caption}
                  loading="lazy"
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
            if (event.target === event.currentTarget) setSelectedPhoto(null);
          }}
        >
          <div
            className="modal-box gallery-modal"
            role="dialog"
            aria-modal="true"
            aria-label={selectedPhoto.caption}
          >
            <div className="modal-head">
              <span>Pratinjau foto</span>
              <button
                className="modal-close"
                type="button"
                aria-label="Tutup"
                onClick={() => setSelectedPhoto(null)}
              >
                ✕
              </button>
            </div>
            <img
              src={galleryImage(selectedPhoto, "900/700")}
              alt={selectedPhoto.caption}
              onError={(event) => {
                const fallback = `https://picsum.photos/seed/${selectedPhoto.seed}/900/700`;
                if (event.currentTarget.src !== fallback) {
                  event.currentTarget.src = fallback;
                }
              }}
            />
            <div className="cap-line">{selectedPhoto.caption}</div>
          </div>
        </div>
      )}
    </>
  );
}
