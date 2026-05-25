# Plan de Pruebas

## 1. Objetivo

Este documento describe el plan de pruebas del proyecto **Biblioteca Personal Compartida**. Su objetivo es:

- Documentar la estrategia de validaci?n actual del repositorio.
- Identificar la cobertura automatizada existente en backend y frontend.
- Definir un conjunto formal de pruebas funcionales para validaci?n manual o futura automatizaci?n E2E.
- Priorizar los escenarios m?s relevantes para la aceptaci?n del sistema.

## 2. Alcance

El plan cubre las funcionalidades principales del sistema:

- Autenticaci?n y control de acceso.
- Gesti?n de cat?logo y ejemplares.
- Gesti?n del estado de lectura.
- Gesti?n de listas personales.
- Gesti?n de bibliotecas compartidas y permisos.
- Comunidad: rese?as, actividad y pr?stamos.
- Estad?sticas de cat?logo y lectura.
- Integraciones de metadatos externos e importaci?n/exportaci?n CSV.

## 3. Estrategia de Pruebas

### 3.1 Estado actual del repositorio

El repositorio ya dispone de pruebas automatizadas, pero no de una suite E2E dedicada.

- **Backend**: pruebas con `pytest` y `FastAPI TestClient`.
- **Frontend**: pruebas con `vitest` y `Testing Library`.
- **Base de datos de test**: SQLite en memoria para la ejecuci?n del backend.

### 3.2 Tipos de prueba presentes

- **Pruebas de API y l?gica de negocio**: validan reglas funcionales, permisos, estados de lectura, cat?logo, listas, bibliotecas compartidas, comunidad y estad?sticas.
- **Pruebas de interfaz y flujo parcial**: validan formularios, modales, filtros, cambios de estado, navegaci?n y mensajes en pantalla.

### 3.3 Huecos identificados

Actualmente no se observa en el repositorio:

- Suite de pruebas E2E con herramientas como Playwright o Cypress.
- Documento formal previo de plan de pruebas.
- Escenarios multiusuario ejecutados como flujo completo de extremo a extremo en navegador real.

## 4. Cobertura Automatizada Actual

La cobertura funcional actual se reparte de forma aproximada en las siguientes ?reas:

- **Autenticaci?n y bootstrap admin**.
- **Cat?logo, ejemplares y estados de lectura**.
- **Listas personales**.
- **Bibliotecas compartidas y roles**.
- **Comunidad, pr?stamos y rese?as**.
- **Integraci?n con Open Library**.
- **Estad?sticas y objetivo anual de lectura**.
- **Pantallas y componentes principales del frontend**.

## 5. Criterios de Aceptaci?n

Se considerar? que una versi?n es apta para validaci?n funcional cuando:

- El backend arranca correctamente y responde en `GET /health`.
- El frontend permite navegar entre rutas p?blicas y privadas sin errores.
- La autenticaci?n funciona de forma consistente.
- Las operaciones principales del dominio persisten correctamente los datos.
- Los permisos impiden accesos o acciones no autorizadas.
- No se observan regresiones en los flujos cr?ticos definidos en este documento.

## 6. Entorno de Ejecuci?n

### 6.1 Entorno recomendado

- Docker Compose para validaci?n integrada del sistema.
- Alternativamente, backend y frontend en local siguiendo la documentaci?n del repositorio.

### 6.2 Comandos ?tiles

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

La siguiente tabla recoge las pruebas funcionales recomendadas. Estas pruebas pueden ejecutarse manualmente y tambi?n servir de base para una futura automatizaci?n E2E.

