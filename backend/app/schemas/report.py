from typing import Optional, List
from pydantic import BaseModel


class MonthlyReportItem(BaseModel):
    employee_id: int
    employee_name: str
    employee_nik: Optional[str]  # NIK (Nomor Induk Kependudukan)
    employee_position: str
    total_days: int
    present_days: int
    late_days: int
    absent_days: int
    leave_days: int
    sick_days: int
    checkout_days: int  # Jumlah hari yang sudah checkout
    attendance_percentage: float


class MonthlyReportResponse(BaseModel):
    month: int
    year: int
    items: List[MonthlyReportItem]
    total_employees: int
