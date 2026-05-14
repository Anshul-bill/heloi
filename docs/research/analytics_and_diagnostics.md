# Research Note: Analytics and Diagnostics Engine

## Heuristic Fault Classification

The Helios-X diagnostic engine operates on a series of physics-informed "logical gates." These gates are designed to isolate specific environmental and mechanical stressors by analyzing the delta between a **theoretical perfect tracker** and the **observed AI-biased output**.

### 1. Thermal Derating Classifier
The engine monitors the cell temperature ($T_{cell}$) using the King Model. When $T_{cell} > 50^\circ C$, a derating factor is applied:
- **Condition:** $P_{loss} > 0.05 \cdot P_{ideal}$ for $t > 2$ hours.
- **Physical Rationale:** Semiconductor efficiency in silicon PV cells decreases as temperature rises above the standard testing condition (STC) of $25^\circ C$. A $50^\circ C$ threshold represents a critical thermal load where active mitigation (e.g., ventilation or spray cooling) is recommended.

### 2. Atmospheric Soiling and AQI Impact
Localized air quality is fetched via the Open-Meteo API. The diagnostic engine cross-references this with wind speed to predict particulate deposition.
- **Condition:** $AQI > 200$, $WS < 2.0 m/s$, $P_{loss} > 0.1 \cdot P_{ideal}$ for $t > 4$ hours.
- **Physical Rationale:** High AQI indicates a high concentration of $PM_{2.5}$ and $PM_{10}$ particles. Without sufficient wind to provide "self-cleaning," these particles settle on the panel surface, increasing optical opacity and decreasing transmittance.

### 3. Urban Shading Anomaly
By leveraging 3D extruded building data from OpenStreetMap, the engine calculates a `shadow_factor`.
- **Condition:** $Alt < 20^\circ$, $P_{loss} > 0.3 \cdot P_{ideal}$.
- **Physical Rationale:** During the golden hours (sunrise/sunset), the solar vector is often obstructed by nearby architecture. The AI tracker attempts to evade these shadows by biasing the panel towards the brightest region of the sky dome (Diffuse Mode). A shading anomaly is flagged if the yield drop is significantly higher than predicted, suggesting a building geometry mismatch or unmapped obstacle.

## Commercial Impact Engine

The financial modeling logic is encapsulated in `src/services/commercial_impact.py`. It uses a deterministic approach to quantify maintenance urgency.

### Mathematical Formulation:
$$ L_{usd} = \left( \frac{\Delta E_{wh}}{1000} \right) \cdot \lambda_{tariff} $$

Where:
- $\Delta E_{wh}$ is the energy loss in Watt-hours.
- $\lambda_{tariff}$ is the localized energy tariff in USD/kWh.

### Urgency Mapping table:

| Financial Loss ($L_{usd}$) | Urgency Level | Recommendation |
|----------------------------|---------------|----------------|
| $\geq \$10.00$ | **CRITICAL** | Schedule onsite maintenance within 48 hours. |
| $\geq \$1.00$ | **MONITOR** | Log anomaly for periodic review. |
| $< \$1.00$ | **HEALTHY** | System within nominal tolerance. |

This diagnostic hierarchy allows operators to optimize their O&M (Operations and Maintenance) budget by focusing on high-revenue impacts rather than purely physical percentage losses.
