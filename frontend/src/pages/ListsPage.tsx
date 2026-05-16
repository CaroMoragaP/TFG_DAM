import { useMemo, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { DashboardHero, HeroActionButton } from "../components/DashboardHero";
import { ListFormModal } from "../components/ListFormModal";
import {
  createListRequest,
  deleteListRequest,
  fetchLists,
  updateListRequest,
  type ListCreatePayload,
  type UserList,
} from "../lib/api";

export function ListsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingList, setEditingList] = useState<UserList | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  const listsQuery = useQuery({
    queryKey: ["lists"],
    queryFn: () => fetchLists(token ?? ""),
    enabled: Boolean(token),
  });

  const visibleLists = useMemo(() => listsQuery.data ?? [], [listsQuery.data]);

  const createListMutation = useMutation({
    mutationFn: (payload: ListCreatePayload) => createListRequest(token ?? "", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
      setIsFormOpen(false);
      setEditingList(null);
    },
  });

  const updateListMutation = useMutation({
    mutationFn: ({ listId, payload }: { listId: number; payload: ListCreatePayload }) =>
      updateListRequest(token ?? "", listId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
      setIsFormOpen(false);
      setEditingList(null);
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: (listId: number) => deleteListRequest(token ?? "", listId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
      setDeleteErrorMessage(null);
    },
    onError: (error) => {
      setDeleteErrorMessage(error instanceof Error ? error.message : "No se pudo eliminar la lista.");
    },
  });

  function handleOpenCreateForm() {
    setEditingList(null);
    setIsFormOpen(true);
  }

  function handleOpenEditForm(list: UserList) {
    setEditingList(list);
    setIsFormOpen(true);
  }

  function handleNavigateToList(listId: number) {
    navigate(`/listas/${listId}`);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, listId: number) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleNavigateToList(listId);
  }

  async function handleSubmitList(payload: ListCreatePayload) {
    if (editingList) {
      await updateListMutation.mutateAsync({ listId: editingList.id, payload });
      return;
    }

    await createListMutation.mutateAsync(payload);
  }

  function handleDeleteList(list: UserList) {
    if (!window.confirm(`Se eliminara la lista "${list.name}" y su contenido guardado. Quieres continuar?`)) {
      return;
    }

    setDeleteErrorMessage(null);
    deleteListMutation.mutate(list.id);
  }

  return (
    <section className="content-stack private-page-shell">
      <DashboardHero
        eyebrow="Listas personales"
        title="Mis listas"
        description="Organiza tus lecturas en colecciones disponibles para todo tu catalogo."
        icon="list"
        actions={
          <HeroActionButton emphasis="primary" icon="plus" onClick={handleOpenCreateForm}>
            Crear lista
          </HeroActionButton>
        }
      />

      {listsQuery.isError ? (
        <div className="panel">
          <p>No se pudieron cargar tus listas.</p>
        </div>
      ) : null}

      {deleteErrorMessage ? (
        <div className="panel">
          <p className="form-error">{deleteErrorMessage}</p>
        </div>
      ) : null}

      {listsQuery.isPending ? (
        <div className="catalog-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="book-skeleton panel list-page-skeleton" aria-hidden="true" />
          ))}
        </div>
      ) : null}

      {listsQuery.isSuccess && visibleLists.length === 0 ? (
        <div className="panel empty-state">
          <h3>Aun no tienes listas.</h3>
          <p>Crea tu primera lista para empezar a organizar lecturas y recomendaciones.</p>
        </div>
      ) : null}

      {listsQuery.isSuccess && visibleLists.length > 0 ? (
        <div className="catalog-grid">
          {visibleLists.map((list) => (
            <article
              key={list.id}
              className="panel list-management-card"
              role="button"
              tabIndex={0}
              onClick={() => handleNavigateToList(list.id)}
              onKeyDown={(event) => handleCardKeyDown(event, list.id)}
            >
              <div className="list-card-main">
                <div>
                  <p className="eyebrow">Lista personal</p>
                  <h3>{list.name}</h3>
                  <p>{list.book_count} libros guardados en esta lista.</p>
                </div>
                <span className="status-chip">{list.type}</span>
              </div>

              <div className="list-card-actions">
                <button
                  className="ghost-link compact-action"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/catalogo?listId=${list.id}`);
                  }}
                >
                  Ver en catalogo
                </button>
                <button
                  className="ghost-link compact-action"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenEditForm(list);
                  }}
                >
                  Editar
                </button>
                <button
                  className="ghost-link compact-action danger-action"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteList(list);
                  }}
                  disabled={deleteListMutation.isPending}
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <ListFormModal
        isOpen={isFormOpen}
        isSaving={createListMutation.isPending || updateListMutation.isPending}
        list={editingList}
        onClose={() => {
          setIsFormOpen(false);
          setEditingList(null);
        }}
        onSubmit={handleSubmitList}
      />
    </section>
  );
}
