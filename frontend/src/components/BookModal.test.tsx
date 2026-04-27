import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
  authors: ["Frank Herbert"],
  genres: ["Sci-Fi"],
  format: "physical",
  physical_location: null,
  digital_location: null,
  status: "available",
  reading_status: "reading",
  user_rating: 5,
};

function renderModal(mode: "create" | "edit") {
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
        genres={["Sci-Fi", "Fantasia"]}
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
});
