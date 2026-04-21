import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { ApiError } from "../lib/api";

type AuthTab = "login" | "register";

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

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, isBootstrapping, login, register } = useAuth();

  const requestedTab: AuthTab =
    searchParams.get("tab") === "register" ? "register" : "login";

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
      <div className="auth-card panel">
        <div className="auth-copy">
          <p className="eyebrow">Ventana 1</p>
          <h1>Entra en tu biblioteca privada</h1>
          <p className="lead">
            Accede a tu catalogo personal, guarda sesion y prepara la zona
            privada para las siguientes fases.
          </p>
        </div>

        <div className="content-stack">
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
              className={
                activeTab === "register" ? "auth-tab active" : "auth-tab"
              }
              type="button"
              role="tab"
              aria-selected={activeTab === "register"}
              onClick={() => handleTabChange("register")}
            >
              Crear cuenta
            </button>
          </div>

          {activeTab === "login" ? (
            <form className="form-grid" onSubmit={handleLoginSubmit} noValidate>
              <label className="field-group">
                <span>Email</span>
                <input
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
                {loginErrors.email && (
                  <p className="field-error">{loginErrors.email}</p>
                )}
              </label>

              <label className="field-group">
                <span>Contrasena</span>
                <input
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
                {loginErrors.password && (
                  <p className="field-error">{loginErrors.password}</p>
                )}
              </label>

              {loginFormError && <p className="form-error">{loginFormError}</p>}

              <button
                className="submit-button"
                type="submit"
                disabled={isLoginSubmitting}
              >
                {isLoginSubmitting ? "Entrando..." : "Entrar"}
              </button>
            </form>
          ) : (
            <form
              className="form-grid"
              onSubmit={handleRegisterSubmit}
              noValidate
            >
              <label className="field-group">
                <span>Nombre</span>
                <input
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
                {registerErrors.name && (
                  <p className="field-error">{registerErrors.name}</p>
                )}
              </label>

              <label className="field-group">
                <span>Email</span>
                <input
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
                {registerErrors.email && (
                  <p className="field-error">{registerErrors.email}</p>
                )}
              </label>

              <label className="field-group">
                <span>Contrasena</span>
                <input
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
                {registerErrors.password && (
                  <p className="field-error">{registerErrors.password}</p>
                )}
              </label>

              <label className="field-group">
                <span>Confirmacion de contrasena</span>
                <input
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
                {registerErrors.confirmPassword && (
                  <p className="field-error">
                    {registerErrors.confirmPassword}
                  </p>
                )}
              </label>

              {registerFormError && (
                <p className="form-error">{registerFormError}</p>
              )}

              <button
                className="submit-button"
                type="submit"
                disabled={isRegisterSubmitting}
              >
                {isRegisterSubmitting ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
