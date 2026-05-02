import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ReadingPage } from "./ReadingPage";

const apiMocks = vi.hoisted(() => ({
  fetchReadingShelf: vi.fn(),
  updateUserCopyDataRequest: vi.fn(),
}));

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
  }),
}));

vi.mock("../lib/api", () => ({
  fetchReadingShelf: apiMocks.fetchReadingShelf,
  updateUserCopyDataRequest: apiMocks.updateUserCopyDataRequest,
}));

function buildShelf() {
  return [
    {
      copy_id: 11,
      book_id: 3,
      library_id: 1,
      title: "Dune",
      authors: ["Frank Herbert"],
      cover_url: null,
      genre: "narrativo",
      collection: "Cronicas de Arrakis",
      author_country: "Estados Unidos",
      reading_status: "reading",
      rating: 4,
      start_date: "2026-04-01",
      end_date: null,
      personal_notes: "Capitulos iniciales",
    },
    {
      copy_id: 12,
      book_id: 4,
      library_id: 2,
      title: "Kindred",
      authors: ["Octavia Butler"],
      cover_url: null,
      genre: "narrativo",
      collection: null,
      author_country: "Estados Unidos",
      reading_status: "pending",
      rating: null,
      start_date: null,
      end_date: null,
      personal_notes: null,
    },
    {
      copy_id: 13,
      book_id: 5,
      library_id: 1,
      title: "Ficciones",
      authors: ["Jorge Luis Borges"],
      cover_url: null,
      genre: "narrativo",
      collection: null,
      author_country: "Argentina",
      reading_status: "finished",
      rating: 5,
      start_date: "2026-03-01",
      end_date: "2026-03-15",
      personal_notes: "Relectura potente",
    },
  ];
}

function renderPage(initialEntry = "/lectura?tab=reading&library=all") {
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
          <Route path="/lectura" element={<ReadingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ReadingPage", () => {
  it("loads the reading shelf, separates tabs, and avoids catalog-only actions", async () => {
    apiMocks.fetchReadingShelf.mockResolvedValue(buildShelf());

    renderPage();

    await waitFor(() => {
      expect(apiMocks.fetchReadingShelf).toHaveBeenCalledWith("token", { libraryId: undefined });
    });

    await screen.findByText("Dune");
    expect(screen.getByText("Lectura")).toBeInTheDocument();
    expect(screen.queryByText("Importar CSV")).not.toBeInTheDocument();
    expect(screen.queryByText("Meta de lectura 2026")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pendiente" }));

    await screen.findByText("Kindred");
    expect(screen.queryByText("Dune")).not.toBeInTheDocument();
  });

  it("filters by library and saves reading changes from the main reading workflow", async () => {
    apiMocks.fetchReadingShelf.mockResolvedValue(buildShelf());
    apiMocks.updateUserCopyDataRequest.mockResolvedValue({
      copy_id: 11,
      reading_status: "finished",
      rating: 5,
      start_date: "2026-04-01",
      end_date: "2026-04-25",
      personal_notes: "Terminado",
    });

    renderPage();

    await screen.findByText("Dune");

    fireEvent.change(screen.getByLabelText("Biblioteca"), {
      target: { value: "1" },
    });

    await waitFor(() => {
      expect(apiMocks.fetchReadingShelf).toHaveBeenLastCalledWith("token", { libraryId: 1 });
    });

    await screen.findByText("Dune");
    fireEvent.click(screen.getByRole("button", { name: "Gestionar lectura" }));
    fireEvent.change(screen.getByLabelText("Estado de lectura"), {
      target: { value: "finished" },
    });
    fireEvent.change(screen.getByLabelText("Fecha de fin"), {
      target: { value: "2026-04-25" },
    });
    fireEvent.change(screen.getByLabelText("Notas personales"), {
      target: { value: "Terminado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar lectura" }));

    await waitFor(() => {
      expect(apiMocks.updateUserCopyDataRequest).toHaveBeenCalledWith("token", 11, {
        reading_status: "finished",
        end_date: "2026-04-25",
        personal_notes: "Terminado",
      });
    });
  });
});
