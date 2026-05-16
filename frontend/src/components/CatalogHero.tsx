type CatalogHeroProps = {
  onImport: () => void;
  onExport: () => void;
  onAddBook: () => void;
  isImportDisabled: boolean;
  isExportDisabled: boolean;
  isExporting: boolean;
};

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

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M11.25 14.75V6.56L8.53 9.28a.75.75 0 1 1-1.06-1.06l4-4a.75.75 0 0 1 1.06 0l4 4a.75.75 0 1 1-1.06 1.06l-2.72-2.72v8.19a.75.75 0 0 1-1.5 0Z"
        fill="currentColor"
      />
      <path
        d="M5 14.75A2.75 2.75 0 0 1 7.75 12h1.5a.75.75 0 0 1 0 1.5h-1.5A1.25 1.25 0 0 0 6.5 14.75v2.5A1.25 1.25 0 0 0 7.75 18.5h8.5a1.25 1.25 0 0 0 1.25-1.25v-2.5a1.25 1.25 0 0 0-1.25-1.25h-1.5a.75.75 0 0 1 0-1.5h1.5A2.75 2.75 0 0 1 19 14.75v2.5A2.75 2.75 0 0 1 16.25 20h-8.5A2.75 2.75 0 0 1 5 17.25v-2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 4.5a.75.75 0 0 1 .75.75v8.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 1 1 1.06-1.06l2.72 2.72V5.25A.75.75 0 0 1 12 4.5Z"
        fill="currentColor"
      />
      <path
        d="M5 14.75A2.75 2.75 0 0 1 7.75 12h1.5a.75.75 0 0 1 0 1.5h-1.5A1.25 1.25 0 0 0 6.5 14.75v2.5A1.25 1.25 0 0 0 7.75 18.5h8.5a1.25 1.25 0 0 0 1.25-1.25v-2.5a1.25 1.25 0 0 0-1.25-1.25h-1.5a.75.75 0 0 1 0-1.5h1.5A2.75 2.75 0 0 1 19 14.75v2.5A2.75 2.75 0 0 1 16.25 20h-8.5A2.75 2.75 0 0 1 5 17.25v-2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 5.25a.75.75 0 0 1 .75.75v5.25H18a.75.75 0 0 1 0 1.5h-5.25V18a.75.75 0 0 1-1.5 0v-5.25H6a.75.75 0 0 1 0-1.5h5.25V6a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

type HeroActionButtonProps = {
  children: string;
  disabled?: boolean;
  emphasis?: "primary" | "secondary";
  icon: "upload" | "download" | "plus";
  onClick: () => void;
};

function HeroActionButton({
  children,
  disabled = false,
  emphasis = "secondary",
  icon,
  onClick,
}: HeroActionButtonProps) {
  const Icon = icon === "upload" ? UploadIcon : icon === "download" ? DownloadIcon : PlusIcon;

  return (
    <button
      className={`dashboard-hero-action dashboard-hero-action-${emphasis}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="dashboard-hero-action-icon">
        <Icon />
      </span>
      <span>{children}</span>
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
    <div className="dashboard-catalog-hero">
      <div className="dashboard-catalog-hero-copy">
        <span className="dashboard-catalog-hero-eyebrow">
          <span className="dashboard-catalog-hero-mark">
            <BookIcon />
          </span>
          Catalogo privado
        </span>
        <h1>Mi catalogo</h1>
        <p>Explora tus libros, busca por autor o ISBN y manten el estado de lectura al dia.</p>
      </div>

      <div className="dashboard-catalog-hero-actions">
        <HeroActionButton
          disabled={isImportDisabled}
          emphasis="secondary"
          icon="upload"
          onClick={onImport}
        >
          Importar CSV
        </HeroActionButton>
        <HeroActionButton
          disabled={isExportDisabled}
          emphasis="secondary"
          icon="download"
          onClick={onExport}
        >
          {isExporting ? "Exportando..." : "Exportar CSV"}
        </HeroActionButton>
        <HeroActionButton
          disabled={isImportDisabled}
          emphasis="primary"
          icon="plus"
          onClick={onAddBook}
        >
          Anadir libro
        </HeroActionButton>
      </div>
    </div>
  );
}
