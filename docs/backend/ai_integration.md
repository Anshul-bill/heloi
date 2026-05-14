# AI Integration: Regime-Conditioned Double DQN

## Overview
Helios-X utilizes a Deep Reinforcement Learning (DRL) agent to optimize solar panel orientation in real-time. Unlike traditional astronomical trackers that focus purely on geometric alignment, the Helios-X policy considers environmental factors like cloud cover, air quality (AQI), and local shading to maximize energy yield.

## Architecture
The core model is a **Regime-Conditioned Double DQN (Deep Q-Network)**.

### Model Topology
The network is implemented in PyTorch as `RegimeConditionedQNetwork`:
*   **Input Layer:** 25 Dimensions.
*   **Hidden Layers:** Three fully connected layers $[128, 128, 64]$ with ReLU activations.
*   **Output Layer:** 13 discrete action logits.

### Regime Conditioning
To ensure global generalizability, the state vector is appended with an 11-dimensional **Climate Regime Vector**. This vector represents the site's long-term climate characteristics (e.g., tropical, arid, temperate), allowing the same weights to perform optimally across diverse geographic regions.

## State Space (25 Dimensions)
The state vector $S$ is composed of:

| Category | Dimensions | Features |
| :--- | :--- | :--- |
| **Solar Geometry** | 3 | Sun Altitude (norm), $\sin(\text{Azimuth})$, $\cos(\text{Azimuth})$ |
| **Temporal Context** | 4 | $\sin/\cos$ of Hour of Day, $\sin/\cos$ of Day of Year |
| **Atmospheric** | 2 | Cloud Fraction $[0,1]$, Normalized AQI $[0,1]$ |
| **Physics Feedback** | 2 | Shadow Factor $[0,1]$, Normalized DNI |
| **Site Metadata** | 3 | Normalized Latitude, Longitude, and Altitude |
| **Climate Regime** | 11 | One-hot or weighted vector representing global regimes |

## Action Space (13 Discrete Actions)
The agent selects from 13 possible actions, which modify the base astronomical tracking behavior:

| ID | Mode | Tilt Bias (deg) | Azimuth Bias (deg) | Intent |
| :--- | :--- | :--- | :--- | :--- |
| 0-6 | Tracking | $[-15, +15]$ | 0 | Optimize cosine loss vs shading |
| 7-10 | Tracking | 0 or $\pm 10$ | $\pm 15$ or $+10$ | Adjust for lateral obstacles |
| 11 | Stow | 0 | 0 | Protect against high winds/hail |
| 12 | Diffuse | 0 | 0 | Maximize Sky View Factor during heavy cloud/shading |

## Inference Pipeline
1.  **Normalization:** Raw environmental data (from Open-Meteo and OpenStreetMap) is clipped and normalized to the $[0, 1]$ or $[-1, 1]$ range.
2.  **State Construction:** The 14 physical dimensions are combined with the 11 regime dimensions.
3.  **Forward Pass:** The model predicts Q-values for all 13 actions.
4.  **Selection:** The action with the highest Q-value is selected ($a = \arg\max Q(s, a)$).
5.  **Fallback:** If PyTorch is unavailable or the model fails to load, a deterministic "Perfect Tracking" policy is used.

## Training Details
*   **Algorithm:** Double DQN to prevent Q-value overestimation.
*   **Loss Function:** Huber Loss for robustness against outliers.
*   **Experience Replay:** Prioritized Experience Replay (PER) to focus on rare shading events.
*   **Reward Function:** 
    $$R = E_{ai} - E_{fixed} - \lambda \cdot (\text{Mechanical Wear})$$
    where $E_{ai}$ is the energy harvested and $\lambda$ penalizes excessive movement.
