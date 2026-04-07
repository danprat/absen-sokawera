"""Service untuk fetch dan sync hari libur dari dayoff-API."""
import httpx
from datetime import datetime, date
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.holiday import Holiday

DAYOFF_API_URL = "https://dayoffapi.vercel.app/api"


async def fetch_holidays_from_api(year: Optional[int] = None) -> List[dict]:
    """Fetch hari libur dari dayoff-API."""
    params = {}
    if year:
        params["year"] = year
    else:
        params["year"] = datetime.now().year
    
    async with httpx.AsyncClient() as client:
        response = await client.get(DAYOFF_API_URL, params=params, timeout=30.0)
        response.raise_for_status()
        return response.json()


def parse_api_date(date_str: str) -> date:
    """Parse tanggal dari format API (YYYY-M-D atau YYYY-MM-DD)."""
    # API returns format like "2025-01-1" or "2025-1-27"
    parts = date_str.split("-")
    year = int(parts[0])
    month = int(parts[1])
    day = int(parts[2])
    return date(year, month, day)


async def sync_holidays_from_api(db: Session, year: Optional[int] = None) -> dict:
    """
    Sync hari libur dari API ke database.
    - Menambahkan hari libur baru dari API (kecuali yang sudah di-exclude)
    - Update hari libur yang sudah ada
    - Tidak menghapus hari libur manual
    - Tidak menambahkan kembali hari libur yang sudah di-exclude user
    
    Returns:
        dict dengan statistik: added, updated, skipped
    """
    api_holidays = await fetch_holidays_from_api(year)
    
    stats = {"added": 0, "updated": 0, "skipped": 0}
    
    for item in api_holidays:
        holiday_date = parse_api_date(item["tanggal"])
        holiday_name = item["keterangan"]
        is_cuti = item.get("is_cuti", False)
        
        # Check if holiday already exists (including excluded ones)
        existing = db.query(Holiday).filter(Holiday.date == holiday_date).first()
        
        if existing:
            # Skip jika sudah di-exclude oleh user
            if existing.is_excluded:
                stats["skipped"] += 1
                continue
            
            # Update jika dari API (is_auto=True), skip jika manual
            if existing.is_auto:
                existing.name = holiday_name
                existing.is_cuti = is_cuti
                stats["updated"] += 1
            else:
                # Manual holiday - don't overwrite
                stats["skipped"] += 1
        else:
            # Add new holiday from API
            new_holiday = Holiday(
                date=holiday_date,
                name=holiday_name,
                is_auto=True,
                is_cuti=is_cuti,
                is_excluded=False
            )
            db.add(new_holiday)
            stats["added"] += 1
    
    db.commit()
    return stats

