// =====================================================================
// app.js — logika bersama untuk semua halaman.
// Data diambil dari data.js (SITE, SISWA, GURU, JADWAL, PIKET, GALERI, VIDEO).
// =====================================================================

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initNav();
  initFooter();
  initModal();
  validateData();

  const page = document.body.dataset.page;
  if (page === "beranda") initBeranda();
  if (page === "siswa") initSiswa();
  if (page === "guru") initGuru();
  if (page === "galeri") initGaleri();
  if (page === "video") initVideo();
  if (page === "komentar") initKomentar();
  initCommentPreview();
});

/* --------------------------------------------------------------------
   TEMA TERANG / GELAP
   Preferensi dibaca lebih dulu oleh inline script kecil di <head>
   (supaya tidak "kedip" saat halaman dimuat), lalu tombol ini tinggal
   melanjutkan: toggle atribut data-theme + simpan pilihan.
   -------------------------------------------------------------------- */
const THEME_KEY = "xirpl1-theme";

function safeStorage() {
  try {
    const testKey = "__xirpl1_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (e) {
    return null; // localStorage tidak tersedia (mis. preview sandbox) → lanjut tanpa menyimpan
  }
}

function initThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  const storage = safeStorage();

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      theme === "dark" ? "Ganti ke tema terang" : "Ganti ke tema gelap",
    );
  }

  applyTheme(currentTheme()); // sinkronkan label tombol dengan tema yang sudah di-set inline script

  btn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    if (storage) storage.setItem(THEME_KEY, next);
  });
}

/* --------------------------------------------------------------------
   NAVBAR — highlight tab aktif + toggle menu mobile
   -------------------------------------------------------------------- */
function initNav() {
  const page = document.body.dataset.page;
  document.querySelectorAll(".tab").forEach((tab) => {
    if (tab.dataset.page === page) tab.classList.add("active");
  });

  const toggle = document.getElementById("menuToggle");
  const tabbar = document.getElementById("tabbar");
  if (toggle && tabbar) {
    toggle.addEventListener("click", () => {
      const isOpen = tabbar.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    tabbar.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => tabbar.classList.remove("open"));
    });
  }
}

/* --------------------------------------------------------------------
   FOOTER — isi status bar dari data SITE
   -------------------------------------------------------------------- */
function initFooter() {
  const $ = (id) => document.getElementById(id);
  if ($("statusSchool")) $("statusSchool").textContent = SITE.className;
  if ($("statusSiswa")) $("statusSiswa").textContent = SITE.totalStudents;
  if ($("statusGuru")) $("statusGuru").textContent = SITE.totalTeachers;
  if ($("statusYear"))
    $("statusYear").textContent =
      `© ${new Date().getFullYear()} ${SITE.className}`;
  if ($("footerWali"))
    $("footerWali").textContent = `Wali kelas: ${SITE.waliKelas}`;
  if ($("footerJurusan"))
    $("footerJurusan").textContent = `Jurusan: ${SITE.majorName}`;
}

/* --------------------------------------------------------------------
   Util: avatar placeholder via ui-avatars.com (inisial otomatis)
   -------------------------------------------------------------------- */
