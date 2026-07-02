# modules/

Each monitoring feature lives here as its own vertical slice.

## Conventions

- Each slice lives in its own folder: `modules/<feature-name>/`
- Inside a slice: `components/`, `hooks/`, `store.ts`, `api.ts`, `index.ts`
- Slices do not import each other directly — shared code goes under `shared/`
- Nothing is exported outside `index.ts` (encapsulation)

## Upcoming Slices (examples)

- `health/` — Runtime health status
- `instances/` — Active workflow instances
- `alerts/` — Alarms and notifications
- `metrics/` — Performance metrics
