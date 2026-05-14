# API Reference: Helios-X Digital Twin Gateway

## Overview
The Helios-X API is built using FastAPI and serves as the primary interface for the frontend dashboard and external researchers. It provides endpoints for environmental data retrieval, high-fidelity physics simulations, and historical data analysis.

**Base URL:** `http://localhost:8000`

---

## 1. Environmental Data

### `GET /weather`
Retrieves current and forecasted weather data for a specific location.

*   **Query Parameters:**
    *   `lat` (float): Latitude in decimal degrees.
    *   `lon` (float): Longitude in decimal degrees.
*   **Response Schema:**
    ```json
    {
      "temperatureC": 31.4,
      "cloudCoverPercent": 20,
      "windSpeed": 4.2,
      "humidity": 45,
      "condition": "Partly Cloudy"
    }
    ```

### `GET /site-context`
Retrieves local architectural context (buildings, trees) using OpenStreetMap Overpass.

*   **Query Parameters:**
    *   `lat` (float): Latitude.
    *   `lon` (float): Longitude.
*   **Response Schema:**
    ```json
    {
      "buildings": [...],
      "trees": [...]
    }
    ```

---

## 2. Simulation Engine

### `POST /simulate`
Runs a full 24-hour physics simulation with AI policy optimization. Results are automatically persisted to the database.

*   **Query Parameters:**
    *   `lat` (float): Latitude.
    *   `lon` (float): Longitude.
    *   `tariff` (float, optional): Energy tariff in USD/kWh. Defaults to `0.15`.
*   **Response Schema:**
    ```json
    {
      "lat": 28.61,
      "lon": 77.23,
      "daily_totals": {
        "fixed_wh": 4500.2,
        "tracker_wh": 6200.5,
        "ai_wh": 6850.1
      },
      "timeseries": [
        {
          "time": "12:00",
          "sun_alt": 65.4,
          "sun_az": 180.2,
          "shadow": 0.0,
          "action": "tracking",
          "energy_ai": 250.5,
          ...
        }
      ],
      "faults": [...],
      "commercial_impact": {
        "kwh_loss": 0.05,
        "financial_loss_usd": 0.75,
        "urgency": "System Healthy"
      },
      "db_id": "uuid-string"
    }
    ```

---

## 3. Data History & Export

### `GET /history`
Retrieves the most recent simulation runs from the database.

*   **Query Parameters:**
    *   `limit` (int, optional): Number of records to return. Defaults to `10`.
*   **Response Schema:** Array of `SimulationRun` objects.

### `POST /export-matlab`
Transforms a Helios-X simulation result into a format compatible with MATLAB Simscape Electrical.

*   **Request Body:** A complete JSON result from the `/simulate` endpoint.
*   **Response Schema:**
    ```json
    {
      "Metadata": { "origin": "Helios-X Digital Twin", "coords": [...] },
      "Environment": { "temperatures": [...], "dni": [...], "aqi": [...] },
      "PhysicsResults": { "energy_fixed": ..., "energy_tracker": ..., "energy_ai": ... },
      "AILog": { "action_modes": [...] },
      "Diagnostics": { "faults": [...] },
      "SiteGeometry": { "obstacles": [...] }
    }
    ```

---

## Security & Rate Limiting
*   **CORS:** Currently configured to allow requests from `http://localhost:3000`.
*   **User-Agent:** Outgoing requests to OSM Overpass include a custom User-Agent to comply with usage policies.
*   **Auth:** No authentication is implemented in the prototype; JWT-based auth is planned for Phase 4.
