# Plan de Pruebas

## 1. Objetivo

Este documento describe el plan de pruebas del proyecto **Biblioteca Personal Compartida**. Su objetivo es:

- Documentar la estrategia de validacion actual del repositorio.
- Identificar la cobertura automatizada existente en backend y frontend.
- Definir un conjunto formal de pruebas funcionales para validacion manual o futura automatizacion E2E.
- Priorizar los escenarios mas relevantes para la aceptacion del sistema.

## 2. Alcance

El plan cubre las funcionalidades principales del sistema:

- Autenticacion y control de acceso.
- Gestion de catalogo y ejemplares.
- Gestion del estado de lectura.
- Gestion de listas personales.
- Gestion de bibliotecas compartidas y permisos.
- Comunidad: resenas, actividad y prestamos.
- Estadisticas de catalogo y lectura.
- Integraciones de metadatos externos e importacion/exportacion CSV.

## 3. Estrategia de Pruebas

### 3.1 Estado actual del repositorio

El repositorio ya dispone de pruebas automatizadas, pero no de una suite E2E dedicada.

- **Backend**: pruebas con `pytest` y `FastAPI TestClient`.
- **Frontend**: pruebas con `vitest` y `Testing Library`.
- **Base de datos de test**: SQLite en memoria para la ejecucion del backend.

### 3.2 Tipos de prueba presentes

- **Pruebas de API y logica de negocio**: validan reglas funcionales, permisos, estados de lectura, catalogo, listas, bibliotecas compartidas, comunidad y estadisticas.
- **Pruebas de interfaz y flujo parcial**: validan formularios, modales, filtros, cambios de estado, navegacion y mensajes en pantalla.

### 3.3 Huecos identificados

Actualmente no se observa en el repositorio:

- Suite de pruebas E2E con herramientas como Playwright o Cypress.
- Documento formal previo de plan de pruebas.
- Escenarios multiusuario ejecutados como flujo completo de extremo a extremo en navegador real.

## 4. Cobertura Automatizada Actual

La cobertura funcional actual se reparte de forma aproximada en las siguientes areas:

- **Autenticacion y bootstrap admin**.
- **Catalogo, ejemplares y estados de lectura**.
- **Listas personales**.
- **Bibliotecas compartidas y roles**.
- **Comunidad, prestamos y resenas**.
- **Integracion con Open Library**.
- **Estadisticas y objetivo anual de lectura**.
- **Pantallas y componentes principales del frontend**.

## 5. Criterios de Aceptacion

Se considerara que una version es apta para validacion funcional cuando:

- El backend arranca correctamente y responde en `GET /health`.
- El frontend permite navegar entre rutas publicas y privadas sin errores.
- La autenticacion funciona de forma consistente.
- Las operaciones principales del dominio persisten correctamente los datos.
- Los permisos impiden accesos o acciones no autorizadas.
- No se observan regresiones en los flujos criticos definidos en este documento.

## 6. Entorno de Ejecucion

### 6.1 Entorno recomendado

- Docker Compose para validacion integrada del sistema.
- Alternativamente, backend y frontend en local siguiendo la documentacion del repositorio.

### 6.2 Comandos utiles

Backend:

```powershell
cd backend
pytest
```

Frontend:

```powershell
cd frontend
npm test
```

Sistema completo:

```powershell
docker compose up --build
```

## 7. Casos de Prueba Funcional

La siguiente tabla recoge las pruebas funcionales recomendadas. Estas pruebas pueden ejecutarse manualmente y tambien servir de base para una futura automatizacion E2E.

