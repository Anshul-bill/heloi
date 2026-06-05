import math
import re
import statistics
from datetime import datetime, timedelta
from src.physics_engine.solar_core import get_solar_position, get_clear_sky_dni
from src.physics_engine.obstacle_engine import calculate_shadow_factor
from src.physics_engine.panel_feedback import calculate_energy
from src.heliosx_ai_policy import HeliosXPolicy
from src.physics_engine.fault_diagnosis import classify_faults
from src.services.commercial_impact import calculate_impact
from src.services.grid_manager import GridManager
from src.bess_agent import BESSAgent, BatterySim

policy = HeliosXPolicy()
grid_mgr = GridManager()
bess_agent = BESSAgent()
battery = BatterySim()

DEFAULT_AQI = 50.0

def project_coordinates(base_lat: float, base_lon: float, target_lat: float, target_lon: float) -> tuple:
    # Haversine approximation to local Cartesian (Meters)
    R = 6378137 # Earth radius in meters
    dLat = math.radians(target_lat - base_lat)
    dLon = math.radians(target_lon - base_lon)
    
    x = R * dLon * math.cos(math.radians(base_lat))
    y = R * dLat
    return (x, y)

def build_cartesian_context(base_lat: float, base_lon: float, context_data: dict) -> list:
    obstacles = []
    for b in context_data.get("buildings", []):
        geom = b.get("geometry", [])
        if geom:
            poly = []
            for pt in geom:
                x, y = project_coordinates(base_lat, base_lon, pt["lat"], pt["lon"])
                poly.append((x, y))
        else:
            # Fallback to a square slightly North if no geometry
            poly = [(-5, 5), (5, 5), (5, 15), (-5, 15)]
            
        raw_h = str(b.get("tags", {}).get("height", 10.0))
        match = re.search(r"[\d\.]+", raw_h)
        h_val = float(match.group(0)) if match else 10.0
            
        obstacles.append({
            "type": "building", 
            "polygon": poly, 
            "z_height": h_val
        })
        
    for t in context_data.get("trees", []):
        lat, lon = t.get("lat"), t.get("lon")
        if lat and lon:
            x, y = project_coordinates(base_lat, base_lon, lat, lon)
            obstacles.append({
                "type": "tree",
                "point": (x, y),
                "radius": 2.0,
                "z_height": 5.0
            })
    return obstacles

