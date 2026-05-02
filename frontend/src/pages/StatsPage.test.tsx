import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StatsPage } from "./StatsPage";

const apiMocks = vi.hoisted(() => ({
  fetchCatalogStats: vi.fn(),
  fetchReadingStats: vi.fn(),
  updateReadingGoal: vi.fn(),
}));

vi.mock("recharts", () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;

  return {
    ResponsiveContainer: Wrapper,
    BarChart: Wrapper,
    Bar: Empty,
    CartesianGrid: Empty,
    Cell: Empty,
    Legend: Empty,
    Pie: Empty,
    PieChart: Wrapper,
    Tooltip: Empty,
    XAxis: Empty,
    YAxis: Empty,
  };
});

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: "token",
  }),
}));

vi.mock("../libraries/ActiveLibraryProvider", () => ({
  useActiveLibrary: () => ({
    activeLibrary: null,
    activeLibraryId: 1,
    isLibrariesError: false,
    isLibrariesLoading: false,
    libraries: [
      {
        id: 1,
        name: "Biblioteca personal",
        type: "personal",
        created_at: "2026-04-19T00:00:00Z",
        role: "owner",
        is_archived: false,
        archived_at: null,
        member_count: 1,
        copy_count: 6,
      },
      {
        id: 2,
        name: "Club de lectura",
        type: "shared",
        created_at: "2026-04-20T00:00:00Z",
        role: "editor",
        is_archived: false,
        archived_at: null,
        member_count: 3,
        copy_count: 4,
      },
    ],
    refreshLibraries: vi.fn(),
    setActiveLibraryId: vi.fn(),
  }),
}));

vi.mock("../lib/api", () => ({
  fetchCatalogStats: apiMocks.fetchCatalogStats,
  fetchReadingStats: apiMocks.fetchReadingStats,
  updateReadingGoal: apiMocks.updateReadingGoal,
}));

function buildMonthlyProgress() {
  return [
    { month: "Ene", started: 1, finished: 0 },
    { month: "Feb", started: 1, finished: 1 },
    { month: "Mar", started: 0, finished: 1 },
    { month: "Abr", started: 1, finished: 0 },
    { month: "May", started: 0, finished: 0 },
    { month: "Jun", started: 0, finished: 0 },
    { month: "Jul", started: 0, finished: 0 },
    { month: "Ago", started: 0, finished: 0 },
    { month: "Sep", started: 0, finished: 0 },
    { month: "Oct", started: 0, finished: 0 },
    { month: "Nov", started: 0, finished: 0 },
    { month: "Dic", started: 0, finished: 0 },
  ];
}

function buildReadingStats(overrides: Record<string, unknown> = {}) {
  return {
    goal_year: 2026,
    goal: null,
    goal_progress: {
      target: 0,
      completed: 2,
      percentage: 0,
    },
    status_counts: {
      pending: 4,
      reading: 2,
      finished: 4,
    },
    monthly_progress: buildMonthlyProgress(),
    streak: {
      current_months: 0,
      best_months: 2,
    },
    stuck_reminders: [
      {
        copy_id: 10,
        book_id: 3,
        library_id: 1,
        title: "Libro atascado",
        authors: ["Autora Lenta"],
        started_on: "2026-03-01",
        days_open: 45,
      },
    ],
    finished_by_year: [{ year: 2025, count: 3 }],
    rating_summary: {
      average: 4.5,
      total_rated: 2,
      distribution: [
        { rating: 1, count: 0, percentage: 0 },
        { rating: 2, count: 0, percentage: 0 },
        { rating: 3, count: 0, percentage: 0 },
        { rating: 4, count: 1, percentage: 50 },
        { rating: 5, count: 1, percentage: 50 },
      ],
    },
    reading_activity: {
      started: 3,
      finished: 2,
      missing_dates: 5,
    },
    recent_finishes: [
      {
        copy_id: 7,
        book_id: 3,
        library_id: 1,
        title: "Dune",
        authors: ["Frank Herbert"],
        finished_on: "2026-03-05",
      },
    ],
    ...overrides,
  };
}

