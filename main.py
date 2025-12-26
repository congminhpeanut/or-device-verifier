from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from routers import api, pages
import os

app = FastAPI(title="Hospital Equipment Verification")

# Mount Static Files
static_dir = os.path.join(os.path.dirname(__file__), 'static')
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Include Routers
app.include_router(api.router)
app.include_router(pages.router)

if __name__ == "__main__":
    import uvicorn
    # Use 0.0.0.0 for proper networking, port from env or 8000
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
