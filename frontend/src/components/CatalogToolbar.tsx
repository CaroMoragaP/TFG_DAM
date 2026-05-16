import { useEffect, useMemo, useState } from "react";

type ToolbarLibrary = {
  id: number;
  name: string;
};

type ToolbarList = {
  id: number;
  name: string;
};

type GenreOption = {
  value: string;
  label: string;
};

type CatalogToolbarProps = {
  searchDraft: string;
  onSearchChange: (value: string) => void;
  libraryParam: string;
  libraries: readonly ToolbarLibrary[];
  onLibraryChange: (value: string) => void;
  listIdParam: string;
  lists: readonly ToolbarList[];
  selectedListId?: number;
  activeList: ToolbarList | null;
  onListChange: (value: string) => void;
  genre: string;
  genreOptions: readonly GenreOption[];
  onGenreChange: (value: string) => void;
  theme: string;
  themeOptions: readonly string[];
  onThemeChange: (value: string) => void;
  collection: string;
  onCollectionChange: (value: string) => void;
  authorCountry: string;
  onAuthorCountryChange: (value: string) => void;
  onClearFilters: () => void;
};

type FilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  extraOption?: { value: string; label: string };
};

function FilterSelect({
  label,
  value,
  onChange,
  placeholder,
  options,
  extraOption,
}: FilterSelectProps) {
  return (
    <label className="dashboard-filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {extraOption ? <option value={extraOption.value}>{extraOption.label}</option> : null}
      </select>
    </label>
  );
}

export function CatalogToolbar({
  searchDraft,
  onSearchChange,
  libraryParam,
  libraries,
  onLibraryChange,
  listIdParam,
  lists,
  selectedListId,
  activeList,
  onListChange,
  genre,
  genreOptions,
  onGenreChange,
  theme,
  themeOptions,
  onThemeChange,
  collection,
  onCollectionChange,
  authorCountry,
  onAuthorCountryChange,
  onClearFilters,
}: CatalogToolbarProps) {
  const activeFilterCount = useMemo(() => {
    return [libraryParam, listIdParam, genre, theme, collection, authorCountry].filter(Boolean).length;
  }, [authorCountry, collection, genre, libraryParam, listIdParam, theme]);
  const [isExpanded, setIsExpanded] = useState(activeFilterCount > 0);

  useEffect(() => {
    if (activeFilterCount > 0) {
      setIsExpanded(true);
    }
  }, [activeFilterCount]);

  return (
    <div className="dashboard-toolbar panel">
      <div className="dashboard-toolbar-top">
        <label className="dashboard-search-shell">
          <span className="dashboard-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 1.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm7.56 10.94 2.72 2.72a.75.75 0 1 1-1.06 1.06L17 17.5a.75.75 0 1 1 1.06-1.06Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <input
            placeholder="Buscar por titulo, autor, ISBN..."
            value={searchDraft}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className="dashboard-toolbar-actions">
          <button
            className={`dashboard-filter-toggle${isExpanded ? " is-open" : ""}`}
            type="button"
            onClick={() => setIsExpanded((currentValue) => !currentValue)}
          >
            Filtros
            {activeFilterCount > 0 ? (
              <span className="dashboard-filter-toggle-count">{activeFilterCount}</span>
            ) : null}
          </button>

          {activeFilterCount > 0 ? (
            <button className="dashboard-toolbar-clear" type="button" onClick={onClearFilters}>
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </div>

      {isExpanded ? (
        <div className="dashboard-filters-grid">
          <FilterSelect
            label="Biblioteca"
            value={libraryParam}
            onChange={onLibraryChange}
            placeholder="Todas"
            options={libraries.map((library) => ({ value: String(library.id), label: library.name }))}
          />

          <FilterSelect
            label="Lista"
            value={listIdParam}
            onChange={onListChange}
            placeholder="Todas"
            options={lists.map((list) => ({ value: String(list.id), label: list.name }))}
            extraOption={
              selectedListId && !activeList
                ? { value: String(selectedListId), label: "Lista no disponible" }
                : undefined
            }
          />

          <FilterSelect
            label="Genero literario"
            value={genre}
            onChange={onGenreChange}
            placeholder="Todos"
            options={genreOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />

          <FilterSelect
            label="Tema"
            value={theme}
            onChange={onThemeChange}
            placeholder="Todos"
            options={themeOptions.map((option) => ({ value: option, label: option }))}
          />

          <label className="dashboard-filter-field">
            <span>Coleccion</span>
            <input
              value={collection}
              placeholder="Buscar coleccion..."
              onChange={(event) => onCollectionChange(event.target.value)}
            />
          </label>

          <label className="dashboard-filter-field">
            <span>Pais del autor</span>
            <input
              value={authorCountry}
              placeholder="Buscar pais..."
              onChange={(event) => onAuthorCountryChange(event.target.value)}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
