import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { ApiError } from "../lib/api";

type AuthTab = "login" | "register";
type AuthRouteMode = "query" | "path";

type AuthPageProps = {
  defaultTab?: AuthTab;
  routeMode?: AuthRouteMode;
};

type LoginValues = {
  email: string;
  password: string;
};

type RegisterValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type LoginErrors = Partial<Record<keyof LoginValues, string>>;
type RegisterErrors = Partial<Record<keyof RegisterValues, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordMaxLength = 72;

function resolveRequestedTab(
  defaultTab: AuthTab,
  routeMode: AuthRouteMode,
  searchParams: URLSearchParams,
): AuthTab {
  if (routeMode === "path") {
    return defaultTab;
  }

  return searchParams.get("tab") === "register" ? "register" : "login";
}

export function AuthPage({
  defaultTab = "login",
  routeMode = "query",
}: AuthPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, isBootstrapping, login, register } = useAuth();

  const requestedTab = resolveRequestedTab(defaultTab, routeMode, searchParams);

  const [activeTab, setActiveTab] = useState<AuthTab>(requestedTab);
  const [loginValues, setLoginValues] = useState<LoginValues>({
    email: "",
    password: "",
  });
  const [registerValues, setRegisterValues] = useState<RegisterValues>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loginErrors, setLoginErrors] = useState<LoginErrors>({});
  const [registerErrors, setRegisterErrors] = useState<RegisterErrors>({});
  const [loginFormError, setLoginFormError] = useState("");
  const [registerFormError, setRegisterFormError] = useState("");
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState(false);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  if (!isBootstrapping && isAuthenticated) {
    return <Navigate to="/catalogo" replace />;
  }

  function handleTabChange(tab: AuthTab) {
    setActiveTab(tab);

    if (routeMode === "path") {
      navigate(tab === "register" ? "/register" : "/login", { replace: true });
      return;
    }

    setSearchParams(tab === "register" ? { tab: "register" } : {});
  }

  function validateLogin(values: LoginValues): LoginErrors {
    const errors: LoginErrors = {};

    if (!values.email.trim()) {
      errors.email = "El email es obligatorio.";
    } else if (!emailPattern.test(values.email.trim())) {
      errors.email = "Introduce un email valido.";
    }

    if (!values.password) {
      errors.password = "La contrasena es obligatoria.";
    }

    return errors;
  }

  function validateRegister(values: RegisterValues): RegisterErrors {
    const errors: RegisterErrors = {};

    if (!values.name.trim()) {
      errors.name = "El nombre es obligatorio.";
    }

    if (!values.email.trim()) {
      errors.email = "El email es obligatorio.";
    } else if (!emailPattern.test(values.email.trim())) {
      errors.email = "Introduce un email valido.";
    }

    if (!values.password) {
      errors.password = "La contrasena es obligatoria.";
    } else if (values.password.length < 8) {
      errors.password = "Usa al menos 8 caracteres.";
    } else if (values.password.length > passwordMaxLength) {
      errors.password = "La contrasena no puede superar 72 caracteres.";
    }

    if (!values.confirmPassword) {
      errors.confirmPassword = "Confirma la contrasena.";
    } else if (values.confirmPassword !== values.password) {
      errors.confirmPassword = "Las contrasenas no coinciden.";
    }

    return errors;
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateLogin(loginValues);

    setLoginErrors(nextErrors);
    setLoginFormError("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsLoginSubmitting(true);

    try {
      await login({
        email: loginValues.email.trim().toLowerCase(),
        password: loginValues.password,
      });
      navigate("/catalogo", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setLoginFormError("Email o contrasena incorrectos.");
      } else {
        setLoginFormError("No se pudo iniciar sesion. Intentalo otra vez.");
      }
    } finally {
      setIsLoginSubmitting(false);
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateRegister(registerValues);

    setRegisterErrors(nextErrors);
    setRegisterFormError("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsRegisterSubmitting(true);

    try {
      await register({
        name: registerValues.name.trim(),
        email: registerValues.email.trim().toLowerCase(),
        password: registerValues.password,
      });
      navigate("/catalogo", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setRegisterErrors({
          email: "Ya existe una cuenta con ese email.",
        });
      } else {
        setRegisterFormError("No se pudo crear la cuenta. Intentalo otra vez.");
      }
    } finally {
      setIsRegisterSubmitting(false);
    }
  }

  return (
    <section className="auth-section">
      <div className="auth-page-shell">
        <div className="auth-page-intro">
          <p className="auth-page-kicker">{activeTab === "login" ? "Acceso privado" : "Nueva cuenta"}</p>
          <h1 className="auth-page-title">
            {activeTab === "login"
              ? "Entra en tu biblioteca privada"
              : "Crea tu espacio personal de lectura"}
          </h1>
          <p className="auth-page-lead">
            {activeTab === "login"
              ? "Accede a catalogo, listas, progreso y estadisticas con la misma identidad visual del resto de la aplicacion."
              : "Registra tu cuenta para organizar libros, lecturas y bibliotecas compartidas desde una unica interfaz."}
          </p>
          <div className="auth-page-links">
            <Link className="auth-page-link" to="/">
              Volver a la landing
            </Link>
            <Link
              className="auth-page-link auth-page-link-strong"
              to={activeTab === "login" ? "/register" : "/login"}
            >
              {activeTab === "login" ? "Crear cuenta" : "Ya tengo cuenta"}
            </Link>
          </div>
        </div>

        <div className="auth-card auth-card-centered panel">
          <div className="auth-tabs" role="tablist" aria-label="Autenticacion">
            <button
              className={activeTab === "login" ? "auth-tab active" : "auth-tab"}
              type="button"
              role="tab"
              aria-selected={activeTab === "login"}
              onClick={() => handleTabChange("login")}
            >
              Login
            </button>
            <button
              className={activeTab === "register" ? "auth-tab active" : "auth-tab"}
              type="button"
              role="tab"
              aria-selected={activeTab === "register"}
              onClick={() => handleTabChange("register")}
            >
              Crear cuenta
            </button>
          </div>

          {activeTab === "login" ? (
            <form className="auth-form" onSubmit={handleLoginSubmit} noValidate>
              <div className="auth-form-copy">
                <h2>Bienvenido otra vez</h2>
                <p>Introduce tus datos para volver a tu zona privada.</p>
              </div>

              <label className="auth-field">
                <span className="auth-field-label">Email</span>
                <input
                  className="auth-input"
                  type="email"
                  value={loginValues.email}
                  onChange={(event) =>
                    setLoginValues((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  autoComplete="email"
                  placeholder="tu@email.com"
                />
                {loginErrors.email ? <p className="auth-field-error">{loginErrors.email}</p> : null}
              </label>

              <label className="auth-field">
                <span className="auth-field-label">Contrasena</span>
                <input
                  className="auth-input"
                  type="password"
                  value={loginValues.password}
                  onChange={(event) =>
                    setLoginValues((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  autoComplete="current-password"
                  placeholder="Introduce tu contrasena"
                />
                {loginErrors.password ? (
                  <p className="auth-field-error">{loginErrors.password}</p>
                ) : null}
              </label>

              {loginFormError ? <p className="auth-form-error">{loginFormError}</p> : null}

              <button className="auth-submit" type="submit" disabled={isLoginSubmitting}>
                {isLoginSubmitting ? "Entrando..." : "Entrar"}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegisterSubmit} noValidate>
              <div className="auth-form-copy">
                <h2>Crea tu cuenta</h2>
                <p>Empieza con un perfil nuevo y entra directo a tu catalogo.</p>
              </div>

              <label className="auth-field">
                <span className="auth-field-label">Nombre</span>
                <input
                  className="auth-input"
                  type="text"
                  value={registerValues.name}
                  onChange={(event) =>
                    setRegisterValues((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  autoComplete="name"
                  placeholder="Como quieres aparecer"
                />
                {registerErrors.name ? (
                  <p className="auth-field-error">{registerErrors.name}</p>
                ) : null}
              </label>

              <label className="auth-field">
                <span className="auth-field-label">Email</span>
                <input
                  className="auth-input"
                  type="email"
                  value={registerValues.email}
                  onChange={(event) =>
                    setRegisterValues((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  autoComplete="email"
                  placeholder="tu@email.com"
                />
                {registerErrors.email ? (
                  <p className="auth-field-error">{registerErrors.email}</p>
                ) : null}
              </label>

              <label className="auth-field">
                <span className="auth-field-label">Contrasena</span>
                <input
                  className="auth-input"
                  type="password"
                  value={registerValues.password}
                  onChange={(event) =>
                    setRegisterValues((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  autoComplete="new-password"
                  placeholder="Entre 8 y 72 caracteres"
                  maxLength={passwordMaxLength}
                />
                {registerErrors.password ? (
                  <p className="auth-field-error">{registerErrors.password}</p>
                ) : null}
              </label>

              <label className="auth-field">
                <span className="auth-field-label">Confirmacion de contrasena</span>
                <input
                  className="auth-input"
                  type="password"
                  value={registerValues.confirmPassword}
                  onChange={(event) =>
                    setRegisterValues((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  autoComplete="new-password"
                  placeholder="Repite la contrasena"
                  maxLength={passwordMaxLength}
                />
                {registerErrors.confirmPassword ? (
                  <p className="auth-field-error">{registerErrors.confirmPassword}</p>
                ) : null}
              </label>

              {registerFormError ? <p className="auth-form-error">{registerFormError}</p> : null}

              <button className="auth-submit" type="submit" disabled={isRegisterSubmitting}>
                {isRegisterSubmitting ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
