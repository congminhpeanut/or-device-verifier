import unicodedata
import re
from fastapi import APIRouter, HTTPException, Header, Depends, Body
from models import DeviceCreate, LabelBind, VerificationRequest, VerificationResponse, EmployeeLogin, PasswordChange
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

# --- Auth Endpoints ---

@router.post("/auth/login")
async def login(creds: EmployeeLogin):
    # Simple cleartext password check as requested "pass is 1234"
    # In production, use hashing (bcrypt).
    res = supabase.table("employees").select("*").eq("employee_code", creds.employee_code).eq("password_text", creds.password).execute()
    
    if not res.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    employee = res.data[0]
    return {
        "status": "ok",
        "employee_code": employee['employee_code'],
        "full_name": employee['full_name'],
        "is_first_login": employee['is_first_login']
    }

@router.post("/auth/change-password")
async def change_password(data: PasswordChange):
    # Verify old password first
    res = supabase.table("employees").select("*").eq("employee_code", data.employee_code).eq("password_text", data.old_password).execute()
    if not res.data:
        raise HTTPException(status_code=401, detail="Invalid old password")
    
    # Update to new password and set is_first_login = false
    update_res = supabase.table("employees").update({
        "password_text": data.new_password, 
        "is_first_login": False
    }).eq("employee_code", data.employee_code).execute()
    
    return {"status": "ok", "message": "Password changed successfully"}

# --- Device/Label Endpoints ---

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

# --- Verification Endpoints ---

@router.post("/verify")
async def verify_event(req: VerificationRequest):
    # 1. Lookup Employee
    emp_res = supabase.table("employees").select("full_name").eq("employee_code", req.employee_code).execute()
    employee_name = emp_res.data[0]['full_name'] if emp_res.data else "Unknown"

    # 2. Look up Label
    label_res = supabase.table("labels").select("bound_serial_norm").eq("label_id", req.label_id).execute()
    
    expected_serial_norm = None
    result = "FAIL"
    message = "Label not found"
    
    if label_res.data:
        expected_serial_norm = label_res.data[0]['bound_serial_norm']
        # Logic Change: If label exists, we pass. We DO NOT check serial match anymore per requirements.
        result = "PASS"
        message = "Verification Successful (Label Found)"
        
    # We still record what was observed if sent, but it's not the diff factor
    observed_serial_norm = normalize_serial(req.observed_serial_raw) if req.observed_serial_raw else None
    
    # Log event
    event_data = {
        "actor_name": employee_name, # Mapping existing field to employee name
        "employee_code": req.employee_code,
        "employee_name": employee_name,
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
    
    try:
        supabase.table("verification_events").insert(event_data).execute()
    except Exception as e:
        print(f"Failed to log event: {e}") 
        
    return VerificationResponse(
        result=result,
        message=message,
        expected_serial=expected_serial_norm,
        # observed_serial_norm remove from response or make optional/None
    )
    
@router.get("/events")
async def list_events(limit: int = 50, x_employee_code: str = Header(None)):
    # Permission Check
    if x_employee_code != "kimhai1234":
        raise HTTPException(status_code=403, detail="Access denied. Only kimhai1234 can view history.")

    response = supabase.table("verification_events").select("*").order("created_at", desc=True).limit(limit).execute()
    return response.data