| ID | Prioridad | Prueba funcional | Precondiciones | Pasos | Resultado esperado |
|---|---|---|---|---|---|
| PF-01 | Critica | Registro de usuario | Aplicacion disponible y usuario no registrado | Acceder a registro, completar nombre, email y contrasena validos, enviar formulario | La cuenta se crea correctamente y el usuario dispone de biblioteca personal y listas iniciales |
| PF-02 | Critica | Inicio de sesion | Usuario existente y activo | Acceder a login, introducir credenciales validas, enviar formulario | El sistema autentica al usuario, crea sesion y redirige a `/catalogo` |
| PF-03 | Alta | Rechazo de login invalido | Pantalla de login disponible | Introducir credenciales incorrectas o usuario inactivo, enviar formulario | Se muestra un error y no se concede acceso a la zona privada |
| PF-04 | Critica | Proteccion de rutas privadas | No haber iniciado sesion | Intentar abrir `/catalogo`, `/lectura`, `/listas`, `/bibliotecas` o `/stats` | La aplicacion impide el acceso y redirige a login |
| PF-05 | Critica | Alta de libro en catalogo | Usuario autenticado con biblioteca accesible | Crear un libro con campos obligatorios y biblioteca destino | El libro se guarda correctamente y aparece en el catalogo |
| PF-06 | Alta | Validacion del formulario de libro | Usuario autenticado | Intentar crear un libro sin campos obligatorios o sin biblioteca | El sistema muestra errores de validacion y no guarda datos invalidos |
| PF-07 | Alta | Edicion de libro o ejemplar | Existencia de un libro en catalogo | Abrir detalle, modificar datos relevantes y guardar | Los cambios persisten y se reflejan en vistas de catalogo y detalle |
| PF-08 | Critica | Flujo de lectura completo | Libro existente en biblioteca del usuario | Marcar un libro como pendiente, despues como leyendo y finalmente como terminado | El estado cambia correctamente y el libro aparece en la pestana correspondiente |
| PF-09 | Alta | Reapertura de libro terminado | Libro marcado como terminado | Reabrir la lectura desde la interfaz | El sistema solicita confirmacion y reabre la lectura como relectura sin inconsistencias |
| PF-10 | Alta | Filtro de lectura por biblioteca | Usuario con varias bibliotecas accesibles | Entrar en lectura y cambiar la biblioteca seleccionada | Solo se muestran los libros asociados a la biblioteca filtrada |
| PF-11 | Alta | Creacion y gestion de listas | Usuario autenticado y catalogo con al menos un libro | Crear lista, editar nombre, anadir libro y eliminarlo despues | La lista se actualiza correctamente y el contador refleja el cambio |
| PF-12 | Alta | Acceso restringido a listas ajenas | Existencia de lista no accesible para el usuario | Intentar abrir una lista ajena o no accesible | El sistema bloquea el acceso o muestra estado no disponible |
| PF-13 | Critica | Creacion de biblioteca compartida | Usuario autenticado | Crear biblioteca compartida y anadir un miembro | La biblioteca queda disponible para sus miembros y aparece en su listado |
| PF-14 | Critica | Permisos por rol en biblioteca compartida | Biblioteca compartida con distintos roles configurados | Probar acciones con propietario, editor y miembro | Cada usuario solo puede realizar las acciones permitidas por su rol |
| PF-15 | Alta | Transferencia de propiedad o salida de miembro | Biblioteca compartida existente | Transferir la propiedad o abandonar la biblioteca | El cambio se guarda correctamente y la estructura de miembros permanece consistente |
| PF-16 | Critica | Importacion CSV de catalogo | Usuario autenticado con biblioteca accesible y fichero CSV valido | Abrir importacion, seleccionar biblioteca, cargar CSV, revisar vista previa y confirmar | La previsualizacion detecta errores o duplicados y la importacion anade los libros validos |
| PF-17 | Media | Exportacion CSV del catalogo | Catalogo con datos y filtros opcionales | Exportar el catalogo tras aplicar filtros | Se obtiene un CSV coherente con el listado visible |
| PF-18 | Alta | Busqueda de metadatos externos | Usuario autenticado en formulario de libro | Buscar por ISBN o por titulo, autor y editorial | El sistema recupera metadatos validos cuando existen y avisa si no hay coincidencia fiable |
| PF-19 | Alta | Publicacion de resena publica | Usuario con libro compartido y valoracion guardada | Publicar una resena desde lectura o detalle | La resena aparece en el muro de la biblioteca compartida |
| PF-20 | Alta | Edicion y retirada de resena | Existencia de una resena publicada por el usuario | Editar la resena o eliminarla | Los cambios se reflejan correctamente; si se elimina, deja de mostrarse |
| PF-21 | Alta | Registro de actividad comunitaria | Biblioteca compartida con actividad reciente | Anadir libros o importar catalogo en biblioteca compartida | El muro muestra eventos de actividad con etiquetas correctas |
| PF-22 | Alta | Prestamo de libro compartido | Existencia de un ejemplar compartido disponible | Registrar un prestamo y posteriormente su devolucion | El prestamo activo y su historial quedan reflejados correctamente |
| PF-23 | Media | Estadisticas de catalogo y lectura | Usuario autenticado con datos registrados | Abrir estadisticas, cambiar de pestana y de biblioteca | Las metricas cambian conforme a la vista y biblioteca seleccionadas |
| PF-24 | Media | Objetivo anual de lectura | Usuario autenticado | Introducir un objetivo anual valido y guardarlo | El objetivo se persiste y se actualizan los indicadores relacionados |
| PF-25 | Media | Rutas legacy y redirecciones | Aplicacion en ejecucion | Acceder a rutas antiguas como `/auth`, `/leyendo` o `/libros/:id` | La aplicacion redirige a las rutas vigentes sin romper el flujo |

## 8. Priorizacion de Escenarios

Los escenarios mas relevantes para aceptacion funcional, defensa academica o validacion previa a entrega son:

- PF-01 Registro de usuario.
- PF-02 Inicio de sesion.
- PF-04 Proteccion de rutas privadas.
- PF-05 Alta de libro en catalogo.
- PF-08 Flujo de lectura completo.
- PF-13 Creacion de biblioteca compartida.
- PF-14 Permisos por rol en biblioteca compartida.
- PF-16 Importacion CSV de catalogo.
- PF-19 Publicacion de resena publica.
- PF-22 Prestamo de libro compartido.

## 9. Riesgos y Consideraciones

- La ausencia de una suite E2E implica mayor dependencia de pruebas manuales para validar flujos integrados.
- Los escenarios multiusuario son especialmente relevantes en bibliotecas compartidas, comunidad y prestamos.
- Las integraciones externas de metadatos pueden verse afectadas por disponibilidad o calidad de datos del servicio remoto.
- Importacion/exportacion y permisos son areas con riesgo alto de regresion funcional.

## 10. Estado del Documento

- **Version**: 1.0
- **Estado**: Documento de planificacion y referencia
- **Implementacion E2E**: No incluida en el alcance actual

