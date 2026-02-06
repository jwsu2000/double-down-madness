# Double Down Madness

Multiplayer blackjack with Socket.IO realtime state sync.

## Local Development

Requirements:
- Node.js 20+
- npm

Run:

```bash
npm ci
npm run dev
```

App:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

## Deploy: Vercel Frontend + Railway Backend

This repo is configured for split hosting:
- Frontend static build on Vercel
- Node + Socket.IO server on Railway

### 1) Deploy backend to Railway

1. Create a Railway service from this repo.
2. Railway uses `railway.json`:
   - Build: `npm install --include=dev && npm run build`
   - Start: `npx tsx server/index.ts`
3. Set Railway environment variable:
   - `CLIENT_ORIGIN=https://your-vercel-app.vercel.app`
   - You can provide multiple origins as CSV.
4. If Railway still uses an older Node version, set:
   - `NIXPACKS_NODE_VERSION=20.19.0`

### 2) Deploy frontend to Vercel

1. Import the same repo into Vercel.
2. Keep framework as Vite defaults.
3. Set Vercel environment variable:
   - `VITE_SOCKET_URL=https://your-railway-service.up.railway.app`
4. Redeploy.

### 3) Verify

Open your Vercel URL and check:
- Status changes from "Connecting..." to connected.
- You can create a room and share room code.

## Environment Variables

See `.env.example` for all deployment variables.

Client:
- `VITE_SOCKET_URL`: Socket.IO backend base URL. If unset, client uses same-origin.

Server:
- `CLIENT_ORIGIN`: allowed frontend origin(s) for Socket.IO CORS. Comma-separated.
