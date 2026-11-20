import React, { useEffect, useRef, useState } from "react";
import { SITE, UI } from "../data/class-data.js";
import { useAuth } from "../context/AuthContext.jsx";
import { nextPathFromHash } from "../lib/navigation.js";
import { CommentsSection } from "../pages/CommentsPage.jsx";
import classLogo from "../../asset/logo/logo-final.png";
import schoolSlogan from "../../asset/logo/slogan.webp";

const navMenus = UI.navMenus;
const schoolWebsiteUrl = UI.links.school.website;

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15 3h3.2c.3 2 1.7 3.4 3.8 3.7v3.2a8.1 8.1 0 0 1-3.8-1.2v5.5a6.2 6.2 0 1 1-6.2-6.2c.4 0 .8 0 1.2.1v3.3a3 3 0 1 0 1.8 2.8V3Z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 8.5a3 3 0 0 0-2.1-2.1C18 6 12 6 12 6s-6 0-7.9.4A3 3 0 0 0 2 8.5 31 31 0 0 0 1.6 12a31 31 0 0 0 .4 3.5 3 3 0 0 0 2.1 2.1C6 18 12 18 12 18s6 0 7.9-.4a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-3.5 31 31 0 0 0-.4-3.5Z" />
      <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

const footerSocialLinks = {
  class: [
    { label: UI.footer.youtubeLabel, href: UI.links.class.youtube, Icon: YouTubeIcon },
    { label: UI.footer.tiktokLabel, href: UI.links.class.tiktok, Icon: TikTokIcon },
    { label: UI.footer.instagramLabel, href: UI.links.class.instagram, Icon: InstagramIcon },
  ],
  school: [
    { label: UI.footer.schoolYoutubeLabel, href: UI.links.school.youtube, Icon: YouTubeIcon },
    { label: UI.footer.schoolTiktokLabel, href: UI.links.school.tiktok, Icon: TikTokIcon },
    { label: UI.footer.schoolInstagramLabel, href: UI.links.school.instagram, Icon: InstagramIcon },
  ],
};

function FooterSocialNav({ links, label }) {
  return (
    <nav className="footer-social" aria-label={label}>
      {links.map(({ label: linkLabel, href, Icon }) => (
        href
          ? (
              <a
                className="footer-social-link"
                href={href}
                key={linkLabel}
                aria-label={linkLabel}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon />
              </a>
            )
          : (
              <span
                className="footer-social-link is-pending"
                key={linkLabel}
                role="img"
                aria-label={`${linkLabel}, tautan belum diisi`}
                title={`${linkLabel} — tautan belum diisi`}
              >
                <Icon />
              </span>
            )
      ))}
    </nav>
  );
}

function getInitialTheme() {
  try {
    const savedTheme = window.localStorage.getItem("xirpl1-theme");
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
  } catch {
    return "dark";
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);
  const dark = theme === "dark";

  function toggleTheme() {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("xirpl1-theme", next);
    } catch {
      // Theme still works for this page view when storage is unavailable.
    }
    setTheme(next);
  }

  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label={dark ? "Ganti ke tema terang" : "Ganti ke tema gelap"}
      aria-pressed={dark}
      onClick={toggleTheme}
    >
      <svg className="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
      </svg>
      <svg className="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
      </svg>
    </button>
  );
}

