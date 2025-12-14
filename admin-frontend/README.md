# Serpico Admin - Backstage Management

Admin interface for managing and viewing all backend data modules and RAG training data.

## Features

- **Data Viewer**: View all data from backend modules (Cases, Perps, Officers, Emergencies, Users)
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

1. **Viewing Data**: Click on any module card (Cases, Perps, Officers, etc.) to view all records in a table format
2. **RAG Training**: Click on "RAG Data Training" to manage AI training documents
   - Click "Add New Document" to create a new RAG document
   - Fill in the form with title, content, category, location (optional), and tags
   - Edit or delete existing documents using the action buttons

## API Endpoints Used

- `/api/v1/admin/cases` - Get all cases
- `/api/v1/admin/perps` - Get all perps
- `/api/v1/admin/officers` - Get all officers
- `/api/v1/admin/emergencies` - Get all emergencies
- `/api/v1/admin/users` - Get all users
- `/api/v1/rag/documents` - CRUD operations for RAG documents