function avatarUrl(nama, bg, color) {
  const name = nama ? String(nama).trim() : "";
  const b = bg || "3355D8";
  const c = color || "fff";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${b}&color=${c}&size=256&font-size=0.36&bold=true`;
}
function initials(nama) {
  if (!nama) return "";
  return String(nama)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w && w[0] ? w[0] : ""))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* --------------------------------------------------------------------
   Util: render tag <img> dengan fallback otomatis kalau src gagal dimuat
   (404 / file belum ada) — tampilan tidak akan pernah rusak/kosong.
   -------------------------------------------------------------------- */
function imgTag(src, fallback, alt) {
  const safeSrc = src || fallback || "";
  const safeAlt = alt || "";
  // create element to avoid attribute-escaping issues and inline JS injection
  const img = document.createElement("img");
  img.src = safeSrc;
  img.alt = String(safeAlt);
  img.loading = "lazy";
  img.onerror = function () {
    this.onerror = null;
    this.src = fallback || "";
  };
  return img.outerHTML;
}

/* --------------------------------------------------------------------
   Util: render tag <img> foto siswa/guru.
   Kalau field "foto" ada di data.js, itu yang dicoba dimuat duluan.
   Kalau file-nya belum ada / gagal dimuat (404), otomatis "jatuh"
   ke avatar inisial supaya tampilan tidak pernah rusak/kosong.
   -------------------------------------------------------------------- */
function photoTag(person, bg) {
  const name = person && person.nama ? person.nama : "";
  const fallback = avatarUrl(name, bg);
  const src =
    person && person.foto && !person.foto.endsWith("/sementara.png")
      ? person.foto
      : fallback;
  return imgTag(src, fallback, `Foto ${name}`);
}

function validateData() {
  const checks = [
    ["siswa", SISWA, SITE.totalStudents],
    ["guru", GURU, SITE.totalTeachers],
    ["galeri", GALERI, 40],
    ["video", VIDEO, 19],
  ];
  checks.forEach(([label, items, expected]) => {
    if (items.length !== expected) {
      console.warn(
        `[data] Jumlah ${label} (${items.length}) tidak sesuai target (${expected}).`,
      );
    }
    const ids = items.map((item) => item.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      console.error(`[data] ID ${label} harus unik.`);
    }
  });
  VIDEO.forEach((video) => {
    if (!/^[\w-]{11}$/.test(video.youtubeId)) {
      console.error(`[data] YouTube ID tidak valid untuk ${video.id}.`);
    }
  });
}

/* --------------------------------------------------------------------
   MODAL global (dipakai halaman galeri & motto)
   -------------------------------------------------------------------- */
function initModal() {
  const backdrop = document.getElementById("globalModal");
  if (!backdrop) return;
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}
function openModal(html) {
  const backdrop = document.getElementById("globalModal");
  const box = document.getElementById("globalModalBox");
  box.innerHTML = html;
  backdrop.classList.add("open");
  const closeBtn = box.querySelector(".modal-close");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
}
function closeModal() {
  const backdrop = document.getElementById("globalModal");
  if (backdrop) backdrop.classList.remove("open");
}

/* =====================================================================
   BERANDA
   ===================================================================== */
function getISOWeek(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getGuruName(parity, hari, mapel, mulai, selesai) {
  const jadwalGuru = GURU_JADWAL[parity] && GURU_JADWAL[parity][hari];
  if (jadwalGuru) {
    if (typeof jadwalGuru === "string") return jadwalGuru;
    return timeToMinutes(mulai) < timeToMinutes(jadwalGuru.mulai)
      ? jadwalGuru.sebelum
      : jadwalGuru.sesudah;
  }

  const aliases = {
    "Pendidikan Agama Budi Pekerti": "Pendidikan Agama",
    "Pendidikan Jasmani Olahraga Kesehatan": "PJOK",
    "Kreativitas Inovasi & Kewirausahaan": "Kewirausahaan",
  };
  const guruObj = GURU.find((g) => g.mapel === (aliases[mapel] || mapel));
  return guruObj ? guruObj.nama : "—";
}

function initBeranda() {
  const now = new Date();
  const hariIni = HARI_LIST[now.getDay()];
  const isoWeek = getISOWeek(now);
  const parity = isoWeek % 2 === 1 ? "genap" : "ganjil";

  // stat angka
  document.getElementById("statSiswaHero").textContent = SITE.totalStudents;
  document.getElementById("statGuruHero").textContent = SITE.totalTeachers;

  // terminal "typed" info
  const tglFormat = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const term = document.getElementById("terminalBody");
  if (term) {
    term.innerHTML =
      `<div><span class="prompt">$</span> whoami</div>` +
      `<div class="out">${SITE.className} — ${SITE.majorName}</div>` +
      `<div style="margin-top:8px"><span class="prompt">$</span> date</div>` +
      `<div class="out">${tglFormat}</div>` +
      `<div style="margin-top:8px"><span class="prompt">$</span> status --minggu</div>` +
      `<div class="out">minggu ke-${isoWeek} (${parity})</div>` +
      `<div style="margin-top:8px"><span class="prompt">$</span> echo "Semangat belajar hari ini!"<span class="terminal-cursor"></span></div>`;
  }

  // marquee motivasi (digandakan agar loop mulus)
  const track = document.getElementById("marqueeTrack");
  if (track) {
    const items = [...MOTIVASI, ...MOTIVASI]
      .map((m) => `<span>${m}</span>`)
      .join("");
    track.innerHTML = items;
  }

  // badge hari ini
  const badge = document.getElementById("todayBadge");
  const isSekolah = HARI_AKTIF.includes(hariIni);
  if (badge) {
    badge.innerHTML = `<span class="dot"></span>${hariIni} · minggu ${parity}`;
  }

  // jadwal hari ini
  const jadwalList = document.getElementById("jadwalList");
  if (jadwalList) {
    if (!isSekolah) {
      jadwalList.innerHTML = `<div class="empty-note">Hari ini ${hariIni}, tidak ada jadwal pelajaran. Selamat beristirahat! 🎉</div>`;
    } else {
      const rows = JADWAL[parity][hariIni] || [];
      jadwalList.innerHTML = rows
        .map((r) => {
          if (typeof r === "string") {
            return `<div class="empty-note">${r}</div>`;
          }
          if (r.istirahat) {
            return `<div class="sched-row break">${r.label} · ${r.mulai}–${r.selesai}</div>`;
          }
          const guruNama = getGuruName(
            parity,
            hariIni,
            r.mapel,
            r.mulai,
            r.selesai,
          );
          return `<div class="sched-row">
                   <span class="time">${r.mulai}–${r.selesai}</span>
                   <span>
                     <span class="mapel">${r.mapel}</span><br>
                     <span class="guru">${guruNama}</span>
                   </span>
                   <span class="filetag">#${r.jamKe}</span>
                 </div>`;
        })
        .join("");
    }
  }

  // piket hari ini
  const piketList = document.getElementById("piketList");
  if (piketList) {
    if (!isSekolah || !PIKET[hariIni]) {
      piketList.innerHTML = `<div class="empty-note">Tidak ada jadwal piket hari ini.</div>`;
    } else {
      piketList.innerHTML = PIKET[hariIni]
        .map(
          (nama, i) =>
            `<div class="piket-chip"><span class="idx">${i + 1}</span>${nama}</div>`,
        )
        .join("");
    }
  }

  // jadwal besok
  const besok = new Date(now);
  besok.setDate(besok.getDate() + 1);
  const hariBesok = HARI_LIST[besok.getDay()];
  const isoWeekBesok = getISOWeek(besok);
  const parityBesok = isoWeekBesok % 2 === 1 ? "genap" : "ganjil";
  const isSekolahBesok = HARI_AKTIF.includes(hariBesok);

  const tomorrowBadge = document.getElementById("tomorrowBadge");
  if (tomorrowBadge) {
    tomorrowBadge.innerHTML = `<span class="dot"></span>${hariBesok} · minggu ${parityBesok}`;
  }

  const tomorrowJadwalList = document.getElementById("tomorrowJadwalList");
  if (tomorrowJadwalList) {
    if (!isSekolahBesok) {
      tomorrowJadwalList.innerHTML = `<div class="empty-note">Besok ${hariBesok}, tidak ada jadwal pelajaran. Selamat beristirahat! 🎉</div>`;
    } else {
      const rowsBesok = JADWAL[parityBesok][hariBesok] || [];
      tomorrowJadwalList.innerHTML = rowsBesok
        .map((r) => {
          if (typeof r === "string") {
            return `<div class="empty-note">${r}</div>`;
          }
          if (r.istirahat) {
            return `<div class="sched-row break">${r.label} · ${r.mulai}–${r.selesai}</div>`;
          }
          const guruNama = getGuruName(
            parityBesok,
            hariBesok,
            r.mapel,
            r.mulai,
            r.selesai,
          );
          return `<div class="sched-row">
                   <span class="time">${r.mulai}–${r.selesai}</span>
                   <span>
                     <span class="mapel">${r.mapel}</span><br>
                     <span class="guru">${guruNama}</span>
                   </span>
                   <span class="filetag">#${r.jamKe}</span>
                 </div>`;
        })
        .join("");
    }
  }

  const tomorrowPiketList = document.getElementById("tomorrowPiketList");
  if (tomorrowPiketList) {
    if (!isSekolahBesok || !PIKET[hariBesok]) {
      tomorrowPiketList.innerHTML = `<div class="empty-note">Tidak ada jadwal piket besok.</div>`;
    } else {
      tomorrowPiketList.innerHTML = PIKET[hariBesok]
        .map(
          (nama, i) =>
            `<div class="piket-chip"><span class="idx">${i + 1}</span>${nama}</div>`,
        )
        .join("");
    }
  }
}

/* =====================================================================
   DAFTAR SISWA
   ===================================================================== */
function initSiswa() {
  const grid = document.getElementById("siswaGrid");
  const search = document.getElementById("siswaSearch");
  const count = document.getElementById("siswaCount");

  function render(list) {
    grid.innerHTML = list
      .map(
        (s) => `
      <div class="panel people-card">
        <div class="people-photo">${photoTag(s, "3355D8")}</div>
        <div class="people-body">
          <span class="role-tag">${s.jabatan}</span>
          <div class="people-name">${s.nama}</div>
          <div class="people-meta">
            <div class="row"><b>Hobi</b><span>${s.hobi}</span></div>
            <div class="row"><b>Catatan</b><span>${s.catatan}</span></div>
          </div>
          ${
            /^https?:\/\/[^\s"'<>]+$/i.test((s.portfolio || "").trim())
              ? `<a class="portfolio-link" href="${s.portfolio.trim()}" target="_blank" rel="noopener noreferrer">Lihat Portofolio ↗</a>`
              : '<span class="portfolio-link portfolio-link--disabled" aria-disabled="true">Portofolio belum tersedia</span>'
          }
        </div>
      </div>
    `,
      )
      .join("");
    count.textContent = `${list.length} siswa`;
  }

  render(SISWA);

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    const filtered = SISWA.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) || s.jabatan.toLowerCase().includes(q),
    );
    render(filtered);
  });
}

/* =====================================================================
   DAFTAR GURU
   ===================================================================== */
function initGuru() {
  const grid = document.getElementById("guruGrid");
  const search = document.getElementById("guruSearch");
  const count = document.getElementById("guruCount");

  function render(list) {
    grid.innerHTML = list
      .map(
        (g) => `
      <div class="panel people-card">
        <div class="people-photo">${photoTag(g, "1E8E5A")}</div>
        <div class="people-body">
          <span class="role-tag">Pengajar</span>
          <div class="people-name">${g.nama}</div>
          <div class="people-meta">
            <div class="row"><b>Mapel</b><span>${g.mapel}</span></div>
          </div>
        </div>
      </div>
    `,
      )
      .join("");
    count.textContent = `${list.length} guru`;
  }

  render(GURU);

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    const filtered = GURU.filter(
      (g) =>
        g.nama.toLowerCase().includes(q) || g.mapel.toLowerCase().includes(q),
    );
    render(filtered);
  });
}

/* =====================================================================
   GALERI
   ===================================================================== */
function initGaleri() {
  const grid = document.getElementById("galeriGrid");
  grid.innerHTML = GALERI.map((p, i) => {
    const fallback = `https://picsum.photos/seed/${p.seed}/500/420`;
    return `
    <div class="gallery-item" data-idx="${i}">
      ${imgTag(p.foto || fallback, fallback, p.caption)}
      <div class="cap">${p.caption}</div>
    </div>
  `;
  }).join("");

  grid.querySelectorAll(".gallery-item").forEach((item) => {
    item.addEventListener("click", () => {
      const p = GALERI[+item.dataset.idx];
      const fallbackBig = `https://picsum.photos/seed/${p.seed}/900/700`;
      openModal(`
        <div class="gallery-modal">
          <div class="modal-head"><span>${p.id}.jpg</span><button class="modal-close" aria-label="Tutup">✕</button></div>
          ${imgTag(p.foto || fallbackBig, fallbackBig, p.caption)}
          <div class="cap-line">${p.caption}</div>
        </div>
      `);
    });
  });
}

