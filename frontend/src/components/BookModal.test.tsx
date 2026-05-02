import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  fetchOpenLibraryBook: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    fetchOpenLibraryBook: apiMocks.fetchOpenLibraryBook,
  };
});

import { BookModal } from "./BookModal";
import type { Book, Library } from "../lib/api";

const libraries: Library[] = [
  {
    id: 1,
    name: "Biblioteca personal",
    type: "personal",
    created_at: "2026-04-19T00:00:00Z",
    role: "owner",
    is_archived: false,
    archived_at: null,
    member_count: 1,
    copy_count: 1,
  },
];

const book: Book = {
  id: 10,
  book_id: 2,
  library_id: 1,
  title: "Dune",
  isbn: "123",
  publication_year: 1965,
  description: null,
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
  reading_status: "reading",
  user_rating: 5,
};

function renderModal(mode: "create" | "edit", themeOptions = ["Ciencia ficcion", "Fantasia"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const onSubmit = vi.fn().mockResolvedValue(undefined);

  render(
    <QueryClientProvider client={queryClient}>
      <BookModal
        book={mode === "edit" ? book : null}
        defaultLibraryId={1}
        themeOptions={themeOptions}
        isOpen={true}
        isSaving={false}
        libraries={libraries}
        mode={mode}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        token="token"
      />
    </QueryClientProvider>,
  );

  return { onSubmit };
}

describe("BookModal", () => {
  beforeEach(() => {
    apiMocks.fetchOpenLibraryBook.mockReset();
  });

  it("shows inline validation when required fields are empty in create mode", async () => {
    const { onSubmit } = renderModal("create");
    const librarySelect = screen.getByLabelText("Biblioteca destino") as HTMLSelectElement;

    expect(librarySelect).toBeInTheDocument();
    expect(librarySelect.value).toBe("1");
    expect(screen.getByText("Estado inicial")).toBeInTheDocument();
    expect(screen.getByText("Rating")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Guardar libro" }));

    await waitFor(() => {
      expect(screen.getByText("El titulo es obligatorio.")).toBeInTheDocument();
    });
    expect(screen.getByText("El autor es obligatorio.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("hides personal fields in edit mode", () => {
    renderModal("edit");

    expect(screen.queryByText("Estado inicial")).not.toBeInTheDocument();
    expect(screen.queryByText("Rating")).not.toBeInTheDocument();
    expect(screen.getByText("Biblioteca")).toBeInTheDocument();
  });

  it("includes publisher in submitted values", async () => {
    const { onSubmit } = renderModal("create");

    fireEvent.change(screen.getByLabelText("Titulo"), { target: { value: "Neuromante" } });
    fireEvent.change(screen.getByLabelText("Nombre del autor"), { target: { value: "William" } });
    fireEvent.change(screen.getByLabelText("Apellido del autor"), { target: { value: "Gibson" } });
    fireEvent.change(screen.getByLabelText("Editorial"), { target: { value: "Minotauro" } });

    fireEvent.click(screen.getByRole("button", { name: "Guardar libro" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          publisherName: "Minotauro",
        }),
      );
    });
  });

  it("limits theme selection to three options", async () => {
    const { onSubmit } = renderModal("create", [
      "Ciencia ficcion",
      "Fantasia",
      "Suspense",
      "Terror",
    ]);

    fireEvent.change(screen.getByLabelText("Titulo"), { target: { value: "Neuromante" } });
    fireEvent.change(screen.getByLabelText("Nombre del autor"), { target: { value: "William" } });
    fireEvent.change(screen.getByLabelText("Apellido del autor"), { target: { value: "Gibson" } });

    fireEvent.click(screen.getByRole("button", { name: "Ciencia ficcion" }));
    fireEvent.click(screen.getByRole("button", { name: "Fantasia" }));
    fireEvent.click(screen.getByRole("button", { name: "Suspense" }));
    expect(screen.getByRole("button", { name: "Terror" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Guardar libro" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          themes: ["Ciencia ficcion", "Fantasia", "Suspense"],
        }),
      );
    });
  });

  it("searches Open Library with title, author, and publisher when ISBN is empty", async () => {
    apiMocks.fetchOpenLibraryBook.mockResolvedValue({
      title: "Del amor y otros demonios",
      authors: ["Gabriel Garcia Marquez"],
      primary_author: {
        first_name: "Gabriel",
        last_name: "Garcia Marquez",
        display_name: "Gabriel Garcia Marquez",
      },
      publication_year: 1994,
      isbn: "9780307474721",
      themes: ["Literatura"],
      cover_url: "https://example.com/cover.jpg",
      publisher_name: "De Bolsillo",
    });

    renderModal("create");

    fireEvent.change(screen.getByLabelText("Titulo"), {
      target: { value: "Del amor y otros demonios" },
    });
    fireEvent.change(screen.getByLabelText("Nombre del autor"), {
      target: { value: "Gabriel" },
    });
    fireEvent.change(screen.getByLabelText("Apellido del autor"), {
      target: { value: "Garcia Marquez" },
    });
    fireEvent.change(screen.getByLabelText("Editorial"), {
      target: { value: "De Bolsillo" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Buscar en Open Library" }));

    await waitFor(() => {
      expect(apiMocks.fetchOpenLibraryBook).toHaveBeenCalledWith("token", {
        title: "Del amor y otros demonios",
        author: "Gabriel Garcia Marquez",
        publisher: "De Bolsillo",
      });
    });
  });
});
