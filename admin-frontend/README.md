# Serpico Admin

Dark synth-themed admin UI (matches the main app). Mobile-friendly.

## Access (production)

1. Open **https://serpico-admin.onrender.com**
2. Log in:
   - **Username:** `g@transfdr`
   - **Password:** `eight88`

API default: `https://serpicoproject.onrender.com/api/v1`

## Modules

- **Users** — view app accounts
- **Data Collection** — AI-driven twice-daily web intel (crime news / case studies / solved cold cases worldwide). Knowledge → RAG; news → Markdown digests for frontline chat. Manual **Run now** available.
- **RAG Training** — create and edit AI training documents

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

Runs at **http://localhost:5093**.