/* =====================================================================
   VIDEO
   ===================================================================== */
function initVideo() {
  const grid = document.getElementById("videoGrid");
  if (!grid) return;
  const classLabel =
    SITE && SITE.className ? String(SITE.className).split(" ")[0] : "";
  grid.innerHTML = VIDEO.map(
    (v) => `
    <div class="panel video-card">
      <div class="video-frame">
        <iframe src="https://www.youtube.com/embed/${v.youtubeId}" title="${v.judul}" loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
      <div class="video-info">
        <div class="video-avatar">${classLabel}</div>
        <div>
          <div class="video-title">${v.judul}</div>
          <div class="video-meta">Kelas XI RPL 1 · ${v.deskripsi}</div>
        </div>
      </div>
    </div>
  `,
  ).join("");
}

/* =====================================================================
   KOMENTAR — anonim, tersimpan di Supabase dan disiarkan lewat Realtime
   ===================================================================== */
const MAX_COMMENT_LENGTH = 500;
const COMMENTS_PAGE_SIZE = 50;

function createCommentsClient() {
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
    return null;
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Library Supabase gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.");
  }
  return window.supabase.createClient(config.url, config.anonKey);
}

function makeCommentCard(comment) {
  const card = document.createElement("article");
  card.className = "comment-card";
  card.dataset.commentId = comment.id;

  const header = document.createElement("div");
  header.className = "comment-card-head";
  const author = document.createElement("strong");
  author.textContent = "Anonim";
  const time = document.createElement("time");
  const createdAt = new Date(comment.created_at);
  time.dateTime = comment.created_at;
  time.textContent = Number.isNaN(createdAt.getTime())
    ? "Waktu tidak diketahui"
    : createdAt.toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      });

  const text = document.createElement("p");
  text.className = "comment-text";
  text.textContent = comment.content;
  header.append(author, time);
  card.append(header, text);
  return card;
}

