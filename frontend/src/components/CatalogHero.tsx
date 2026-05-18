import { DashboardHero, HeroActionButton } from "./DashboardHero";

type CatalogHeroProps = {
  onImport: () => void;
  onExport: () => void;
  onAddBook: () => void;
  isImportDisabled: boolean;
  isExportDisabled: boolean;
  isExporting: boolean;
};

export function CatalogHero({
  onImport,
  onExport,
  onAddBook,
  isImportDisabled,
  isExportDisabled,
  isExporting,
}: CatalogHeroProps) {
  return (
    <DashboardHero
      eyebrow="Catalogo privado"
      title="Mi catalogo"
      description="Explora tus libros, busca por autor o ISBN y manten el estado de lectura al dia."
      icon="book"
      actions={
        <>
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
            Añadir libro
          </HeroActionButton>
        </>
      }
    />
  );
}
