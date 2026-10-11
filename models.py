# SANO pydantic models - match frontend Medical Records / Meds / Wellness pages
from pydantic import BaseModel
from typing import List, Optional


class ChatIn(BaseModel):
    message: str
    record_id: Optional[str] = None


class MedicationIn(BaseModel):
    name: str
    dose: str = ""
    schedule: str = ""
    status: str = "current"


class AppointmentIn(BaseModel):
    title: str
    date: str
    status: str = "upcoming"
    doctor: str = ""
    specialty: str = ""
    appt_type: str = ""
    time: str = ""
    location: str = ""
    notes: str = ""


class AppointmentStatus(BaseModel):
    status: str
    doctor: str = ""
    specialty: str = ""
    appt_type: str = ""
    time: str = ""
    location: str = ""
    notes: str = ""


class AppointmentPatch(BaseModel):
    status: Optional[str] = None


class SignupIn(BaseModel):
    name: str
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


class RecordIn(BaseModel):
    title: str
    type: str = "other"
    date: str = ""
    status: str = "Normal"


class WellnessIn(BaseModel):
    date: str = ""
    steps: Optional[int] = None
    sleep_hrs: Optional[float] = None
    water_l: Optional[float] = None
    heart_rate: Optional[int] = None


class ProfileIn(BaseModel):
    email: str
    name: str = ""
    phone: str = ""
    gender: str = ""
    dob: str = ""
    blood_group: str = ""
    address: str = ""
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
