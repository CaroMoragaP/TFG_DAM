import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListsPage } from "./ListsPage";

const navigateMock = vi.fn();
const apiMocks = vi.hoisted(() => ({
  fetchLists: vi.fn(),
  createListRequest: vi.fn(),
  updateListRequest: vi.fn(),
  deleteListRequest: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: "token",
  }),
}));

vi.mock("../lib/api", () => ({
  fetchLists: apiMocks.fetchLists,
  createListRequest: apiMocks.createListRequest,
  updateListRequest: apiMocks.updateListRequest,
  deleteListRequest: apiMocks.deleteListRequest,
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
      <ListsPage />
    </QueryClientProvider>,
  );
}

describe("ListsPage", () => {
  it("shows list cards only and navigates to the list detail page", async () => {
    apiMocks.fetchLists.mockResolvedValue([
      {
        id: 1,
        user_id: 1,
        name: "Favoritos",
        type: "wishlist",
        created_at: "2026-04-19T00:00:00Z",
        updated_at: "2026-04-19T00:00:00Z",
        book_count: 3,
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Favoritos")).toBeInTheDocument();
    });

    expect(screen.queryByText("Listas globales")).not.toBeInTheDocument();
    expect(screen.queryByText("Lista seleccionada")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Favoritos").closest("article")!);
    expect(navigateMock).toHaveBeenCalledWith("/listas/1");
  });

  it("keeps the catalog shortcut as a secondary action", async () => {
    apiMocks.fetchLists.mockResolvedValue([
      {
        id: 3,
        user_id: 1,
        name: "Sci-Fi",
        type: "custom",
        created_at: "2026-04-19T00:00:00Z",
        updated_at: "2026-04-19T00:00:00Z",
        book_count: 2,
      },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Sci-Fi")).toBeInTheDocument();
    });

    navigateMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Ver en catalogo" }));

    expect(navigateMock).toHaveBeenCalledWith("/catalogo?listId=3");
  });

  it("keeps edit and delete actions from navigating by mistake", async () => {
    apiMocks.fetchLists.mockResolvedValue([
      {
        id: 2,
        user_id: 1,
        name: "Pendientes",
        type: "pending",
        created_at: "2026-04-19T00:00:00Z",
        updated_at: "2026-04-19T00:00:00Z",
        book_count: 5,
      },
    ]);
    apiMocks.deleteListRequest.mockResolvedValue(undefined);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Pendientes")).toBeInTheDocument();
    });

    navigateMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Editar lista" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(apiMocks.deleteListRequest).toHaveBeenCalledWith("token", 2);
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
