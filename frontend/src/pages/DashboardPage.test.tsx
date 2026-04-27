import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { DashboardPage } from "./DashboardPage";

const apiMocks = vi.hoisted(() => ({
  fetchBooks: vi.fn(),
  fetchGenres: vi.fn(),
  fetchLists: vi.fn(),
  createBookRequest: vi.fn(),
  updateCopyRequest: vi.fn(),
  addBookToListRequest: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: "token",
  }),
}));

vi.mock("../libraries/ActiveLibraryProvider", () => ({
  useActiveLibrary: () => ({
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
        copy_count: 2,
      },
      {
        id: 2,
        name: "Club de lectura",
        type: "shared",
        created_at: "2026-04-19T00:00:00Z",
        role: "editor",
        is_archived: false,
        archived_at: null,
        member_count: 3,
        copy_count: 4,
      },
    ],
  }),
}));

vi.mock("../lib/api", () => ({
  ApiError: class ApiError extends Error {},
  fetchBooks: apiMocks.fetchBooks,
  fetchGenres: apiMocks.fetchGenres,
  fetchLists: apiMocks.fetchLists,
  createBookRequest: apiMocks.createBookRequest,
  updateCopyRequest: apiMocks.updateCopyRequest,
  addBookToListRequest: apiMocks.addBookToListRequest,
  fetchOpenLibraryBook: vi.fn(),
}));

vi.mock("../components/BookModal", () => ({
  BookModal: () => null,
}));

vi.mock("../components/CopyEditModal", () => ({
  CopyEditModal: () => null,
}));

vi.mock("../components/AddToListModal", () => ({
  AddToListModal: () => null,
}));

function renderPage(initialEntry = "/catalogo?listId=2") {
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
          <Route path="/catalogo" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage", () => {
  it("reads listId from the URL, hides the default library panel, and allows clearing the filter", async () => {
    apiMocks.fetchGenres.mockResolvedValue([]);
    apiMocks.fetchLists.mockResolvedValue([
      {
        id: 2,
        user_id: 1,
        name: "Favoritos",
        type: "wishlist",
        created_at: "2026-04-19T00:00:00Z",
        updated_at: "2026-04-19T00:00:00Z",
        book_count: 0,
      },
    ]);
    apiMocks.fetchBooks.mockImplementation(async (_token: string, params: { listId?: number }) => {
      return params.listId ? [] : [
        {
          id: 7,
          book_id: 3,
          library_id: 1,
          title: "Dune",
          isbn: null,
          publication_year: 1965,
          description: null,
          cover_url: null,
          publisher: null,
          collection: "Cronicas de Arrakis",
          author_country: "Estados Unidos",
          authors: ["Frank Herbert"],
          genres: ["Sci-Fi"],
          format: "physical",
          physical_location: null,
          digital_location: null,
          status: "available",
          reading_status: "reading",
          user_rating: 5,
        },
      ];
    });

    renderPage();

    await waitFor(() => {
      expect(apiMocks.fetchBooks).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ listId: 2 }),
      );
    });
    await screen.findByRole("option", { name: "Favoritos" });

    expect(screen.queryByText("Biblioteca por defecto")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Favoritos" })).toBeInTheDocument();
    expect(screen.getByText("La lista seleccionada esta vacia.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtro" }));

    await waitFor(() => {
      expect(apiMocks.fetchBooks).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ listId: undefined }),
      );
    });

    await screen.findByText("Dune");
    expect(screen.getByText("Cronicas de Arrakis")).toBeInTheDocument();
  });
});
