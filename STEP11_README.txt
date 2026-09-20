FLOODFLOW STEP 11 — LIVE DATA MODE

This build removes the synthetic demo flood zones and the fabricated/hard-coded risk priors.

LIVE / REAL INPUTS NOW USED
- Open-Meteo current weather + rolling 24 h precipitation
- RainViewer current radar frames
- Open-Meteo Flood API / GloFAS modelled river discharge
- Copernicus DEM GLO-90 elevation
- OpenStreetMap / Overpass mapped drainage geometry
- FloodFlow citizen reports from the backend database
- OSRM / OpenStreetMap routing

IMPORTANT LIMITATION
There is still no connected verified public realtime Guwahati street-flood-depth or drain-blockage API. FloodFlow therefore labels its risk as a LIVE DERIVED INDEX, not an official warning. Citizen reports are the realtime street-level ground input.

ROUTING
Synthetic stress-test circles are removed. Safer routing now passes only current High/Very High derived risk points and recent caution/blocked citizen reports as avoidance hazards.

REFRESH
- selected-location weather: 2 min
- live risk grid: 2 min
- citizen reports: 20 sec
- radar: 5 min
- river model: 30 min

CLEAN OLD TEST REPORTS (OPTIONAL)
If your existing SQLite database contains dummy reports created during testing, stop the backend and delete backend/floodflow.db. The backend will create a clean database on the next start. Do this only if you do not need the existing reports.
