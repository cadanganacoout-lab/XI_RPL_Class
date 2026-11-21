import React, { useCallback, useEffect, useState } from "react";
import { CommentCard, useCommentFeed } from "../components/Comments.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";

const REPORT_REASON_LABELS = {
  spam: "Spam",
  bullying: "Perundungan atau bahasa tidak pantas",
  personal_info: "Informasi pribadi",
  other: "Lainnya",
};

function AdminCommentReports() {
  const { user } = useAuth();
  const isMainAdmin = user?.role === "admin" && user?.username === "admin";
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState("Memuat antrean laporan...");
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState("");
  const [removingId, setRemovingId] = useState("");

  const loadReports = useCallback(async () => {
    if (!isMainAdmin) return;
    setLoading(true);
    try {
      const payload = await apiRequest("/api/comments/reports");
      setReports(payload.reports);
      setStatus(payload.reports.length ? "" : "Belum ada laporan yang menunggu ditinjau.");
    } catch (error) {
      setStatus(`Antrean laporan gagal dimuat: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [isMainAdmin]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  async function markReviewed(reportId) {
    try {
      setReviewingId(reportId);
      await apiRequest("/api/comments/reports/review", {
        method: "POST",
        body: { report_id: reportId },
      });
      setReports(current => current.filter(report => report.id !== reportId));
      setStatus("Laporan ditandai sudah ditinjau; komentar tidak diubah.");
    } catch (error) {
      setStatus(`Laporan gagal diperbarui: ${error.message}`);
    } finally {
      setReviewingId("");
    }
  }

  async function removeComment(report) {
    if (!window.confirm(`Hapus komentar #${report.commentId}? Balasan pada komentar ini juga akan terhapus.`)) {
      return;
    }
    try {
      setRemovingId(report.id);
      await apiRequest("/api/comments/reports/remove", {
        method: "POST",
        body: { report_id: report.id },
      });
      setReports(current => current.filter(item => item.id !== report.id));
      setStatus(`Komentar #${report.commentId} dan balasannya telah dihapus.`);
    } catch (error) {
      setStatus(`Komentar gagal dihapus: ${error.message}`);
    } finally {
      setRemovingId("");
    }
  }

  if (!isMainAdmin) return null;

  return (
    <section className="container comment-report-queue" aria-labelledby="comment-reports-heading">
      <div className="comment-report-queue-heading">
        <div>
          <span className="route-label">admin</span>
          <h2 id="comment-reports-heading">Antrean laporan komentar</h2>
        </div>
        <button className="button-secondary" type="button" onClick={loadReports} disabled={loading}>
          {loading ? "Memuat..." : "Muat ulang"}
        </button>
      </div>
      {status && <p className="comment-report-queue-status" role="status">{status}</p>}
      {reports.length > 0 && (
        <ol className="comment-report-list">
          {reports.map(report => (
            <li className="panel comment-report-item" key={report.id}>
              <div className="comment-report-item-heading">
                <strong>Komentar #{report.commentId}</strong>
                <time dateTime={report.createdAt}>
                  {new Date(report.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </div>
              <p><strong>Alasan:</strong> {REPORT_REASON_LABELS[report.reason] || "Lainnya"}</p>
              <p><strong>Laporan:</strong> {report.reportCount}</p>
              <blockquote>{report.commentContent}</blockquote>
              <div className="comment-report-item-actions">
                <button
                  className="button-secondary"
                  type="button"
                  aria-label={`Tandai ditinjau, komentar nomor ${report.commentId}`}
                  disabled={reviewingId === report.id || removingId === report.id}
                  onClick={() => markReviewed(report.id)}
                >
                  {reviewingId === report.id ? "Menyimpan..." : "Tandai ditinjau"}
                </button>
                <button
                  className="button-secondary comment-report-delete"
                  type="button"
                  aria-label={`Hapus komentar nomor ${report.commentId}`}
                  disabled={reviewingId === report.id || removingId === report.id}
                  onClick={() => removeComment(report)}
                >
                  {removingId === report.id ? "Menghapus..." : "Hapus komentar"}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CommentsSection() {
  const feed = useCommentFeed();
  const { user } = useAuth();
  const isMainAdmin = user?.role === "admin" && user?.username === "admin";
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
      if (isMainAdmin) await feed.insertAdminComment(content, replyTo);
      else await feed.insertComment(content, replyTo);
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
    <>
      <section className="container home-discussion" id="diskusi">
        <div className="section-head discussion-heading">
          <div>
          <span className="route-label">ruang kelas</span>
          <h2 id="comments-title">Ruang Diskusi</h2>
          <p>Berbagi kabar dan ide secara anonim. Admin utama tampil dengan nama akun. Jangan bagikan informasi pribadi.</p>
          </div>
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
              <span className={text.length > 450 ? "is-near" : undefined}>{text.length}/500</span>
              <button className="comment-submit" type="submit" disabled={!feed.enabled || submitting}>
                {submitting
                  ? "Mengirim..."
                  : isMainAdmin
                    ? replyTo !== null ? "Kirim balasan sebagai admin" : "Kirim sebagai admin"
                    : replyTo !== null ? "Kirim balasan" : "Kirim anonim"}
              </button>
            </div>
            <p
              className={`comment-notice${/gagal|terlebih dahulu|maksimal/i.test(notice) ? " is-error" : ""}`}
              role="status"
              aria-live="polite"
            >
              {notice}
            </p>
          </form>
          <div className="panel comments-panel">
            <div className="panel-head">
              <h3>Semua Komentar</h3>
              <span className={`filetag feed-status${feed.status.startsWith("Terhubung") ? " is-online" : ""}`}>{feed.status}</span>
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
      <AdminCommentReports />
    </>
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
