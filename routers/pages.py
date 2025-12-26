from fastapi import APIRouter
from fastapi.responses import FileResponse
import os

router = APIRouter()

STATIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'static')

@router.get("/")
async def index():
    return FileResponse(os.path.join(STATIC_DIR, 'index.html'))

@router.get("/admin")
async def admin():
    return FileResponse(os.path.join(STATIC_DIR, 'admin.html'))

@router.get("/logs")
async def logs():
    return FileResponse(os.path.join(STATIC_DIR, 'logs.html'))
