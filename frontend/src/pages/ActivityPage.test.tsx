import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActivityPage } from "./ActivityPage";

const apiMocks = vi.hoisted(() => ({
  fetchLibraryActivity: vi.fn(),
  fetchLibraryReviews: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: "token",
  }),
}));

vi.mock("../libraries/ActiveLibraryProvider", () => ({
  useActiveLibrary: () => ({
    activeLibrary: {
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
    activeLibraryId: 2,
  }),
}));

vi.mock("../lib/api", () => ({
  fetchLibraryActivity: apiMocks.fetchLibraryActivity,
  fetchLibraryReviews: apiMocks.fetchLibraryReviews,
}));

function renderPage(initialEntry = "/muro?tab=reviews") {
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
          <Route path="/muro" element={<ActivityPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ActivityPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows review cards separating the user's publication from the community", async () => {
    apiMocks.fetchLibraryReviews.mockResolvedValue({
      items: [
        {
          copy_id: 12,
          book_id: 4,
          title: "Kindred",
          authors: ["Octavia Butler"],
          cover_url: null,
          public_review_count: 2,
          public_average_rating: 4.5,
          last_reviewed_at: "2026-05-01T10:00:00Z",
          my_review: {
            id: 7,
            copy_id: 12,
            user_id: 1,
            user_name: "Ada",
            rating: 4,
            body: "Lo quiero comentar.",
            created_at: "2026-05-01T10:00:00Z",
            updated_at: "2026-05-01T10:00:00Z",
          },
          other_reviews: [
            {
              id: 8,
              copy_id: 12,
              user_id: 2,
              user_name: "Bob",
              rating: 5,
              body: "Impactante.",
              created_at: "2026-05-01T11:00:00Z",
              updated_at: "2026-05-01T11:00:00Z",
            },
          ],
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });

    renderPage();

    await waitFor(() => {
      expect(apiMocks.fetchLibraryReviews).toHaveBeenCalledWith("token", 2, {
        filter: "all",
        sort: "recent",
        limit: 50,
        offset: 0,
      });
    });

    expect(await screen.findByText("Tu publicacion")).toBeInTheDocument();
    expect(screen.getAllByText("Comunidad").length).toBeGreaterThan(0);
    expect(screen.getByText("Lo quiero comentar.")).toBeInTheDocument();
    expect(screen.getByText("Impactante.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Publicar o editar" })).toHaveAttribute(
      "href",
      "/lectura?library=2&copy=12",
    );
  });

  it("renders new activity event labels for book additions and imports", async () => {
    apiMocks.fetchLibraryActivity.mockResolvedValue({
      items: [
        {
          id: 1,
          library_id: 2,
          actor_user_id: 1,
          actor_name: "Ada",
          copy_id: 12,
          review_id: null,
          loan_id: null,
          event_type: "book_added",
          created_at: "2026-05-01T10:00:00Z",
          payload_json: { book_title: "Kindred", copy_id: 12 },
        },
        {
          id: 2,
          library_id: 2,
          actor_user_id: 1,
          actor_name: "Ada",
          copy_id: null,
          review_id: null,
          loan_id: null,
          event_type: "books_imported",
          created_at: "2026-05-02T10:00:00Z",
          payload_json: { imported_count: 18, sample_titles: ["Kindred"] },
        },
      ],
      total: 2,
      limit: 50,
      offset: 0,
    });

    renderPage("/muro?tab=activity");

    expect(await screen.findByText("anadio Kindred")).toBeInTheDocument();
    expect(screen.getByText("anadio 18 libros")).toBeInTheDocument();
  });
});
