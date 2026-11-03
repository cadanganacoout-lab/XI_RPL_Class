import React, { useEffect, useMemo, useState } from "react";
import { MediaUploader } from "../components/MediaUploader.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { apiRequest } from "../lib/api.js";

const EMPTY_STUDENT = {
  nama: "",
  jabatan: "Siswa",
  hobi: "",
  catatan: "",
  foto: "",
  portfolio: "",
};
const EMPTY_TEACHER = {
  nama: "",
  mapel: "",
  role: "Guru Teori",
  foto: "",
  linktree: "",
};

function getFields(kind) {
  return kind === "students"
    ? [
        ["nama", "Nama siswa", "text"],
        ["jabatan", "Jabatan", "text"],
        ["hobi", "Hobi", "text"],
        ["catatan", "Catatan", "textarea"],
        ["foto", "Foto (path asset/ atau URL HTTPS)", "text"],
        ["portfolio", "URL portfolio (opsional)", "url"],
      ]
    : [
        ["nama", "Nama guru", "text"],
        ["mapel", "Mata pelajaran", "text"],
        ["role", "Role guru", "select"],
        ["foto", "Foto (path asset/ atau URL HTTPS)", "text"],
        ["linktree", "URL Linktree (opsional)", "url"],
      ];
}

export function AdminDataPage() {
  const { user } = useAuth();
  const [kind, setKind] = useState("students");
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_STUDENT);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const fields = getFields(kind);
  const isNew = editingId === "new";
  const canManageMedia = user?.role === "admin" && user?.username === "admin";
  const editingRecord = records.find(record => record.id === editingId);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");
    apiRequest(`/api/admin/${kind}`)
      .then(payload => {
        const items = payload[kind];
        if (!Array.isArray(items)) throw new Error("Respons data tidak valid.");
        if (active) {
          setRecords(items);
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
  }, [kind, revision]);

  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter(record =>
      `${record.nama} ${record.jabatan || record.mapel || ""}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [records, query]);

  function chooseKind(nextKind) {
    setKind(nextKind);
    setQuery("");
    setEditingId(null);
    setForm(nextKind === "students" ? EMPTY_STUDENT : EMPTY_TEACHER);
    setError("");
    setNotice("");
  }

  function startCreate() {
    setEditingId("new");
    setForm(kind === "students" ? EMPTY_STUDENT : EMPTY_TEACHER);
    setError("");
    setNotice("");
  }

  function startEdit(record) {
    setEditingId(record.id);
    setForm(
      kind === "students"
        ? {
            nama: record.nama,
            jabatan: record.jabatan,
            hobi: record.hobi,
            catatan: record.catatan,
            foto: record.foto,
            portfolio: record.portfolio || "",
          }
        : {
            nama: record.nama,
            mapel: record.mapel,
            role: record.role,
            foto: record.foto,
            linktree: record.linktree || "",
          },
    );
    setError("");
    setNotice("");
  }

  async function saveRecord(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [key, value.trim()]),
    );
    try {
      const base = `/api/admin/${kind}`;
      await apiRequest(
        isNew ? base : `${base}/${encodeURIComponent(editingId)}`,
        { method: isNew ? "POST" : "PATCH", body: payload },
      );
      setEditingId(null);
      setForm(kind === "students" ? EMPTY_STUDENT : EMPTY_TEACHER);
      setNotice(isNew ? "Data berhasil ditambahkan." : "Perubahan berhasil disimpan.");
      setRevision(value => value + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function setRecordActive(record, active) {
    setError("");
    setNotice("");
    try {
      await apiRequest(`/api/admin/${kind}/${encodeURIComponent(record.id)}`, {
        method: active ? "PATCH" : "DELETE",
        ...(active
          ? { body: kind === "students" ? { isPublished: true } : { isActive: true } }
          : {}),
      });
      setNotice(active ? "Data berhasil dipulihkan." : "Data diarsipkan dan tidak tampil di halaman publik.");
      setRevision(value => value + 1);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <section className="container page-hero">
        <span className="route-label">/admin/data</span>
        <h1>Kelola Data</h1>
        <p>Kelola informasi siswa dan guru yang ditampilkan di website kelas.</p>
      </section>
      <section className="container admin-data-page" aria-busy={status === "loading" || saving}>
        <div className="admin-data-tabs" role="group" aria-label="Jenis data">
          <button type="button" className="button-secondary" aria-pressed={kind === "students"} onClick={() => chooseKind("students")}>
            Data siswa
          </button>
          <button type="button" className="button-secondary" aria-pressed={kind === "teachers"} onClick={() => chooseKind("teachers")}>
            Data guru
          </button>
        </div>

        {notice && <p className="admin-data-notice" role="status">{notice}</p>}
        {error && <p className="admin-data-error" role="alert">{error}</p>}

        <div className="admin-data-layout">
          <section className="admin-data-list" aria-labelledby="admin-records-heading">
            <div className="admin-data-list-heading">
              <h2 id="admin-records-heading">{kind === "students" ? "Daftar siswa" : "Daftar guru"}</h2>
              <button type="button" className="button-primary" onClick={startCreate}>
                Tambah {kind === "students" ? "siswa" : "guru"}
              </button>
            </div>
            <label className="admin-data-search">
              Cari {kind === "students" ? "siswa" : "guru"}
              <input value={query} onChange={event => setQuery(event.target.value)} type="search" />
            </label>
            {status === "loading" && <p role="status">Memuat data…</p>}
            {status === "error" && (
              <button type="button" className="button-secondary" onClick={() => setRevision(value => value + 1)}>
                Coba muat ulang
              </button>
            )}
            {status === "ready" && (
              <ul className="admin-record-list">
                {filteredRecords.map(record => {
                  const active = kind === "students" ? record.isPublished : record.isActive;
                  return (
                    <li key={record.id} className={!active ? "is-archived" : ""}>
                      <div>
                        <strong>{record.nama}</strong>
                        <span>
                          {kind === "students"
                            ? record.jabatan
                            : `${record.mapel} · ${record.role}`}
                        </span>
                        <small>{active ? "Tampil publik" : "Diarsipkan"} · {record.id}</small>
                      </div>
                      <div className="admin-record-actions">
                        <button type="button" className="button-secondary" onClick={() => startEdit(record)}>
                          Edit
                        </button>
                        {active ? (
                          <button type="button" className="button-secondary" onClick={() => setRecordActive(record, false)}>
                            Arsipkan
                          </button>
                        ) : (
                          <button type="button" className="button-secondary" onClick={() => setRecordActive(record, true)}>
                            Pulihkan
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
                {filteredRecords.length === 0 && <li>Tidak ada data yang cocok.</li>}
              </ul>
            )}
          </section>

          {editingId && (
            <form className="admin-data-form" onSubmit={saveRecord}>
              <h2>{isNew ? `Tambah ${kind === "students" ? "siswa" : "guru"}` : "Edit data"}</h2>
              {canManageMedia && !isNew && (
                <p className="admin-data-status">Mode Admin — mengelola media milik record ini.</p>
              )}
              {fields.map(([name, label, type]) => (
                <label key={name}>
                  {label}
                  {type === "textarea" ? (
                    <textarea
                      name={name}
                      value={form[name]}
                      onChange={event => setForm(current => ({ ...current, [name]: event.target.value }))}
                      rows={3}
                      maxLength={500}
                    />
                  ) : type === "select" ? (
                    <select
                      name={name}
                      value={form[name]}
                      onChange={event => setForm(current => ({ ...current, [name]: event.target.value }))}
                      required
                    >
                      <option value="Guru Teori">Guru Teori</option>
                      <option value="Guru Praktek">Guru Praktek</option>
                    </select>
                  ) : (
                    <input
                      name={name}
                      type={type}
                      value={form[name]}
                      onChange={event => setForm(current => ({ ...current, [name]: event.target.value }))}
                      required={!["portfolio", "linktree"].includes(name)}
                    />
                  )}
                </label>
              ))}
              {canManageMedia && !isNew && (
                <>
                  <MediaUploader
                    targetType={kind}
                    targetId={editingId}
                    mediaType="avatar"
                    currentUrl={editingRecord?.avatar?.url || editingRecord?.foto || ""}
                    removable={Boolean(editingRecord?.avatar)}
                    onChanged={media => setRecords(current => current.map(record =>
                      record.id === editingId ? { ...record, avatar: media } : record
                    ))}
                  />
                  <MediaUploader
                    targetType={kind}
                    targetId={editingId}
                    mediaType="background"
                    currentUrl={editingRecord?.background?.url || ""}
                    removable={Boolean(editingRecord?.background)}
                    onChanged={media => setRecords(current => current.map(record =>
                      record.id === editingId ? { ...record, background: media } : record
                    ))}
                  />
                </>
              )}
              {canManageMedia && isNew && (
                <p className="admin-data-status">
                  Simpan data terlebih dahulu, lalu pilih Edit untuk menambahkan foto.
                </p>
              )}
              <div className="admin-data-form-actions">
                <button className="button-primary" type="submit" disabled={saving}>
                  {saving ? "Menyimpan…" : "Simpan"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={saving}
                  onClick={() => setEditingId(null)}
                >
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
