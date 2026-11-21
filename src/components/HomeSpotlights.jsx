import React, { useEffect, useMemo, useState } from "react";
import { VIDEO, UI } from "../data/class-data.js";
import { apiRequest } from "../lib/api.js";

const VIDEO_HIGHLIGHT_COUNT = 9;
function selectVideoHighlights(videos) {
  return videos.length <= VIDEO_HIGHLIGHT_COUNT
    ? videos
    : Array.from({ length: VIDEO_HIGHLIGHT_COUNT }, (_, index) => (
      videos[Math.round(index * (videos.length - 1) / (VIDEO_HIGHLIGHT_COUNT - 1))]
    ));
}

function createGalleryHighlights(photos) {
  const galleryPhotoPool = photos
    .filter(photo => typeof photo.url === "string" && photo.url.trim())
    .filter((photo, index, items) => items.findIndex(item => item.url === photo.url) === index);
  const selectedPhotos = galleryPhotoPool.slice(0, 8);
  const alternatePhotos = galleryPhotoPool.slice(8);

  if (alternatePhotos.length === 0 || selectedPhotos.length === 0) return selectedPhotos;

  const randomTopLeftPhoto = alternatePhotos[Math.floor(Math.random() * alternatePhotos.length)];
  return [randomTopLeftPhoto, ...selectedPhotos.slice(1)];
}

function GalleryHighlightCard({ photo, index, isClosing }) {
  const [imageStatus, setImageStatus] = useState("loading");

  return (
    <figure
      className={[
        "gallery-highlight-card",
        index === 0 && "gallery-highlight-card--featured",
        isClosing && "gallery-highlight-card--closing",
        imageStatus === "loaded" && "is-loaded",
        imageStatus === "loading" && "is-image-loading",
        imageStatus === "error" && "has-image-error",
      ].filter(Boolean).join(" ")}
      style={{ "--spotlight-index": index }}
    >
      <div className="gallery-highlight-media">
        <img
          src={photo.url}
          alt={photo.caption || `Kegiatan kelas ${index + 1}`}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageStatus("loaded")}
          onError={() => setImageStatus("error")}
        />
        {imageStatus === "loading" && (
          <span className="home-photo-skeleton" aria-hidden="true" />
        )}
        {imageStatus === "error" && (
          <span className="gallery-highlight-image-error" aria-hidden="true">
            Foto tidak dapat dimuat
          </span>
        )}
      </div>
      <figcaption>{photo.caption}</figcaption>
    </figure>
  );
}

function GalleryHighlights({ photos, status }) {
  const highlights = useMemo(() => createGalleryHighlights(photos), [photos]);

  return (
    <section id="gallery-spotlight" className="home-spotlight home-gallery-spotlight" aria-labelledby="gallery-spotlight-title" tabIndex="-1">
      <div
        className="gallery-highlight-stage"
        aria-busy={status === "loading"}
      >
        <div className="spotlight-section-header">
          <div className="spotlight-heading">
            <h2 id="gallery-spotlight-title">{UI.spotlights.galleryTitle}</h2>
          </div>
          <a className="spotlight-link" href={UI.spotlights.galleryLink}>{UI.spotlights.galleryLinkLabel}</a>
        </div>
        {status === "loading" && (
          <>
            <span className="visually-hidden" role="status">Memuat foto galeri…</span>
            {Array.from({ length: 8 }, (_, index) => (
              <figure
                className={[
                  "gallery-highlight-card",
                  "gallery-highlight-card--skeleton",
                  index === 0 && "gallery-highlight-card--featured",
                  index === 7 && "gallery-highlight-card--closing",
                ].filter(Boolean).join(" ")}
                key={index}
                aria-hidden="true"
                style={{ "--spotlight-index": index }}
              >
                <span className="home-photo-skeleton" />
                <figcaption><span className="gallery-highlight-caption-skeleton" /></figcaption>
              </figure>
            ))}
          </>
        )}
        {status === "ready" && highlights.map((photo, index) => (
          <GalleryHighlightCard
            photo={photo}
            index={index}
            isClosing={index === highlights.length - 1 && index > 0}
            key={photo.id || photo.url}
          />
        ))}
        {status !== "loading" && highlights.length === 0 && (
          <p className="gallery-highlight-empty" role={status === "error" ? "alert" : "status"}>
            {status === "error"
              ? "Foto galeri belum dapat dimuat."
              : "Belum ada foto galeri."}
          </p>
        )}
      </div>
    </section>
  );
}

function VideoHighlights() {
  const [videos, setVideos] = useState(VIDEO);

  useEffect(() => {
    let active = true;
    apiRequest("/api/videos")
      .then(payload => {
        if (active && Array.isArray(payload.videos)) {
          setVideos(payload.videos.length ? payload.videos : VIDEO);
        }
      })
      .catch(() => {
        if (active) setVideos(VIDEO);
      });
    return () => {
      active = false;
    };
  }, []);

  const videoHighlights = selectVideoHighlights(videos);

  return (
    <section id="video-spotlight" className="home-spotlight home-video-spotlight" aria-labelledby="video-spotlight-title" tabIndex="-1">
      <div className="video-spotlight-layout">
        <div className="spotlight-section-header video-spotlight-heading">
          <div className="spotlight-heading">
            <h2 id="video-spotlight-title">{UI.spotlights.videoTitle}</h2>
          </div>
          <a className="spotlight-link" href={UI.spotlights.videoLink}>{UI.spotlights.videoLinkLabel}</a>
        </div>
        <div className="video-highlight-grid">
          {videoHighlights.map((video, index) => (
            <a
              className={`video-highlight-card${index === 0 ? " video-highlight-card--featured" : ""}`}
              href={`#/video?id=${encodeURIComponent(video.id)}`}
              key={video.id}
              style={{ "--spotlight-index": index }}
            >
              <span className="video-highlight-media">
                <img
                  src={`https://img.youtube.com/vi/${encodeURIComponent(video.youtubeId)}/hqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <span className="video-highlight-play-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
                  </svg>
                </span>
              </span>
              <span className="video-highlight-info">
                <span className="video-highlight-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{video.judul}</strong>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeSpotlights({ photos, status }) {
  return (
    <>
      <GalleryHighlights photos={photos} status={status} />
      <VideoHighlights />
    </>
  );
}
