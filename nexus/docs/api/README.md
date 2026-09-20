# Nexus Inventory — Phase 1 API

Interactive docs: open `/api/docs` while the Next.js app is running.

Raw OpenAPI 3.0: `/api/docs?format=json` or this file `openapi.json`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/categories` | List / create categories |
| GET/PUT/DELETE | `/api/categories/:id` | Category by ID |
| GET/POST | `/api/products` | List / create products |
| GET/PUT/PATCH/DELETE | `/api/products/:id` | Product by ID |
| GET/POST | `/api/inventory` | List / create stock rows |
| GET/PUT/DELETE | `/api/inventory/:id` | Inventory item by ID |
| POST | `/api/inventory/adjust` | Adjust on-hand quantity |
| POST | `/api/inventory/stock-take` | Physical count reconciliation |

All mutating routes (except `/api/docs`) require a NextAuth session.

Legacy dashboard mirrors also exist under `/api/dashboard/*`.
