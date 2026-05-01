import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { useActiveLibrary } from "../libraries/ActiveLibraryProvider";
import {
  fetchCatalogStats,
  fetchReadingStats,
  type ReadingStats,
  type StatsBreakdownItem,
  type StatsRankingItem,
} from "../lib/api";

type StatsTab = "catalog" | "reading";

const PIE_COLORS = [
  "#214f4a",
  "#c96b3b",
  "#94b49f",
  "#d9a66b",
  "#5b6f95",
  "#d27d6d",
  "#85a6a0",
  "#b5c7af",
];

const readingStatusCards = [
  { key: "finished", label: "Leidos" },
  { key: "reading", label: "Leyendo" },
  { key: "pending", label: "Pendientes" },
] as const;

const activityCards = [
  { key: "started", label: "Con fecha de inicio" },
  { key: "finished", label: "Con fecha de fin" },
  { key: "missing_dates", label: "Fechas incompletas" },
] as const;

const numberFormatter = new Intl.NumberFormat("es-ES");
const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function normalizeTab(value: string | null): StatsTab {
  return value === "reading" ? "reading" : "catalog";
}

function normalizeLibraryValue(value: string | null) {
  if (!value || value === "all") {
    return "all";
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return "all";
  }

  return String(parsed);
}

function hasData(items: StatsBreakdownItem[]) {
  return items.some((item) => item.count > 0);
}

function topSlice(items: StatsBreakdownItem[], size: number) {
  return items.slice(0, size);
}

function buildCountryPieData(items: StatsBreakdownItem[]) {
  if (items.length <= 6) {
    return items;
  }

  const visibleItems = items.slice(0, 6);
  const remainingItems = items.slice(6);
  const otherCount = remainingItems.reduce((sum, item) => sum + item.count, 0);
  const otherPercentage = remainingItems.reduce((sum, item) => sum + item.percentage, 0);

  return [
    ...visibleItems,
    {
      key: "Otros",
      label: "Otros",
      count: otherCount,
      percentage: Number(otherPercentage.toFixed(2)),
    },
  ];
}

function MetricCard({
  eyebrow,
  label,
  value,
}: {
  eyebrow: string;
  label: string;
  value: number | string;
}) {
  return (
    <article className="panel stats-metric-card">
      <p className="eyebrow">{eyebrow}</p>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function EmptyChartPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="panel stats-panel">
      <div className="stats-panel-header">
        <div>
          <p className="eyebrow">Sin datos</p>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="stats-empty-chart">
        <p>{description}</p>
      </div>
    </article>
  );
}

function BreakdownBarCard({
  title,
  eyebrow,
  data,
  countLabel,
  wide = false,
}: {
  title: string;
  eyebrow: string;
  data: StatsBreakdownItem[];
  countLabel: string;
  wide?: boolean;
}) {
  if (!hasData(data)) {
    return (
      <EmptyChartPanel
        title={title}
        description="Todavia no hay suficientes registros para construir este grafico."
      />
    );
  }

  return (
    <article className={`panel stats-panel ${wide ? "stats-panel-wide" : ""}`}>
      <div className="stats-panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="stats-chart-scroll">
        <div
          className="stats-chart-wide"
          style={{ minWidth: `${Math.max(540, data.length * 74)}px` }}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 12, right: 18, left: 4, bottom: 42 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(29, 36, 51, 0.12)" />
              <XAxis
                dataKey="label"
                angle={data.length > 6 ? -25 : 0}
                textAnchor={data.length > 6 ? "end" : "middle"}
                height={data.length > 6 ? 64 : 40}
                interval={0}
                tick={{ fill: "#5f6b7f", fontSize: 12 }}
              />
              <YAxis tickFormatter={formatPercentage} tick={{ fill: "#5f6b7f", fontSize: 12 }} />
              <Tooltip
                formatter={(value, _name, entry) => [
                  `${formatPercentage(typeof value === "number" ? value : Number(value ?? 0))} · ${entry.payload.count} ${countLabel}`,
                  "Peso",
                ]}
              />
              <Bar dataKey="percentage" radius={[10, 10, 0, 0]} fill="#214f4a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </article>
  );
}

