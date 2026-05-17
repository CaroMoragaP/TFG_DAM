import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

const landingLinks = [
  { href: "#funciones", label: "Funciones" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#empezar", label: "Empezar" },
];

function BookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M6.25 4A2.25 2.25 0 0 1 8.5 1.75h8.25A2.25 2.25 0 0 1 19 4v13.25a.75.75 0 0 1-1.23.57l-2.33-1.88a1 1 0 0 0-1.26 0l-1.55 1.24a1 1 0 0 1-1.25 0l-1.55-1.24a1 1 0 0 0-1.26 0l-2.33 1.88A.75.75 0 0 1 5 17.25V5.25A1.25 1.25 0 0 1 6.25 4Z"
        fill="currentColor"
      />
      <path
        d="M4 6.25a.75.75 0 0 0-1.5 0v11A4 4 0 0 0 6.5 21.25H15a.75.75 0 0 0 0-1.5H6.5A2.5 2.5 0 0 1 4 17.25v-11Z"
        fill="currentColor"
        opacity="0.42"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M4.75 6.75a.75.75 0 0 1 .75-.75h13a.75.75 0 0 1 0 1.5h-13a.75.75 0 0 1-.75-.75Zm0 5.25a.75.75 0 0 1 .75-.75h13a.75.75 0 0 1 0 1.5h-13a.75.75 0 0 1-.75-.75Zm.75 4.5a.75.75 0 0 0 0 1.5h13a.75.75 0 0 0 0-1.5h-13Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M6.72 6.72a.75.75 0 0 1 1.06 0L12 10.94l4.22-4.22a.75.75 0 1 1 1.06 1.06L13.06 12l4.22 4.22a.75.75 0 1 1-1.06 1.06L12 13.06l-4.22 4.22a.75.75 0 0 1-1.06-1.06L10.94 12 6.72 7.78a.75.75 0 0 1 0-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PublicLayout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isHomeRoute = location.pathname === "/";

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  const resolveHref = (href: string) => (isHomeRoute ? href : `/${href}`);

  return (
    <div className="public-shell">
      <header className="public-header landing-header">
        <nav className="landing-nav" aria-label="Principal">
          <Link className="landing-brand" to="/">
            <span className="landing-brand-icon">
              <BookIcon />
            </span>
            <span className="landing-brand-copy">Mi Biblioteca</span>
          </Link>

          <div className="landing-nav-links" aria-label="Secciones">
            {landingLinks.map((link) => (
              <a key={link.href} className="landing-nav-link" href={resolveHref(link.href)}>
                {link.label}
              </a>
            ))}
          </div>

          <div className="landing-nav-actions">
            <Link className="landing-login-link" to="/auth">
              Iniciar sesion
            </Link>
            <Link className="landing-signup-link" to="/auth?tab=register">
              Regístrate
            </Link>
          </div>

          <button
            className="landing-menu-button"
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            <span className="landing-menu-icon">{isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}</span>
          </button>
        </nav>

        {isMobileMenuOpen ? (
          <div className="landing-mobile-menu">
            <div className="landing-mobile-links">
              {landingLinks.map((link) => (
                <a key={link.href} className="landing-mobile-link" href={resolveHref(link.href)}>
                  {link.label}
                </a>
              ))}
            </div>
            <div className="landing-mobile-actions">
              <Link className="landing-login-link" to="/auth">
                Iniciar sesion
              </Link>
              <Link className="landing-signup-link" to="/auth?tab=register">
                Regístrate
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main className={isHomeRoute ? "public-main public-main-landing" : "public-main"}>
        <Outlet />
      </main>
    </div>
  );
}
