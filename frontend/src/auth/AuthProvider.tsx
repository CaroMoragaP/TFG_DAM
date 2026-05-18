import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  fetchMe,
  loginRequest,
  registerRequest,
  setUnauthorizedHandler,
  type LoginPayload,
  type RegisterPayload,
  type User,
} from "../lib/api";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

type StoredSession = {
  token: string;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "library.auth.session";

function readStoredSession(): StoredSession | null {
  const rawSession = window.localStorage.getItem(STORAGE_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as StoredSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function persistSession(token: string, user: User | null) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token,
      user,
    } satisfies StoredSession),
  );
}

function clearStoredSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function bootstrapSession() {
      const storedSession = readStoredSession();

      if (!storedSession?.token) {
        if (!isCancelled) {
          setIsBootstrapping(false);
        }
        return;
      }

      try {
        const currentUser = await fetchMe(storedSession.token, {
          handleUnauthorized: false,
        });
        if (isCancelled) {
          return;
        }

        setToken(storedSession.token);
        setUser(currentUser);
        persistSession(storedSession.token, currentUser);
      } catch {
        clearStoredSession();
        if (!isCancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!isCancelled) {
          setIsBootstrapping(false);
        }
      }
    }

    void bootstrapSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await loginRequest(payload);
    // /auth/me remains the canonical server-side validation for the persisted session.
    setToken(response.access_token);
    setUser(response.user);
    persistSession(response.access_token, response.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await registerRequest(payload);
    setToken(response.access_token);
    setUser(response.user);
    persistSession(response.access_token, response.user);
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      window.location.replace("/login");
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  const refreshMe = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const currentUser = await fetchMe(token);
      setUser(currentUser);
      persistSession(token, currentUser);
    } catch {
      logout();
      throw new Error("No se pudo refrescar la sesion.");
    }
  }, [logout, token]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: Boolean(token && user),
        isBootstrapping,
        login,
        register,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider.");
  }

  return context;
}
