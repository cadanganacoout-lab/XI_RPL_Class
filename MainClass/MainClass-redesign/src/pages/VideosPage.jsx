import React, { useState } from "react";
import { SITE, VIDEO } from "../data/class-data.js";

function VideoPlayer({ video }) {
  const [playing, setPlaying] = useState(false);
  const id = encodeURIComponent(video.youtubeId);

  return (
    <div className="video-frame">
      {playing ? (
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1`}
          title={video.judul}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          className="video-play"
          type="button"
          aria-label={`Putar video: ${video.judul}`}
          onClick={() => setPlaying(true)}
        >
          <img
            className="video-poster"
            src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          <span className="video-play-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}

export function VideosPage() {
  const classLabel = SITE.className.split(" ")[0];

  return (
    <>
      <section className="container page-hero">
        <span className="route-label">/video</span>
        <h1>Video Kegiatan</h1>
        <p>
          Dokumentasi dan materi belajar kelas XI RPL. Pilih video untuk memutar di sini,
          atau buka langsung di YouTube.
        </p>
      </section>
      <section className="container">
        <p className="video-count">{VIDEO.length} video untuk ditonton</p>
        <div className="video-grid">
          {VIDEO.map((video) => (
            <article className="video-card" key={video.id}>
              <VideoPlayer video={video} />
              <div className="video-info">
                <div className="video-avatar" aria-hidden="true">{classLabel}</div>
                <div className="video-text">
                  <h2 className="video-title">{video.judul}</h2>
                  <p className="video-meta">Kelas XI RPL · {video.deskripsi}</p>
                  <a
                    className="video-external-link"
                    href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.youtubeId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Buka di YouTube
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 17 17 7M8 7h9v9" />
                    </svg>
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