function renderComments(container, comments) {
  if (!container) return;
  container.replaceChildren(...comments.map(makeCommentCard));
  if (!comments.length) {
    const empty = document.createElement("p");
    empty.className = "comments-empty";
    empty.textContent = "Belum ada komentar. Jadilah yang pertama berbagi pesan!";
    container.append(empty);
  }
}

function showCommentError(container, message) {
  container.replaceChildren();
  const error = document.createElement("p");
  error.className = "comments-empty";
  error.textContent = message;
  container.append(error);
}

function addCommentToList(container, comment, limit) {
  if (
    !container ||
    Array.from(container.querySelectorAll(".comment-card")).some(
      (card) => card.dataset.commentId === String(comment.id),
    )
  ) return;
  const empty = container.querySelector(".comments-empty");
  if (empty) empty.remove();
  const card = makeCommentCard(comment);
  card.dataset.commentId = comment.id;
  container.prepend(card);
  if (limit) {
    while (container.querySelectorAll(".comment-card").length > limit) {
      container.lastElementChild.remove();
    }
  }
}

function connectCommentFeed({ list, status, limit, showOlder }) {
  let client;
  try {
    client = createCommentsClient();
  } catch (error) {
    status.textContent = `Gagal menghubungkan Supabase: ${error.message}`;
    showCommentError(list, "Layanan komentar tidak dapat dimuat. Muat ulang halaman atau hubungi pengelola.");
    if (showOlder) showOlder.hidden = true;
    return null;
  }
  if (!client) {
    status.textContent = "Komentar online belum dikonfigurasi.";
    if (showOlder) showOlder.hidden = true;
    showCommentError(
      list,
      "Hubungkan URL dan anon key Supabase di js/supabase-config.js untuk mengaktifkan ruang diskusi bersama.",
    );
    return null;
  }

  const pageSize = limit || COMMENTS_PAGE_SIZE;
  let oldestLoaded = null;
  let loadingOlder = false;

  async function loadLatest() {
    status.textContent = "Menghubungkan ke ruang diskusi...";
    const { data, error } = await client
      .from("comments")
      .select("id, content, created_at")
      .order("id", { ascending: false })
      .limit(pageSize);
    if (error) throw error;
    renderComments(list, data || []);
    oldestLoaded = data && data.length ? data[data.length - 1] : null;
    if (showOlder) showOlder.hidden = !data || data.length < pageSize;
    status.textContent = "Terhubung · komentar anonim";
  }

  async function loadOlder() {
    if (!oldestLoaded || loadingOlder) return;
    loadingOlder = true;
    showOlder.disabled = true;
    status.textContent = "Memuat komentar sebelumnya...";
    try {
      const { data, error } = await client
        .from("comments")
        .select("id, content, created_at")
        .lt("id", oldestLoaded.id)
        .order("id", { ascending: false })
        .limit(pageSize);
      if (error) throw error;
      (data || []).forEach((comment) => list.append(makeCommentCard(comment)));
      oldestLoaded = data && data.length ? data[data.length - 1] : null;
      if (showOlder) showOlder.hidden = !data || data.length < pageSize;
      status.textContent = "Terhubung · komentar anonim";
    } catch (error) {
      status.textContent = `Gagal memuat komentar: ${error.message}`;
    } finally {
      loadingOlder = false;
      showOlder.disabled = false;
    }
  }

  if (showOlder) showOlder.addEventListener("click", loadOlder);
  loadLatest().catch((error) => {
    status.textContent = `Gagal memuat komentar: ${error.message}`;
    showCommentError(list, "Komentar gagal dimuat. Periksa koneksi lalu muat ulang halaman.");
  });

  const channel = client
    .channel("public-comments-feed")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "comments" },
      ({ new: comment }) => addCommentToList(list, comment, limit),
    )
    .subscribe((state) => {
      if (state === "SUBSCRIBED") status.textContent = "Terhubung · komentar anonim";
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        status.textContent = "Realtime terputus · coba muat ulang halaman.";
      }
    });
  return { client, channel, loadLatest };
}

