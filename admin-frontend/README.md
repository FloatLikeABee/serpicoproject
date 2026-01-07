# Serpico Admin - Backstage Management

Admin interface for managing and viewing serial killers, mysteries, paranormal events, and conspiracy theories data.

## Features

- **Data Viewer**: View all data from backend modules (Serial Killer Cases, Serial Killers, Mysteries, Officers, Emergencies, Users)
- **Mysteries Management**: Manage paranormal events, urban legends, and conspiracy theories
- **RAG Data Training**: Format and manage RAG documents for AI training
  - Create, edit, and delete RAG documents
  - Format documents with categories, tags, and locations
  - Manage AI training data

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```
REACT_APP_API_URL=http://localhost:5092/api/v1
```

3. Start the development server:
```bash
npm start
```

The admin interface will be available at `http://localhost:5093`

## Usage

1. **Viewing Data**: Click on any module card (Serial Killer Cases, Serial Killers, Mysteries, etc.) to view all records in a table format
2. **Mysteries**: Click on "Mysteries" to view and manage paranormal events, urban legends, and conspiracy theories
3. **RAG Training**: Click on "RAG Data Training" to manage AI training documents
   - Click "Add New Document" to create a new RAG document
   - Fill in the form with title, content, category, location (optional), and tags
   - Edit or delete existing documents using the action buttons

## API Endpoints Used

- `/api/v1/admin/cases` - Get all serial killer cases
- `/api/v1/admin/perps` - Get all serial killers
- `/api/v1/admin/mysteries` - Get all mysteries (paranormal, urban legends, conspiracy)
- `/api/v1/admin/officers` - Get all officers
- `/api/v1/admin/emergencies` - Get all emergencies
- `/api/v1/admin/users` - Get all users
- `/api/v1/rag/documents` - CRUD operations for RAG documents

