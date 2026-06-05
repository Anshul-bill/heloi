from contextlib import asynccontextmanager
from typing import Annotated, List
from datetime import datetime
import httpx
import json
from fastapi import FastAPI, Depends, Request, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.models import CoordinatesRequest, UnifiedEnvironmentalPayload, LatQuery, LonQuery, SimulationResult
from src.weather_service import WeatherService
from src.site_context import SiteContextService
from src.heliosx_sim_server import run_simulation
from src.services.matlab_export_service import format_for_matlab
from src.services.grid_manager import GridManager
from src.services.hardware_bridge import HardwareBridge
from src.database import get_db
import src.db_models as db_models

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Set up the shared client and specialized services
    headers = {"User-Agent": "HeliosX-DigitalTwin/1.0 (contact@heliosx.example.com)"}
    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        app.state.client = client
        app.state.grid_manager = GridManager()
        app.state.hardware_bridge = HardwareBridge()
        yield

app = FastAPI(title="Helios-X API Gateway", lifespan=lifespan)

# Restrict CORS Origins in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency Injection helpers
def get_http_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.client

def get_weather_service(client: httpx.AsyncClient = Depends(get_http_client)):
    return WeatherService(client=client)

def get_context_service(client: httpx.AsyncClient = Depends(get_http_client)):
    return SiteContextService(client=client)

def get_grid_manager(request: Request) -> GridManager:
    return request.app.state.grid_manager

def get_hardware_bridge(request: Request) -> HardwareBridge:
    return request.app.state.hardware_bridge

@app.websocket("/ws/hardware")
async def hardware_websocket(
    websocket: WebSocket, 
    bridge: HardwareBridge = Depends(get_hardware_bridge)
):
    """Low-latency IoT bridge for physical solar tracker hardware."""
    await bridge.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await bridge.handle_telemetry(data)
    except WebSocketDisconnect:
        bridge.disconnect(websocket)

@app.get("/weather", response_model=UnifiedEnvironmentalPayload)
async def get_weather(
    lat: LatQuery, 
    lon: LonQuery, 
    weather_svc: WeatherService = Depends(get_weather_service)
):
    req = CoordinatesRequest(lat=lat, lon=lon)
    return await weather_svc.get_weather(req)

@app.get("/site-context")
async def get_site_context(
    lat: LatQuery, 
    lon: LonQuery, 
    context_svc: SiteContextService = Depends(get_context_service)
):
    req = CoordinatesRequest(lat=lat, lon=lon)
    return await context_svc.get_context(req)

@app.post("/simulate")
async def simulate(
    lat: LatQuery, 
    lon: LonQuery,
    year: int = Query(None, ge=2000, le=2100),
    month: int = Query(None, ge=1, le=12),
    day: int = Query(None, ge=1, le=31),
    tariff: float = Query(None, ge=0),
    weather_svc: WeatherService = Depends(get_weather_service),
    context_svc: SiteContextService = Depends(get_context_service),
    grid_mgr: GridManager = Depends(get_grid_manager),
    bridge: HardwareBridge = Depends(get_hardware_bridge),
    db: AsyncSession = Depends(get_db)
):
    req = CoordinatesRequest(lat=lat, lon=lon)
    
    # Use selected date if provided, else current
    now = datetime.now()
    try:
        if year and month and day:
            now = now.replace(year=year, month=month, day=day)
        elif month:
            now = now.replace(month=month)
    except ValueError:
        pass
        
    start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # NEW: Fetch correct weather (Archive vs Forecast) based on start_dt
    weather = await weather_svc.get_weather(req, target_dt=start_dt)
    context = await context_svc.get_context(req)
    
    utc_offset = round(lon / 15.0)

    # Use GridManager to calculate dynamic tariff if none provided
    if tariff is None:
        tariff = grid_mgr.get_current_tariff(start_dt)
    
    result = await run_in_threadpool(
        run_simulation, 
        lat, lon, 
        weather.model_dump(), 
        context, 
        start_dt=start_dt, 
        utc_offset=utc_offset,
        tariff=tariff
    )

    # Stream real-time target to hardware
    current_action = result["timeseries"][24] 
    await bridge.stream_command(current_action["tilt_bias"], current_action["azimuth_bias"])

    # Persist to Database
    try:
        stmt = select(db_models.Site).where(
            db_models.Site.latitude == lat, 
            db_models.Site.longitude == lon
        )
        site_result = await db.execute(stmt)
        site = site_result.scalar_one_or_none()
        
        if not site:
            site = db_models.Site(
                name=f"Site_{lat}_{lon}",
                latitude=lat,
                longitude=lon,
                timezone_offset=float(utc_offset)
            )
            db.add(site)
            await db.flush()

        run = db_models.SimulationRun(
            site_id=site.id,
            weather_data=weather.model_dump(mode='json'),
            total_fixed_wh=result["daily_totals"]["fixed_wh"],
            total_tracker_wh=result["daily_totals"]["tracker_wh"],
            total_ai_wh=result["daily_totals"]["ai_wh"],
            kwh_loss=result["commercial_impact"]["kwh_loss"],
            financial_loss_usd=result["commercial_impact"]["financial_loss_usd"],
            total_revenue_usd=result["daily_totals"]["ai_revenue_usd"],
            maintenance_urgency=result["commercial_impact"]["urgency"]
        )
        db.add(run)
        await db.flush()

        for f in result.get("faults", []):
            db.add(db_models.FaultLog(
                simulation_id=run.id,
                fault_type=f["type"],
                severity=f["severity"],
                message=f["message"]
            ))
        
        await db.commit()
        result["db_id"] = run.id
    except Exception as e:
        await db.rollback()
        print(f"Database persistence failed: {e}")

    return result

@app.get("/history")
async def get_history(limit: int = 10, db: AsyncSession = Depends(get_db)):
    stmt = select(db_models.SimulationRun).order_by(db_models.SimulationRun.timestamp.desc()).limit(limit)
    result = await db.execute(stmt)
    runs = result.scalars().all()
    return runs

@app.post("/export-matlab")
async def export_matlab(sim_payload: SimulationResult):
    return format_for_matlab(sim_payload)
