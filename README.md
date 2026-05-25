# Biblioteca Personal Compartida

Monorepo base para una aplicaci?n web de biblioteca personal o compartida. Esta fase ya incorpora autenticaci?n b?sica con `FastAPI`, `JWT`, `PostgreSQL`, `SQLAlchemy`, `Alembic`, `React`, `Vite`, `React Router` y `TanStack Query`.

## Estructura

```text
.
|-- backend/
|-- frontend/
|-- docker-compose.yml
|-- .env.example
`-- README.md
```

## Requisitos

- Docker Desktop con `docker compose`
- Opcional para desarrollo local:
  - Python 3.12
  - Node.js 22 o equivalente

## Arranque con Docker

1. Crear el archivo de entorno:

```powershell
Copy-Item .env.example .env
```

2. Levantar todos los servicios:

```powershell
docker compose up --build
```

### Admin de desarrollo opcional

La aplicaci?n puede sembrar un usuario administrador global al arrancar el backend, pero solo si defines las tres variables `ADMIN_*` en `.env`:

```env
ADMIN_NAME=Admin desarrollo
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=supersecret123
```

Comportamiento del seed:

- Si `ADMIN_NAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` existen, el backend crea o sincroniza ese admin al arrancar.
- Si no existe ninguna `ADMIN_*`, el backend arranca normal sin crear admin.
- Si la configuraci?n es parcial, el backend falla al arrancar con un error claro.
- El seed es idempotente: no duplica el usuario, su biblioteca personal ni sus listas por defecto.
- El admin queda marcado como activo y con rol global de plataforma.
- El admin tambi?n recibe la biblioteca personal inicial y las listas semilla (`Favoritos` y `Pr?ximas lecturas`).
- En esta fase no hay cambio obligatorio de contrase?a.

Este mecanismo est? pensado para desarrollo y bootstrap del proyecto, no como estrategia de despliegue en producci?n.

## URLs de desarrollo

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Healthcheck backend: `http://localhost:8000/health`
- Auth frontend: `http://localhost:5173/auth`
- Cat?logo privado: `http://localhost:5173/catalogo`
- PostgreSQL: `localhost:5432`

## Desarrollo local del backend

1. Entrar en el directorio:

```powershell
cd backend
```

2. Crear y activar entorno virtual:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

3. Instalar dependencias:

```powershell
pip install -r requirements.txt
```

4. Ejecutar migraciones:

```powershell
alembic upgrade head
```

5. Ejecutar la API:

```powershell
uvicorn app.main:app --reload
```

Nota: el `DATABASE_URL` del ejemplo est? pensado para Docker (`db`). Si ejecutas el backend fuera de Docker y necesitas acceder a PostgreSQL local, cambia temporalmente el host a `localhost`.

## Desarrollo local del frontend

1. Entrar en el directorio:

```powershell
cd frontend
```

2. Instalar dependencias:

```powershell
npm install
```

3. Levantar Vite:

```powershell
npm run dev
```

## Validaci?n r?pida

- `docker compose up --build` debe levantar base de datos, backend y frontend.
- `alembic upgrade head` debe crear la tabla `users`.
- `GET /health` debe responder con un JSON simple de estado.
- `POST /auth/register` y `POST /auth/login` deben devolver `access_token`, `token_type` y `user`, incluyendo `user.is_admin`.
- La app React debe mostrar la pantalla p?blica en `/auth` y proteger `/catalogo` y el resto de rutas privadas.
- Si defines `ADMIN_*`, el backend debe crear o resincronizar el admin de desarrollo al arrancar.