| ID | Prioridad | Prueba funcional | Precondiciones | Pasos | Resultado esperado |
|---|---|---|---|---|---|
| PF-01 | Cr?tica | Registro de usuario | Aplicaci?n disponible y usuario no registrado | Acceder a registro, completar nombre, email y contrase?a v?lidos, enviar formulario | La cuenta se crea correctamente y el usuario dispone de biblioteca personal y listas iniciales |
| PF-02 | Cr?tica | Inicio de sesi?n | Usuario existente y activo | Acceder a login, introducir credenciales v?lidas, enviar formulario | El sistema autentica al usuario, crea sesi?n y redirige a `/catalogo` |
| PF-03 | Alta | Rechazo de login inv?lido | Pantalla de login disponible | Introducir credenciales incorrectas o usuario inactivo, enviar formulario | Se muestra un error y no se concede acceso a la zona privada |
| PF-04 | Cr?tica | Protecci?n de rutas privadas | No haber iniciado sesi?n | Intentar abrir `/catalogo`, `/lectura`, `/listas`, `/bibliotecas` o `/stats` | La aplicaci?n impide el acceso y redirige a login |
| PF-05 | Cr?tica | Alta de libro en cat?logo | Usuario autenticado con biblioteca accesible | Crear un libro con campos obligatorios y biblioteca destino | El libro se guarda correctamente y aparece en el cat?logo |
| PF-06 | Alta | Validaci?n del formulario de libro | Usuario autenticado | Intentar crear un libro sin campos obligatorios o sin biblioteca | El sistema muestra errores de validaci?n y no guarda datos inv?lidos |
| PF-07 | Alta | Edici?n de libro o ejemplar | Existencia de un libro en cat?logo | Abrir detalle, modificar datos relevantes y guardar | Los cambios persisten y se reflejan en vistas de cat?logo y detalle |
| PF-08 | Cr?tica | Flujo de lectura completo | Libro existente en biblioteca del usuario | Marcar un libro como pendiente, despu?s como leyendo y finalmente como terminado | El estado cambia correctamente y el libro aparece en la pesta?a correspondiente |
| PF-09 | Alta | Reapertura de libro terminado | Libro marcado como terminado | Reabrir la lectura desde la interfaz | El sistema solicita confirmaci?n y reabre la lectura como relectura sin inconsistencias |
| PF-10 | Alta | Filtro de lectura por biblioteca | Usuario con varias bibliotecas accesibles | Entrar en lectura y cambiar la biblioteca seleccionada | Solo se muestran los libros asociados a la biblioteca filtrada |
| PF-11 | Alta | Creaci?n y gesti?n de listas | Usuario autenticado y cat?logo con al menos un libro | Crear lista, editar nombre, a?adir libro y eliminarlo despu?s | La lista se actualiza correctamente y el contador refleja el cambio |
| PF-12 | Alta | Acceso restringido a listas ajenas | Existencia de lista no accesible para el usuario | Intentar abrir una lista ajena o no accesible | El sistema bloquea el acceso o muestra estado no disponible |
| PF-13 | Cr?tica | Creaci?n de biblioteca compartida | Usuario autenticado | Crear biblioteca compartida y a?adir un miembro | La biblioteca queda disponible para sus miembros y aparece en su listado |
| PF-14 | Cr?tica | Permisos por rol en biblioteca compartida | Biblioteca compartida con distintos roles configurados | Probar acciones con propietario, editor y miembro | Cada usuario solo puede realizar las acciones permitidas por su rol |
| PF-15 | Alta | Transferencia de propiedad o salida de miembro | Biblioteca compartida existente | Transferir la propiedad o abandonar la biblioteca | El cambio se guarda correctamente y la estructura de miembros permanece consistente |
| PF-16 | Cr?tica | Importaci?n CSV de cat?logo | Usuario autenticado con biblioteca accesible y fichero CSV v?lido | Abrir importaci?n, seleccionar biblioteca, cargar CSV, revisar vista previa y confirmar | La previsualizaci?n detecta errores o duplicados y la importaci?n a?ade los libros v?lidos |
| PF-17 | Media | Exportaci?n CSV del cat?logo | Cat?logo con datos y filtros opcionales | Exportar el cat?logo tras aplicar filtros | Se obtiene un CSV coherente con el listado visible |
| PF-18 | Alta | B?squeda de metadatos externos | Usuario autenticado en formulario de libro | Buscar por ISBN o por t?tulo, autor y editorial | El sistema recupera metadatos v?lidos cuando existen y avisa si no hay coincidencia fiable |
| PF-19 | Alta | Publicaci?n de rese?a p?blica | Usuario con libro compartido y valoraci?n guardada | Publicar una rese?a desde lectura o detalle | La rese?a aparece en el muro de la biblioteca compartida |
| PF-20 | Alta | Edici?n y retirada de rese?a | Existencia de una rese?a publicada por el usuario | Editar la rese?a o eliminarla | Los cambios se reflejan correctamente; si se elimina, deja de mostrarse |
| PF-21 | Alta | Registro de actividad comunitaria | Biblioteca compartida con actividad reciente | A?adir libros o importar cat?logo en biblioteca compartida | El muro muestra eventos de actividad con etiquetas correctas |
| PF-22 | Alta | Pr?stamo de libro compartido | Existencia de un ejemplar compartido disponible | Registrar un pr?stamo y posteriormente su devoluci?n | El pr?stamo activo y su historial quedan reflejados correctamente |
| PF-23 | Media | Estad?sticas de cat?logo y lectura | Usuario autenticado con datos registrados | Abrir estad?sticas, cambiar de pesta?a y de biblioteca | Las m?tricas cambian conforme a la vista y biblioteca seleccionadas |
| PF-24 | Media | Objetivo anual de lectura | Usuario autenticado | Introducir un objetivo anual v?lido y guardarlo | El objetivo se persiste y se actualizan los indicadores relacionados |
| PF-25 | Media | Rutas legacy y redirecciones | Aplicaci?n en ejecuci?n | Acceder a rutas antiguas como `/auth`, `/leyendo` o `/libros/:id` | La aplicaci?n redirige a las rutas vigentes sin romper el flujo |

## 8. Priorizaci?n de Escenarios

Los escenarios m?s relevantes para aceptaci?n funcional, defensa acad?mica o validaci?n previa a entrega son:

- PF-01 Registro de usuario.
- PF-02 Inicio de sesi?n.
- PF-04 Protecci?n de rutas privadas.
- PF-05 Alta de libro en cat?logo.
- PF-08 Flujo de lectura completo.
- PF-13 Creaci?n de biblioteca compartida.
- PF-14 Permisos por rol en biblioteca compartida.
- PF-16 Importaci?n CSV de cat?logo.
- PF-19 Publicaci?n de rese?a p?blica.
- PF-22 Pr?stamo de libro compartido.

## 9. Riesgos y Consideraciones

- La ausencia de una suite E2E implica mayor dependencia de pruebas manuales para validar flujos integrados.
- Los escenarios multiusuario son especialmente relevantes en bibliotecas compartidas, comunidad y pr?stamos.
- Las integraciones externas de metadatos pueden verse afectadas por disponibilidad o calidad de datos del servicio remoto.
- Importaci?n/exportaci?n y permisos son ?reas con riesgo alto de regresi?n funcional.

## 10. Estado del Documento

- **Versi?n**: 1.0
- **Estado**: Documento de planificaci?n y referencia
- **Implementaci?n E2E**: No incluida en el alcance actual
