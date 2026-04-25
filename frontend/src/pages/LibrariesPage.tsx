import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import { useActiveLibrary } from "../libraries/ActiveLibraryProvider";
import {
  addLibraryMemberRequest,
  archiveLibraryRequest,
  createLibraryRequest,
  deleteLibraryRequest,
  fetchLibraries,
  fetchLibraryMembers,
  removeLibraryMemberRequest,
  restoreLibraryRequest,
  updateLibraryMemberRequest,
  updateLibraryRequest,
  type Library,
  type LibraryType,
  type UserLibraryRole,
} from "../lib/api";

const roleLabels: Record<UserLibraryRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

export function LibrariesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { activeLibraryId, setActiveLibraryId } = useActiveLibrary();
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<LibraryType>("shared");
  const [renameDraft, setRenameDraft] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<UserLibraryRole, "owner">>("editor");
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<number, Exclude<UserLibraryRole, "owner">>>({});

  const librariesQuery = useQuery({
    queryKey: ["libraries", "all"],
    queryFn: () => fetchLibraries(token ?? "", { includeArchived: true }),
    enabled: Boolean(token),
  });

  const allLibraries = librariesQuery.data ?? [];
  const activeLibraries = useMemo(
    () => allLibraries.filter((library) => !library.is_archived),
    [allLibraries],
  );
  const archivedLibraries = useMemo(
    () => allLibraries.filter((library) => library.is_archived),
    [allLibraries],
  );
  const selectedLibrary =
    allLibraries.find((library) => library.id === selectedLibraryId) ??
    activeLibraries[0] ??
    archivedLibraries[0] ??
    null;

  useEffect(() => {
    if (!selectedLibrary && selectedLibraryId !== null) {
      setSelectedLibraryId(null);
      return;
    }

    if (selectedLibrary && selectedLibrary.id !== selectedLibraryId) {
      setSelectedLibraryId(selectedLibrary.id);
      setRenameDraft(selectedLibrary.name);
    }
  }, [selectedLibrary, selectedLibraryId]);

  useEffect(() => {
    if (selectedLibrary) {
      setRenameDraft(selectedLibrary.name);
    }
  }, [selectedLibrary]);

  const membersQuery = useQuery({
    queryKey: ["library-members", selectedLibrary?.id],
    queryFn: () => fetchLibraryMembers(token ?? "", selectedLibrary!.id),
    enabled: Boolean(
      token &&
        selectedLibrary &&
        selectedLibrary.type === "shared" &&
        selectedLibrary.role === "owner",
    ),
  });

  const invalidateLibraries = async () => {
    await queryClient.invalidateQueries({ queryKey: ["libraries"] });
  };

  const createLibraryMutation = useMutation({
    mutationFn: () =>
      createLibraryRequest(token ?? "", {
        name: createName.trim(),
        type: createType,
      }),
    onSuccess: async (library) => {
      await invalidateLibraries();
      setCreateName("");
      setCreateType("shared");
      setSelectedLibraryId(library.id);
      if (!library.is_archived) {
        setActiveLibraryId(library.id);
      }
    },
  });

  const renameLibraryMutation = useMutation({
    mutationFn: () =>
      updateLibraryRequest(token ?? "", selectedLibrary!.id, {
        name: renameDraft.trim(),
      }),
    onSuccess: async () => {
      await invalidateLibraries();
    },
  });

  const archiveLibraryMutation = useMutation({
    mutationFn: (libraryId: number) => archiveLibraryRequest(token ?? "", libraryId),
    onSuccess: async () => {
      await invalidateLibraries();
    },
  });

  const restoreLibraryMutation = useMutation({
    mutationFn: (libraryId: number) => restoreLibraryRequest(token ?? "", libraryId),
    onSuccess: async () => {
      await invalidateLibraries();
    },
  });

  const deleteLibraryMutation = useMutation({
    mutationFn: (libraryId: number) => deleteLibraryRequest(token ?? "", libraryId),
    onSuccess: async (_data, libraryId) => {
      await invalidateLibraries();
      if (selectedLibraryId === libraryId) {
        setSelectedLibraryId(null);
      }
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: () =>
      addLibraryMemberRequest(token ?? "", selectedLibrary!.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      }),
    onSuccess: async () => {
      await Promise.all([
        invalidateLibraries(),
        queryClient.invalidateQueries({ queryKey: ["library-members", selectedLibrary?.id] }),
      ]);
      setInviteEmail("");
      setInviteRole("editor");
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: (memberUserId: number) =>
      updateLibraryMemberRequest(token ?? "", selectedLibrary!.id, memberUserId, {
        role: memberRoleDrafts[memberUserId] ?? "editor",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["library-members", selectedLibrary?.id] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberUserId: number) =>
      removeLibraryMemberRequest(token ?? "", selectedLibrary!.id, memberUserId),
    onSuccess: async () => {
      await Promise.all([
        invalidateLibraries(),
        queryClient.invalidateQueries({ queryKey: ["library-members", selectedLibrary?.id] }),
      ]);
    },
  });

  const canDeleteSelectedLibrary = Boolean(
    selectedLibrary &&
      selectedLibrary.type === "shared" &&
      selectedLibrary.role === "owner" &&
      selectedLibrary.member_count === 1 &&
      selectedLibrary.copy_count === 0,
  );

  function renderLibraryButton(library: Library) {
    return (
      <button
        key={library.id}
        className={selectedLibrary?.id === library.id ? "list-summary-card active" : "list-summary-card"}
        type="button"
        onClick={() => setSelectedLibraryId(library.id)}
      >
        <span>
          <strong>{library.name}</strong>
          <small>
            {library.copy_count} libros · {library.member_count} miembros
          </small>
        </span>
        <span className="status-chip">
          {library.type} · {roleLabels[library.role]}
        </span>
      </button>
    );
  }

  return (
    <section className="content-stack">
      <div className="catalog-hero panel hero-panel">
        <div>
          <p className="eyebrow">Colaboración</p>
          <h2>Mis bibliotecas</h2>
          <p>Gestiona bibliotecas personales y compartidas, miembros, archivado y permisos.</p>
        </div>
      </div>

      <div className="split-panel">
        <form
          className="panel subtle-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void createLibraryMutation.mutateAsync();
          }}
        >
          <p className="eyebrow">Nueva biblioteca</p>
          <label className="field-group">
            Nombre
            <input value={createName} onChange={(event) => setCreateName(event.target.value)} />
          </label>
          <label className="field-group">
            Tipo
            <select
              value={createType}
              onChange={(event) => setCreateType(event.target.value as LibraryType)}
            >
              <option value="shared">Compartida</option>
              <option value="personal">Personal</option>
            </select>
          </label>
          {createLibraryMutation.isError ? (
            <p className="form-error">
              {createLibraryMutation.error instanceof Error
                ? createLibraryMutation.error.message
                : "No se pudo crear la biblioteca."}
            </p>
          ) : null}
          <button className="submit-button" type="submit" disabled={createLibraryMutation.isPending || !createName.trim()}>
            {createLibraryMutation.isPending ? "Creando..." : "Crear biblioteca"}
          </button>
        </form>

        <div className="content-stack">
          <div className="panel">
            <p className="eyebrow">Activas</p>
            {activeLibraries.length === 0 ? (
              <p>No tienes bibliotecas activas.</p>
            ) : (
              <div className="content-stack">{activeLibraries.map(renderLibraryButton)}</div>
            )}
          </div>

          <div className="panel">
            <p className="eyebrow">Archivadas</p>
            {archivedLibraries.length === 0 ? (
              <p>No hay bibliotecas archivadas.</p>
            ) : (
              <div className="content-stack">{archivedLibraries.map(renderLibraryButton)}</div>
            )}
          </div>
        </div>
      </div>

      {librariesQuery.isError ? (
        <div className="panel">
          <p>No se pudieron cargar tus bibliotecas.</p>
        </div>
      ) : null}

      {selectedLibrary ? (
        <div className="panel content-stack">
          <div className="modal-header">
            <div>
              <p className="eyebrow">{selectedLibrary.is_archived ? "Archivada" : "Activa"}</p>
              <h2>{selectedLibrary.name}</h2>
              <p>
                {selectedLibrary.type} · {roleLabels[selectedLibrary.role]} · {selectedLibrary.copy_count} libros
              </p>
            </div>
            {!selectedLibrary.is_archived ? (
              <button
                className="ghost-link compact-action"
                type="button"
                onClick={() => setActiveLibraryId(selectedLibrary.id)}
                disabled={activeLibraryId === selectedLibrary.id}
              >
                {activeLibraryId === selectedLibrary.id ? "Biblioteca por defecto" : "Usar por defecto"}
              </button>
            ) : null}
          </div>

          {selectedLibrary.role === "owner" ? (
            <div className="split-panel">
              <form
                className="panel subtle-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!selectedLibrary) {
                    return;
                  }
                  void renameLibraryMutation.mutateAsync();
                }}
              >
                <p className="eyebrow">Renombrar</p>
                <label className="field-group">
                  Nombre
                  <input value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} />
                </label>
                {renameLibraryMutation.isError ? (
                  <p className="form-error">
                    {renameLibraryMutation.error instanceof Error
                      ? renameLibraryMutation.error.message
                      : "No se pudo renombrar la biblioteca."}
                  </p>
                ) : null}
                <button className="submit-button" type="submit" disabled={renameLibraryMutation.isPending || !renameDraft.trim()}>
                  {renameLibraryMutation.isPending ? "Guardando..." : "Guardar nombre"}
                </button>
              </form>

              <div className="panel subtle-panel content-stack">
                <p className="eyebrow">Acciones</p>
                {selectedLibrary.type === "shared" && !selectedLibrary.is_archived ? (
                  <button
                    className="ghost-link compact-action"
                    type="button"
                    onClick={() => {
                      if (window.confirm("La biblioteca se archivará y saldrá del catálogo operativo.")) {
                        archiveLibraryMutation.mutate(selectedLibrary.id);
                      }
                    }}
                    disabled={archiveLibraryMutation.isPending}
                  >
                    Archivar biblioteca
                  </button>
                ) : null}

                {selectedLibrary.type === "shared" && selectedLibrary.is_archived ? (
                  <button
                    className="ghost-link compact-action"
                    type="button"
                    onClick={() => restoreLibraryMutation.mutate(selectedLibrary.id)}
                    disabled={restoreLibraryMutation.isPending}
                  >
                    Restaurar biblioteca
                  </button>
                ) : null}

                {canDeleteSelectedLibrary ? (
                  <button
                    className="ghost-link compact-action danger-action"
                    type="button"
                    onClick={() => {
                      if (window.confirm("La biblioteca se eliminará definitivamente. ¿Quieres continuar?")) {
                        deleteLibraryMutation.mutate(selectedLibrary.id);
                      }
                    }}
                    disabled={deleteLibraryMutation.isPending}
                  >
                    Borrar definitivamente
                  </button>
                ) : null}

                {selectedLibrary.type === "shared" && !canDeleteSelectedLibrary ? (
                  <p className="detail-inline-copy">
                    El borrado definitivo solo está disponible si no hay miembros adicionales y la biblioteca está vacía.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {selectedLibrary.type === "shared" && selectedLibrary.role === "owner" ? (
            <div className="split-panel">
              <form
                className="panel subtle-panel"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addMemberMutation.mutateAsync();
                }}
              >
                <p className="eyebrow">Compartir por email</p>
                <label className="field-group">
                  Email
                  <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
                </label>
                <label className="field-group">
                  Rol
                  <select
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as Exclude<UserLibraryRole, "owner">)}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
                {addMemberMutation.isError ? (
                  <p className="form-error">
                    {addMemberMutation.error instanceof Error
                      ? addMemberMutation.error.message
                      : "No se pudo añadir el miembro."}
                  </p>
                ) : null}
                <button className="submit-button" type="submit" disabled={addMemberMutation.isPending || !inviteEmail.trim() || selectedLibrary.is_archived}>
                  {addMemberMutation.isPending ? "Añadiendo..." : "Añadir miembro"}
                </button>
              </form>

              <div className="content-stack">
                <div className="panel">
                  <p className="eyebrow">Miembros</p>
                  {membersQuery.isPending ? <p>Cargando miembros...</p> : null}
                  {membersQuery.isError ? <p>No se pudieron cargar los miembros.</p> : null}
                  {membersQuery.data ? (
                    <div className="content-stack">
                      {membersQuery.data.map((member) => (
                        <article key={member.user_id} className="panel library-manager-card">
                          <div className="library-manager-header">
                            <div>
                              <h3>{member.name}</h3>
                              <p>{member.email}</p>
                            </div>
                            <span className="status-chip">{roleLabels[member.role]}</span>
                          </div>

                          {member.role === "owner" ? (
                            <p className="detail-inline-copy">Propietario actual de la biblioteca.</p>
                          ) : (
                            <div className="inline-actions">
                              <select
                                value={memberRoleDrafts[member.user_id] ?? member.role}
                                onChange={(event) =>
                                  setMemberRoleDrafts((current) => ({
                                    ...current,
                                    [member.user_id]: event.target.value as Exclude<UserLibraryRole, "owner">,
                                  }))
                                }
                                disabled={selectedLibrary.is_archived}
                              >
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                              </select>
                              <button
                                className="ghost-link compact-action"
                                type="button"
                                onClick={() => updateMemberMutation.mutate(member.user_id)}
                                disabled={updateMemberMutation.isPending || selectedLibrary.is_archived}
                              >
                                Guardar rol
                              </button>
                              <button
                                className="ghost-link compact-action danger-action"
                                type="button"
                                onClick={() => removeMemberMutation.mutate(member.user_id)}
                                disabled={removeMemberMutation.isPending || selectedLibrary.is_archived}
                              >
                                Expulsar
                              </button>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
