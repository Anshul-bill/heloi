import pytest
from datetime import datetime
from src.heliosx_sim_server import run_simulation

def test_granular_metrics():
    # Mock data
    lat, lon = 28.6139, 77.2090
    weather = {
        "temperatureC": 25.0,
        "windSpeed": 5.0,
        "cloudCoverPercent": 0.0
    }
    context = {"buildings": [], "trees": []}
    
    # Run simulation
    result = run_simulation(lat, lon, weather, context)
    
    # Check if total_shaved_wh exists in daily_totals
    assert "total_shaved_wh" in result["daily_totals"]
    assert isinstance(result["daily_totals"]["total_shaved_wh"], float)
    
    # Check if pricing_zone exists in each timeseries step
    for step in result["timeseries"]:
        assert "pricing_zone" in step
        assert step["pricing_zone"] in ["BUY", "SELL", "NEUTRAL"]
        
        # Verify pricing zone logic
        price = step["grid_price"]
        zone = step["pricing_zone"]
        if price < 0.10:
            assert zone == "BUY"
        elif price > 0.30:
            assert zone == "SELL"
        else:
            assert zone == "NEUTRAL"

if __name__ == "__main__":
    pytest.main([__file__])
