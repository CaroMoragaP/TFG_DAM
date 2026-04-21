import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookCard } from "./BookCard";
import type { Book, Library } from "../lib/api";

const book: Book = {
  id: 7,
  book_id: 3,
  library_id: 9,
  title: "Dune",
  isbn: "9780441172719",
  publication_year: 1965,
  description: null,
  cover_url: null,
  publisher: null,
  authors: ["Frank Herbert"],
  genres: ["Sci-Fi"],
  format: "physical",
  physical_location: null,
  digital_location: null,
  status: "available",
  reading_status: "reading",
  user_rating: 5,
};

const library: Library = {
  id: 9,
  name: "Biblioteca personal",
  type: "personal",
  created_at: "2026-04-19T00:00:00Z",
  role: "owner",
};

describe("BookCard", () => {
  it("renders the main catalog information and exposes list and edit actions", () => {
    const onEdit = vi.fn();
    const onAddToList = vi.fn();

    render(
      <BookCard
        book={book}
        library={library}
        showLibraryBadge={true}
        onAddToList={onAddToList}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Frank Herbert")).toBeInTheDocument();
    expect(screen.getByText("5/5")).toBeInTheDocument();
    expect(screen.getByText("Leyendo")).toBeInTheDocument();
    expect(screen.getByText("Biblioteca personal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Anadir a lista" }));
    expect(onAddToList).toHaveBeenCalledWith(book);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(onEdit).toHaveBeenCalledWith(book);
  });
});
