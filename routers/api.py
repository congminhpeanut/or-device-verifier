import unicodedata
import re
from fastapi import APIRouter, HTTPException, Header, Depends
from models import DeviceCreate, LabelBind, VerificationRequest, VerificationResponse
from database import supabase
from utils import normalize_serial
import datetime

router = APIRouter(prefix="/api")

def verify_admin(admin_pin: str = Header(None, alias="X-Admin-Pin")):

    import os
    expected_pin = os.environ.get("ADMIN_PIN")
    if not expected_pin or admin_pin != expected_pin:
        raise HTTPException(status_code=403, detail="Invalid Admin PIN")

@router.get("/admin/verify", dependencies=[Depends(verify_admin)])
async def check_admin():
    return {"status": "ok"}

@router.post("/devices")
async def create_device(device: DeviceCreate, _ = Depends(verify_admin)):
    serial_norm = normalize_serial(device.serial_raw)
    data = device.dict()
    data['serial_norm'] = serial_norm
    data['created_at'] = datetime.datetime.now().isoformat()
    
    try:
        response = supabase.table("devices").insert(data).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/labels/bind")
async def bind_label(bind: LabelBind, _ = Depends(verify_admin)):
    serial_norm = normalize_serial(bind.serial_raw)
    
    # Check if device exists, if not, maybe auto-create or error? 
    # Req says "Bind label_id -> device.serial_norm", implies device should exist.
    # We will assume admin creates device first, or we could upsert.
    # Let's simple check existence first
    
    device_res = supabase.table("devices").select("serial_norm").eq("serial_norm", serial_norm).execute()
    if not device_res.data:
        raise HTTPException(status_code=404, detail=f"Device with normalized serial {serial_norm} not found. Create device first.")

    data = {
        "label_id": bind.label_id,
        "bound_serial_norm": serial_norm,
        "active": True
    }
    
    try:
        response = supabase.table("labels").upsert(data).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/labels/{label_id}")
async def get_label(label_id: str):
    response = supabase.table("labels").select("bound_serial_norm, devices(*)").eq("label_id", label_id).eq("active", True).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Label not found or inactive")
    return response.data[0]

@router.post("/verify")
async def verify_event(req: VerificationRequest):
    # 1. Look up expected
    label_res = supabase.table("labels").select("bound_serial_norm").eq("label_id", req.label_id).execute()
    
    expected_serial_norm = None
    result = "FAIL"
    message = "Label not found"
    
    if label_res.data:
        expected_serial_norm = label_res.data[0]['bound_serial_norm']
        
    observed_serial_norm = normalize_serial(req.observed_serial_raw)
    
    if expected_serial_norm:
        if expected_serial_norm == observed_serial_norm:
            result = "PASS"
            message = "Verification Successful"
        else:
            result = "FAIL"
            message = f"Mismatch: Expected {expected_serial_norm}, Got {observed_serial_norm}"
    
    # Log event
    event_data = {
        "actor_name": req.actor_name,
        "label_id": req.label_id,
        "expected_serial_norm": expected_serial_norm,
        "observed_serial_raw": req.observed_serial_raw,
        "observed_serial_norm": observed_serial_norm,
        "method": req.method,
        "result": result,
        "notes": req.notes,
        "is_offline_event": req.is_offline_event
    }
    if req.created_at:
        event_data["created_at"] = req.created_at.isoformat()
    
    # Fire and forget logging (or await it)
    try:
        supabase.table("verification_events").insert(event_data).execute()
    except Exception as e:
        print(f"Failed to log event: {e}") 
        # We don't fail the verification response if logging fails, but in prod we might want a queue
        
    return VerificationResponse(
        result=result,
        message=message,
        expected_serial=expected_serial_norm,
        observed_serial_norm=observed_serial_norm
    )
    
@router.get("/events")
async def list_events(limit: int = 50):
    # Retrieve events
    response = supabase.table("verification_events").select("*").order("created_at", desc=True).limit(limit).execute()
    return response.data
