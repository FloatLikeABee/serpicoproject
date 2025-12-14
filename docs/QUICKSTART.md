# Quick Start Guide

## Prerequisites Check

Before starting, ensure you have:
- Node.js 18+ installed (`node --version`)
- Go 1.21+ installed (`go version`)
- npm or yarn installed

## Step-by-Step Setup

### 1. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 2. Install Backend Dependencies

```bash
cd backend
go mod download
```

### 3. Start Backend Server

In the `backend` directory:
```bash
go run main.go
```

You should see:
```
Database initialized successfully
Server starting on port 5092
Swagger UI available at http://localhost:5092/swagger/index.html
```

### 4. Start Frontend Server

In a new terminal, navigate to `frontend` directory:
```bash
cd frontend
npm start
```

The React app will open automatically at `http://localhost:5091`

## First Use

1. **Login**: 
   - Click "Quick Login (Mock)" button on the login page
   - Or enter any email/password and click "Login"
   - Or use "Sign in with Google" or "Sign in with Apple" (all mocked)

2. **Explore Modules**:
   - Use bottom navigation to switch between modules
   - Click the AI Chat button to open the AI assistant drawer
   - Go to Settings to change theme (light/dark mode) or user role

3. **Map Features**:
   - Default home shows a map canvas
   - Click markers to see details
   - Open AI chat for context-aware assistance

## Troubleshooting

### Frontend Issues

- **Port 5091 already in use**: Change the port in `package.json` or kill the process using port 5091
- **Map not loading**: Add a Mapbox token in `.env` file (optional for demo)
- **Build errors**: Run `npm install` again to ensure all dependencies are installed

### Backend Issues

- **Port 5092 already in use**: Change the PORT environment variable or kill the process
- **Database errors**: Delete the `backend/data` directory and restart
- **Go module errors**: Run `go mod tidy` in the backend directory

## Testing API Endpoints

Visit `http://localhost:5092/swagger/index.html` to see all available API endpoints and test them directly.

## Development Tips

- Frontend hot-reloads automatically on file changes
- Backend requires restart after code changes
- Check browser console for frontend errors
- Check terminal for backend errors
- Use SwaggerUI to test API endpoints

