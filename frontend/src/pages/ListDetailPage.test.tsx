import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ListDetailPage } from "./ListDetailPage";

const apiMocks = vi.hoisted(() => ({
  fetchLists: vi.fn(),
  fetchListBooks: vi.fn(),
  removeBookFromListRequest: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: "token",
  }),
}));

vi.mock("../lib/api", () => ({
  fetchLists: apiMocks.fetchLists,
  fetchListBooks: apiMocks.fetchListBooks,
  removeBookFromListRequest: apiMocks.removeBookFromListRequest,
}));

function renderPage(initialEntry = "/listas/7") {
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
          <Route path="/listas/:id" element={<ListDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ListDetailPage", () => {
  it("loads the list detail and supports client-side sorting", async () => {
    apiMocks.fetchLists.mockResolvedValue([
      {
        id: 7,
        user_id: 1,
        name: "Favoritos",
        type: "wishlist",
        created_at: "2026-04-19T00:00:00Z",
        updated_at: "2026-04-19T00:00:00Z",
        book_count: 2,
      },
    ]);
    apiMocks.fetchListBooks.mockResolvedValue([
      {
        book_id: 12,
        title: "Zeta",
        authors: ["Bruno Diaz"],
        genre: "narrativo",
        themes: ["Fantasia"],
        collection: "Saga 2",
        author_country: "Espana",
        cover_url: null,
        publication_year: 2001,
        isbn: null,
        added_at: "2026-04-20T00:00:00Z",
      },
      {
        book_id: 9,
        title: "Alpha",
        authors: ["Ana Perez"],
        genre: "narrativo",
        themes: ["Sci-Fi"],
        collection: "Saga 1",
        author_country: "Argentina",
        cover_url: null,
        publication_year: 2010,
        isbn: null,
        added_at: "2026-04-18T00:00:00Z",
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Favoritos" })).toBeInTheDocument();
    });

    expect(screen.getAllByRole("heading", { level: 3 }).map((item) => item.textContent)).toEqual([
      "Zeta",
      "Alpha",
    ]);

    fireEvent.change(screen.getByRole("combobox", { name: "Ordenar por" }), {
      target: { value: "title" },
    });

    expect(screen.getAllByRole("heading", { level: 3 }).map((item) => item.textContent)).toEqual([
      "Alpha",
      "Zeta",
    ]);
  });

  it("removes a book from the list and refreshes the count", async () => {
    apiMocks.fetchLists
      .mockResolvedValueOnce([
        {
          id: 7,
          user_id: 1,
          name: "Favoritos",
          type: "wishlist",
          created_at: "2026-04-19T00:00:00Z",
          updated_at: "2026-04-19T00:00:00Z",
          book_count: 2,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 7,
          user_id: 1,
          name: "Favoritos",
          type: "wishlist",
          created_at: "2026-04-19T00:00:00Z",
          updated_at: "2026-04-19T00:00:00Z",
          book_count: 1,
        },
      ]);
    apiMocks.fetchListBooks
      .mockResolvedValueOnce([
        {
          book_id: 12,
          title: "Zeta",
          authors: ["Bruno Diaz"],
          genre: "narrativo",
          themes: ["Fantasia"],
          collection: "Saga 2",
          author_country: "Espana",
          cover_url: null,
          publication_year: 2001,
          isbn: null,
          added_at: "2026-04-20T00:00:00Z",
        },
        {
          book_id: 9,
          title: "Alpha",
          authors: ["Ana Perez"],
          genre: "narrativo",
          themes: ["Sci-Fi"],
          collection: "Saga 1",
          author_country: "Argentina",
          cover_url: null,
          publication_year: 2010,
          isbn: null,
          added_at: "2026-04-18T00:00:00Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          book_id: 9,
          title: "Alpha",
          authors: ["Ana Perez"],
          genre: "narrativo",
          themes: ["Sci-Fi"],
          collection: "Saga 1",
          author_country: "Argentina",
          cover_url: null,
          publication_year: 2010,
          isbn: null,
          added_at: "2026-04-18T00:00:00Z",
        },
      ]);
    apiMocks.removeBookFromListRequest.mockResolvedValue(undefined);

    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("2 libros guardados en esta lista personal.")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Quitar de la lista" })[0]);

    await waitFor(() => {
      expect(apiMocks.removeBookFromListRequest).toHaveBeenCalledWith("token", 7, 12);
    });

    await waitFor(() => {
      expect(screen.queryByText("Zeta")).not.toBeInTheDocument();
    });

    expect(screen.getByText("1 libro guardado en esta lista personal.")).toBeInTheDocument();
    confirmMock.mockRestore();
  });

  it("shows an unavailable state when the list is not in the accessible list set", async () => {
    apiMocks.fetchLists.mockResolvedValue([]);
    apiMocks.fetchListBooks.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "La lista ya no esta disponible." })).toBeInTheDocument();
    });
  });
});
