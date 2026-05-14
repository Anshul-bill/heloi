# 3D Visualization Architecture: Kinematic Simulation & Geographic Fidelity

## 1. Technological Stack
Helios-X leverages **React-Three-Fiber (R3F)** and **Three.js** for its rendering pipeline. R3F allows for a declarative scene graph that syncs with the React state lifecycle, ensuring that physics-engine updates are reflected in the visualization with minimal overhead.

## 2. Solar Kinematics & Sun Positioning
The sun's position in the scene is calculated via a spherical-to-Cartesian conversion based on the physics engine's altitude ($\alpha$) and azimuth ($\phi$) outputs.
- **Coordinate Mapping:** A distance of $1000$ units is maintained to keep the sun outside the interactive field while maintaining shadow-casting validity.
- **Atmospheric Scattering:** The sky color interpolates between `#020617` (Nadir), `#0f172a` (Civil Twilight), and `#7dd3fc` (Daylight) based on the altitude angle, providing intuitive temporal feedback.

## 3. GIS Geometry: ExtrudeGeometry for Buildings
To represent the physical environment accurately, GIS building polygons are transformed into 3D meshes using `THREE.ExtrudeGeometry`.
- **Polygon-to-Mesh Pipeline:** 2D vertex arrays are converted into `THREE.Shape` objects and extruded to their recorded `z_height`.
- **Shadow Mapping:** These extruded geometries are configured to cast and receive shadows (`PCSS` shadows for softness), critical for the "Shadow Evasion" AI training visualization.

## 4. Mechanical Simulation: Kinematic Interpolation
The solar panels do not "snap" to positions. They follow a **Kinematic Interpolation Loop** via the `useFrame` hook.
- **Lerp (Linear Interpolation):** A `lerpFactor` of $0.05$ is applied to the rotation of the tracker head. This mimics the physical constraints of an actual solar actuator, providing a realistic representation of the panel's movement speed.
- **Rotation Order:** The trackers use `YXZ` rotation ordering to prevent gimbal lock during extreme azimuth transitions.

## 5. Weather Simulation & Volumetric Effects
Environmental conditions are visualized using `Sparkles` from the `@react-three/drei` library.
- **Precipitation:** Rain and snow are simulated as high-speed particles with specific color-mapping (`#60a5fa` for rain, `#ffffff` for snow), providing immediate context for yield drops in the analytics charts.
