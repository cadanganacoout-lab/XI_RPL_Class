import React, { useCallback, useEffect, useRef, useState } from "react";

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
  return (
    <article className={`comment-card${comment.parent_id ? " comment-reply" : ""}`} data-comment-id={comment.id}>
      <div className="comment-card-head">
        <strong>Anonim</strong>
        <div className="comment-actions">
          {onReply && (
            <button
              className="comment-reply-button"
              type="button"
              onClick={() => onReply(comment)}
            >
              Balas
            </button>
          )}
          <time dateTime={comment.created_at}>{formatCommentTime(comment.created_at)}</time>
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
      .select("id, content, parent_id, created_at")
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
        .select("id, content, parent_id, created_at")
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
    const client = clientRef.current;
    if (!client) throw new Error("Komentar online belum siap. Periksa koneksi dan konfigurasi Supabase.");
    const comment = { content };
    if (parentId !== null) comment.parent_id = parentId;
    const { error } = await client.from("comments").insert(comment);
    if (error) throw error;
  }, []);

  return { comments, status, enabled, hasOlder, loadingOlder, loadOlder, loadLatest, insertComment };
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
