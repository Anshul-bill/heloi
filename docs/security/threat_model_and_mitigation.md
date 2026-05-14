# Threat Model and Mitigation: Helios-X Security Analysis

## Abstract
This document presents an academic analysis of the security architecture of the Helios-X Digital Twin. Utilizing the STRIDE threat modeling framework, it identifies potential attack vectors in a research-heavy, simulation-driven environment and describes the robust mitigation strategies implemented, including API proxying, Pydantic data validation, and secure machine learning model loading.

## 1. Threat Modeling (STRIDE)

| Category | Description | Helios-X Context | Mitigation |
|----------|-------------|-------------------|------------|
| **S**poofing | Impersonating a user or service. | Unauthorized access to simulation history. | CORS restriction; future JWT implementation. |
| **T**ampering | Modifying data in transit or at rest. | Altering simulation parameters or weather data. | Pydantic validation; HTTPS in transit. |
| **R**epudiation | Denying an action performed. | Deleting simulation logs without audit. | Database persistence with immutable timestamps. |
| **I**nformation Disclosure | Exposing sensitive data. | Leaking API keys or proprietary ML model info. | Environment variable isolation; Docker hardening. |
| **D**enial of Service | Exhausting system resources. | Resource-intensive physics simulations. | Thread pooling via `run_in_threadpool`. |
| **E**levation of Privilege | Gaining unauthorized access levels. | Accessing raw SQL database from frontend. | API Gateway (FastAPI) acting as a strict proxy. |

## 2. API Security and Proxying

### 2.1 Bypass of CORS and User-Agent Blocks
The Helios-X backend and frontend perform intelligent API proxying to interact with upstream data providers like OpenStreetMap (OSM) and OpenWeatherMap.
*   **User-Agent Compliance:** Providers often block default library headers (e.g., `python-requests` or `Next.js`). Helios-X implements custom `User-Agent` strings (e.g., `HeliosX-DigitalTwin/1.0`) to comply with crawler policies and ensure reliable data ingestion.
*   **CORS Management:** The FastAPI backend implements a strict `CORSMiddleware` configuration, restricting cross-origin requests specifically to the trusted dashboard origin (`http://localhost:3000`).

## 3. Data Integrity via Pydantic
Pydantic is utilized as the primary validation engine for all incoming and outgoing payloads. By enforcing strict type checking and schema validation, the system mitigates injection attacks and data corruption.
*   **Schema Enforcement:** Every API endpoint is bound to a Pydantic model (e.g., `CoordinatesRequest`, `SimulationResult`).
*   **Runtime Validation:** Malformed JSON or type-mismatched data are rejected at the edge, preventing them from entering the physics engine or the persistence layer.

## 4. Secure Machine Learning Model Loading
Pickle-based model loading (common in Python) is a significant security risk, as it allows for arbitrary code execution. Helios-X addresses this via the `weights_only=True` mitigation in PyTorch.

*   **Vulnerability:** Standard `torch.load` can execute malicious payloads embedded in `.pt` or `.pth` files.
*   **Mitigation:** By setting `weights_only=True`, the system instructs PyTorch to only unpickle the tensors and state dictionaries, completely ignoring any executable code or object definitions. This ensures that the ML models used for regime conditioning are purely mathematical artifacts and cannot compromise the host system.

```python
# Implementation in src/heliosx_ai_policy.py
checkpoint = torch.load(model_path, map_location=torch.device('cpu'), weights_only=True)
```

## 5. Container Hardening
The use of multi-stage Docker builds ensures that the production image contains the absolute minimum number of binaries required for operation. This reduces the surface area available to attackers should they gain a foothold in the container.

## 6. Conclusion
The security posture of Helios-X is designed to be "secure by default." By combining modern architectural patterns (API Gateway, Proxying) with language-level safety features (Pydantic, Secure ML Loading), the project ensures the integrity and availability of its digital twin simulations.
