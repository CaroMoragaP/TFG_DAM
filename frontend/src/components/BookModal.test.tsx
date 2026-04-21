import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BookModal } from "./BookModal";
import type { Library } from "../lib/api";

const libraries: Library[] = [
  {
    id: 1,
    name: "Biblioteca personal",
    type: "personal",
    created_at: "2026-04-19T00:00:00Z",
    role: "owner",
  },
  {
    id: 2,
    name: "Club de lectura",
    type: "shared",
    created_at: "2026-04-19T00:00:00Z",
    role: "member",
  },
];

function renderModal() {
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
        book={null}
        defaultLibraryId={1}
        genres={["Sci-Fi", "Fantasia"]}
        isOpen={true}
        isSaving={false}
        libraries={libraries}
        mode="create"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        token="token"
      />
    </QueryClientProvider>,
  );

  return { onSubmit };
}

describe("BookModal", () => {
  it("shows inline validation when required fields are empty", async () => {
    const { onSubmit } = renderModal();

    expect(screen.getByText("Biblioteca destino")).toBeInTheDocument();
    expect(screen.getByText("Biblioteca personal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Guardar libro" }));

    await waitFor(() => {
      expect(screen.getByText("El título es obligatorio.")).toBeInTheDocument();
    });
    expect(screen.getByText("El autor es obligatorio.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
