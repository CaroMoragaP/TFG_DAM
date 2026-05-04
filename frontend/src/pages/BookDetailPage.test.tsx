import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { BookDetailPage } from "./BookDetailPage";

const apiMocks = vi.hoisted(() => ({
  fetchCopyById: vi.fn(),
  fetchThemes: vi.fn(),
  fetchUserCopyData: vi.fn(),
  updateUserCopyDataRequest: vi.fn(),
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
  ApiError: class ApiError extends Error {},
  fetchCopyById: apiMocks.fetchCopyById,
  fetchThemes: apiMocks.fetchThemes,
  fetchUserCopyData: apiMocks.fetchUserCopyData,
  updateUserCopyDataRequest: apiMocks.updateUserCopyDataRequest,
  updateCopyRequest: apiMocks.updateCopyRequest,
  updateBookMetadataRequest: apiMocks.updateBookMetadataRequest,
  deleteCopyRequest: apiMocks.deleteCopyRequest,
}));

describe("BookDetailPage", () => {
  it("loads copy detail and saves personal updates", async () => {
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
    apiMocks.updateUserCopyDataRequest.mockResolvedValue({
      copy_id: 7,
      reading_status: "finished",
      rating: 5,
      start_date: "2026-04-01",
      end_date: "2026-04-25",
      personal_notes: "Notas finales",
    });
    apiMocks.updateCopyRequest.mockResolvedValue({});
    apiMocks.updateBookMetadataRequest.mockResolvedValue({});
    apiMocks.deleteCopyRequest.mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/libros/7"]}>
          <Routes>
            <Route path="/libros/:id" element={<BookDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Dune")).toBeInTheDocument();
    });
    expect(screen.getByText("Cronicas de Arrakis")).toBeInTheDocument();
    expect(screen.getByText("Estados Unidos")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "finished" },
    });

    await waitFor(() => {
      expect(apiMocks.updateUserCopyDataRequest).toHaveBeenCalledWith("token", 7, {
        reading_status: "finished",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Notas finales" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(apiMocks.updateUserCopyDataRequest).toHaveBeenCalledWith("token", 7, {
        personal_notes: "Notas finales",
      });
    });
  });

  it("marks the book as finished when saving an end date from the detail page", async () => {
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
    apiMocks.updateUserCopyDataRequest.mockResolvedValue({
      copy_id: 7,
      reading_status: "finished",
      rating: null,
      start_date: null,
      end_date: "2026-04-25",
      personal_notes: null,
    });
    apiMocks.updateCopyRequest.mockResolvedValue({});
    apiMocks.updateBookMetadataRequest.mockResolvedValue({});
    apiMocks.deleteCopyRequest.mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/libros/7"]}>
          <Routes>
            <Route path="/libros/:id" element={<BookDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Dune")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Fin"), {
      target: { value: "2026-04-25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar fechas" }));

    await waitFor(() => {
      expect(apiMocks.updateUserCopyDataRequest).toHaveBeenCalledWith("token", 7, {
        start_date: null,
        end_date: "2026-04-25",
        reading_status: "finished",
      });
    });
  });

  it("marks the book as reading when saving a start date from the detail page", async () => {
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
    apiMocks.updateUserCopyDataRequest.mockResolvedValue({
      copy_id: 7,
      reading_status: "reading",
      rating: null,
      start_date: "2026-04-20",
      end_date: null,
      personal_notes: null,
    });
    apiMocks.updateCopyRequest.mockResolvedValue({});
    apiMocks.updateBookMetadataRequest.mockResolvedValue({});
    apiMocks.deleteCopyRequest.mockResolvedValue(undefined);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/libros/7"]}>
          <Routes>
            <Route path="/libros/:id" element={<BookDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Dune")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Inicio"), {
      target: { value: "2026-04-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar fechas" }));

    await waitFor(() => {
      expect(apiMocks.updateUserCopyDataRequest).toHaveBeenCalledWith("token", 7, {
        start_date: "2026-04-20",
        end_date: null,
        reading_status: "reading",
      });
    });
  });
});
