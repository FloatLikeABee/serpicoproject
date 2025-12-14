# Debugging Guide

This guide explains how to debug both the frontend and backend in VS Code.

## Prerequisites

### Required VS Code Extensions

Install the recommended extensions (VS Code will prompt you, or install manually):

- **Go** (golang.go) - For Go debugging
- **ESLint** (dbaeumer.vscode-eslint) - For TypeScript/JavaScript linting
- **Prettier** (esbenp.prettier-vscode) - For code formatting
- **TypeScript and JavaScript Language Features** (built-in)
- **Tailwind CSS IntelliSense** (bradlc.vscode-tailwindcss) - For Tailwind autocomplete

### Go Tools

The Go extension will automatically install required tools. If needed, run:
```bash
cd backend
go install github.com/go-delve/delve/cmd/dlv@latest
```

## Debugging Frontend (React)

### Option 1: Launch Chrome with Debugging

1. Open the Debug panel (Ctrl+Shift+D / Cmd+Shift+D)
2. Select "Debug Frontend (Chrome)" from the dropdown
3. Press F5 or click the green play button
4. Chrome will open with debugging enabled
5. Set breakpoints in your TypeScript/TSX files
6. The debugger will pause at breakpoints

### Option 2: Attach to Running Chrome

1. Start the frontend manually: `cd frontend && npm start`
2. Launch Chrome with remote debugging:
   ```bash
   # macOS
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
   
   # Linux
   google-chrome --remote-debugging-port=9222
   
   # Windows
   chrome.exe --remote-debugging-port=9222
   ```
3. Navigate to `http://localhost:5091`
4. In VS Code, select "Attach to Frontend (Chrome)"
5. Press F5 to attach

### Frontend Debugging Tips

- **Breakpoints**: Click in the gutter next to line numbers to set breakpoints
- **Watch**: Add variables to the Watch panel to monitor values
- **Call Stack**: View the call stack when paused
- **Debug Console**: Execute JavaScript expressions in the context of the paused code
- **Source Maps**: Already enabled via `GENERATE_SOURCEMAP=true` in `.env`

## Debugging Backend (Go)

### Option 1: Debug Backend (Go)

1. Open the Debug panel (Ctrl+Shift+D / Cmd+Shift+D)
2. Select "Debug Backend (Go)" from the dropdown
3. Press F5 or click the green play button
4. Set breakpoints in your Go files (`.go`)
5. The debugger will pause at breakpoints when the code executes

### Option 2: Debug Backend (Delve)

For more advanced debugging with Delve:

1. Select "Debug Backend (Delve)" from the dropdown
2. Press F5
3. Delve provides additional debugging features

### Backend Debugging Tips

- **Breakpoints**: Click in the gutter next to line numbers
- **Step Over (F10)**: Execute the current line
- **Step Into (F11)**: Step into function calls
- **Step Out (Shift+F11)**: Step out of current function
- **Continue (F5)**: Continue execution
- **Variables**: View local and global variables
- **Watch**: Monitor specific expressions
- **Debug Console**: Execute Go expressions

## Debugging Both (Full Stack)

### Debug Full Stack

1. Select "Debug Full Stack" from the dropdown
2. Press F5
3. Both frontend and backend will start with debugging enabled
4. Set breakpoints in both frontend and backend code
5. The debugger will pause at breakpoints in either codebase

### Manual Full Stack Debugging

1. Start backend in debug mode: Select "Debug Backend (Go)" and press F5
2. Start frontend in debug mode: Select "Debug Frontend (Chrome)" and press F5
3. Both will run simultaneously with debugging enabled

## Common Debugging Scenarios

### Debugging API Calls

1. Set a breakpoint in the backend handler (e.g., `handlers.go`)
2. Set a breakpoint in the frontend API call code
3. Trigger the API call from the frontend
4. Debug through the request flow

### Debugging React Components

1. Set breakpoints in component files (`.tsx`)
2. Use React DevTools in Chrome for component inspection
3. Check the React Components tab in Chrome DevTools

### Debugging State Management

1. Set breakpoints in context files (`AuthContext.tsx`, `ThemeContext.tsx`)
2. Use React DevTools to inspect state
3. Monitor state changes in the Variables panel

### Debugging Database Operations

1. Set breakpoints in database functions (`database.go`)
2. Use the Debug Console to inspect database objects
3. Check the `data/` directory for database files

## Troubleshooting

### Frontend Debugging Issues

**Problem**: Breakpoints not hitting
- **Solution**: Ensure `GENERATE_SOURCEMAP=true` is in `.env`
- **Solution**: Clear browser cache and restart
- **Solution**: Check that source maps are loading in Chrome DevTools (Sources tab)

**Problem**: Can't attach to Chrome
- **Solution**: Ensure Chrome is launched with `--remote-debugging-port=9222`
- **Solution**: Check that port 9222 is not in use

**Problem**: Source maps not working
- **Solution**: Verify `GENERATE_SOURCEMAP=true` in `.env`
- **Solution**: Restart the dev server after adding the env variable

### Backend Debugging Issues

**Problem**: Breakpoints not hitting
- **Solution**: Ensure you're using the "Debug Backend (Go)" configuration
- **Solution**: Check that the Go extension is installed
- **Solution**: Verify `go` is in your PATH

**Problem**: Can't start debugger
- **Solution**: Install Delve: `go install github.com/go-delve/delve/cmd/dlv@latest`
- **Solution**: Check Go version (requires 1.21+)

**Problem**: Port already in use
- **Solution**: Change the PORT in launch.json or kill the process using port 5092

## Advanced Debugging

### Conditional Breakpoints

Right-click on a breakpoint to add conditions:
- Break only when a variable equals a specific value
- Break only after hitting the breakpoint N times

### Logpoints

Add logpoints to log messages without modifying code:
- Right-click in the gutter
- Select "Add Logpoint"
- Enter a message with expressions: `Variable value: {variableName}`

### Debug Console

Use the Debug Console to:
- Evaluate expressions
- Call functions
- Inspect variables
- Modify variable values (frontend only)

## Keyboard Shortcuts

- **F5**: Start/Continue debugging
- **Shift+F5**: Stop debugging
- **Ctrl+Shift+F5 / Cmd+Shift+F5**: Restart debugging
- **F9**: Toggle breakpoint
- **F10**: Step over
- **F11**: Step into
- **Shift+F11**: Step out
- **Ctrl+Shift+D / Cmd+Shift+D**: Open Debug panel

## Additional Resources

- [VS Code Debugging Documentation](https://code.visualstudio.com/docs/editor/debugging)
- [Go Debugging with VS Code](https://github.com/golang/vscode-go/wiki/debugging)
- [React Debugging](https://react.dev/learn/react-developer-tools)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

