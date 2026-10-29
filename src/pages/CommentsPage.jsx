import React, { useState } from "react";
import { CommentCard, useCommentFeed } from "../components/Comments.jsx";

export function CommentsSection() {
  const feed = useCommentFeed();
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function chooseReply(comment) {
    setReplyTo(comment.parent_id || comment.id);
    document.getElementById("commentInput")?.focus();
  }

  async function submitComment(event) {
    event.preventDefault();
    const content = text.trim();
    if (!content) {
      setNotice("Tulis komentar terlebih dahulu.");
      return;
    }
    if (content.length > 500) {
      setNotice("Komentar maksimal 500 karakter.");
      return;
    }

    try {
      setSubmitting(true);
      setNotice("Mengirim komentar...");
      await feed.insertComment(content, replyTo);
      setText("");
      setReplyTo(null);
      setNotice(replyTo !== null
        ? "Balasan terkirim ke ruang diskusi."
        : "Komentar terkirim ke ruang diskusi.");
    } catch (error) {
      setNotice(`Komentar gagal dikirim: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
      <section className="container home-discussion" id="diskusi">
        <div className="discussion-heading">
          <span className="route-label">ruang kelas</span>
          <h2>Ruang Diskusi</h2>
          <p>Berbagi kabar dan ide secara anonim. Jangan bagikan informasi pribadi.</p>
        </div>
        <div className="comments-layout comments-layout--home">
          <form className="panel comment-form" onSubmit={submitComment}>
            <label htmlFor="commentInput">Tulis komentar</label>
            {replyTo !== null && (
              <div className="replying-to">
                <span className="replying-to-label">
                  <svg
                    className="reply-indicator"
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 4v5a4 4 0 0 0 4 4h7m-4-4 4 4-4 4" />
                  </svg>
                  Membalas komentar #{replyTo}
                </span>
                <button className="reply-cancel" type="button" onClick={() => setReplyTo(null)}>
                  Batal
                </button>
              </div>
            )}
            <textarea
              id="commentInput"
              name="comment"
              maxLength={500}
              rows={5}
              required
              placeholder="Tulis pesan yang sopan untuk kelas..."
              value={text}
              onChange={event => setText(event.target.value)}
            />
            <div className="comment-form-footer">
              <span>{text.length}/500</span>
              <button className="comment-submit" type="submit" disabled={!feed.enabled || submitting}>
                {submitting ? "Mengirim..." : replyTo !== null ? "Kirim balasan" : "Kirim anonim"}
              </button>
            </div>
            <p className="comment-notice" role="status" aria-live="polite">{notice}</p>
          </form>
          <div className="panel comments-panel">
            <div className="panel-head">
              <h3>Semua Komentar</h3>
              <span className="filetag">{feed.status}</span>
            </div>
            <div
              className="discussion-scroll"
              aria-label="Daftar komentar"
              onScroll={event => {
                const area = event.currentTarget;
                if (area.scrollTop + area.clientHeight >= area.scrollHeight - 100) {
                  feed.loadOlder();
                }
              }}
            >
              <div className="comments-list" aria-live="polite">
                {feed.comments.length ? feed.comments.map(comment => (
                  <CommentCard key={comment.id} comment={comment} onReply={chooseReply} />
                )) : (
                  <p className="comments-empty">
                    {feed.enabled
                      ? "Belum ada komentar. Jadilah yang pertama berbagi pesan!"
                      : feed.status.startsWith("Gagal")
                        ? "Komentar gagal dimuat. Periksa koneksi lalu muat ulang halaman."
                        : "Menghubungkan ke ruang diskusi..."}
                  </p>
                )}
              </div>
              <div className="comments-pagination">
                <button
                  className="comment-submit"
                  type="button"
                  hidden={!feed.hasOlder}
                  disabled={feed.loadingOlder}
                  onClick={feed.loadOlder}
                >
                  {feed.loadingOlder ? "Memuat..." : "Muat komentar sebelumnya"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}

export function CommentsPage() {
  return (
    <>
      <section className="container page-hero">
        <span className="route-label">/komentar</span>
        <h1>Ruang Diskusi</h1>
      </section>
      <CommentsSection />
    </>
  );
}
