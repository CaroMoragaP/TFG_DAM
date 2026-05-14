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
  const [libraryActionErrorMessage, setLibraryActionErrorMessage] = useState<string | null>(null);
  const [memberActionErrorMessage, setMemberActionErrorMessage] = useState<string | null>(null);

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
      setLibraryActionErrorMessage(null);
      setMemberActionErrorMessage(null);
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
      setLibraryActionErrorMessage(null);
    },
    onError: (error) => {
      setLibraryActionErrorMessage(error instanceof Error ? error.message : "No se pudo archivar la biblioteca.");
    },
  });

  const restoreLibraryMutation = useMutation({
    mutationFn: (libraryId: number) => restoreLibraryRequest(token ?? "", libraryId),
    onSuccess: async () => {
      await invalidateLibraries();
      setLibraryActionErrorMessage(null);
    },
    onError: (error) => {
      setLibraryActionErrorMessage(error instanceof Error ? error.message : "No se pudo restaurar la biblioteca.");
    },
  });

  const deleteLibraryMutation = useMutation({
    mutationFn: (libraryId: number) => deleteLibraryRequest(token ?? "", libraryId),
    onSuccess: async (_data, libraryId) => {
      await invalidateLibraries();
      setLibraryActionErrorMessage(null);
      if (selectedLibraryId === libraryId) {
        setSelectedLibraryId(null);
      }
    },
    onError: (error) => {
      setLibraryActionErrorMessage(error instanceof Error ? error.message : "No se pudo borrar la biblioteca.");
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
      setMemberActionErrorMessage(null);
    },
    onError: (error) => {
      setMemberActionErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar el rol.");
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
      setMemberActionErrorMessage(null);
    },
    onError: (error) => {
      setMemberActionErrorMessage(error instanceof Error ? error.message : "No se pudo expulsar al miembro.");
    },
  });

  const canDeleteSelectedLibrary = Boolean(
    selectedLibrary &&
      selectedLibrary.type === "shared" &&
      selectedLibrary.role === "owner" &&
      selectedLibrary.member_count === 1,
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
            {librariesQuery.isPending ? (
              <div className="content-stack">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="panel book-skeleton library-list-skeleton" aria-hidden="true" />
                ))}
              </div>
            ) : activeLibraries.length === 0 ? (
              <p>No tienes bibliotecas activas.</p>
            ) : (
              <div className="content-stack">{activeLibraries.map(renderLibraryButton)}</div>
            )}
          </div>

          <div className="panel">
            <p className="eyebrow">Archivadas</p>
            {librariesQuery.isPending ? (
              <div className="content-stack">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="panel book-skeleton library-list-skeleton" aria-hidden="true" />
                ))}
              </div>
            ) : archivedLibraries.length === 0 ? (
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
                        setLibraryActionErrorMessage(null);
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
                    onClick={() => {
                      setLibraryActionErrorMessage(null);
                      restoreLibraryMutation.mutate(selectedLibrary.id);
                    }}
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
                        setLibraryActionErrorMessage(null);
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
                    El borrado definitivo solo está disponible si no hay miembros adicionales en la biblioteca.
                  </p>
                ) : null}
                {libraryActionErrorMessage ? <p className="form-error">{libraryActionErrorMessage}</p> : null}
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
                  {membersQuery.isPending ? (
                    <div className="content-stack">
                      {Array.from({ length: 2 }).map((_, index) => (
                        <div key={index} className="panel book-skeleton library-member-skeleton" aria-hidden="true" />
                      ))}
                    </div>
                  ) : null}
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
                                onClick={() => {
                                  setMemberActionErrorMessage(null);
                                  updateMemberMutation.mutate(member.user_id);
                                }}
                                disabled={updateMemberMutation.isPending || selectedLibrary.is_archived}
                              >
                                Guardar rol
                              </button>
                              <button
                                className="ghost-link compact-action danger-action"
                                type="button"
                                onClick={() => {
                                  if (!window.confirm(`Se expulsara a ${member.name} de la biblioteca. Quieres continuar?`)) {
                                    return;
                                  }
                                  setMemberActionErrorMessage(null);
                                  removeMemberMutation.mutate(member.user_id);
                                }}
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
                  {memberActionErrorMessage ? <p className="form-error">{memberActionErrorMessage}</p> : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
