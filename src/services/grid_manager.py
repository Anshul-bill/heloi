import math
from datetime import datetime

class GridManager:
    """
    Simulates dynamic grid load and electricity pricing (TOU Tariffs).
    Implements a 'Duck Curve' model where power is cheap during peak solar hours
    and expensive during evening peak demand.
    """
    
    def get_current_tariff(self, dt: datetime) -> float:
        """
        Returns the electricity price in USD/kWh for a given time.
        Model:
        - 00:00 - 08:00 (Night): $0.10 (Off-peak)
        - 08:00 - 15:00 (Peak Solar): $0.05 (Overproduction / Solar Peak)
        - 15:00 - 21:00 (Evening Peak): $0.35 (High demand / Duck Curve)
        - 21:00 - 00:00 (Late Night): $0.15 (Transition)
        """
        hour = dt.hour + (dt.minute / 60.0)
        
        if 8.0 <= hour < 15.0:
            return 0.05
        elif 15.0 <= hour < 21.0:
            return 0.35
        elif 21.0 <= hour or hour < 8.0:
            return 0.10 if hour < 8.0 else 0.15
        return 0.15

    def get_grid_stability_signal(self, dt: datetime, lat: float = 0.0, lon: float = 0.0) -> float:
        """
        Returns a normalized grid load signal (0.0 to 1.0).
        Includes location-specific modifiers:
        - Latitude adjustment: Tropical regions have higher base cooling load.
        - Solar alignment: Peak demand is shifted slightly based on longitude.
        """
        hour = dt.hour + (dt.minute / 60.0)
        
        # Latitude impact: higher load in tropical/extreme zones (|lat| < 30 or |lat| > 60)
        lat_mod = 1.0 + (math.cos(math.radians(lat)) * 0.2)
        
        # Longitude shift: align grid peak to local solar time vs system time
        # shift = lon / 15.0  # approximate timezone shift
        # For simplicity in this sim, we peak at 19:00 local
        
        # Peak demand gaussian centered at 19:00
        load = math.exp(-((hour - 19.0)**2) / 10.0) 
        
        # Morning peak at 08:00
        morning_peak = 0.4 * math.exp(-((hour - 8.0)**2) / 4.0)
        
        return max(0.2, (load + morning_peak) * lat_mod)

    def calculate_revenue(self, energy_wh: float, dt: datetime) -> float:
        """
        Calculates the dollar value of energy generated at a specific time.
        """
        tariff = self.get_current_tariff(dt)
        return (energy_wh / 1000.0) * tariff
