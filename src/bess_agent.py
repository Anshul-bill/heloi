import torch
import torch.nn as nn

class BESSQNetwork(nn.Module):
    def __init__(self, state_dim=5, action_dim=1):
        super(BESSQNetwork, self).__init__()
        self.fc = nn.Sequential(
            nn.Linear(state_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, action_dim),
            nn.Tanh()
        )
    
    def forward(self, x):
        return self.fc(x)

class BESSAgent:
    def __init__(self, max_rate=2500.0):
        self.model = BESSQNetwork()
        self.model.eval()
        self.max_rate = max_rate

    def get_dispatch_action(self, state, target_export_w=None):
        """
        state: [solar_yield, soc, grid_price, grid_load, hour]
        target_export_w: target power to export to grid (for flattening)
        Returns: action in [-1.0, 1.0] 
        (Positive = charge, Negative = discharge)
        """
        solar_yield, soc, grid_price, grid_load, hour = state
        
        if target_export_w is not None:
            # Flattening logic: try to compensate for deviation from target
            diff = solar_yield - target_export_w
            action = diff / self.max_rate
            return max(-1.0, min(1.0, action))

        # Heuristic fallback simulating trained behavior
        if grid_price < 0.10:
            return 1.0  # Charge aggressively (cheap price)
        elif grid_price > 0.20:
            return -1.0 # Discharge aggressively (peak shaving/profit)
        else:
            return 0.0  # Hold

class BatterySim:
    def __init__(self, max_capacity_wh=5000):
        self.max_capacity_wh = max_capacity_wh
        self.current_capacity_wh = 0.0
        self.efficiency = 0.90 # Round-trip efficiency
        
    def step(self, action, solar_available_w):
        """
        action: [-1.0, 1.0]
        solar_available_w: energy from PV panels in Wh
        Returns: energy_to_grid_wh, new_soc_percent
        """
        # Max power rate assumed to be capacity / 2 for simplicity (2C rate)
        max_rate = self.max_capacity_wh / 2.0
        power_request = action * max_rate
        
        energy_to_grid = 0.0
        
        if power_request > 0: # Charge
            # Take from solar first, then grid if needed
            charge_amount = min(power_request, self.max_capacity_wh - self.current_capacity_wh)
            self.current_capacity_wh += charge_amount * self.efficiency
            energy_to_grid = solar_available_w - charge_amount
        else: # Discharge
            discharge_request = abs(power_request)
            discharge_amount = min(discharge_request, self.current_capacity_wh)
            self.current_capacity_wh -= discharge_amount
            energy_to_grid = solar_available_w + (discharge_amount * self.efficiency)
            
        soc_percent = (self.current_capacity_wh / self.max_capacity_wh) * 100.0
        return energy_to_grid, soc_percent
