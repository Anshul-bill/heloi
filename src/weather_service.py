import httpx
from datetime import datetime, date
from src.models import CoordinatesRequest, UnifiedEnvironmentalPayload
import logging

logger = logging.getLogger(__name__)

class WeatherService:
    def __init__(self, client: httpx.AsyncClient):
        """
        Initialize the service.
        :param client: Required httpx.AsyncClient to reuse.
        """
        self.client = client
        self._cache = {}

    async def get_weather(self, coords: CoordinatesRequest, target_dt: datetime = None) -> UnifiedEnvironmentalPayload:
        if target_dt is None:
            target_dt = datetime.now()
            
        cache_key = f"{round(coords.lat, 2)},{round(coords.lon, 2)},{target_dt.strftime('%Y-%m-%d')}"
        
        if cache_key in self._cache:
            return self._cache[cache_key]

        try:
            return await self._fetch_weather(self.client, coords, target_dt, cache_key)
        except (httpx.RequestError, httpx.HTTPStatusError) as e:
            logger.error(f"Weather API failed: {e}")
            return self._safe_fallback(target_dt)

    async def _fetch_weather(self, client: httpx.AsyncClient, coords: CoordinatesRequest, target_dt: datetime, cache_key: str) -> UnifiedEnvironmentalPayload:
        now = datetime.now()
        is_past = target_dt.date() < now.date()
        
        if is_past:
            # Use Historical Archive API
            date_str = target_dt.strftime("%Y-%m-%d")
            url = f"https://archive-api.open-meteo.com/v1/archive?latitude={coords.lat}&longitude={coords.lon}&start_date={date_str}&end_date={date_str}&daily=temperature_2m_mean,relative_humidity_2m_mean,wind_speed_10m_max,rain_sum,precipitation_hours"
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            daily = data.get("daily", {})
            
            rain_val = float(daily.get("rain_sum", [0.0])[0])
            is_rainy = rain_val > 0.5 or float(daily.get("precipitation_hours", [0.0])[0]) > 2
            
            payload = UnifiedEnvironmentalPayload(
                temperatureC=float(daily.get("temperature_2m_mean", [25.0])[0]),
                roundedTemperatureC=int(round(daily.get("temperature_2m_mean", [25.0])[0])),
                humidityPercent=float(daily.get("relative_humidity_2m_mean", [50.0])[0]),
                windSpeed=float(daily.get("wind_speed_10m_max", [3.0])[0]),
                cloudCoverPercent=90.0 if is_rainy else 20.0, 
                source="Open-Meteo-Archive",
                sourceLabel=f"Historical Archive ({date_str}) {'[RAIN DETECTED]' if is_rainy else ''}",
                fetchedAt=datetime.now()
            )
        else:
            # Use Forecast API for Present/Future
            url = f"https://api.open-meteo.com/v1/forecast?latitude={coords.lat}&longitude={coords.lon}&current=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m"
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            
            curr = data.get("current", {})
            payload = UnifiedEnvironmentalPayload(
                temperatureC=float(curr.get("temperature_2m", 35.0)),
                roundedTemperatureC=int(round(curr.get("temperature_2m", 35.0))),
                humidityPercent=float(curr.get("relative_humidity_2m", 50.0)),
                windSpeed=float(curr.get("wind_speed_10m", 3.0)),
                cloudCoverPercent=float(curr.get("cloud_cover", 0.0)),
                source="Open-Meteo-Forecast",
                sourceLabel="Live Forecast / Real-time",
                fetchedAt=datetime.now()
            )
            
        self._cache[cache_key] = payload
        return payload

    def _safe_fallback(self, target_dt: datetime) -> UnifiedEnvironmentalPayload:
        return UnifiedEnvironmentalPayload(
            temperatureC=35.0,
            roundedTemperatureC=35,
            humidityPercent=50.0,
            windSpeed=3.0,
            cloudCoverPercent=0.0,
            source="Fallback",
            sourceLabel=f"Fallback Defaults for {target_dt.strftime('%Y-%m-%d')}",
            fetchedAt=datetime.now()
        )
