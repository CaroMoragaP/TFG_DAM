import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LibrariesPage } from "./LibrariesPage";

const apiMocks = vi.hoisted(() => ({
  fetchLibraries: vi.fn(),
  fetchLibraryMembers: vi.fn(),
  createLibraryRequest: vi.fn(),
  updateLibraryRequest: vi.fn(),
  deleteLibraryRequest: vi.fn(),
  addLibraryMemberRequest: vi.fn(),
  updateLibraryMemberRequest: vi.fn(),
  removeLibraryMemberRequest: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: "token",
  }),
}));

vi.mock("../lib/api", () => ({
  fetchLibraries: apiMocks.fetchLibraries,
  fetchLibraryMembers: apiMocks.fetchLibraryMembers,
  createLibraryRequest: apiMocks.createLibraryRequest,
  updateLibraryRequest: apiMocks.updateLibraryRequest,
  deleteLibraryRequest: apiMocks.deleteLibraryRequest,
  addLibraryMemberRequest: apiMocks.addLibraryMemberRequest,
  updateLibraryMemberRequest: apiMocks.updateLibraryMemberRequest,
  removeLibraryMemberRequest: apiMocks.removeLibraryMemberRequest,
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
      <LibrariesPage />
    </QueryClientProvider>,
  );
}

describe("LibrariesPage", () => {
  it("lists the user libraries and edits one from its modal", async () => {
    apiMocks.fetchLibraries.mockResolvedValue([
      {
        id: 1,
        name: "Casa",
        type: "personal",
        created_at: "2026-04-19T00:00:00Z",
        role: "owner",
        is_archived: false,
        archived_at: null,
        member_count: 1,
        copy_count: 8,
      },
      {
        id: 2,
        name: "Club lector",
        type: "shared",
        created_at: "2026-04-19T00:00:00Z",
        role: "owner",
        is_archived: false,
        archived_at: null,
        member_count: 3,
        copy_count: 12,
      },
    ]);
    apiMocks.fetchLibraryMembers.mockResolvedValue([
      {
        user_id: 7,
        name: "Ana",
        email: "ana@example.com",
        role: "owner",
      },
    ]);
    apiMocks.updateLibraryRequest.mockResolvedValue({
      id: 2,
      name: "Club renovado",
      type: "shared",
      created_at: "2026-04-19T00:00:00Z",
      role: "owner",
      is_archived: false,
      archived_at: null,
      member_count: 3,
      copy_count: 12,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText("Casa").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Club lector").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Biblioteca seleccionada para editar.")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[1]);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Club lector")).toBeInTheDocument();
      expect(apiMocks.fetchLibraryMembers).toHaveBeenCalledWith("token", 2);
    });

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Club renovado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(apiMocks.updateLibraryRequest).toHaveBeenCalledWith("token", 2, {
        name: "Club renovado",
      });
    });
  });
});
