import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import { fetchLibraries, type Library } from "../lib/api";

type ActiveLibraryContextValue = {
  activeLibrary: Library | null;
  activeLibraryId: number | null;
  libraries: Library[];
  isLibrariesError: boolean;
  isLibrariesLoading: boolean;
  refreshLibraries: () => Promise<unknown>;
  setActiveLibraryId: (libraryId: number) => void;
};

const STORAGE_KEY = "library.activeLibraryId";
const ActiveLibraryContext = createContext<ActiveLibraryContextValue | undefined>(
  undefined,
);

function readStoredLibraryId(): number | null {
  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }

  return parsedValue;
}

function persistLibraryId(libraryId: number | null) {
  if (libraryId === null) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, String(libraryId));
}

export function ActiveLibraryProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, token } = useAuth();
  const [activeLibraryId, setActiveLibraryIdState] = useState<number | null>(() =>
    readStoredLibraryId(),
  );

  const librariesQuery = useQuery({
    queryKey: ["libraries"],
    queryFn: () => fetchLibraries(token ?? ""),
    enabled: Boolean(token && isAuthenticated),
  });

  const libraries = librariesQuery.data ?? [];
  const activeLibrary =
    libraries.find((library) => library.id === activeLibraryId) ?? null;

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    persistLibraryId(null);
    setActiveLibraryIdState(null);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || libraries.length === 0) {
      return;
    }

    const currentLibraryStillExists =
      activeLibraryId !== null &&
      libraries.some((library) => library.id === activeLibraryId);
    const nextLibraryId =
      (currentLibraryStillExists ? activeLibraryId : null) ??
      libraries.find((library) => library.type === "personal")?.id ??
      libraries[0]?.id ??
      null;

    if (nextLibraryId !== activeLibraryId) {
      setActiveLibraryIdState(nextLibraryId);
    }
    persistLibraryId(nextLibraryId);
  }, [activeLibraryId, isAuthenticated, libraries]);

  function setActiveLibraryId(libraryId: number) {
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return;
    }

    setActiveLibraryIdState(libraryId);
    persistLibraryId(libraryId);
  }

  return (
    <ActiveLibraryContext.Provider
      value={{
        activeLibrary,
        activeLibraryId,
        libraries,
        isLibrariesError: librariesQuery.isError,
        isLibrariesLoading: librariesQuery.isPending,
        refreshLibraries: librariesQuery.refetch,
        setActiveLibraryId,
      }}
    >
      {children}
    </ActiveLibraryContext.Provider>
  );
}

export function useActiveLibrary() {
  const context = useContext(ActiveLibraryContext);

  if (!context) {
    throw new Error(
      "useActiveLibrary debe usarse dentro de ActiveLibraryProvider.",
    );
  }

  return context;
}
