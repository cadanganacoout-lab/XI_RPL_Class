import React, { useEffect, useRef, useState } from "react";
import { StudentCard } from "../components/StudentCard.jsx";
import { apiRequest } from "../lib/api.js";

const fieldLimits = {
  hobi: 300,
  catatan: 500,
  portfolio: 2048,
};

function editableValues(card) {
  return {
    hobi: card.hobi || "",
    catatan: card.catatan || "",
    portfolio: card.portfolio || "",
  };
}

function hasChanges(original, draft) {
  return Boolean(
    original &&
    draft &&
    Object.keys(fieldLimits).some(field => {
      const currentValue = draft[field].trim();
      const originalValue = (original[field] || "").trim();
      return currentValue !== originalValue;
    }),
  );
}

function CardEditorLoading() {
  return (
    <div className="card-editor-loading" aria-busy="true">
      <span className="student-skeleton student-skeleton--name" />
      <span className="student-skeleton" />
      <span className="student-skeleton" />
      <span className="student-skeleton student-skeleton--button" />
      <span className="visually-hidden" role="status">Memuat card milik Anda…</span>
    </div>
  );
}

export function CardEditorPage() {
  const [card, setCard] = useState(null);
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const previousHash = useRef(window.location.hash);
  const restoringHash = useRef(false);
  const allowedHash = useRef(null);
  const dirty = hasChanges(card, draft);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");

    apiRequest("/api/cards/me")
      .then(payload => {
        if (!payload.card || typeof payload.card !== "object") {
          throw new Error("Respons card tidak valid.");
        }
        if (active) {
          setCard(payload.card);
          setDraft(editableValues(payload.card));
          setStatus("ready");
        }
      })
      .catch(requestError => {
        if (active) {
          setError(requestError.message);
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeUnload = event => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmHashNavigation = () => {
      if (restoringHash.current) {
        restoringHash.current = false;
        return;
      }
      const nextHash = window.location.hash;
      if (allowedHash.current === nextHash) {
        allowedHash.current = null;
        previousHash.current = nextHash;
        return;
      }
      if (window.confirm("Perubahan belum disimpan. Tetap tinggalkan halaman?")) {
        previousHash.current = nextHash;
      } else {
        restoringHash.current = true;
        window.location.hash = previousHash.current;
      }
    };
    const confirmAnchorNavigation = event => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest('a[href^="#/"]');
      if (!link || link.hash === window.location.hash) return;
      if (!window.confirm("Perubahan belum disimpan. Tetap tinggalkan halaman?")) {
        event.preventDefault();
        return;
      }
      previousHash.current = link.hash;
      allowedHash.current = link.hash;
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("hashchange", confirmHashNavigation, true);
    document.addEventListener("click", confirmAnchorNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("hashchange", confirmHashNavigation, true);
      document.removeEventListener("click", confirmAnchorNavigation, true);
    };
  }, [dirty]);

  useEffect(() => {
    if (!dirty) previousHash.current = window.location.hash;
  }, [dirty]);

  async function save(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const payload = await apiRequest("/api/cards/me", {
        method: "PATCH",
        body: {
          hobi: draft.hobi,
          catatan: draft.catatan,
          portfolio: draft.portfolio.trim(),
        },
      });
      setCard(payload.card);
      setDraft(editableValues(payload.card));
      setNotice("Perubahan card berhasil disimpan.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function updateField(field, value) {
    setDraft(current => ({ ...current, [field]: value }));
    setNotice("");
  }

  return (
    <>
      <section className="container page-hero">
        <span className="route-label">/card-saya</span>
        <h1>Edit card saya</h1>
        <p>Perbarui informasi card yang ditautkan ke akun Anda.</p>
      </section>
      <section className="container card-editor-page">
        {status === "loading" && <CardEditorLoading />}
        {status === "error" && (
          <div className="student-list-message" role="alert">
            <p>{error}</p>
            <button type="button" className="button-secondary" onClick={() => setRetry(value => value + 1)}>
              Coba muat ulang
            </button>
          </div>
        )}
        {status === "ready" && card && draft && (
          <div className="card-editor-layout">
            <form className="card-editor-form" onSubmit={save} aria-busy={saving}>
              <div className="card-editor-identity">
                <h2>{card.nama}</h2>
                <p>{card.jabatan} · Informasi identitas hanya dapat diubah admin.</p>
              </div>

              <div className="auth-field">
                <label htmlFor="card-hobi">Hobi</label>
                <textarea
                  id="card-hobi"
                  name="hobi"
                  rows={3}
                  maxLength={fieldLimits.hobi}
                  value={draft.hobi}
                  aria-describedby="card-hobi-count"
                  onChange={event => updateField("hobi", event.target.value)}
                />
                <small id="card-hobi-count">{draft.hobi.length}/{fieldLimits.hobi} karakter</small>
              </div>

              <div className="auth-field">
                <label htmlFor="card-catatan">Catatan</label>
                <textarea
                  id="card-catatan"
                  name="catatan"
                  rows={4}
                  maxLength={fieldLimits.catatan}
                  value={draft.catatan}
                  aria-describedby="card-catatan-count"
                  onChange={event => updateField("catatan", event.target.value)}
                />
                <small id="card-catatan-count">{draft.catatan.length}/{fieldLimits.catatan} karakter</small>
              </div>

              <div className="auth-field">
                <label htmlFor="card-portfolio">Portfolio (opsional)</label>
                <input
                  id="card-portfolio"
                  name="portfolio"
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  pattern="https://.+"
                  maxLength={fieldLimits.portfolio}
                  value={draft.portfolio}
                  aria-describedby="card-portfolio-help card-portfolio-count"
                  onChange={event => updateField("portfolio", event.target.value)}
                />
                <small id="card-portfolio-help">Gunakan URL HTTPS. Kosongkan untuk menghapus tautan.</small>
                <small id="card-portfolio-count">{draft.portfolio.length}/{fieldLimits.portfolio} karakter</small>
              </div>

              {error && (
                <p className="auth-error" role="alert" aria-live="assertive">
                  {error}
                </p>
              )}
              {notice && <p className="card-editor-notice" role="status">{notice}</p>}

              <div className="card-editor-actions">
                <button className="auth-submit" type="submit" disabled={!dirty || saving}>
                  {saving ? "Menyimpan…" : "Simpan perubahan"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  disabled
                  aria-describedby="background-deferred-help"
                >
                  Ganti Background
                </button>
              </div>
              <small id="background-deferred-help" className="card-editor-deferred">
                Fitur background card belum termasuk tahap ini.
              </small>
              {dirty && <p className="card-editor-unsaved" role="status">Ada perubahan yang belum disimpan.</p>}
            </form>

            <aside className="card-editor-preview" aria-labelledby="card-preview-heading">
              <h2 id="card-preview-heading">Pratinjau</h2>
              <StudentCard student={{ ...card, ...draft }} />
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
