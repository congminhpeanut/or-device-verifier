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
    observed_serial_raw: str
    method: str = "MANUAL" # OCR or MANUAL, default MANUAL
    actor_name: str
    device_photo_base64: Optional[str] = None # We might handle upload separately, but for now simple
    notes: Optional[str] = None
    is_offline_event: bool = False
    created_at: Optional[datetime] = None # Client timestamp if offline

class VerificationResponse(BaseModel):
    result: str # PASS, FAIL, WARN
    message: str
    expected_serial: Optional[str] = None
    observed_serial_norm: str
