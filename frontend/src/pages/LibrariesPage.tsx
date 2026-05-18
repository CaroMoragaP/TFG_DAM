import { useEffect, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import { DashboardHero, HeroActionButton } from "../components/DashboardHero";
import { LibraryFormModal } from "../components/LibraryFormModal";
import {
  addLibraryMemberRequest,
  createLibraryRequest,
  deleteLibraryRequest,
  fetchLibraries,
  fetchLibraryMembers,
  removeLibraryMemberRequest,
  updateLibraryMemberRequest,
  updateLibraryRequest,
  type Library,
  type LibraryType,
  type UserLibraryRole,
} from "../lib/api";

const roleLabels: Record<UserLibraryRole, string> = {
  owner: "Propietario",
  editor: "Editor",
  viewer: "Lector",
};

const typeLabels: Record<LibraryType, string> = {
  personal: "Biblioteca personal",
  shared: "Biblioteca compartida",
};

function formatCopiesLabel(copyCount: number) {
  return copyCount === 1 ? "1 libro" : `${copyCount} libros`;
}

function formatMembersLabel(memberCount: number) {
  return memberCount === 1 ? "1 miembro" : `${memberCount} miembros`;
}

export function LibrariesPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<UserLibraryRole, "owner">>("editor");
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<number, Exclude<UserLibraryRole, "owner">>>({});
  const [libraryActionErrorMessage, setLibraryActionErrorMessage] = useState<string | null>(null);
  const [memberActionErrorMessage, setMemberActionErrorMessage] = useState<string | null>(null);

  const librariesQuery = useQuery({
    queryKey: ["libraries", "all"],
    queryFn: () => fetchLibraries(token ?? ""),
    enabled: Boolean(token),
  });

  const allLibraries = librariesQuery.data ?? [];
  const selectedLibrary = allLibraries.find((library) => library.id === selectedLibraryId) ?? null;

  useEffect(() => {
    if (!selectedLibrary && selectedLibraryId !== null) {
      setSelectedLibraryId(null);
    }
  }, [selectedLibrary, selectedLibraryId]);

  useEffect(() => {
    if (!selectedLibrary) {
      return;
    }

    setRenameDraft(selectedLibrary.name);
    setLibraryActionErrorMessage(null);
    setMemberActionErrorMessage(null);
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
    mutationFn: (payload: { name: string; type: LibraryType }) => createLibraryRequest(token ?? "", payload),
    onSuccess: async (library) => {
      await invalidateLibraries();
      setSelectedLibraryId(library.id);
      setIsCreateModalOpen(false);
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

  function handleOpenEditModal(libraryId: number) {
    setSelectedLibraryId(libraryId);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, libraryId: number) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleOpenEditModal(libraryId);
  }

  function renderLibraryCard(library: Library) {
    const isActive = selectedLibrary?.id === library.id;

    return (
      <article
        key={library.id}
        className={isActive ? "panel list-management-card active" : "panel list-management-card"}
        role="button"
        tabIndex={0}
        onClick={() => handleOpenEditModal(library.id)}
        onKeyDown={(event) => handleCardKeyDown(event, library.id)}
      >
        <div className="list-card-main">
          <div>
            <p className="eyebrow">{typeLabels[library.type]}</p>
            <h3>{library.name}</h3>
            <p>
              {formatCopiesLabel(library.copy_count)} - {formatMembersLabel(library.member_count)}
            </p>
          </div>
          <span className={isActive ? "status-chip active" : "status-chip"}>{roleLabels[library.role]}</span>
        </div>
        <div className="list-card-actions">
          <button
            className="ghost-link compact-action"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleOpenEditModal(library.id);
            }}
          >
            Editar
          </button>
        </div>
      </article>
    );
  }

  return (
    <section className="content-stack private-page-shell">
      <DashboardHero
        eyebrow="Colaboracion"
        title="Mis bibliotecas"
        description="Gestiona bibliotecas personales y compartidas, miembros y permisos."
        icon="library"
        actions={
          <HeroActionButton
            emphasis="primary"
            icon="plus"
            onClick={() => setIsCreateModalOpen(true)}
          >
            Anadir biblioteca
          </HeroActionButton>
        }
      />

      {librariesQuery.isError ? (
        <div className="panel">
          <p>No se pudieron cargar tus bibliotecas.</p>
        </div>
      ) : null}

      {librariesQuery.isPending ? (
        <div className="catalog-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="book-skeleton panel list-page-skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : null}

      {librariesQuery.isSuccess && allLibraries.length === 0 ? (
        <div className="panel empty-state">
          <h3>Aun no tienes bibliotecas.</h3>
          <p>Crea una para empezar a organizar tus lecturas o colaborar con otras personas.</p>
        </div>
      ) : null}

      {librariesQuery.isSuccess && allLibraries.length > 0 ? (
        <div className="catalog-grid">{allLibraries.map(renderLibraryCard)}</div>
      ) : null}

      <LibraryFormModal
        isOpen={isCreateModalOpen}
        isSaving={createLibraryMutation.isPending}
        onClose={() => {
          if (createLibraryMutation.isPending) {
            return;
          }
          setIsCreateModalOpen(false);
        }}
        onSubmit={async (payload) => {
          await createLibraryMutation.mutateAsync(payload);
        }}
      />

      {selectedLibrary ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            setSelectedLibraryId(null);
          }}
        >
          <div
            className="modal-panel panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-edit-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">
                  {selectedLibrary.role === "owner" ? "Editar biblioteca" : "Biblioteca seleccionada"}
                </p>
                <h2 id="library-edit-modal-title">{selectedLibrary.name}</h2>
                <p>
                  {typeLabels[selectedLibrary.type]} - {roleLabels[selectedLibrary.role]} -{" "}
                  {formatCopiesLabel(selectedLibrary.copy_count)} - {formatMembersLabel(selectedLibrary.member_count)}
                </p>
              </div>
              <button
                className="ghost-link compact-action"
                type="button"
                onClick={() => {
                  setSelectedLibraryId(null);
                }}
              >
                Cerrar
              </button>
            </div>

            <div className="modal-form">
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
                    <p className="eyebrow">Informacion</p>
                    <label className="field-group">
                      Nombre
                      <input value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} />
                    </label>
                    <div className="subtle-panel modal-info-panel">
                      <p className="eyebrow">Tipo</p>
                      <p>{typeLabels[selectedLibrary.type]}</p>
                    </div>
                    {renameLibraryMutation.isError ? (
                      <p className="form-error">
                        {renameLibraryMutation.error instanceof Error
                          ? renameLibraryMutation.error.message
                          : "No se pudo actualizar la biblioteca."}
                      </p>
                    ) : null}
                    <button
                      className="submit-button"
                      type="submit"
                      disabled={renameLibraryMutation.isPending || !renameDraft.trim()}
                    >
                      {renameLibraryMutation.isPending ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </form>

                  <div className="panel subtle-panel content-stack">
                    <p className="eyebrow">Acciones</p>
                    {canDeleteSelectedLibrary ? (
                      <button
                        className="ghost-link compact-action danger-action"
                        type="button"
                        onClick={() => {
                          if (window.confirm("La biblioteca se eliminara definitivamente. Quieres continuar?")) {
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
                        El borrado definitivo solo esta disponible si no hay miembros adicionales en la biblioteca.
                      </p>
                    ) : null}
                    {libraryActionErrorMessage ? <p className="form-error">{libraryActionErrorMessage}</p> : null}
                  </div>
                </div>
              ) : (
                <div className="panel subtle-panel">
                  <p className="eyebrow">Permisos</p>
                  <p>
                    {selectedLibrary.role === "editor"
                      ? "Puedes editar el contenido de esta biblioteca, pero el nombre y los permisos solo puede cambiarlos su propietario."
                      : "Tienes acceso de lectura a esta biblioteca. El nombre y los permisos solo puede cambiarlos su propietario."}
                  </p>
                </div>
              )}

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
                        <option value="viewer">Lector</option>
                      </select>
                    </label>
                    {addMemberMutation.isError ? (
                      <p className="form-error">
                        {addMemberMutation.error instanceof Error
                          ? addMemberMutation.error.message
                          : "No se pudo anadir el miembro."}
                      </p>
                    ) : null}
                    <button
                      className="submit-button"
                      type="submit"
                      disabled={addMemberMutation.isPending || !inviteEmail.trim()}
                    >
                      {addMemberMutation.isPending ? "Anadiendo..." : "Anadir miembro"}
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
                                  >
                                    <option value="editor">Editor</option>
                                    <option value="viewer">Lector</option>
                                  </select>
                                  <button
                                    className="ghost-link compact-action"
                                    type="button"
                                    onClick={() => {
                                      setMemberActionErrorMessage(null);
                                      updateMemberMutation.mutate(member.user_id);
                                    }}
                                    disabled={updateMemberMutation.isPending}
                                  >
                                    Guardar rol
                                  </button>
                                  <button
                                    className="ghost-link compact-action danger-action"
                                    type="button"
                                    onClick={() => {
                                      if (
                                        !window.confirm(
                                          `Se expulsara a ${member.name} de la biblioteca. Quieres continuar?`,
                                        )
                                      ) {
                                        return;
                                      }
                                      setMemberActionErrorMessage(null);
                                      removeMemberMutation.mutate(member.user_id);
                                    }}
                                    disabled={removeMemberMutation.isPending}
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
          </div>
        </div>
      ) : null}
    </section>
  );
}
