import { useState } from "react";
import { Link } from "react-router-dom";

const landingPreviewImageSrc = "/images/landing/public-home-preview.jpg";

const featureCards = [
  {
    title: "Catalogo privado",
    description: "Guarda tus libros por biblioteca, localiza rapido por autor o ISBN y manten tu fondo ordenado.",
  },
  {
    title: "Seguimiento de lectura",
    description: "Marca pendientes, en lectura y terminados. Anade notas y puntuaciones sin salir de tu panel.",
  },
  {
    title: "Listas tematicas",
    description: "Agrupa lecturas por club, semestre, regalos o cualquier coleccion que quieras preparar.",
  },
  {
    title: "Estadisticas claras",
    description: "Consulta tendencias, formatos, generos y progreso para entender mejor tus habitos lectores.",
  },
  {
    title: "Bibliotecas separadas",
    description: "Organiza colecciones distintas dentro de la misma cuenta y mueve el foco segun necesites.",
  },
  {
    title: "Importa y exporta",
    description: "Aprovecha el soporte CSV para arrancar rapido o sacar copias de tu catalogo cuando quieras.",
  },
];

const steps = [
  {
    number: "01",
    title: "Crea tu cuenta",
    description: "Accede a la zona privada en pocos segundos y entra directamente a tu espacio personal.",
  },
  {
    number: "02",
    title: "Carga tu catalogo",
    description: "Anade libros manualmente o importa un CSV para empezar a trabajar con tu biblioteca real.",
  },
  {
    number: "03",
    title: "Ordena y consulta",
    description: "Filtra, clasifica, sigue tus lecturas y revisa estadisticas desde una misma interfaz.",
  },
];

function BookStackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5.25 4.5A2.25 2.25 0 0 1 7.5 2.25h8.25A2.25 2.25 0 0 1 18 4.5v9.75A2.25 2.25 0 0 1 15.75 16.5H7.5a2.25 2.25 0 0 1-2.25-2.25V4.5Z"
        fill="currentColor"
      />
      <path
        d="M4 7.5a.75.75 0 0 1 .75-.75h.5v7.5A3.75 3.75 0 0 0 9 18h7.25v.5A2.25 2.25 0 0 1 14 20.75H7A3 3 0 0 1 4 17.75V7.5Z"
        fill="currentColor"
        opacity="0.38"
      />
    </svg>
  );
}

function LandingPreviewImage() {
  const [hasImageError, setHasImageError] = useState(false);

  if (hasImageError) {
    return (
      <div className="landing-preview-placeholder">
        <span>Coloca tu imagen en:</span>
        <strong>{landingPreviewImageSrc}</strong>
      </div>
    );
  }

  return (
    <img
      className="landing-preview-image"
      src={landingPreviewImageSrc}
      alt="Vista previa de la aplicacion"
      onError={() => setHasImageError(true)}
    />
  );
}

export function PublicHomePage() {
  return (
    <div className="landing-page">
      <section className="landing-hero-section landing-section">
        <div className="landing-hero-copy">
          <span className="landing-hero-badge">Tu biblioteca personal</span>
          <h1>
            Organiza tu catalogo. <span>Sigue</span> cada lectura.
          </h1>
          <p>
            Reune catalogo, listas, progreso y estadisticas en una zona privada con acceso real,
            autenticacion persistente y una interfaz preparada para trabajar desde el primer dia.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-signup-link landing-hero-primary" to="/register">
              Regístrate
            </Link>
            <Link className="landing-hero-secondary" to="/login">
              Ya tengo cuenta
            </Link>
          </div>
        </div>

        <div className="landing-hero-preview" aria-label="Vista previa del producto">
          <div className="landing-preview-shell">
            <div className="landing-preview-media">
              <LandingPreviewImage />
            </div>
          </div>
        </div>
      </section>

      <section id="funciones" className="landing-features-section landing-section">
        <div className="landing-section-heading">
          <span>Funciones</span>
          <h2>Una experiencia mas cuidada para gestionar tu biblioteca real</h2>
          <p>
            El estilo visual del catalogo se traslada a la portada para que toda la aplicacion se
            sienta coherente, clara y lista para usar.
          </p>
        </div>

        <div className="landing-features-grid">
          {featureCards.map((feature) => (
            <article key={feature.title} className="landing-feature-card">
              <span className="landing-feature-marker" aria-hidden="true" />
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="landing-steps-section landing-section">
        <div className="landing-section-heading">
          <span>Como funciona</span>
          <h2>Ordena tu biblioteca en solo tres pasos</h2>
        </div>

        <div className="landing-steps-grid">
          {steps.map((step) => (
            <article key={step.number} className="landing-step-card">
              <div className="landing-step-number">{step.number}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="empezar" className="landing-cta-section landing-section">
        <div className="landing-cta-shell">
          <div>
            <span className="landing-cta-badge">Empieza hoy</span>
            <h2>Activa tu espacio privado y organiza tus libros con el mismo estilo del catalogo</h2>
            <p>
              La navegacion publica mantiene los accesos originales y la zona privada sigue
              funcionando igual, ahora con una entrada mucho mas solida y consistente.
            </p>
          </div>
          <div className="landing-cta-actions">
            <Link className="landing-cta-primary" to="/register">
              Crear mi biblioteca
            </Link>
            <Link className="landing-cta-secondary" to="/login">
              Iniciar sesion
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <span className="landing-brand-icon">
            <BookStackIcon />
          </span>
          <div>
            <strong>Mi Biblioteca</strong>
            <small>Catalogo, lectura, listas y estadisticas en un mismo lugar.</small>
          </div>
        </div>

        <nav className="landing-footer-nav" aria-label="Accesos rapidos">
          <a href="#funciones">Funciones</a>
          <a href="#como-funciona">Como funciona</a>
          <Link to="/login">Iniciar sesion</Link>
        </nav>

        <p className="landing-footer-copy">(c) {new Date().getFullYear()} Mi Biblioteca</p>
      </footer>
    </div>
  );
}
