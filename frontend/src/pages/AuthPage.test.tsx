import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthPage } from "./AuthPage";

const authState = vi.hoisted(() => ({
  current: {
    isAuthenticated: false,
    isBootstrapping: false,
    login: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => authState.current,
}));

describe("AuthPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
    authState.current = {
      isAuthenticated: false,
      isBootstrapping: false,
      login: vi.fn(),
      register: vi.fn(),
    };
  });

  it("shows a unified notice when the previous session expired", async () => {
    window.sessionStorage.setItem("library.auth.session-expired", "1");

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthPage defaultTab="login" routeMode="path" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Tu sesión ha expirado. Inicia sesión de nuevo.")).toBeInTheDocument();
  });
});
