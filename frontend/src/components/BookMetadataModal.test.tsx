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

import { BookMetadataModal } from "./BookMetadataModal";
import type { BookMetadata, Library } from "../lib/api";

const library: Library = {
  id: 1,
  name: "Biblioteca compartida",
  type: "shared",
  created_at: "2026-04-19T00:00:00Z",
  role: "owner",
  is_archived: false,
  archived_at: null,
  member_count: 3,
  copy_count: 12,
};

const book: BookMetadata = {
  id: 5,
  title: "Dune",
  isbn: "123",
  publication_year: 1965,
  description: "Arrakis",
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
};

function renderModal(themeOptions = ["Ciencia ficcion", "Fantasia"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <BookMetadataModal
        book={book}
        isOpen={true}
        isSaving={false}
        library={library}
        themeOptions={themeOptions}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        token="token"
      />
    </QueryClientProvider>,
  );
}

describe("BookMetadataModal", () => {
  beforeEach(() => {
    apiMocks.fetchOpenLibraryBook.mockReset();
  });

  it("shows the library, isbn search, and theme dropdowns in edit mode", () => {
    renderModal();

    expect(screen.getByText("Biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Biblioteca compartida")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar en Open Library" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tema 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Tema 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Tema 3")).toBeInTheDocument();
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

    renderModal();

    fireEvent.change(screen.getByLabelText("ISBN"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Titulo"), {
      target: { value: "Del amor y otros demonios" },
    });
    fireEvent.change(screen.getByLabelText("Editorial"), {
      target: { value: "De Bolsillo" },
    });
    fireEvent.change(screen.getByLabelText("Nombre del autor"), {
      target: { value: "Gabriel" },
    });
    fireEvent.change(screen.getByLabelText("Apellido del autor"), {
      target: { value: "Garcia Marquez" },
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
