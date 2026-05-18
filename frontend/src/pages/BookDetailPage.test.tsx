import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../libraries/useLibraries", () => ({
  useLibraries: () => ({
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

  it("simplifies the detail view and opens a single edit modal", async () => {
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
    expect(screen.getByText("Editorial")).toBeInTheDocument();
    expect(screen.getByText("Estados Unidos")).toBeInTheDocument();
    expect(screen.getByText("Mi lectura")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar" })).toHaveAttribute(
      "href",
      "/lectura?tab=reading&library=1&copy=7",
    );
    expect(screen.queryByText("El trabajo diario vive ahora en")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir seguimiento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir muro" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Estado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar fechas" })).not.toBeInTheDocument();
    expect(screen.getByText("Comunidad")).toBeInTheDocument();
    expect(screen.queryByText("Ver opiniones")).not.toBeInTheDocument();
    expect(screen.queryByText("Ver actividad")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Ejemplar local")).toBeInTheDocument();
    expect(screen.getByText("Ficha canonica")).toBeInTheDocument();
  });

  it("hides empty notes and community sections when there is no content", async () => {
    apiMocks.fetchCopyById.mockResolvedValue({
      id: 7,
      book_id: 3,
      library_id: 1,
      title: "Dune",
      isbn: "123",
      publication_year: 1965,
      description: null,
      cover_url: null,
      publisher: "Ace",
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
      public_review_count: 0,
      public_average_rating: null,
    });
    apiMocks.fetchThemes.mockResolvedValue(["Ciencia ficcion", "Fantasia"]);
    apiMocks.fetchUserCopyData.mockResolvedValue({
      copy_id: 7,
      reading_status: "pending",
      rating: null,
      start_date: null,
      end_date: null,
      personal_notes: null,
    });
    apiMocks.fetchCopyCommunity.mockResolvedValue({
      copy_id: 7,
      active_loan: null,
      shared_readers: [],
      shared_readers_count: 0,
      public_review_count: 0,
      public_average_rating: null,
      latest_reviews: [],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Dune")).toBeInTheDocument();
    });

    expect(screen.queryByText("Notas personales")).not.toBeInTheDocument();
    expect(screen.queryByText("Comunidad")).not.toBeInTheDocument();
    expect(screen.queryByText("No hay ningun prestamo activo para este ejemplar.")).not.toBeInTheDocument();
    expect(screen.queryByText("Nadie lo esta leyendo ahora mismo.")).not.toBeInTheDocument();
    expect(screen.queryByText("Todavia no hay resenas publicas.")).not.toBeInTheDocument();
  });

  it("shows a safe borrower fallback when an internal loan arrives without borrower_name", async () => {
    apiMocks.fetchCopyById.mockResolvedValue({
      id: 7,
      book_id: 3,
      library_id: 1,
      title: "Dune",
      isbn: "123",
      publication_year: 1965,
      description: null,
      cover_url: null,
      publisher: "Ace",
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
      status: "loaned",
      active_loan: {
        id: 19,
        copy_id: 7,
        lender_user_id: 1,
        lender_name: "Owner",
        borrower_user_id: 2,
        borrower_name: null,
        is_internal: true,
        loaned_at: "2026-05-01T10:00:00Z",
        due_date: "2026-05-10",
        returned_at: null,
        notes: null,
      },
      shared_readers_preview: [],
      shared_readers_count: 0,
      public_review_count: 0,
      public_average_rating: null,
    });
    apiMocks.fetchThemes.mockResolvedValue(["Ciencia ficcion"]);
    apiMocks.fetchUserCopyData.mockResolvedValue({
      copy_id: 7,
      reading_status: "pending",
      rating: null,
      start_date: null,
      end_date: null,
      personal_notes: null,
    });
    apiMocks.fetchCopyCommunity.mockResolvedValue({
      copy_id: 7,
      active_loan: {
        id: 19,
        copy_id: 7,
        lender_user_id: 1,
        lender_name: "Owner",
        borrower_user_id: 2,
        borrower_name: null,
        is_internal: true,
        loaned_at: "2026-05-01T10:00:00Z",
        due_date: "2026-05-10",
        returned_at: null,
        notes: null,
      },
      shared_readers: [],
      shared_readers_count: 0,
      public_review_count: 0,
      public_average_rating: null,
      latest_reviews: [],
    });

    renderPage();

    expect(await screen.findByText("Prestamo activo")).toBeInTheDocument();
    expect(screen.getByText(/Prestado a Miembro de la biblioteca/)).toBeInTheDocument();
  });
});
