import React from "react";
import { SITE, VIDEO } from "../data/class-data.js";

export function VideosPage() {
  const classLabel = SITE.className.split(" ")[0];

  return (
    <>
      <section className="container page-hero">
          <span className="route-label">/video</span>
          <h1>Video Kegiatan</h1>
          <p>
            Dokumentasi dan materi belajar kelas XI RPL. Jika pemutar tidak tersedia,
            buka video langsung di YouTube.
          </p>
      </section>
      <section className="container">
          <p className="video-count">{VIDEO.length} video untuk ditonton</p>
          <div className="video-grid frame-grid">
            {VIDEO.map((video) => (
              <article className="video-card frame-cell" key={video.id}>
                <div className="video-frame">
                  <img
                    className="video-poster"
                    src={`https://img.youtube.com/vi/${encodeURIComponent(video.youtubeId)}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                  />
                  <iframe
                    src={`https://www.youtube.com/embed/${encodeURIComponent(video.youtubeId)}`}
                    title={video.judul}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="video-info">
                  <div className="video-avatar">{classLabel}</div>
                  <div>
                    <div className="video-title">{video.judul}</div>
                    <div className="video-meta">
                      Kelas XI RPL · {video.deskripsi}
                    </div>
                    <a
                      className="video-external-link"
                      href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.youtubeId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Buka di YouTube ↗
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
