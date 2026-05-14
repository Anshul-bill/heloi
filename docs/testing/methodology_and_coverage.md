# Testing Methodology & Coverage Strategy: Validating Physical Integrity

## 1. Overview
Helios-X employs a Test-Driven Development (TDD) approach focused on **Physical Integrity Validation**. In climate-tech, software failure can lead to equipment damage; thus, our test suite prioritizes physical edge cases over simple UI checks.

## 2. Unit Testing: Physics & Solar Core
The core physics engine (`solar_core.py`) is subjected to rigorous unit testing:
- **Zenith Stability:** Specific tests verify that the engine does not encounter `ZeroDivisionError` when the sun is at exactly $90^\circ$ (Zenith).
- **Coordinate Extremes:** Validation of solar position at the North and South poles during solstices and equinoxes.
- **Leap Year Logic:** Verification of 366-day solar cycles to ensure long-term scheduling accuracy.

## 3. Integration Testing: API & State Synchronization
We use `pytest` and `FastAPI.TestClient` to verify the bridge between the physics engine and the dashboard.
- **State Consistency:** Ensuring that the DNI (Direct Normal Irradiance) calculated in the backend matches the visual "Solar Rays" intensity in the frontend.
- **Telemetry Buffering:** Verifying that the simulation routes can handle high-frequency requests during "Scrubbing" or "Replay" modes.

## 4. Simulation Validation: AI vs Baseline
A critical component of our testing is the comparison of yield strategies:
- **Baseline (Fixed):** Validates the "Control" scenario where panels do not move.
- **Ideal (Tracker):** Validates the "Perfect Physical" scenario (Direct Sun Tracking).
- **Optimized (AI):** Validates the "Neural Inference" scenario (Shadow Evasion + Albedo Maximization).
These are verified through statistical tolerance checks: we expect AI yield to be $\geq$ Tracker yield in complex shading scenarios.
