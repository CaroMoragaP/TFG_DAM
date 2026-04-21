import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import { LibraryManagerModal } from "../components/LibraryManagerModal";
import { useActiveLibrary } from "../libraries/ActiveLibraryProvider";
import {
  createLibraryRequest,
  updateLibraryRequest,
  type LibraryCreatePayload,
  type LibraryUpdatePayload,
} from "../lib/api";

const navigationItems = [
  { to: "/catalogo", label: "Catalogo" },
  { to: "/listas", label: "Mis listas" },
  { to: "/leyendo", label: "Leyendo" },
  { to: "/leidos", label: "Leidos" },
  { to: "/pendiente", label: "Pendiente" },
  { to: "/resenas", label: "Resenas" },
  { to: "/stats", label: "Stats" },
];

export function PrivateLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token, user, logout } = useAuth();
  const {
    activeLibraryId,
    libraries,
    refreshLibraries,
    setActiveLibraryId,
  } = useActiveLibrary();
  const [isLibraryManagerOpen, setIsLibraryManagerOpen] = useState(false);

  const createLibraryMutation = useMutation({
    mutationFn: (payload: LibraryCreatePayload) =>
      createLibraryRequest(token ?? "", payload),
    onSuccess: async (library) => {
      await queryClient.invalidateQueries({ queryKey: ["libraries"] });
      setActiveLibraryId(library.id);
      await refreshLibraries();
    },
  });

  const renameLibraryMutation = useMutation({
    mutationFn: ({
      libraryId,
      payload,
    }: {
      libraryId: number;
      payload: LibraryUpdatePayload;
    }) => updateLibraryRequest(token ?? "", libraryId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["libraries"] });
      await refreshLibraries();
    },
  });

  function handleLogout() {
    logout();
    navigate("/auth", { replace: true });
  }

  return (
    <div className="private-shell">
      <header className="private-header">
        <NavLink className="brand-mark" to="/catalogo">
          <span className="brand-icon">BP</span>
          <span>
            <strong>Biblioteca Personal</strong>
            <small>Zona privada</small>
          </span>
        </NavLink>

        <details className="user-menu">
          <summary className="user-summary">
            <span className="avatar-badge">
              {user?.name?.slice(0, 1).toUpperCase() ?? "U"}
            </span>
            <span className="user-summary-copy">
              <strong>{user?.name ?? "Usuario"}</strong>
              <small>{user?.email ?? "Sin email"}</small>
            </span>
          </summary>

          <div className="menu-card">
            <p className="eyebrow">Cuenta activa</p>
            <h3>{user?.name}</h3>
            <p>{user?.email}</p>
            <label className="field-group compact-field">
              Biblioteca activa
              <select
                value={activeLibraryId ?? ""}
                onChange={(event) => setActiveLibraryId(Number(event.target.value))}
              >
                {libraries.map((library) => (
                  <option key={library.id} value={library.id}>
                    {library.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="ghost-link compact-action menu-inline-button"
              type="button"
              onClick={() => setIsLibraryManagerOpen(true)}
            >
              Gestionar mis bibliotecas
            </button>
            <button className="menu-button" type="button" onClick={handleLogout}>
              Cerrar sesion
            </button>
          </div>
        </details>
      </header>

      <div className="private-body">
        <aside className="private-sidebar">
          <div className="sidebar-card">
            <p className="eyebrow">Navegacion</p>
            <nav className="sidebar-nav" aria-label="Secciones privadas">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <main className="private-content">
          <Outlet />
        </main>
      </div>

      <LibraryManagerModal
        activeLibraryId={activeLibraryId}
        isOpen={isLibraryManagerOpen}
        isSaving={createLibraryMutation.isPending || renameLibraryMutation.isPending}
        libraries={libraries}
        onClose={() => setIsLibraryManagerOpen(false)}
        onCreate={async (payload) => {
          await createLibraryMutation.mutateAsync(payload);
        }}
        onRename={async (libraryId, payload) => {
          await renameLibraryMutation.mutateAsync({ libraryId, payload });
        }}
        onSelectActive={(libraryId) => setActiveLibraryId(libraryId)}
      />
    </div>
  );
}