export function SiteHeader({ activePage, introMode = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [introPassed, setIntroPassed] = useState(false);
  const navRef = useRef(null);
  const menuToggleRef = useRef(null);
  const { user, loading, logout } = useAuth();
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!introMode) return undefined;
    const main = document.getElementById("main");
    if (!main) return undefined;

    function updateIntroState() {
      const welcome = document.querySelector(".welcome-hero");
      setIntroPassed(Boolean(welcome && welcome.getBoundingClientRect().bottom <= 0));
    }

    updateIntroState();
    const observer = new MutationObserver(updateIntroState);
    observer.observe(main, { childList: true, subtree: true });
    window.addEventListener("scroll", updateIntroState, { passive: true });
    window.addEventListener("resize", updateIntroState);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateIntroState);
      window.removeEventListener("resize", updateIntroState);
    };
  }, [introMode]);

  async function signOut() {
    setLogoutError("");
    setLoggingOut(true);
    try {
      await logout();
      window.location.hash = "#/beranda";
    } catch (error) {
      setLogoutError(error.message);
    } finally {
      setLoggingOut(false);
    }
  }

  function closeAccountMenu(event) {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      const openDropdown = navRef.current?.querySelector("details[open]");
      if (!openDropdown && !menuOpen) return;
      openDropdown?.removeAttribute("open");
      setMenuOpen(false);
      if (menuOpen) {
        menuToggleRef.current?.focus();
      } else {
        openDropdown?.querySelector("summary")?.focus();
      }
    }
    function onPointerDown(event) {
      if (navRef.current?.contains(event.target)) return;
      navRef.current?.querySelectorAll("details[open]").forEach(dropdown => {
        dropdown.removeAttribute("open");
      });
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  function closeNavigation(event) {
    const dropdown = event.currentTarget.closest("details");
    dropdown?.removeAttribute("open");
    setMenuOpen(false);
    if (menuOpen) {
      menuToggleRef.current?.focus();
    } else {
      dropdown?.querySelector("summary")?.focus();
    }
  }

  function closeSiblingPickers(event) {
    const currentDropdown = event.currentTarget.parentElement;
    navRef.current?.querySelectorAll("details[open]").forEach(dropdown => {
      if (dropdown !== currentDropdown) dropdown.removeAttribute("open");
    });
  }

  return (
    <>
      <header
        className={`site-header${introMode ? ` site-header--intro${introPassed ? " is-intro-passed" : ""}` : ""}`}
        aria-hidden={introMode && !introPassed ? true : undefined}
        inert={introMode && !introPassed}
      >
        <div className="navwrap">
          <a href="#/beranda" className="brand" onClick={() => setMenuOpen(false)}>
            <img className="brand-logo" src={classLogo} alt="" width="40" height="40" />
            <span>
              XI RPL
              <small>SMK PGRI 2 Ponorogo</small>
            </span>
          </a>
          <nav
            ref={navRef}
            id="site-nav"
            className={`tabbar${menuOpen ? " open" : ""}`}
            aria-label="Navigasi utama"
          >
            {[
              {
                group: "home",
                label: navMenus.homeLabel,
                links: navMenus.homeLinks,
                isActive: activePage === "beranda",
              },
              {
                group: "pages",
                label: navMenus.exploreLabel,
                links: navMenus.exploreLinks,
                isActive: ["siswa", "guru"].includes(activePage),
              },
            ].map(({ group, label, links, isActive }) => (
              <details className="nav-picker" data-group={group} key={group}>
                <summary
                  className={`tab nav-picker-trigger${isActive ? " active" : ""}`}
                  data-page={isActive ? activePage : undefined}
                  onClick={closeSiblingPickers}
                >
                  {label}
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m4 6 4 4 4-4" />
                  </svg>
                </summary>
                <div className="nav-picker-panel">
                  {links.map(({ label: linkLabel, href, page }) => (
                    <a
                      className="nav-picker-link"
                      data-page={page}
                      href={href}
                      key={href}
                      aria-current={page === activePage ? "page" : undefined}
                      onClick={closeNavigation}
                    >
                      {linkLabel}
                    </a>
                  ))}
                  {group === "pages" && !loading && !user && (
                    <>
                      <span className="nav-picker-divider" aria-hidden="true" />
                      <a
                        className="nav-picker-link"
                        href={`#/login?next=${encodeURIComponent(nextPathFromHash())}`}
                        onClick={closeNavigation}
                      >
                        {navMenus.loginLabel}
                      </a>
                      <a
                        className="nav-picker-link nav-picker-link--primary"
                        href={navMenus.registerHref}
                        onClick={closeNavigation}
                      >
                        {navMenus.registerLabel}
                      </a>
                    </>
                  )}
                </div>
              </details>
            ))}
          </nav>
          <div className="nav-actions">
            {loading ? (
              <span className="nav-auth-loading" role="status">Memeriksa akun…</span>
            ) : user ? (
              <details className="account-menu">
                <summary className="account-trigger">
                  <span className="account-avatar" aria-hidden="true">
                    {user.displayName
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map(part => part[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="account-trigger-name">{user.displayName}</span>
                  <span className="account-chevron" aria-hidden="true">⌄</span>
                </summary>
                <div className="account-menu-panel">
                  {!user.mustChangePassword && (
                    <>
                      <a href="#/profil" onClick={closeAccountMenu}>Profil Saya</a>
                      {["student", "admin"].includes(user.role) && (
                        <a href="#/card-saya" onClick={closeAccountMenu}>Edit Card</a>
                      )}
                      {user.role === "admin" && (
                        <a href="#/admin" onClick={closeAccountMenu}>Kelola Data</a>
                      )}
                    </>
                  )}
                  {(user.role !== "member" || user.mustChangePassword) && (
                    <a href="#/ganti-password" onClick={closeAccountMenu}>Ganti password</a>
                  )}
                  <button type="button" disabled={loggingOut} onClick={signOut}>
                    {loggingOut ? "Keluar…" : "Keluar"}
                  </button>
                  {logoutError && <p role="alert">{logoutError}</p>}
                </div>
              </details>
            ) : null}
            <ThemeToggle />
            <button
              className="menu-toggle"
              type="button"
              aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={menuOpen}
              aria-controls="site-nav"
              ref={menuToggleRef}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <i className="hamburger" />
            </button>
          </div>
        </div>
      </header>
      {menuOpen && <div className="nav-backdrop" aria-hidden="true" onClick={() => setMenuOpen(false)} />}
    </>
  );
}

export function SiteFooter({ isHome = false }) {
  const [wordmarkVisible, setWordmarkVisible] = useState(false);
  const wordmarkLetters = Array.from(SITE.className);
  const wordmarkRef = React.useRef(null);

  useEffect(() => {
    const wordmark = wordmarkRef.current;
    if (!wordmark) return undefined;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      setWordmarkVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setWordmarkVisible(entry.isIntersecting);
    }, { threshold: 0.1 });
    observer.observe(wordmark);
    return () => observer.disconnect();
  }, []);

  return (
    <footer id="site-footer" className={`site-footer${isHome ? " site-footer--attached" : ""}`} tabIndex="-1">
      <div className="footer-inner">
        <div className="footer-main">
          <div>
            <div className="footer-brand">
              <img className="brand-logo" src={classLogo} alt="" width="40" height="40" />
              <span>{SITE.className}<small>{SITE.schoolName}</small></span>
            </div>
            <p className="footer-message">{UI.footer.message}</p>
          </div>
          <div className="footer-navigation">
            <section className="footer-link-group" data-group="class" aria-labelledby="footer-class-links-title">
              <h2 className="footer-link-heading" id="footer-class-links-title">{UI.footer.classLinksTitle}</h2>
              <nav className="footer-links" aria-label={UI.footer.classLinksTitle}>
                <a href={UI.links.class.website}>{UI.footer.classWebsiteLabel}</a>
              </nav>
              <FooterSocialNav
                links={footerSocialLinks.class}
                label={UI.footer.classSocialLabel}
              />
            </section>
            <section className="footer-link-group" data-group="school" aria-labelledby="footer-school-links-title">
              <h2 className="footer-link-heading" id="footer-school-links-title">{UI.footer.schoolLinksTitle}</h2>
              <nav className="footer-links" aria-label={UI.footer.schoolLinksTitle}>
                {schoolWebsiteUrl
                  ? (
                      <a href={schoolWebsiteUrl} target="_blank" rel="noopener noreferrer">
                        {UI.footer.schoolWebsiteLabel}
                      </a>
                    )
                  : (
                      <span className="footer-link footer-link--pending" title={UI.footer.schoolWebsitePendingTitle}>
                        {UI.footer.schoolWebsiteLabel}
                      </span>
                    )}
              </nav>
              <FooterSocialNav
                links={footerSocialLinks.school}
                label={UI.footer.schoolSocialLabel}
              />
            </section>
          </div>
          <img
            className="footer-slogan"
            src={schoolSlogan}
            alt='Logo SMK PGRI 2 Ponorogo dengan slogan "Tidak tertib, tidak baik"'
            loading="lazy"
            decoding="async"
          />
        </div>
        <div
          ref={wordmarkRef}
          className={`footer-wordmark${wordmarkVisible ? " is-revealed" : ""}`}
          role="img"
          aria-label={SITE.className}
        >
          <div className="footer-wordmark-row" aria-hidden="true">
            {wordmarkLetters.map((letter, index) => (
              <span
                className="footer-wordmark-letter"
                key={`${index}-${letter}`}
                style={{ animationDelay: `${300 + index * 70}ms` }}
              >
                {letter === " " ? "\u00a0" : letter}
              </span>
            ))}
          </div>
          <div className="footer-wordmark-floor" aria-hidden="true" />
          <div
            className="footer-wordmark-reflection"
            aria-hidden="true"
            style={{ transitionDelay: `${300 + (wordmarkLetters.length - 1) * 70 + 100}ms` }}
          >
            <div className="footer-wordmark-reflection-row">
              {wordmarkLetters.map((letter, index) => (
                <span key={`${index}-${letter}`}>
                  {letter === " " ? "\u00a0" : letter}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {SITE.className} · {SITE.schoolName}</span>
          <span className="footer-stack">{UI.footer.builtWith}</span>
        </div>
      </div>
    </footer>
  );
}

export function GlobalChatWidget({ routePage }) {
  const [open, setOpen] = useState(false);
  const triggerRef = React.useRef(null);
  const dialogRef = React.useRef(null);

  useEffect(() => {
    setOpen(routePage === "komentar");
  }, [routePage]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="global-chat-trigger"
        type="button"
        aria-label={UI.header.chatOpenLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="global-chat-dialog"
        onClick={() => setOpen(true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6a7.5 7.5 0 1 1 17-3.5Z" />
          <path d="M8 11h.01M12 11h.01M16 11h.01" />
        </svg>
        <span>{UI.header.chatLabel}</span>
      </button>
      <dialog
        ref={dialogRef}
        id="global-chat-dialog"
        className="global-chat-dialog"
        aria-labelledby="global-chat-title"
        onClose={() => {
          setOpen(false);
          triggerRef.current?.focus();
        }}
        onClick={event => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
        <h2 className="visually-hidden" id="global-chat-title">{UI.header.chatTitle}</h2>
        <button
          className="global-chat-close"
          type="button"
          aria-label={UI.header.chatCloseLabel}
          autoFocus
          onClick={() => setOpen(false)}
        >
          <span aria-hidden="true">×</span>
        </button>
        {open && <CommentsSection />}
      </dialog>
    </>
  );
}
