# SocratesFrontend

Frontend de Sócrates (Seminario Integrador 3K1 2026, UTN FRC): React + Vite + TypeScript + Tailwind.

Parte del prototipo de UX/UI de Mateo Fernández (repo `MateoFernandez04/proyectoPriv`), que sigue
siendo la referencia de diseño. Este repo es el producto: se conecta al backend
(`JoaquinMorais/SocratesBackend`).

## Arrancar

Requiere Node 20 o superior.

```bash
npm install
cp .env.example .env.local   # y ajustar si hace falta
npm run dev                  # http://localhost:3000
```

- **Con backend:** levantar `SocratesBackend` (`docker compose up -d`) y dejar `VITE_USE_MOCK=false`.
  Vite reenvía `/api/...` a `http://localhost:8000`.
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
