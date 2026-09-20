FLOODFLOW — NETLIFY + RENDER DEPLOYMENT

PROJECT STRUCTURE
=================
FloodFlow_Deployment_Full_Code/
├─ backend/
│  ├─ main.py
│  └─ requirements.txt
├─ public/
│  └─ _redirects
├─ src/
│  ├─ data/
│  │  └─ drainageAssets.js
│  ├─ App.jsx
│  ├─ api.js
│  ├─ index.css
│  └─ main.jsx
├─ .env.example
├─ .env.production.example
├─ .gitignore
├─ index.html
├─ netlify.toml
├─ package.json
├─ render.yaml
└─ vite.config.js


STEP 1 — PUSH TO GITHUB
=======================
From the project root:

git init
git add .
git commit -m "FloodFlow deployment"

Then connect the repository to GitHub.


STEP 2 — DEPLOY FASTAPI ON RENDER
==================================
Option A: Render can read render.yaml automatically.

Option B: Create a Web Service manually:
Root Directory:
backend

Build Command:
pip install -r requirements.txt

Start Command:
uvicorn main:app --host 0.0.0.0 --port $PORT

After deployment, test:
https://YOUR-RENDER-DOMAIN/
https://YOUR-RENDER-DOMAIN/docs
https://YOUR-RENDER-DOMAIN/api/weather


STEP 3 — NETLIFY ENVIRONMENT VARIABLE
======================================
In Netlify:

Site configuration
→ Environment variables
→ Add variable

Key:
VITE_API_URL

Value:
https://YOUR-RENDER-DOMAIN/api

IMPORTANT:
Do NOT use http://127.0.0.1:8000 online.


STEP 4 — NETLIFY BUILD
======================
Netlify settings:

Build command:
npm run build

Publish directory:
dist

The included netlify.toml already configures this.

After setting VITE_API_URL, TRIGGER A NEW DEPLOY.
Vite injects VITE_* environment variables at build time.


STEP 5 — VERIFY
===============
On https://floodflow.netlify.app open Developer Tools → Network.

API requests should look like:

https://YOUR-RENDER-DOMAIN/api/weather
https://YOUR-RENDER-DOMAIN/api/reports
https://YOUR-RENDER-DOMAIN/api/risks
https://YOUR-RENDER-DOMAIN/api/route

They must NOT call:

http://127.0.0.1:8000


CORS
====
backend/main.py already allows:
http://localhost:5174
http://127.0.0.1:5174
https://floodflow.netlify.app

You can add additional origins on Render with:
FRONTEND_ORIGINS=https://example.netlify.app,https://example.com


DATABASE NOTE
=============
The current citizen-report database is SQLite.
On many free cloud hosts, local files may be ephemeral.
For permanent reports, migrate the report table to Supabase/PostgreSQL later.


STEP 10 — TRUSTED REPORTS
=========================
This build adds report freshness, verification status, admin verification,
rejected-report filtering, and trust-weighted citizen-report influence.

On Render, set FLOODFLOW_ADMIN_KEY to a private value.
Example: a long random password.

In FloodFlow open REPORTS and enter that key in the prototype verification
console. Do not share the key with public users.

Reports older than 6 hours are shown as stale and excluded from active
risk/routing influence. Pending reports use reduced trust weight; verified
reports use full trust weight.
