# Serpico v0.1

An AI Agent assistant helper application for police forces on patrol or in office use, and for civilians to check nearby safety status with AI assistance.

## Overview

Serpico is a demo and basic framework for a comprehensive police assistance and civilian safety application. It provides AI-powered features for both law enforcement officers and civilians, with real-time location-based services and intelligent recommendations.

## Features

### For Police Officers
- **In Pursue**: Ongoing cases and pursuits on a map canvas with real-time AI chat suggestions
- **Perps**: AI chat with database of perps from recent cases (configurable year range)
- **Case Library**: AI chat for historical cases with search and wiki functionality
- **Emergency Notification / 911 Dispatch**: AI-categorized notifications with suggestions based on officer rank/ability
- **Leisure**: AI chat for after-hour activities, training, healthcare, and social activities

### For Civilians
- **Nearby Officers/Police Vehicles**: Real-time map display with AI chat showing officer information
- **Nearby Perps/Criminals**: Recent history events with privacy-compliant display
- **Safe Route Recommendations**: AI-powered route suggestions avoiding danger zones
- **Crime Notifications**: Location-based crime alerts for nearby areas

### Common Features
- **Map Canvas**: Default home screen with location-based services
- **AI Chat Drawer**: Context-aware AI assistant accessible from any screen
- **Settings**: User profile management and theme toggle (light/dark mode)
- **Mock Authentication**: Simplified login for demo purposes

## Tech Stack

### Frontend
- **ReactJS** with TypeScript
- **Tailwind CSS** for styling
- **Mobile-first** responsive design
- **Map Integration** (React Leaflet with OpenStreetMap)

### Backend
- **Golang** with Gin framework
- **BadgerDB** for key-value caching
- **SQLite** for structured data
- **SwaggerUI** for API documentation
- **Goroutines** for concurrent operations

## Project Structure

```
serpico/
├── frontend/          # React application
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── contexts/      # React contexts (Auth, Theme)
│   │   ├── pages/         # Page components
│   │   │   ├── police/    # Police-specific pages
│   │   │   └── civilian/  # Civilian-specific pages
│   │   └── App.tsx
│   └── package.json
├── backend/           # Golang API server
│   ├── internal/
│   │   ├── api/          # API handlers and routes
│   │   ├── database/     # Database initialization
│   │   └── middleware/   # HTTP middleware
│   └── main.go
├── docs/              # Additional documentation
├── DESIGN.md          # Design document
└── README.md          # This file
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Go 1.21+
- Git
- No API keys required for maps (uses OpenStreetMap tiles)

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (optional, for map functionality):
```bash
cp .env.example .env
# Maps use OpenStreetMap tiles - no API key required
```

4. Start the development server:
```bash
npm start
```

The frontend will be available at `http://localhost:5091`

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install Go dependencies:
```bash
go mod download
```

3. Run the server:
```bash
go run main.go
```

The backend API will be available at `http://localhost:5092`
SwaggerUI will be available at `http://localhost:5092/swagger/index.html`

### Quick Start (Both Services)

You can run both services in separate terminals:

**Terminal 1 (Backend):**
```bash
cd backend && go run main.go
```

**Terminal 2 (Frontend):**
```bash
cd frontend && npm start
```

## Debugging in VS Code

Both frontend and backend are fully debuggable in VS Code. See [docs/DEBUGGING.md](./docs/DEBUGGING.md) for detailed instructions.

### Quick Start Debugging

1. **Install Recommended Extensions**: VS Code will prompt you, or install:
   - Go extension (golang.go)
   - ESLint, Prettier, TypeScript support

2. **Debug Frontend**:
   - Open Debug panel (Ctrl+Shift+D / Cmd+Shift+D)
   - Select "Debug Frontend (Chrome)"
   - Press F5
   - Set breakpoints in TypeScript/TSX files

3. **Debug Backend**:
   - Select "Debug Backend (Go)"
   - Press F5
   - Set breakpoints in Go files

4. **Debug Both**:
   - Select "Debug Full Stack"
   - Press F5
   - Both services start with debugging enabled

### Debug Configurations Available

- **Debug Frontend (Chrome)**: Launch Chrome with debugging
- **Debug Frontend (Edge)**: Launch Edge with debugging
- **Debug Backend (Go)**: Debug Go backend with breakpoints
- **Debug Backend (Delve)**: Advanced Go debugging with Delve
- **Attach to Frontend**: Attach to running Chrome instance
- **Debug Full Stack**: Debug both frontend and backend simultaneously

## Usage

1. **Login**: Use the mock login page. You can:
   - Enter any email/password and click "Login"
   - Click "Quick Login (Mock)" for instant access
   - Use "Sign in with Google" or "Sign in with Apple" (both mocked)

2. **Navigation**: 
   - Bottom navigation bar for quick access to modules
   - AI Chat drawer button to open the AI assistant
   - Settings icon to manage profile and theme

3. **Map Canvas**: 
   - Default home screen shows map with relevant markers
   - Click markers for details
   - Open AI chat drawer for context-aware assistance

4. **Theme Toggle**: 
   - Go to Settings
   - Toggle between light and dark mode

## API Endpoints

All API endpoints are documented in SwaggerUI at `http://localhost:5092/swagger/index.html`

Main endpoints:
- `POST /api/v1/auth/login` - Mock login
- `GET /api/v1/users/me` - Get current user
- `GET /api/v1/cases` - Get cases
- `GET /api/v1/perps` - Get perps
- `GET /api/v1/officers` - Get officers
- `GET /api/v1/emergencies` - Get emergencies
- `POST /api/v1/chat` - AI chat endpoint
- `GET /api/v1/recommendations/routes` - Route recommendations

## Admin Backstage

A separate React application for managing backend data and RAG training:

### Setup Admin Frontend

```bash
cd admin-frontend
npm install
npm start
```

The admin interface will be available at `http://localhost:5093`

### Features
- **Data Viewer**: View all backend data modules (Cases, Perps, Officers, Emergencies, Users)
- **RAG Data Training**: Format and manage RAG documents for AI training
  - Create, edit, and delete RAG documents
  - Categorize with tags and locations
  - Manage AI training data

See [admin-frontend/README.md](./admin-frontend/README.md) for more details.

## Development Status

This is version 0.1 - a demo and basic framework. Features are implemented with mock data and simplified authentication for demonstration purposes.

## Design

See [DESIGN.md](./DESIGN.md) for detailed design specifications and architecture.

## Logo & Branding

- **Logo**: Shield design inspired by Captain America's shield
- **Colors**: 
  - Primary Red: #DC2626 (eye-friendly)
  - Primary Blue: #2563EB (eye-friendly)

## Deployment

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed deployment instructions to Render.

Quick summary:
- **Backend**: Deploy as Web Service (Go)
- **Main Frontend**: Deploy as Static Site
- **Admin Frontend**: Deploy as Static Site
- All services require environment variables (see deployment guide)

## License

[To be determined]

## Contributing

[To be determined]
