import { useMemo, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
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
    navigate(`/catalogo?listId=${listId}`);
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

  return (
    <section className="content-stack">
      <div className="catalog-hero panel hero-panel">
        <div>
          <p className="eyebrow">Listas personales</p>
          <h2>Mis listas</h2>
          <p>Organiza tus lecturas en colecciones disponibles para todo tu catalogo.</p>
        </div>
        <button className="submit-button catalog-add-button" type="button" onClick={handleOpenCreateForm}>
          + Crear lista
        </button>
      </div>

      {listsQuery.isError ? (
        <div className="panel">
          <p>No se pudieron cargar tus listas.</p>
        </div>
      ) : null}

      {visibleLists.length === 0 ? (
        <div className="panel empty-state">
          <h3>Aun no tienes listas.</h3>
          <p>Crea tu primera lista para empezar a organizar lecturas y recomendaciones.</p>
        </div>
      ) : null}

      {visibleLists.length > 0 ? (
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
                    handleNavigateToList(list.id);
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
                    deleteListMutation.mutate(list.id);
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