def run_simulation(lat: float, lon: float, weather: dict, context: dict, start_dt: datetime = None, utc_offset: float = 0.0, **kwargs) -> dict:
    if start_dt is None:
        # Default to today at midnight if not provided
        start_dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    obstacles = build_cartesian_context(lat, lon, context)
    
    results = []
    total_fixed, total_tracker, total_ai = 0.0, 0.0, 0.0
    total_revenue_ai = 0.0
    total_shaved_wh = 0.0
    
    # Pre-calculate avg_solar for curve flattening
    energy_ai_vals = []
    # Simplified loop to get target
    for step in range(48):
        dt = start_dt + timedelta(minutes=30 * step)
        alt, az = get_solar_position(lat, lon, utc_offset, dt)
        dni = get_clear_sky_dni(alt, 100.0)
        shadow = calculate_shadow_factor(alt, az, obstacles)
        temp_c = weather.get("temperatureC", 25.0)
        wind_speed = weather.get("windSpeed", 5.0)
        aqi = kwargs.get("aqi", DEFAULT_AQI)
        
        state = {
            "sun_altitude": alt, "sun_azimuth": az,
            "hour_of_day": dt.hour + (dt.minute/60.0), 
            "day_of_year": dt.timetuple().tm_yday,
            "cloud_fraction": weather.get("cloudCoverPercent", 0.0) / 100.0,
            "aqi": aqi, "shadow_factor": shadow,
            "latitude": lat, "longitude": lon, "site_altitude": 100.0, "dni": dni,
            "regime_vector": [1.0] + [0.0] * 10
        }
        action = policy.get_action(state)
        _, _, e_ai = calculate_energy(dni, temp_c, wind_speed, aqi, shadow, alt, az, action)
        energy_ai_vals.append(e_ai)
        
    avg_solar = sum(energy_ai_vals) / 48
    
    # Reset BESS SoC for simulation
    battery.current_capacity_wh = battery.max_capacity_wh * 0.2
    
    # Main simulation loop
    for step in range(48):
        dt = start_dt + timedelta(minutes=30 * step)
        
        # 1. Solar Math
        alt, az = get_solar_position(lat, lon, utc_offset, dt)
        dni = get_clear_sky_dni(alt, 100.0) 
        
        # 2. Shadows
        shadow = calculate_shadow_factor(alt, az, obstacles)
        
        # 3. AI Policy
        temp_c = weather.get("temperatureC", 25.0)
        wind_speed = weather.get("windSpeed", 5.0)
        aqi = kwargs.get("aqi", DEFAULT_AQI)
        
        state = {
            "sun_altitude": alt, 
            "sun_azimuth": az,
            "hour_of_day": dt.hour + (dt.minute/60.0), 
            "day_of_year": dt.timetuple().tm_yday,
            "cloud_fraction": weather.get("cloudCoverPercent", 0.0) / 100.0,
            "aqi": aqi, 
            "shadow_factor": shadow,
            "latitude": lat, 
            "longitude": lon, 
            "site_altitude": 100.0, 
            "dni": dni,
            "regime_vector": [1.0] + [0.0] * 10
        }
        action = policy.get_action(state)
        
        # 4. Energy
        e_fix, e_tr, e_ai = calculate_energy(dni, temp_c, wind_speed, aqi, shadow, alt, az, action)
        
        total_fixed += e_fix
        total_tracker += e_tr
        total_ai += e_ai
        
        # 5. BESS Dispatch & Grid Economics
        grid_price = grid_mgr.get_current_tariff(dt)
        grid_load = grid_mgr.get_grid_stability_signal(dt, lat=lat, lon=lon)
        soc = (battery.current_capacity_wh / battery.max_capacity_wh) * 100.0
        
        bess_state = [e_ai, soc, grid_price, grid_load, dt.hour + dt.minute/60.0]
        bess_action = bess_agent.get_dispatch_action(bess_state, target_export_w=avg_solar)
        
        energy_to_grid, soc_percent = battery.step(bess_action, e_ai)
        
        step_revenue = (energy_to_grid / 1000.0) * grid_price
        total_revenue_ai += step_revenue
        
        # Transformation Variables
        # Scale demand based on latitude (Equatorial regions have higher HVAC load)
        demand_scale = 500.0 * (1.0 + abs(lat) / 90.0)
        base_demand = grid_load * demand_scale
        grid_unbalanced = base_demand - e_ai
        grid_balanced = base_demand - energy_to_grid
        
        total_shaved_wh += abs(grid_unbalanced - grid_balanced) / 2.0
        
        # Calculate visualization variables
        bess_charge = max(0, e_ai - energy_to_grid) if bess_action > 0 else 0
        bess_discharge = max(0, energy_to_grid - e_ai) if bess_action < 0 else 0
        
        results.append({
            "time": dt.strftime("%H:%M"),
            "sun_alt": round(alt, 2),
            "sun_az": round(az, 2),
            "shadow": shadow,
            "action": action["mode"],
            "action_id": action.get("action_id", 3),
            "tilt_bias": action.get("tilt_bias", 0),
            "azimuth_bias": action.get("azimuth_bias", 0),
            "q_values": action.get("q_values", []),
            "energy_fixed": round(e_fix, 2),
            "energy_ai": round(e_ai, 2),
            "energy_tracker": round(e_tr, 2),
            "energy_exported": round(energy_to_grid, 2),
            "grid_demand": round(base_demand, 2),
            "grid_unbalanced": round(grid_unbalanced, 2),
            "grid_balanced": round(grid_balanced, 2),
            "temp_c": temp_c,
            "dni": round(dni, 2),
            "aqi": aqi,
            "wind_speed": wind_speed,
            "grid_price": grid_price,
            "grid_load": grid_load,
            "revenue": round(step_revenue, 4),
            "bess_soc": round(soc_percent, 1),
            "bess_action": bess_action,
            "bess_charge": round(bess_charge, 2),
            "bess_discharge": round(bess_discharge, 2)
        })
        
    # Calculate efficiency score
    unbalanced_vals = [r["grid_unbalanced"] for r in results]
    balanced_vals = [r["grid_balanced"] for r in results]
    var_unbalanced = statistics.variance(unbalanced_vals) if len(unbalanced_vals) > 1 else 0
    var_balanced = statistics.variance(balanced_vals) if len(balanced_vals) > 1 else 0
    
    efficiency_score = 100.0 * (1.0 - var_balanced / var_unbalanced) if var_unbalanced > 0 else 0.0
    
    totals = {
        "fixed_wh": round(total_fixed, 2),
        "tracker_wh": round(total_tracker, 2),
        "ai_wh": round(total_ai, 2),
        "ai_revenue_usd": round(total_revenue_ai, 2),
        "total_shaved_wh": round(total_shaved_wh, 2),
        "efficiency_score": round(efficiency_score, 1)
    }
    
    results_dict = {
        "lat": lat, "lon": lon,
        "daily_totals": totals,
        "timeseries": results,
        "obstacles": obstacles
    }
    
    # Analytics
    results_dict["faults"] = classify_faults(results)
    
    # wh_loss is tracker minus ai
    wh_loss = max(0.0, totals["tracker_wh"] - totals["ai_wh"])
    # use dynamic tariff if provided in kwargs, else 0.15
    results_dict["commercial_impact"] = calculate_impact(wh_loss, tariff=kwargs.get("tariff", 0.15))
    
    return results_dict
