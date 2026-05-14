# Physics Engine: Helios-X Solar Simulation

## Overview
The Helios-X Physics Engine is a high-fidelity deterministic simulation suite designed to model the interaction between solar irradiance, complex site geometry (buildings, trees), and photovoltaic (PV) panel configurations. It forms the backbone of the Digital Twin, providing the ground-truth data required for both real-time monitoring and AI policy training.

## Solar Position Algorithm
The engine implements a standard astronomical model to calculate the Sun's position relative to a specific latitude and longitude at any given timestamp.

### 1. Fractional Year ($\gamma$)
Calculated in radians to account for the Earth's elliptical orbit:
$$\gamma = \frac{2\pi}{N_{days}} \cdot (n - 1 + \frac{h - 12}{24})$$
where $n$ is the day of the year and $h$ is the hour.

### 2. Equation of Time ($E_t$)
Adjusts for the discrepancy between apparent solar time and mean solar time:
$$E_t = 229.18 \cdot (0.000075 + 0.001868 \cos\gamma - 0.032077 \sin\gamma - 0.014615 \cos(2\gamma) - 0.040849 \sin(2\gamma))$$

### 3. Solar Declination ($\delta$)
The angle between the Sun's rays and the Earth's equatorial plane:
$$\delta = 0.006918 - 0.399912 \cos\gamma + 0.070257 \sin\gamma - 0.006758 \cos(2\gamma) + 0.000907 \sin(2\gamma) - 0.002697 \cos(3\gamma) + 0.00148 \sin(3\gamma)$$

## Atmospheric Modeling
### Hottel Clear-Sky Model
To estimate Direct Normal Irradiance (DNI) without real-time sensor data, we utilize the Hottel model, which adjusts for site altitude ($H$):
$$a_0 = 0.4237 - 0.00821 \cdot (6 - H/1000)^2$$
$$a_1 = 0.5055 + 0.00595 \cdot (6.5 - H/1000)^2$$
$$k = 0.2711 + 0.01858 \cdot (2.5 - H/1000)^2$$
The atmospheric transmittance ($\tau$) is then:
$$\tau = a_0 + a_1 \exp(-k \cdot AM)$$
where $AM$ is the Air Mass calculated via the Kasten-Young formula.
$$DNI = I_{sc} \cdot \tau$$
where $I_{sc} = 1367 \, \text{W/m}^2$ (the solar constant).

## Ray-Tracing and Obstacle Engine
The `obstacle_engine.py` handles shading analysis using a discrete ray-stepping approach.

1.  **Coordinate Projection:** Global Lat/Lon coordinates are projected into a local Cartesian $(X, Y)$ plane using a Haversine approximation.
2.  **Ray Generation:** The Sun's polar coordinates (Altitude $\alpha$, Azimuth $\psi$) are converted into a normalized 3D vector $\vec{S}$:
    $$\vec{S} = [\cos\alpha \sin\psi, \cos\alpha \cos\psi, \sin\alpha]$$
3.  **Intersection Testing:** A ray is traced from the panel origin $(0, 0, 0)$ toward the Sun. The engine checks for intersections with:
    *   **Buildings:** Defined as 2D polygons with a fixed height $Z_{height}$.
    *   **Trees:** Modeled as cylinders with a center point, radius, and height.
4.  **Shadow Factor:** Currently, a binary shadow factor is returned ($1.0$ for shaded, $0.0$ for clear).

## Energy Harvesting Formulas
### Incident Angle Calculation
The effective irradiance on a panel depends on the cosine of the incident angle ($\theta$):
$$\cos\theta = \sin\alpha \cos\beta + \cos\alpha \sin\beta \cos(\psi_s - \psi_p)$$
where $\beta$ is panel tilt and $\psi_p$ is panel azimuth.

### Cell Temperature (King Model)
PV efficiency degrades with temperature. We estimate cell temperature ($T_{cell}$) using the King model:
$$T_{cell} = T_{amb} + DNI \cdot \exp(a + b \cdot WS)$$
where $WS$ is wind speed, $a = -3.47$, and $b = -0.05$.

### Sky View Factor (SVF)
To account for diffuse horizontal irradiance (DHI), we calculate the portion of the sky visible to the tilted panel:
$$SVF = \frac{1 + \cos\beta}{2}$$

## Performance Diagnostics and Fault Heuristics
The simulation includes a diagnostic layer (`fault_diagnosis.py`) that identifies operational anomalies using heuristic comparison between the AI-optimized tracker and a theoretical "Perfect Tracker."

*   **Thermal Derating:** Triggered when ambient temperatures exceed $50^\circ\text{C}$ for sustained periods, causing an efficiency drop $>5\%$.
*   **Dust & Soiling:** Identified by high AQI and low wind speed conditions, correlating with energy losses $>10\%$.
*   **Shading Anomalies:** Detected when energy loss exceeds $30\%$ during low solar altitudes ($\alpha < 20^\circ$), indicating significant local obstruction.

## Limitations and Future Work
*   **Binary Shading:** The current model does not account for partial shading across the panel string, which can cause non-linear power drops.
*   **Albedo Modeling:** Ground reflection (Albedo) is currently ignored but is significant for bifacial panels.
*   **Complex Geometries:** Transitioning from simple polygons to full 3D mesh (GLB/OBJ) support for more accurate ray-tracing.
