---
description: Start the development server and open it in the browser
allowed-tools: Bash(npm run dev:*), Bash(open:*), Bash(lsof:*), Bash(pkill:*)
---

# Start Development Server

Start the local development server and open it in the browser.

## Steps

1. Check if a dev server is already running on port 3000
2. If running, ask if to restart or just open the URL
3. Start the dev server with `npm run dev` in the background
4. Wait a few seconds for the server to initialize
5. Open http://localhost:3000 in the browser

## Commands to use

- Start server: `npm run dev` (run in background)
- Open in browser: `open http://localhost:3000`
- Check if running: `lsof -i :3000`

Please start the server now and open the local URL.
