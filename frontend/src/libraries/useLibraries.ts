import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import { fetchLibraries } from "../lib/api";

export function useLibraries() {
  const { isAuthenticated, token } = useAuth();

  const librariesQuery = useQuery({
    queryKey: ["libraries"],
    queryFn: () => fetchLibraries(token ?? ""),
    enabled: Boolean(token && isAuthenticated),
  });

  return {
    libraries: librariesQuery.data ?? [],
    isLibrariesError: librariesQuery.isError,
    isLibrariesLoading: librariesQuery.isPending,
    refreshLibraries: librariesQuery.refetch,
  };
}
