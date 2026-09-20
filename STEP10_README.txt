FloodFlow Step 10 — Trusted Reports & Verification

NEW
- REPORTS operations panel
- Active / verified / pending / blocked counters
- Freshness labels (Live / Recent / Fresh / Stale)
- Reports older than 6 hours excluded from active routing/risk
- Verified reports weighted more strongly than pending reports
- Backend admin verification endpoint
- Rejected reports hidden from public map and risk/routing use
- Backward-compatible SQLite migration

BACKEND ENVIRONMENT VARIABLE
FLOODFLOW_ADMIN_KEY=<your-private-key>

FILES TO REPLACE
backend/main.py
src/App.jsx
src/api.js
src/index.css

Also update render.yaml if you use Render Blueprint deployment.
