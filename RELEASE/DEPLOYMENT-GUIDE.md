# Secret Agent: Find the Imposter – Production Deployment Guide

## Overview
*Secret Agent – Find the Imposter* is a serverless, real-time multiplayer browser game powered by React, TypeScript, Vite, Tailwind CSS, Netlify Functions, and Netlify Blobs.

This guide provides step-by-step instructions for deploying the project to Netlify in production.

---

## Deployment Prerequisites
- Node.js version 18.x or 20.x
- npm version 9.x or higher
- A Netlify account ([https://app.netlify.com](https://app.netlify.com))
- Netlify CLI (optional, for CLI-based deployment): `npm install -g netlify-cli`

---

## Deployment Option A: Netlify Git-Based Deployment (Recommended)

1. **Push repository to GitHub / GitLab / Bitbucket**:
   ```bash
   git remote add origin <your-remote-repo-url>
   git branch -M main
   git push -u origin main
   ```

2. **Connect to Netlify**:
   - Log into [Netlify Console](https://app.netlify.com).
   - Click **"Add new site"** $\rightarrow$ **"Import an existing project"**.
   - Select your Git provider and choose the repository.

3. **Verify Build Configuration**:
   The `netlify.toml` file automatically sets the correct configuration:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
   - **Node version**: Default (Node 18+)

4. **Enable Netlify Blobs**:
   - Netlify Blobs is automatically enabled for all modern Netlify sites.
   - When deploying via Netlify Git integration or Netlify CLI linked site, `NETLIFY_BLOBS_CONTEXT` is injected automatically by Netlify into the function runtime environment.
   - **No manual creation of `NETLIFY_BLOBS_TOKEN` or `NETLIFY_SITE_ID` is needed** when using standard Netlify deployments.

5. **Trigger Deploy**:
   - Click **"Deploy Site"**.
   - Netlify will run `npm run build`, bundle `netlify/functions/game.ts` using esbuild, and publish the site to your unique Netlify URL (`https://<your-site-name>.netlify.app`).

---

## Deployment Option B: Netlify CLI Manual Deployment

1. **Install and Log In to Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   netlify login
   ```

2. **Initialize or Link Site**:
   ```bash
   netlify init
   # Or to link an existing site:
   netlify link
   ```

3. **Build and Deploy to Production**:
   ```bash
   npm run build
   netlify deploy --prod
   ```
   When prompted:
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`

---

## Verification & Health Check

After deployment completes:

1. **Verify SPA Routing**:
   - Navigate to `https://<your-site-name>.netlify.app/` $\rightarrow$ Home screen loads.
   - Navigate directly to `https://<your-site-name>.netlify.app/how-to-play` $\rightarrow$ Directly loads without 404 (handled by `netlify.toml` redirect rules).

2. **Verify Serverless Game Function**:
   - Execute a POST test from terminal or browser console:
     ```bash
     curl -X POST https://<your-site-name>.netlify.app/.netlify/functions/game \
       -H "Content-Type: application/json" \
       -d '{"action":"GET_ROOM","roomCode":"TEST99"}'
     ```
   - Expected response:
     ```json
     {"success":false,"error":"Room TEST99 does not exist","code":"ROOM_NOT_FOUND"}
     ```
     This confirms `/.netlify/functions/game` is active and responding authoritatively with HTTP 404 and structured JSON.

3. **Verify Multiplayer Room Creation**:
   - Open the homepage on Device 1.
   - Click "INITIALIZE MISSION ROOM" $\rightarrow$ Enter codename and select avatar.
   - Verify room code is generated and lobby appears.
   - On Device 2 (or incognito window), enter the 6-character room code.
   - Verify both operatives appear synchronized in the lobby.
