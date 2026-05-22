import asyncio
import json
import logging
from typing import List
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class HardwareBridge:
    """
    Manages WebSocket connections to physical hardware (ESP32/RPi).
    Streams AI-derived mechanical commands and receives sensor ground-truth.
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.latest_hardware_telemetry = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("Hardware connected via WebSocket bridge")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info("Hardware disconnected from bridge")

    async def stream_command(self, tilt: float, azimuth: float):
        """Broadcast mechanical commands to all connected physical trackers."""
        payload = {
            "type": "CMD_MOVE",
            "target_tilt": round(tilt, 2),
            "target_azimuth": round(azimuth, 2),
            "timestamp": asyncio.get_event_loop().time()
        }
        message = json.dumps(payload)
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Failed to stream to hardware: {e}")

    async def handle_telemetry(self, data: str):
        """Process incoming ground-truth data from physical sensors."""
        try:
            telemetry = json.loads(data)
            # Update internal state with physical sensor values
            # e.g., {"actual_tilt": 44.5, "actual_azimuth": 180.2, "pyranometer_dni": 850}
            self.latest_hardware_telemetry.update(telemetry)
        except json.JSONDecodeError:
            logger.error("Invalid telemetry JSON received from hardware")
