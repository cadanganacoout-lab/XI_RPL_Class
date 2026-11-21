import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";

const PAGE_SIZE = 50;

function parentIdsFor(comments) {
  return [...new Set(comments.filter(comment => comment.parent_id).map(comment => comment.parent_id))];
}

async function addParentContent(client, comments) {
  const ids = parentIdsFor(comments);
  if (!ids.length) return comments;
  const { data, error } = await client.from("comments").select("id, content").in("id", ids);
  if (error) throw error;
  const content = new Map((data || []).map(comment => [comment.id, comment.content]));
  return comments.map(comment => ({
    ...comment,
    parentContent: content.get(comment.parent_id) || null,
  }));
}

function formatCommentTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Waktu tidak diketahui"
    : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function CommentCard({ comment, onReply }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportNotice, setReportNotice] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const authorName = comment.author_name || "Anonim";
  const initials = comment.author_name
    ? authorName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()
    : "A";

  async function submitReport(event) {
    event.preventDefault();
    try {
      setReporting(true);
      setReportNotice("Mengirim laporan...");
      await apiRequest("/api/comments/report", {
        method: "POST",
        body: { comment_id: comment.id, reason: reportReason },
      });
      setReported(true);
      setReportNotice("Laporan terkirim ke admin. Komentar tetap terlihat sampai ditinjau.");
    } catch (error) {
      setReportNotice(`Laporan gagal dikirim: ${error.message}`);
    } finally {
      setReporting(false);
    }
  }

  return (
    <article
      className={`comment-card${comment.parent_id ? " comment-reply" : ""}`}
      data-comment-id={comment.id}
      id={`comment-${comment.id}`}
    >
      <span className={`comment-avatar${comment.author_name ? " comment-avatar--admin" : ""}`} aria-hidden="true">{initials}</span>
      <div className="comment-main">
        <div className="comment-card-head">
          <div className="comment-who">
            <strong>{authorName}</strong>
            {comment.author_name && <span className="comment-admin-badge">Admin utama</span>}
            <time dateTime={comment.created_at}>{formatCommentTime(comment.created_at)}</time>
          </div>
          <div className="comment-actions">
            {onReply && (
              <button
                className="comment-reply-button"
                type="button"
                onClick={() => onReply(comment)}
              >
                <ReplyIndicator />
                Balas
              </button>
            )}
            <button
              className="comment-report-button"
              type="button"
              aria-expanded={reportOpen}
              aria-controls={`report-comment-${comment.id}`}
              onClick={() => setReportOpen(value => !value)}
            >
              Laporkan
            </button>
          </div>
        </div>
        {comment.parent_id && (
          <blockquote className="comment-reply-context">
            <span className="comment-reply-label">
              <ReplyIndicator />
              Membalas:
            </span>
            <span>{comment.parent?.content || comment.parentContent || "Komentar asal tidak tersedia."}</span>
          </blockquote>
        )}
        <p className="comment-text">{comment.content}</p>
        <form
          className="comment-report-form"
          id={`report-comment-${comment.id}`}
          hidden={!reportOpen}
          onSubmit={submitReport}
        >
          <label htmlFor={`report-reason-${comment.id}`}>Alasan laporan</label>
          <select
            id={`report-reason-${comment.id}`}
            name="reason"
            required
            value={reportReason}
            onChange={event => setReportReason(event.target.value)}
          >
            <option value="">Pilih alasan</option>
            <option value="spam">Spam</option>
            <option value="bullying">Perundungan atau bahasa tidak pantas</option>
            <option value="personal_info">Informasi pribadi</option>
            <option value="other">Lainnya</option>
          </select>
          <div className="comment-report-form-actions">
            <button className="comment-submit" type="submit" disabled={reporting || reported}>
              {reporting ? "Mengirim..." : reported ? "Sudah dilaporkan" : "Kirim laporan"}
            </button>
            <button className="reply-cancel" type="button" onClick={() => setReportOpen(false)}>
              Tutup
            </button>
          </div>
          <p
            className={`comment-report-notice${/gagal/i.test(reportNotice) ? " is-error" : ""}`}
            role="status"
            aria-live="polite"
          >
            {reportNotice}
          </p>
        </form>
      </div>
    </article>
  );
}

function ReplyIndicator() {
  return (
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
  );
}

