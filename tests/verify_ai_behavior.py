import sys
import os
import torch
import numpy as np

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.heliosx_ai_policy import HeliosXPolicy

def verify_ai_behavior():
    print("=== Helios-X ML Model Movement Verification ===\n")
    
    # 1. Initialize Policy
    model_path = "dqn_final_helios_x_v2_regime_conditioned.pt"
    policy = HeliosXPolicy(model_path=model_path)
    
    if policy.use_fallback:
        print("CRITICAL ERROR: AI Model failed to load. Verification cannot proceed.")
        return

    print(f"Successfully loaded AI Model: {model_path}")
    
    # 2. Test Scenario A: Perfect Sun (No Obstacles)
    # Midday, high sun, clear sky, no shadow.
    # We expect the AI to stay close to 0 bias (Perfect Tracking).
    state_clear = {
        "sun_altitude": 65.0,
        "sun_azimuth": 180.0,
        "hour_of_day": 12.0,
        "day_of_year": 172,
        "cloud_fraction": 0.0,
        "aqi": 20,
        "shadow_factor": 0.0,
        "latitude": 28.6,
        "longitude": 77.2,
        "site_altitude": 200.0,
        "dni": 900.0,
        "regime_vector": [1.0] + [0.0]*10
    }
    
    action_clear = policy.get_action(state_clear)
    print(f"\nScenario A: Midday Clear Sky (No Shadows)")
    print(f"AI Action ID: {action_clear['action_id']}")
    print(f"AI Choice: Tilt Bias {action_clear['tilt_bias']}°, Azimuth Bias {action_clear['azimuth_bias']}°")
    print(f"Mode: {action_clear['mode']}")
    
    # 3. Test Scenario B: Shadow Evasion
    # Afternoon, low sun, heavy shadow detected (shadow_factor=0.9).
    # We expect the AI to apply a bias to find light.
    state_shadow = state_clear.copy()
    state_shadow["sun_altitude"] = 25.0
    state_shadow["shadow_factor"] = 0.9
    
    action_shadow = policy.get_action(state_shadow)
    print(f"\nScenario B: Afternoon Shading (Shadow Factor 0.9)")
    print(f"AI Action ID: {action_shadow['action_id']}")
    print(f"AI Choice: Tilt Bias {action_shadow['tilt_bias']}°, Azimuth Bias {action_shadow['azimuth_bias']}°")
    print(f"Mode: {action_shadow['mode']}")
    
    # 4. Mechanical Verification (Frontend Sync)
    # Verify how these angles translate to the 3D viewer
    print(f"\n=== Mechanical Translation Check ===")
    sun_alt = state_shadow["sun_altitude"]
    sun_az = state_shadow["sun_azimuth"]
    
    # Standard tracking angle (face the sun)
    perfect_tilt = 90 - sun_alt
    perfect_az = sun_az
    
    # AI Adjusted angles
    ai_tilt = perfect_tilt + action_shadow['tilt_bias']
    ai_az = perfect_az + action_shadow['azimuth_bias']
    
    print(f"Ideal Solar Alignment: Tilt {perfect_tilt:.2f}°, Azimuth {perfect_az:.2f}°")
    print(f"AI Adjusted Alignment: Tilt {ai_tilt:.2f}°, Azimuth {ai_az:.2f}°")
    
    if action_shadow['tilt_bias'] != 0 or action_shadow['azimuth_bias'] != 0:
        print("\nRESULT: AI Model is active and providing non-zero tracking offsets.")
        print("Verification PASS: Movement is being driven by neural inference.")
    else:
        print("\nRESULT: AI Model returned default tracking (0,0).")
        print("Note: This is physically correct if no improvement was found for this specific state.")

if __name__ == "__main__":
    verify_ai_behavior()
