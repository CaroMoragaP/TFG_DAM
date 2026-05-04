import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookDetailPage } from "./BookDetailPage";

const apiMocks = vi.hoisted(() => ({
  fetchCopyById: vi.fn(),
  fetchCopyCommunity: vi.fn(),
  fetchThemes: vi.fn(),
  fetchUserCopyData: vi.fn(),
  updateCopyRequest: vi.fn(),
  updateBookMetadataRequest: vi.fn(),
  deleteCopyRequest: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: "token",
  }),
}));

vi.mock("../libraries/ActiveLibraryProvider", () => ({
  useActiveLibrary: () => ({
    libraries: [
      {
        id: 1,
        name: "Biblioteca compartida",
        type: "shared",
        created_at: "2026-04-19T00:00:00Z",
        role: "owner",
        is_archived: false,
        archived_at: null,
        member_count: 1,
        copy_count: 1,
      },
    ],
  }),
}));

vi.mock("../lib/api", () => ({
  fetchCopyById: apiMocks.fetchCopyById,
  fetchCopyCommunity: apiMocks.fetchCopyCommunity,
  fetchThemes: apiMocks.fetchThemes,
  fetchUserCopyData: apiMocks.fetchUserCopyData,
  updateCopyRequest: apiMocks.updateCopyRequest,
  updateBookMetadataRequest: apiMocks.updateBookMetadataRequest,
  deleteCopyRequest: apiMocks.deleteCopyRequest,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/libros/7"]}>
        <Routes>
          <Route path="/libros/:id" element={<BookDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BookDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a compact reading summary and shared community block", async () => {
    apiMocks.fetchCopyById.mockResolvedValue({
      id: 7,
      book_id: 3,
      library_id: 1,
      title: "Dune",
      isbn: "123",
      publication_year: 1965,
      description: "Arrakis.",
      cover_url: null,
      publisher: null,
      collection: "Cronicas de Arrakis",
      author_country: "Estados Unidos",
      author_sex: "male",
      primary_author: {
        first_name: "Frank",
        last_name: "Herbert",
        display_name: "Frank Herbert",
      },
      authors: ["Frank Herbert"],
      genre: "narrativo",
      themes: ["Ciencia ficcion"],
      format: "physical",
      physical_location: null,
      digital_location: null,
      status: "available",
      active_loan: null,
      shared_readers_preview: [],
      shared_readers_count: 0,
      public_review_count: 2,
      public_average_rating: 4.5,
    });
    apiMocks.fetchThemes.mockResolvedValue(["Ciencia ficcion", "Fantasia"]);
    apiMocks.fetchUserCopyData.mockResolvedValue({
      copy_id: 7,
      reading_status: "reading",
      rating: 4,
      start_date: "2026-04-01",
      end_date: null,
      personal_notes: "Notas iniciales",
    });
    apiMocks.fetchCopyCommunity.mockResolvedValue({
      copy_id: 7,
      active_loan: null,
      shared_readers: [{ user_id: 2, name: "Reader" }],
      shared_readers_count: 1,
      public_review_count: 2,
      public_average_rating: 4.5,
      latest_reviews: [
        {
          id: 1,
          copy_id: 7,
          user_id: 2,
          user_name: "Reader",
          rating: 5,
          body: "Magnifico.",
          created_at: "2026-04-10T00:00:00Z",
          updated_at: "2026-04-10T00:00:00Z",
        },
      ],
    });
    apiMocks.updateCopyRequest.mockResolvedValue({});
    apiMocks.updateBookMetadataRequest.mockResolvedValue({});
    apiMocks.deleteCopyRequest.mockResolvedValue(undefined);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Dune")).toBeInTheDocument();
    });

    expect(screen.getByText("Cronicas de Arrakis")).toBeInTheDocument();
    expect(screen.getByText("Estados Unidos")).toBeInTheDocument();
    expect(screen.getByText("Mi lectura")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir seguimiento" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir muro" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Estado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar fechas" })).not.toBeInTheDocument();
    expect(screen.getByText("Ultimas resenas")).toBeInTheDocument();
    expect(screen.getByText("Ver opiniones")).toBeInTheDocument();
  });
});