export function useCommentFeed({ limit } = {}) {
  const [comments, setComments] = useState([]);
  const [status, setStatus] = useState("Menghubungkan...");
  const [enabled, setEnabled] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const oldestId = useRef(null);
  const clientRef = useRef(null);

  const loadLatest = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    setStatus("Menghubungkan ke ruang diskusi...");
    const { data, error } = await client
      .from("comments")
      .select("id, content, parent_id, created_at, author_name")
      .order("id", { ascending: false })
      .limit(limit || PAGE_SIZE);
    if (error) throw error;
    const rows = await addParentContent(client, data || []);
    setComments(rows);
    oldestId.current = rows.length ? rows[rows.length - 1].id : null;
    setHasOlder(Boolean(data && data.length === (limit || PAGE_SIZE)));
    setStatus("Terhubung · komentar anonim");
  }, [limit]);

  useEffect(() => {
    const config = window.SUPABASE_CONFIG;
    if (
      !config ||
      typeof config.url !== "string" ||
      typeof config.anonKey !== "string" ||
      !config.url.startsWith("https://") ||
      !config.anonKey ||
      config.url.includes("YOUR_SUPABASE") ||
      config.anonKey.includes("YOUR_SUPABASE")
    ) {
      setStatus("Komentar online belum dikonfigurasi.");
      return undefined;
    }
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      setStatus("Library Supabase gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.");
      return undefined;
    }

    const client = window.supabase.createClient(config.url, config.anonKey);
    clientRef.current = client;
    let active = true;

    loadLatest().then(() => {
      setEnabled(true);
    }).catch(error => {
      if (active) setStatus(`Gagal memuat komentar: ${error.message}`);
    });

    const channel = client
      .channel("public-comments-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, async ({ new: row }) => {
        let next = row;
        if (row.parent_id) {
          const { data, error } = await client
            .from("comments")
            .select("content")
            .eq("id", row.parent_id)
            .maybeSingle();
          if (error) setStatus(`Balasan masuk, tetapi komentar asal gagal dimuat: ${error.message}`);
          else next = { ...row, parentContent: data?.content };
        }
        setComments(current => {
          if (current.some(comment => comment.id === next.id)) return current;
          const updated = [next, ...current];
          return limit ? updated.slice(0, limit) : updated;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "comments" }, ({ old: row }) => {
        setComments(current => current.filter(comment => comment.id !== row.id));
      })
      .subscribe(state => {
        if (!active) return;
        if (state === "SUBSCRIBED") {
          setEnabled(true);
          setStatus("Terhubung · komentar anonim");
        }
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          setStatus("Realtime terputus · coba muat ulang halaman.");
        }
      });

    return () => {
      active = false;
      client.removeChannel(channel);
      clientRef.current = null;
    };
  }, [loadLatest]);

  const loadOlder = useCallback(async () => {
    const client = clientRef.current;
    const cursor = oldestId.current;
    if (!client || !cursor || loadingOlder || !hasOlder) return;
    setLoadingOlder(true);
    setStatus("Memuat komentar sebelumnya...");
    try {
      const { data, error } = await client
        .from("comments")
        .select("id, content, parent_id, created_at, author_name")
        .lt("id", cursor)
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);
      if (error) throw error;
      const rows = await addParentContent(client, data || []);
      setComments(current => {
        const existing = new Set(current.map(comment => comment.id));
        return [...current, ...rows.filter(comment => !existing.has(comment.id))];
      });
      oldestId.current = rows.length ? rows[rows.length - 1].id : null;
      setHasOlder(Boolean(data && data.length === PAGE_SIZE));
      setStatus("Terhubung · komentar anonim");
    } catch (error) {
      setStatus(`Gagal memuat komentar: ${error.message}`);
    } finally {
      setLoadingOlder(false);
    }
  }, [hasOlder, loadingOlder]);

  const insertComment = useCallback(async (content, parentId) => {
    await apiRequest("/api/comments", {
      method: "POST",
      body: { content, parent_id: parentId },
    });
  }, []);

  const insertAdminComment = useCallback(async (content, parentId) => {
    const payload = await apiRequest("/api/comments/admin", {
      method: "POST",
      body: { content, parent_id: parentId },
    });
    if (payload.ok !== true) throw new Error("Respons komentar admin tidak valid.");
  }, []);

  return {
    comments,
    status,
    enabled,
    hasOlder,
    loadingOlder,
    loadOlder,
    loadLatest,
    insertComment,
    insertAdminComment,
  };
}

export function RecentComments() {
  const feed = useCommentFeed({ limit: 3 });
  return (
    <div className="panel recent-comments-panel">
      <div className="panel-head">
        <h3>Komentar Terbaru</h3>
        <span className="filetag">{feed.status}</span>
        <a className="filetag" href="#/komentar">Lihat semua &amp; tulis komentar</a>
      </div>
      <div className="comments-list" aria-live="polite">
        {feed.comments.length ? feed.comments.map(comment => (
          <CommentCard key={comment.id} comment={comment} />
        )) : (
          <p className="comments-empty">
            {feed.status.startsWith("Gagal")
              ? "Komentar gagal dimuat. Periksa koneksi lalu muat ulang halaman."
              : feed.enabled
                ? "Belum ada komentar. Jadilah yang pertama berbagi pesan!"
                : "Memuat komentar..."}
          </p>
        )}
      </div>
    </div>
  );
}
