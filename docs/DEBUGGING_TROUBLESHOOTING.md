# Debugging Troubleshooting Guide

## Common Go Debugging Issues

### Issue: "could not read debug info (decoding dwarf section info)"

**Symptoms:**
- Error: "could not launch process: could not read debug info (decoding dwarf section info at offset 0x0: too short)"
- Error: "could not find rodata struct member"

**Solutions:**

1. **Install/Update Delve:**
   ```bash
   go install github.com/go-delve/delve/cmd/dlv@latest
   ```

2. **Verify Delve Installation:**
   ```bash
   dlv version
   # Should show version information
   ```

3. **Clean Go Cache:**
   ```bash
   cd backend
   go clean -cache
   go mod tidy
   ```

4. **Use Correct Debug Configuration:**
   - Use "Debug Backend (Go)" configuration
   - Ensure `program` points to `main.go` file
   - Mode should be set to "debug" or "auto"

5. **Check Go Version Compatibility:**
   ```bash
   go version
   # Should be Go 1.21 or later
   ```

6. **Restart VS Code:**
   - Sometimes VS Code needs a restart after installing Delve
   - Reload the window: `Cmd+Shift+P` → "Developer: Reload Window"

### Issue: Delve Not Found

**Solution:**
1. Install Delve: `go install github.com/go-delve/delve/cmd/dlv@latest`
2. Add to PATH (if needed):
   ```bash
   export PATH=$PATH:$(go env GOPATH)/bin
   ```
3. Restart VS Code

### Issue: Breakpoints Not Hitting

**Solutions:**
1. Ensure source files match the running code
2. Check that you're using the correct debug configuration
3. Verify the program path in launch.json is correct
4. Try setting breakpoints on executable lines (not comments/blank lines)

### Issue: "Port already in use"

**Solution:**
1. Find the process using the port:
   ```bash
   lsof -i :5092
   ```
2. Kill the process or change the PORT in launch.json

### Issue: Frontend Debugging Not Working

**Solutions:**
1. Ensure `GENERATE_SOURCEMAP=true` in `.env` file
2. Clear browser cache
3. Restart the dev server
4. Check Chrome DevTools → Sources tab for source maps

## Verification Steps

1. **Test Delve Manually:**
   ```bash
   cd backend
   dlv debug main.go
   # Should start Delve debugger
   # Type 'continue' or 'c' to run
   # Type 'exit' to quit
   ```

2. **Test Go Build:**
   ```bash
   cd backend
   go build -o test-build .
   # Should build without errors
   ```

3. **Test VS Code Go Extension:**
   - Open a Go file
   - Check that syntax highlighting works
   - Hover over functions to see if Go language server is working

## Getting Help

If issues persist:
1. Check VS Code Go extension output:
   - View → Output → Select "Go" from dropdown
2. Enable verbose logging in launch.json:
   ```json
   "trace": "verbose",
   "showLog": true
   ```
3. Check Delve logs in VS Code output panel

