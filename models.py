from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

class DeviceCreate(BaseModel):
    serial_raw: str
    model: Optional[str] = None
    mfg_date: Optional[date] = None

class LabelBind(BaseModel):
    label_id: str
    serial_raw: str

class VerificationRequest(BaseModel):
    label_id: str
    # observed_serial_raw is removed from MANDATORY check in new flow, 
    # but we might still want to capture it if the client sends it, 
    # OR we just remove it entirely if strictly "no check".
    # User said "Bỏ phần kiểm tra serial". 
    # But usually scanning a barcode IS the check. The "serial check" likely meant the 2nd step.
    # We will keep it optional for backward compat or if they still want to send what they scanned.
    observed_serial_raw: Optional[str] = None 
    method: str = "SCAN" # SCAN, MANUAL
    
    # New Employee Fields
    employee_code: str
    
    device_photo_base64: Optional[str] = None
    notes: Optional[str] = None
    is_offline_event: bool = False
    created_at: Optional[datetime] = None

class VerificationResponse(BaseModel):
    result: str # PASS, FAIL, WARN
    message: str
    expected_serial: Optional[str] = None
    # observed_serial_norm removed or optional

class EmployeeLogin(BaseModel):
    employee_code: str
    password: str

class PasswordChange(BaseModel):
    employee_code: str
    old_password: str
    new_password: str
