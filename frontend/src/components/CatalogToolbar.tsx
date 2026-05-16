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

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M10.5 4.25a6.25 6.25 0 1 1 0 12.5 6.25 6.25 0 0 1 0-12.5Zm0 1.5a4.75 4.75 0 1 0 0 9.5 4.75 4.75 0 0 0 0-9.5Zm6.97 9.91 2.78 2.78a.75.75 0 1 1-1.06 1.06l-2.78-2.78a.75.75 0 1 1 1.06-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M4 7.25a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4A.75.75 0 0 1 4 7.25Zm8.5 0A.75.75 0 0 1 13.25 6.5h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
      />
      <path
        d="M9.75 4.5a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
      <path
        d="M4 16.75a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 0 1.5h-9a.75.75 0 0 1-.75-.75Zm13.5 0a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1a.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
      />
      <path
        d="M16.25 14a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0v-4a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={isExpanded ? "is-expanded" : ""}>
      <path
        d="m7.72 14.78 3.75-3.75a.75.75 0 0 1 1.06 0l3.75 3.75a.75.75 0 1 1-1.06 1.06L12 12.62l-3.22 3.22a.75.75 0 1 1-1.06-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
    <div className="dashboard-toolbar">
      <div className="dashboard-toolbar-top">
        <label className="dashboard-search-shell">
          <span className="dashboard-search-icon">
            <SearchIcon />
          </span>
          <input
            placeholder="Buscar por titulo, autor, ISBN..."
            value={searchDraft}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <button
          className={`dashboard-filter-toggle${isExpanded ? " is-open" : ""}`}
          type="button"
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
        >
          <span className="dashboard-filter-toggle-main">
            <span className="dashboard-filter-toggle-icon">
              <SlidersIcon />
            </span>
            <span>Filtros</span>
          </span>
          <span className="dashboard-filter-toggle-side">
            {activeFilterCount > 0 ? (
              <span className="dashboard-filter-toggle-count">{activeFilterCount}</span>
            ) : null}
            <ChevronIcon isExpanded={isExpanded} />
          </span>
        </button>
      </div>

      {isExpanded ? (
        <div className="dashboard-filters-shell">
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

          {activeFilterCount > 0 ? (
            <div className="dashboard-filters-footer">
              <button className="dashboard-toolbar-clear" type="button" onClick={onClearFilters}>
                Limpiar filtros
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