function renderPage(initialEntry = "/stats") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("StatsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads catalog stats by default and switches to reading stats when the tab changes", async () => {
    apiMocks.fetchCatalogStats.mockResolvedValue({
      totals: {
        total: 10,
        physical: 6,
        digital: 4,
      },
      author_sex_distribution: [
        { key: "male", label: "Hombre", count: 5, percentage: 50 },
        { key: "female", label: "Mujer", count: 3, percentage: 30 },
        { key: "non_binary", label: "No binario", count: 1, percentage: 10 },
        { key: "unknown", label: "Sin dato", count: 1, percentage: 10 },
      ],
      author_country_distribution: [{ key: "Espana", label: "Espana", count: 4, percentage: 40 }],
      genre_distribution: [{ key: "Sci-Fi", label: "Sci-Fi", count: 6, percentage: 60 }],
      theme_distribution: [{ key: "Sci-Fi", label: "Sci-Fi", count: 6, percentage: 60 }],
      publisher_distribution: [{ key: "Minotauro", label: "Minotauro", count: 4, percentage: 40 }],
      publication_year_distribution: [{ key: "2024", label: "2024", count: 2, percentage: 20 }],
      top_authors: [{ label: "Frank Herbert", count: 2 }],
      top_genres: [{ label: "Sci-Fi", count: 6 }],
      top_themes: [{ label: "Sci-Fi", count: 6 }],
    });
    apiMocks.fetchReadingStats.mockResolvedValue(buildReadingStats());

    renderPage();

    await waitFor(() => {
      expect(apiMocks.fetchCatalogStats).toHaveBeenCalledWith("token", { libraryId: undefined });
    });

    await screen.findByText("Total de ejemplares");
    expect(screen.getByRole("button", { name: "Estadisticas del catalogo" })).toHaveClass("active");
    expect(screen.getByText("Frank Herbert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Estadisticas de lectura" }));

    await waitFor(() => {
      expect(apiMocks.fetchReadingStats).toHaveBeenCalledWith("token", { libraryId: undefined });
    });

    await screen.findByText("Meta de lectura 2026");
    expect(screen.getByText("Libros atascados")).toBeInTheDocument();
    expect(screen.getByText("Dune")).toBeInTheDocument();
  });

  it("re-fetches the active stats view when the selected library changes", async () => {
    apiMocks.fetchCatalogStats.mockResolvedValue({
      totals: {
        total: 4,
        physical: 2,
        digital: 2,
      },
      author_sex_distribution: [
        { key: "male", label: "Hombre", count: 2, percentage: 50 },
        { key: "female", label: "Mujer", count: 2, percentage: 50 },
        { key: "non_binary", label: "No binario", count: 0, percentage: 0 },
        { key: "unknown", label: "Sin dato", count: 0, percentage: 0 },
      ],
      author_country_distribution: [{ key: "Chile", label: "Chile", count: 2, percentage: 50 }],
      genre_distribution: [{ key: "Drama", label: "Drama", count: 2, percentage: 50 }],
      theme_distribution: [{ key: "Drama", label: "Drama", count: 2, percentage: 50 }],
      publisher_distribution: [{ key: "Planeta", label: "Planeta", count: 2, percentage: 50 }],
      publication_year_distribution: [{ key: "2020", label: "2020", count: 2, percentage: 50 }],
      top_authors: [{ label: "Isabel Allende", count: 2 }],
      top_genres: [{ label: "Drama", count: 2 }],
      top_themes: [{ label: "Drama", count: 2 }],
    });
    apiMocks.fetchReadingStats.mockResolvedValue(
      buildReadingStats({
        goal: { year: 2026, target_books: 12 },
        goal_progress: { target: 12, completed: 2, percentage: 16.67 },
        finished_by_year: [],
        rating_summary: {
          average: null,
          total_rated: 0,
          distribution: [
            { rating: 1, count: 0, percentage: 0 },
            { rating: 2, count: 0, percentage: 0 },
            { rating: 3, count: 0, percentage: 0 },
            { rating: 4, count: 0, percentage: 0 },
            { rating: 5, count: 0, percentage: 0 },
          ],
        },
        reading_activity: {
          started: 0,
          finished: 0,
          missing_dates: 4,
        },
        recent_finishes: [],
        stuck_reminders: [],
      }),
    );

    renderPage("/stats?tab=reading&library=all");

    await waitFor(() => {
      expect(apiMocks.fetchReadingStats).toHaveBeenCalledWith("token", { libraryId: undefined });
    });

    fireEvent.change(screen.getByLabelText("Biblioteca"), {
      target: { value: "2" },
    });

    await waitFor(() => {
      expect(apiMocks.fetchReadingStats).toHaveBeenCalledWith("token", { libraryId: 2 });
    });
  });

  it("saves the annual reading goal and refreshes reading stats", async () => {
    apiMocks.fetchCatalogStats.mockResolvedValue({
      totals: {
        total: 0,
        physical: 0,
        digital: 0,
      },
      author_sex_distribution: [],
      author_country_distribution: [],
      genre_distribution: [],
      theme_distribution: [],
      publisher_distribution: [],
      publication_year_distribution: [],
      top_authors: [],
      top_genres: [],
      top_themes: [],
    });
    apiMocks.fetchReadingStats
      .mockResolvedValueOnce(
        buildReadingStats({
          goal: { year: 2026, target_books: 12 },
          goal_progress: { target: 12, completed: 2, percentage: 16.67 },
        }),
      )
      .mockResolvedValueOnce(
        buildReadingStats({
          goal: { year: 2026, target_books: 24 },
          goal_progress: { target: 24, completed: 2, percentage: 8.33 },
        }),
      );
    apiMocks.updateReadingGoal.mockResolvedValue({
      year: 2026,
      target_books: 24,
    });

    renderPage("/stats?tab=reading&library=all");

    await screen.findByText("Meta de lectura 2026");
    fireEvent.change(screen.getByLabelText("Libros objetivo en 2026"), {
      target: { value: "24" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar meta" }));

    await waitFor(() => {
      expect(apiMocks.updateReadingGoal).toHaveBeenCalledWith("token", {
        year: 2026,
        target_books: 24,
      });
    });

    await waitFor(() => {
      expect(apiMocks.fetchReadingStats).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("24")).toBeInTheDocument();
    });
  });
});
