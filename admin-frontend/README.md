# Serpico Admin

Mobile-friendly admin UI for backend data, RAG training, and data collection.

## Access (production)

1. Open **https://serpico-admin.onrender.com** (phone or desktop browser).
2. Log in with the admin account configured in the backend:
   - **Username:** `g@transfdr`
   - **Password:** `eight88`

The admin site talks to `https://serpicoproject.onrender.com/api/v1` by default. Cold starts on Render can take a minute if the API has been idle.

## What it includes

- **Cases / Suspects / Officers / Emergencies / Users** — view and add records
- **Data Collection** — ingest content from URL, API, or file into RAG
- **RAG Training** — create and edit AI training documents

Legacy “Mysteries” (paranormal) admin UI was removed; the in-app Board is AI-driven and does not use that table UI.

## Local setup

```bash
npm install
```

Optional `.env`:

```
REACT_APP_API_URL=http://localhost:5092/api/v1
```

```bash
npm start
```

Admin runs at **http://localhost:5093**.

## API endpoints used

- `POST /api/v1/admin/login`
- `GET|POST /api/v1/admin/cases`
- `GET|POST /api/v1/admin/perps`
- `GET|POST /api/v1/admin/officers`
- `GET|POST /api/v1/admin/emergencies`
- `GET /api/v1/admin/users`
- `CRUD /api/v1/rag/documents`
- `POST /api/v1/admin/collection/*`
