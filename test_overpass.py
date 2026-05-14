import asyncio
import httpx

async def main():
    bbox = "28.608,77.208,28.612,77.212"
    overpass_url = "https://overpass-api.de/api/interpreter"
    query = f"""
    [out:json];
    (
      way["building"]({bbox});
      node["natural"="tree"]({bbox});
    );
    out body geom qt;
    """
    
    async with httpx.AsyncClient() as client:
        print("Testing with default headers...")
        resp = await client.post(overpass_url, data={"data": query})
        print("Status:", resp.status_code)
        
        print("\nTesting with custom headers...")
        headers = {
            "User-Agent": "HeliosX/1.0",
            "Accept": "*/*"
        }
        resp = await client.post(overpass_url, data={"data": query}, headers=headers)
        print("Status:", resp.status_code)
        
        print("\nTesting with Accept: application/json...")
        headers["Accept"] = "application/json"
        resp = await client.post(overpass_url, data={"data": query}, headers=headers)
        print("Status:", resp.status_code)

if __name__ == "__main__":
    asyncio.run(main())
