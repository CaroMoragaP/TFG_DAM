import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import { ListFormModal } from "../components/ListFormModal";
import {
  createListRequest,
  deleteListRequest,
  fetchListBooks,
  fetchLists,
  removeBookFromListRequest,
  updateListRequest,
  type ListCreatePayload,
  type UserList,
} from "../lib/api";

export function ListsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [editingList, setEditingList] = useState<UserList | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const listsQuery = useQuery({
    queryKey: ["lists"],
    queryFn: () => fetchLists(token ?? ""),
    enabled: Boolean(token),
  });

  const visibleLists = useMemo(() => listsQuery.data ?? [], [listsQuery.data]);
  const selectedList =
    visibleLists.find((list) => list.id === selectedListId) ?? visibleLists[0] ?? null;

  useEffect(() => {
    if (!selectedList && selectedListId !== null) {
      setSelectedListId(null);
      return;
    }

    if (selectedList && selectedList.id !== selectedListId) {
      setSelectedListId(selectedList.id);
    }
  }, [selectedList, selectedListId]);

  const listBooksQuery = useQuery({
    queryKey: ["list-books", selectedList?.id],
    queryFn: () => fetchListBooks(token ?? "", selectedList!.id),
    enabled: Boolean(token && selectedList),
  });

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lists"] }),
        queryClient.invalidateQueries({ queryKey: ["list-books"] }),
      ]);
      setIsFormOpen(false);
      setEditingList(null);
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: (listId: number) => deleteListRequest(token ?? "", listId),
    onSuccess: async (_data, listId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lists"] }),
        queryClient.removeQueries({ queryKey: ["list-books", listId] }),
      ]);
      if (selectedListId === listId) {
        setSelectedListId(null);
      }
    },
  });

  const removeBookMutation = useMutation({
    mutationFn: ({ listId, bookId }: { listId: number; bookId: number }) =>
      removeBookFromListRequest(token ?? "", listId, bookId),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lists"] }),
        queryClient.invalidateQueries({ queryKey: ["list-books", variables.listId] }),
      ]);
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

      <div className="panel subtle-panel">
        <p className="eyebrow">Listas globales</p>
        <h3>Todas tus listas</h3>
        <p>Estas listas estan disponibles para anadir libros desde cualquiera de tus bibliotecas.</p>
      </div>

      <div className="lists-layout">
        <aside className="content-stack">
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
          ) : (
            visibleLists.map((list) => (
              <button
                key={list.id}
                className={selectedList?.id === list.id ? "list-summary-card active" : "list-summary-card"}
                type="button"
                onClick={() => setSelectedListId(list.id)}
              >
                <span>
                  <strong>{list.name}</strong>
                  <small>{list.book_count} libros</small>
                </span>
                <span className="status-chip">{list.type}</span>
              </button>
            ))
          )}
        </aside>

        <div className="content-stack">
          {selectedList ? (
            <div className="panel">
              <div className="modal-header">
                <div>
                  <p className="eyebrow">Lista seleccionada</p>
                  <h2>{selectedList.name}</h2>
                  <p>Disponible para guardar libros desde cualquier biblioteca accesible.</p>
                </div>
                <div className="inline-actions">
                  <button
                    className="ghost-link compact-action"
                    type="button"
                    onClick={() => handleOpenEditForm(selectedList)}
                  >
                    Editar
                  </button>
                  <button
                    className="ghost-link compact-action danger-action"
                    type="button"
                    onClick={() => deleteListMutation.mutate(selectedList.id)}
                    disabled={deleteListMutation.isPending}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {selectedList && listBooksQuery.isError ? (
            <div className="panel">
              <p>No se pudieron cargar los libros de esta lista.</p>
            </div>
          ) : null}

          {selectedList && listBooksQuery.data?.length === 0 ? (
            <div className="panel empty-state">
              <h3>La lista esta vacia.</h3>
              <p>Anade libros desde el catalogo usando la accion "Anadir a lista".</p>
            </div>
          ) : null}

          {selectedList && listBooksQuery.data && listBooksQuery.data.length > 0 ? (
            <div className="content-stack">
              {listBooksQuery.data.map((book) => (
                <article key={book.book_id} className="panel list-book-card">
                  <div>
                    <h3>{book.title}</h3>
                    <p>{book.authors[0] ?? "Autor sin registrar"}</p>
                  </div>
                  <div className="inline-actions">
                    <span className="library-badge">{book.genres[0] ?? "Sin genero"}</span>
                    <button
                      className="ghost-link compact-action"
                      type="button"
                      onClick={() =>
                        removeBookMutation.mutate({
                          listId: selectedList.id,
                          bookId: book.book_id,
                        })
                      }
                      disabled={removeBookMutation.isPending}
                    >
                      Quitar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>

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
