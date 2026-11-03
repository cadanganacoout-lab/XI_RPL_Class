import React, { useEffect, useId, useRef, useState } from "react";
import { apiRequest } from "../lib/api.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function mediaEndpoints(targetType, targetId, mediaType) {
  if (targetType === "gallery") {
    return {
      intent: "/api/admin/gallery/upload-url",
      finalize: "/api/admin/gallery/finalize",
    };
  }
  const base = `/api/media/${targetType}/${encodeURIComponent(targetId)}/${mediaType}`;
  return {
    intent: `${base}/upload-url`,
    finalize: `${base}/finalize`,
    remove: base,
  };
}

export function MediaUploader({
  targetType,
  targetId,
  mediaType,
  currentUrl = "",
  removable = false,
  onChanged,
}) {
  const inputId = useId();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isGallery = targetType === "gallery";
  const title = isGallery
    ? "Tambah foto galeri"
    : mediaType === "avatar"
      ? "Foto profil"
      : "Background card";
  const captionInvalid = isGallery && error === "Deskripsi foto wajib diisi.";
  const fileInvalid = [
    "File gambar kosong.",
    "Gunakan file JPEG, PNG, atau WebP.",
    "Ukuran file maksimal 5 MB.",
  ].includes(error);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(event) {
    const selected = event.target.files?.[0] || null;
    event.target.value = "";
    setError("");
    setNotice("");
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setFile(null);
      setError("Gunakan file JPEG, PNG, atau WebP.");
      return;
    }
    if (selected.size === 0) {
      setFile(null);
      setError("File gambar kosong.");
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFile(null);
      setError("Ukuran file maksimal 5 MB.");
      return;
    }
    setFile(selected);
  }

  async function upload(event) {
    event.preventDefault();
    if (!file || busy) return;
    setError("");
    setNotice("");
    if (isGallery && !caption.trim()) {
      setError("Deskripsi foto wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      const endpoints = mediaEndpoints(targetType, targetId, mediaType);
      const intent = await apiRequest(endpoints.intent, {
        method: "POST",
        body: {
          contentType: file.type,
          sourceSize: file.size,
          ...(isGallery ? { caption: caption.trim() } : {}),
        },
      });
      const storageConfig = window.SUPABASE_CONFIG;
      if (!storageConfig?.url || !storageConfig?.anonKey || !intent.uploadUrl) {
        throw new Error("Konfigurasi upload foto belum tersedia.");
      }
      const uploadUrl = new URL(intent.uploadUrl);
      if (uploadUrl.origin !== new URL(storageConfig.url).origin) {
        throw new Error("Tujuan upload foto tidak valid.");
      }
      const storageResponse = await fetch(uploadUrl, {
        method: "PUT",
        credentials: "omit",
        headers: {
          apikey: storageConfig.anonKey,
          "Content-Type": file.type,
        },
        body: file,
      });
      if (!storageResponse.ok) {
        throw new Error(`Storage menolak upload foto (HTTP ${storageResponse.status}).`);
      }
      const result = await apiRequest(endpoints.finalize, {
        method: "POST",
        body: { uploadId: intent.uploadId },
      });
      onChanged?.(isGallery ? result.photo : result.media);
      setFile(null);
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice(
        result.cleanupPending
          ? "Foto tersimpan. Pembersihan file lama masih tertunda."
          : "Foto berhasil disimpan.",
      );
    } catch (requestError) {
      setError(requestError.message || "Foto gagal diunggah. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removable || busy || !window.confirm("Hapus foto ini?")) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const endpoint = mediaEndpoints(targetType, targetId, mediaType).remove;
      const result = await apiRequest(endpoint, { method: "DELETE" });
      onChanged?.(null);
      setNotice(
        result.cleanupPending
          ? "Foto dihapus dari tampilan. Penghapusan file masih tertunda."
          : "Foto berhasil dihapus.",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="media-uploader" aria-busy={busy}>
      <legend>{title}</legend>
      {currentUrl && (
        <div className={`media-uploader-preview${mediaType === "background" ? " media-uploader-preview--background" : ""}`}>
          <img src={currentUrl} alt="" />
          <span>Foto saat ini</span>
        </div>
      )}
      {previewUrl && (
        <div className={`media-uploader-preview${mediaType === "background" ? " media-uploader-preview--background" : ""}`}>
          <img src={previewUrl} alt="" />
          <span>Pratinjau gambar baru</span>
        </div>
      )}
      {isGallery && (
        <label className="media-uploader-caption" htmlFor={`${inputId}-caption`}>
          Deskripsi foto
          <input
            id={`${inputId}-caption`}
            type="text"
            maxLength={500}
            required
            value={caption}
            aria-invalid={captionInvalid}
            aria-describedby={`${inputId}-caption-help${captionInvalid ? ` ${inputId}-error` : ""}`}
            onChange={event => setCaption(event.target.value)}
            disabled={busy}
          />
          <small id={`${inputId}-caption-help`}>Maksimal 500 karakter.</small>
        </label>
      )}
      <label className="media-uploader-label" htmlFor={inputId}>
        Pilih gambar baru
      </label>
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        aria-invalid={fileInvalid}
        aria-describedby={`${inputId}-help${fileInvalid ? ` ${inputId}-error` : ""}`}
        onChange={chooseFile}
        disabled={busy}
      />
      <small id={`${inputId}-help`}>
        JPEG, PNG, atau WebP. Maksimal 5 MB; foto disimpan sebagai WebP. Gunakan foto yang pantas untuk publik.
      </small>
      {file && <span className="media-uploader-filename">{file.name}</span>}
      {error && (
        <p
          id={captionInvalid || fileInvalid ? `${inputId}-error` : undefined}
          className="media-uploader-error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      )}
      {notice && <p className="media-uploader-notice" role="status">{notice}</p>}
      <div className="media-uploader-actions">
        <button
          className="button-primary"
          type="button"
          disabled={!file || busy}
          onClick={upload}
        >
          {busy ? "Memproses…" : isGallery ? "Tambah ke galeri" : "Simpan foto"}
        </button>
        {removable && (
          <button
            className="button-secondary"
            type="button"
            disabled={busy}
            onClick={remove}
          >
            Hapus foto
          </button>
        )}
      </div>
    </fieldset>
  );
}
