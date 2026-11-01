# SocratesFrontend

Frontend de Sócrates (Seminario Integrador 3K1 2026, UTN FRC): React + Vite + TypeScript + Tailwind.

Parte del prototipo de UX/UI de Mateo Fernández (repo `MateoFernandez04/proyectoPriv`), que sigue
siendo la referencia de diseño. Este repo es el producto: se conecta al backend
(`JoaquinMorais/SocratesBackend`).

## Levantar todo con Docker (para probar)

Solo requiere Docker Desktop. Levanta la base, el backend (se baja de su repo de GitHub) y el
frontend:

```bash
docker compose up --build -d   # http://localhost:3000
```

- Usuarios de prueba: los carga el backend la primera vez que arranca la base y todos usan la
  contraseña `Test1234!`. Uno por rol:

  | Rol | Correo |
  |---|---|
  | Administrador | `marta.rodriguez@frc.utn.edu.ar` |
  | Docente | `carlos.ruiz@frc.utn.edu.ar` |
  | Estudiante | `100001@sistemas.frc.utn.edu.ar` |

  El resto aparece en la pantalla Usuarios; los estudiantes entran con `{legajo}@sistemas.frc.utn.edu.ar`.
  Un usuario creado desde la app no tiene contraseña: la crea con "Crear o restablecer
  contraseña", que manda un código por mail. Para volver a la base inicial: `docker compose down -v`
  y `docker compose up --build -d`.
- Sin configurar nada, los mails (por ejemplo, el código para crear o restablecer la contraseña)
  no se envían: se leen con `docker compose logs backend`. Para mandarlos de verdad, guardar el
  `.env` del backend (se pasa por privado) como `.env.backend` en esta carpeta y poner tu correo
  institucional en `EMAIL_DEV_REDIRECT`.
- Para traer la última versión del backend o del frontend: `docker compose up --build -d` de nuevo.
- Para apagar: `docker compose down` (agregar `-v` borra también la base).

## Arrancar para desarrollar

Requiere Node 20 o superior.

```bash
npm install
cp .env.example .env.local   # y ajustar si hace falta
npm run dev                  # http://localhost:3000
```

- **Con backend:** desde esta misma carpeta, `docker compose up -d backend` (levanta la base y el
  backend, sin el contenedor del frontend) y dejar `VITE_USE_MOCK=false`. Vite reenvía `/api/...` a
  `http://localhost:8000`.
- **Sin backend:** `VITE_USE_MOCK=true`. Las pantallas usan datos simulados y aparece el selector
  "Rol en vista" para recorrerlas como admin, profesor o alumno.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 3000 |
| `npm run lint` | Chequeo de tipos de TypeScript |
| `npm run build` | Build de producción en `dist/` |

## Cómo se trabaja

Nadie sube directo a `main`: cada tarea va en su rama (`feat/...`, `fix/...`) y entra por Pull
Request revisado por otro integrante. El contrato de la API está en `http://localhost:8000/docs`
con el backend levantado.