function BreakdownPieCard({
  title,
  eyebrow,
  data,
}: {
  title: string;
  eyebrow: string;
  data: StatsBreakdownItem[];
}) {
  if (!hasData(data)) {
    return (
      <EmptyChartPanel
        title={title}
        description="Todavia no hay registros con esta metadata para mostrar la distribucion."
      />
    );
  }

  return (
    <article className="panel stats-panel">
      <div className="stats-panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="stats-pie-wrap">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius={62}
              outerRadius={110}
              paddingAngle={2}
            >
              {data.map((item, index) => (
                <Cell key={item.key} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, entry) => [
                `${numberFormatter.format(typeof value === "number" ? value : Number(value ?? 0))} libros · ${formatPercentage(entry.payload.percentage)}`,
                entry.payload.label,
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function RankingCard({
  title,
  eyebrow,
  items,
  emptyText,
}: {
  title: string;
  eyebrow: string;
  items: StatsRankingItem[];
  emptyText: string;
}) {
  return (
    <article className="panel stats-panel">
      <div className="stats-panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="stats-empty-chart">
          <p>{emptyText}</p>
        </div>
      ) : (
        <ol className="stats-ranking-list">
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`} className="stats-ranking-item">
              <div>
                <strong>{item.label}</strong>
                <span>{numberFormatter.format(item.count)} ejemplares</span>
              </div>
              <span className="status-chip active">#{index + 1}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function RecentFinishesCard({ items }: { items: ReadingStats["recent_finishes"] }) {
  return (
    <article className="panel stats-panel">
      <div className="stats-panel-header">
        <div>
          <p className="eyebrow">Lecturas recientes</p>
          <h3>Ultimos libros terminados</h3>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="stats-empty-chart">
          <p>Todavia no hay libros terminados con fecha de fin registrada.</p>
        </div>
      ) : (
        <div className="stats-recent-list">
          {items.map((item) => (
            <Link key={item.copy_id} className="stats-recent-item" to={`/libros/${item.copy_id}`}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.authors.join(", ") || "Autor sin registrar"}</span>
              </div>
              <small>{dateFormatter.format(new Date(item.finished_on))}</small>
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}

export function StatsPage() {
  const { token } = useAuth();
  const {
    isLibrariesError,
    isLibrariesLoading,
    libraries,
  } = useActiveLibrary();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = normalizeTab(searchParams.get("tab"));
  const libraryValue = normalizeLibraryValue(searchParams.get("library"));
  const selectedLibraryId = libraryValue === "all" ? undefined : Number(libraryValue);
  const availableLibraries = libraries.filter((library) => !library.is_archived);

  useEffect(() => {
    const nextTab = searchParams.get("tab");
    const nextLibrary = searchParams.get("library");

    if (nextTab && nextLibrary) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    if (!nextTab) {
      nextSearchParams.set("tab", tab);
    }
    if (!nextLibrary) {
      nextSearchParams.set("library", libraryValue);
    }
    setSearchParams(nextSearchParams, { replace: true });
  }, [libraryValue, searchParams, setSearchParams, tab]);

  const catalogQuery = useQuery({
    queryKey: ["stats", "catalog", selectedLibraryId ?? "all"],
    queryFn: () => fetchCatalogStats(token ?? "", { libraryId: selectedLibraryId }),
    enabled: Boolean(token && tab === "catalog"),
  });

  const readingQuery = useQuery({
    queryKey: ["stats", "reading", selectedLibraryId ?? "all"],
    queryFn: () => fetchReadingStats(token ?? "", { libraryId: selectedLibraryId }),
    enabled: Boolean(token && tab === "reading"),
  });

  const activeLibrary = selectedLibraryId
    ? availableLibraries.find((library) => library.id === selectedLibraryId) ?? null
    : null;
  const activeQuery = tab === "catalog" ? catalogQuery : readingQuery;
  const queryErrorMessage =
    activeQuery.error instanceof Error
      ? activeQuery.error.message
      : "No se pudieron cargar las estadisticas.";

  function updateSearchParam(key: "tab" | "library", value: string) {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set(key, value);
    setSearchParams(nextSearchParams, { replace: true });
  }

  return (
    <section className="content-stack">
      <div className="panel hero-panel stats-hero">
        <div>
          <p className="eyebrow">Analitica personal</p>
          <h2>Estadisticas</h2>
          <p>
            Revisa el equilibrio de tu catalogo, el progreso de lectura y los patrones que se van
            formando en tus bibliotecas.
          </p>
        </div>
        <div className="stats-hero-aside">
          <span className="status-chip active">{activeLibrary ? activeLibrary.name : "Todas mis bibliotecas"}</span>
          <p>Las metricas de lectura siempre se calculan con tus datos personales.</p>
        </div>
      </div>

      <div className="panel stats-toolbar">
        <label className="field-group">
          Biblioteca
          <select
            value={libraryValue}
            onChange={(event) => updateSearchParam("library", event.target.value)}
            disabled={isLibrariesLoading}
          >
            <option value="all">Todas mis bibliotecas</option>
            {availableLibraries.map((library) => (
              <option key={library.id} value={library.id}>
                {library.name}
              </option>
            ))}
          </select>
        </label>

        <div className="stats-tab-strip" role="tablist" aria-label="Tipos de estadisticas">
          <button
            className={tab === "catalog" ? "stats-tab active" : "stats-tab"}
            type="button"
            onClick={() => updateSearchParam("tab", "catalog")}
          >
            Estadisticas del catalogo
          </button>
          <button
            className={tab === "reading" ? "stats-tab active" : "stats-tab"}
            type="button"
            onClick={() => updateSearchParam("tab", "reading")}
          >
            Estadisticas de lectura
          </button>
        </div>
      </div>

      {isLibrariesError ? (
        <div className="panel">
          <p>No se pudieron cargar las bibliotecas disponibles para filtrar esta vista.</p>
        </div>
      ) : null}

      {activeQuery.isPending ? (
        <div className="stats-grid stats-grid-metrics">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="book-skeleton panel" aria-hidden="true" />
          ))}
        </div>
      ) : null}

      {activeQuery.isError ? (
        <div className="panel">
          <p>{queryErrorMessage}</p>
        </div>
      ) : null}

      {tab === "catalog" && catalogQuery.data ? (
        <>
          <div className="stats-grid stats-grid-metrics">
            <MetricCard
              eyebrow="Catalogo"
              label="Total de ejemplares"
              value={numberFormatter.format(catalogQuery.data.totals.total)}
            />
            <MetricCard
              eyebrow="Formato"
              label="Libros fisicos"
              value={numberFormatter.format(catalogQuery.data.totals.physical)}
            />
            <MetricCard
              eyebrow="Formato"
              label="Libros digitales"
              value={numberFormatter.format(catalogQuery.data.totals.digital)}
            />
          </div>

          <div className="stats-grid">
            <BreakdownBarCard
              title="Autorias por sexo"
              eyebrow="Catalogo"
              data={catalogQuery.data.author_sex_distribution}
              countLabel="libros"
            />
            <BreakdownPieCard
              title="Pais de nacimiento del autor"
              eyebrow="Catalogo"
              data={buildCountryPieData(catalogQuery.data.author_country_distribution)}
            />
            <BreakdownBarCard
              title="Distribucion por genero"
              eyebrow="Catalogo"
              data={topSlice(catalogQuery.data.genre_distribution, 10)}
              countLabel="libros"
            />
            <BreakdownBarCard
              title="Distribucion por editorial"
              eyebrow="Catalogo"
              data={catalogQuery.data.publisher_distribution}
              countLabel="libros"
            />
            <BreakdownBarCard
              title="Distribucion por ano de publicacion"
              eyebrow="Catalogo"
              data={catalogQuery.data.publication_year_distribution}
              countLabel="libros"
              wide={true}
            />
            <RankingCard
              title="Top autores"
              eyebrow="Ranking"
              items={catalogQuery.data.top_authors}
              emptyText="Todavia no hay autores suficientes para construir un ranking."
            />
            <RankingCard
              title="Top generos"
              eyebrow="Ranking"
              items={catalogQuery.data.top_genres}
              emptyText="Todavia no hay generos suficientes para construir un ranking."
            />
          </div>
        </>
      ) : null}

      {tab === "reading" && readingQuery.data ? (
        <>
          <div className="stats-grid stats-grid-metrics">
            {readingStatusCards.map((card) => (
              <MetricCard
                key={card.key}
                eyebrow="Lectura"
                label={card.label}
                value={numberFormatter.format(readingQuery.data.status_counts[card.key])}
              />
            ))}
          </div>

          <div className="stats-grid stats-grid-metrics">
            {activityCards.map((card) => (
              <MetricCard
                key={card.key}
                eyebrow="Actividad"
                label={card.label}
                value={numberFormatter.format(readingQuery.data.reading_activity[card.key])}
              />
            ))}
          </div>

          <div className="stats-grid">
            <article className="panel stats-panel stats-panel-wide">
              <div className="stats-panel-header">
                <div>
                  <p className="eyebrow">Ritmo de lectura</p>
                  <h3>Libros leidos por ano</h3>
                </div>
              </div>
              {readingQuery.data.finished_by_year.length === 0 ? (
                <div className="stats-empty-chart">
                  <p>Todavia no hay lecturas terminadas con fecha de fin para construir este grafico.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={readingQuery.data.finished_by_year}
                    margin={{ top: 12, right: 18, left: 4, bottom: 12 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(29, 36, 51, 0.12)" />
                    <XAxis dataKey="year" tick={{ fill: "#5f6b7f", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#5f6b7f", fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value) => [
                        `${typeof value === "number" ? value : Number(value ?? 0)} libros`,
                        "Terminados",
                      ]}
                    />
                    <Bar dataKey="count" radius={[10, 10, 0, 0]} fill="#c96b3b" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </article>

            <article className="panel stats-panel">
              <div className="stats-panel-header">
                <div>
                  <p className="eyebrow">Valoraciones</p>
                  <h3>Resumen de ratings</h3>
                </div>
              </div>
              <div className="stats-rating-summary">
                <strong>
                  {readingQuery.data.rating_summary.average !== null
                    ? `${readingQuery.data.rating_summary.average}/5`
                    : "Sin media"}
                </strong>
                <span>
                  {readingQuery.data.rating_summary.total_rated > 0
                    ? `${readingQuery.data.rating_summary.total_rated} libros valorados`
                    : "Todavia no has valorado ningun libro"}
                </span>
              </div>
              {readingQuery.data.rating_summary.total_rated > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={readingQuery.data.rating_summary.distribution}
                    margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(29, 36, 51, 0.12)" />
                    <XAxis dataKey="rating" tick={{ fill: "#5f6b7f", fontSize: 12 }} />
                    <YAxis tickFormatter={formatPercentage} tick={{ fill: "#5f6b7f", fontSize: 12 }} />
                    <Tooltip
                      formatter={(value, _name, entry) => [
                        `${formatPercentage(typeof value === "number" ? value : Number(value ?? 0))} · ${entry.payload.count} libros`,
                        `${entry.payload.rating} estrellas`,
                      ]}
                    />
                    <Bar dataKey="percentage" radius={[10, 10, 0, 0]} fill="#214f4a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="stats-empty-chart compact">
                  <p>Aun no hay datos de valoracion para repartir por estrellas.</p>
                </div>
              )}
            </article>

            <RecentFinishesCard items={readingQuery.data.recent_finishes} />
          </div>
        </>
      ) : null}
    </section>
  );
}
