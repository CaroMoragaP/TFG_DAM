type CatalogHeroProps = {
  onImport: () => void;
  onExport: () => void;
  onAddBook: () => void;
  isImportDisabled: boolean;
  isExportDisabled: boolean;
  isExporting: boolean;
};

function BookSparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M6.5 4.75A2.75 2.75 0 0 1 9.25 2h7.25a2 2 0 0 1 2 2v12.5a.75.75 0 0 1-1.22.586l-2.53-2.07a1.25 1.25 0 0 0-1.58 0l-2.26 1.85a1.25 1.25 0 0 1-1.58 0l-2.27-1.85a1.25 1.25 0 0 0-.56-.26V4.75Z"
        fill="currentColor"
      />
      <path
        d="M5 6.25a.75.75 0 0 0-1.5 0V18A4 4 0 0 0 7.5 22h7.75a.75.75 0 0 0 0-1.5H7.5A2.5 2.5 0 0 1 5 18V6.25Z"
        fill="currentColor"
        opacity="0.48"
      />
      <path
        d="m15.85 5.35.24.74h.78a.55.55 0 0 1 .33.99l-.64.47.24.75a.55.55 0 0 1-.85.61l-.63-.46-.63.46a.55.55 0 0 1-.85-.61l.24-.75-.64-.47a.55.55 0 0 1 .33-.99h.78l.24-.74a.55.55 0 0 1 1.06 0Z"
        fill="#f6d485"
      />
    </svg>
  );
}

type HeroActionButtonProps = {
  children: string;
  disabled?: boolean;
  emphasis?: "primary" | "secondary";
  onClick: () => void;
};

function HeroActionButton({
  children,
  disabled = false,
  emphasis = "secondary",
  onClick,
}: HeroActionButtonProps) {
  return (
    <button
      className={`dashboard-hero-action dashboard-hero-action-${emphasis}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function CatalogHero({
  onImport,
  onExport,
  onAddBook,
  isImportDisabled,
  isExportDisabled,
  isExporting,
}: CatalogHeroProps) {
  return (
    <div className="dashboard-catalog-hero panel">
      <div className="dashboard-catalog-hero-glow dashboard-catalog-hero-glow-left" aria-hidden="true" />
      <div className="dashboard-catalog-hero-glow dashboard-catalog-hero-glow-right" aria-hidden="true" />

      <div className="dashboard-catalog-hero-copy">
        <span className="dashboard-catalog-hero-eyebrow">
          <span className="dashboard-catalog-hero-mark">
            <BookSparkIcon />
          </span>
          Catalogo privado
        </span>
        <h2>Mi catalogo</h2>
        <p>Explora tus libros, busca por autor o ISBN y manten el estado de lectura al dia.</p>
      </div>

      <div className="dashboard-catalog-hero-actions">
        <HeroActionButton disabled={isImportDisabled} onClick={onImport}>
          Importar CSV
        </HeroActionButton>
        <HeroActionButton disabled={isExportDisabled} onClick={onExport}>
          {isExporting ? "Exportando..." : "Exportar CSV"}
        </HeroActionButton>
        <HeroActionButton
          disabled={isImportDisabled}
          emphasis="primary"
          onClick={onAddBook}
        >
          + Anadir libro
        </HeroActionButton>
      </div>
    </div>
  );
}
