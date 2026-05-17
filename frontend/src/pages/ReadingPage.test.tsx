import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReadingPage } from "./ReadingPage";

const apiMocks = vi.hoisted(() => ({
  fetchReadingShelf: vi.fn(),
  updateUserCopyDataRequest: vi.fn(),
  createCopyReviewRequest: vi.fn(),
  updateReviewRequest: vi.fn(),
  deleteReviewRequest: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: "token",
  }),
}));

vi.mock("../libraries/useLibraries", () => ({
  useLibraries: () => ({
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
  createCopyReviewRequest: apiMocks.createCopyReviewRequest,
  updateReviewRequest: apiMocks.updateReviewRequest,
  deleteReviewRequest: apiMocks.deleteReviewRequest,
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
      public_review_count: 0,
      public_average_rating: null,
      my_public_review: null,
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
      public_review_count: 2,
      public_average_rating: 4.5,
      my_public_review: null,
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
      public_review_count: 0,
      public_average_rating: null,
      my_public_review: null,
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the reading shelf, separates tabs, and avoids catalog-only actions", async () => {
    apiMocks.fetchReadingShelf.mockResolvedValue(buildShelf());

    renderPage();

    await waitFor(() => {
      expect(apiMocks.fetchReadingShelf).toHaveBeenCalledWith("token", { libraryId: undefined });
    });

    await screen.findByText("Dune");
    expect(screen.getByText("Mi registro de lectura")).toBeInTheDocument();
    expect(screen.queryByText("Importar CSV")).not.toBeInTheDocument();
    expect(screen.queryByText("Meta de lectura 2026")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Buscar lecturas" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pendiente" }));

    await screen.findByText("Kindred");
    expect(screen.queryByText("Dune")).not.toBeInTheDocument();
    expect(screen.queryByText("Planificacion manual")).not.toBeInTheDocument();
  });

  it("filters by library and saves reading changes from the main workflow", async () => {
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

  it("opens the shared item editor from copy query param and publishes from the same reading workflow", async () => {
    apiMocks.fetchReadingShelf.mockResolvedValue(buildShelf());
    apiMocks.updateUserCopyDataRequest.mockResolvedValue({
      copy_id: 12,
      reading_status: "pending",
      rating: 5,
      start_date: null,
      end_date: null,
      personal_notes: null,
    });
    apiMocks.createCopyReviewRequest.mockResolvedValue({
      id: 20,
      copy_id: 12,
      user_id: 1,
      user_name: "Ada",
      rating: 5,
      body: "Quiero comentarlo con el club.",
      created_at: "2026-05-01T10:00:00Z",
      updated_at: "2026-05-01T10:00:00Z",
    });

    renderPage("/lectura?tab=pending&library=2&copy=12");

    await screen.findByText("Kindred");
    await waitFor(() => {
      expect(screen.getByText("Mi valoracion y publicacion")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Valorar Kindred con 5 estrellas" }));
    fireEvent.change(screen.getByLabelText("Comentario publico"), {
      target: { value: "Quiero comentarlo con el club." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar mi valoracion" }));

    await waitFor(() => {
      expect(apiMocks.updateUserCopyDataRequest).toHaveBeenCalledWith("token", 12, {
        rating: 5,
      });
    });

    await waitFor(() => {
      expect(apiMocks.createCopyReviewRequest).toHaveBeenCalledWith("token", 12, {
        body: "Quiero comentarlo con el club.",
      });
    });
  });

  it("keeps the pending tab active when opening a non-pending copy from the query string", async () => {
    apiMocks.fetchReadingShelf.mockResolvedValue(buildShelf());

    renderPage("/lectura?tab=pending&library=1&copy=11");

    await screen.findByText("Dune");
    await waitFor(() => {
      expect(screen.getByText("Mi lectura")).toBeInTheDocument();
    });

    expect(apiMocks.fetchReadingShelf).toHaveBeenCalledWith("token", { libraryId: 1 });
    expect(screen.getByRole("button", { name: "Pendiente" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "Cerrar editor" })).toBeInTheDocument();
  });

  it("filters the shelf with the search box and only shows personal notes when available", async () => {
    apiMocks.fetchReadingShelf.mockResolvedValue(buildShelf());

    renderPage("/lectura?tab=pending&library=all");

    await screen.findByText("Kindred");
    expect(screen.queryByText("Sin notas personales todavia.")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar lecturas" }), {
      target: { value: "Arrakis" },
    });

    await waitFor(() => {
      expect(screen.queryByText("Kindred")).not.toBeInTheDocument();
    });

    expect(screen.getByText("No hay resultados para esa busqueda.")).toBeInTheDocument();
  });

  it("cancels an active reading by moving it back to pending and clearing both dates", async () => {
    apiMocks.fetchReadingShelf.mockResolvedValue(buildShelf());
    apiMocks.updateUserCopyDataRequest.mockResolvedValue({
      copy_id: 11,
      reading_status: "pending",
      rating: 4,
      start_date: null,
      end_date: null,
      personal_notes: "Capitulos iniciales",
    });

    renderPage();

    await screen.findByText("Dune");

    fireEvent.click(screen.getByRole("button", { name: "Gestionar lectura" }));
    fireEvent.change(screen.getByLabelText("Estado de lectura"), {
      target: { value: "pending" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar lectura" }));

    await waitFor(() => {
      expect(apiMocks.updateUserCopyDataRequest).toHaveBeenCalledWith("token", 11, {
        reading_status: "pending",
        start_date: null,
      });
    });
  });

  it("asks for confirmation before reopening a finished book as a reread", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    apiMocks.fetchReadingShelf.mockResolvedValue(buildShelf());
    apiMocks.updateUserCopyDataRequest.mockResolvedValue({
      copy_id: 13,
      reading_status: "reading",
      rating: 5,
      start_date: "2026-05-01",
      end_date: null,
      personal_notes: "Relectura potente",
    });

    renderPage("/lectura?tab=finished&library=all");

    await screen.findByText("Ficciones");

    fireEvent.click(screen.getByRole("button", { name: "Gestionar lectura" }));
    fireEvent.change(screen.getByLabelText("Fecha de inicio"), {
      target: { value: "2026-05-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar lectura" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(apiMocks.updateUserCopyDataRequest).toHaveBeenCalledWith("token", 13, {
        reading_status: "reading",
        start_date: "2026-05-01",
        end_date: null,
      });
    });

    confirmSpy.mockRestore();
  });

  it("asks for confirmation before removing a public review", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const shelf = buildShelf();
    shelf[1] = {
      ...shelf[1],
      rating: 4,
      my_public_review: {
        id: 44,
        copy_id: 12,
        user_id: 1,
        user_name: "Ada",
        rating: 4,
        body: "Muy recomendable.",
        created_at: "2026-05-01T10:00:00Z",
        updated_at: "2026-05-01T10:00:00Z",
      },
    };
    apiMocks.fetchReadingShelf.mockResolvedValue(shelf);
    apiMocks.deleteReviewRequest.mockResolvedValue(undefined);

    renderPage("/lectura?tab=pending&library=2&copy=12");

    await screen.findByText("Kindred");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Retirar publicacion" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Retirar publicacion" }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled();
      expect(apiMocks.deleteReviewRequest).toHaveBeenCalledWith("token", 44);
    });

    confirmSpy.mockRestore();
  });
});