function initCommentPreview() {
  const list = document.getElementById("homeCommentsList");
  const status = document.getElementById("homeCommentsStatus");
  if (!list || !status) return;
  connectCommentFeed({ list, status, limit: 3 });
}

function initKomentar() {
  const form = document.getElementById("commentForm");
  const input = document.getElementById("commentInput");
  const counter = document.getElementById("commentCounter");
  const notice = document.getElementById("commentNotice");
  const list = document.getElementById("commentsList");
  const status = document.getElementById("commentConnectionStatus");
  const showOlder = document.getElementById("loadOlderComments");
  if (!form || !input || !counter || !notice || !list || !status) return;

  const feed = connectCommentFeed({ list, status, showOlder });
  if (!feed) {
    form.querySelector("button[type='submit']").disabled = true;
    notice.textContent = "Komentar online akan aktif setelah konfigurasi Supabase.";
    return;
  }

  input.addEventListener("input", () => {
    counter.textContent = `${input.value.length}/${MAX_COMMENT_LENGTH}`;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      notice.textContent = "Tulis komentar terlebih dahulu.";
      input.focus();
      return;
    }
    if (text.length > MAX_COMMENT_LENGTH) {
      notice.textContent = `Komentar maksimal ${MAX_COMMENT_LENGTH} karakter.`;
      return;
    }

    try {
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      notice.textContent = "Mengirim komentar...";
      const { error } = await feed.client.from("comments").insert({ content: text });
      if (error) throw error;
      input.value = "";
      counter.textContent = `0/${MAX_COMMENT_LENGTH}`;
      notice.textContent = "Komentar terkirim ke ruang diskusi.";
    } catch (error) {
      notice.textContent = `Komentar gagal dikirim: ${error.message}`;
    } finally {
      form.querySelector("button[type='submit']").disabled = false;
    }
  });
}
