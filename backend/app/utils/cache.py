"""
Simple in-memory cache for frequently accessed data.
Reduces database queries for data that rarely changes.
"""
from datetime import datetime, timedelta
from typing import Any, Optional
import threading


class SimpleCache:
    """Thread-safe in-memory cache with TTL support."""
    
    def __init__(self):
        self._cache: dict = {}
        self._lock = threading.Lock()
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired."""
        with self._lock:
            if key not in self._cache:
                return None
            
            data, expires = self._cache[key]
            if datetime.now() >= expires:
                del self._cache[key]
                return None
            
            return data
    
    def set(self, key: str, value: Any, ttl_seconds: int = 60) -> None:
        """Set cache value with TTL."""
        with self._lock:
            expires = datetime.now() + timedelta(seconds=ttl_seconds)
            self._cache[key] = (value, expires)
    
    def invalidate(self, key: str) -> None:
        """Remove specific key from cache."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
    
    def invalidate_prefix(self, prefix: str) -> None:
        """Remove all keys starting with prefix."""
        with self._lock:
            keys_to_delete = [k for k in self._cache if k.startswith(prefix)]
            for key in keys_to_delete:
                del self._cache[key]
    
    def clear(self) -> None:
        """Clear all cache."""
        with self._lock:
            self._cache.clear()


# Global cache instance
cache = SimpleCache()

# Cache keys
SETTINGS_CACHE_KEY = "work_settings"
PUBLIC_SETTINGS_CACHE_KEY = "public_settings"
DAILY_SCHEDULE_CACHE_KEY = "daily_schedule"
HOLIDAY_CACHE_KEY_PREFIX = "holiday"
SURVEY_STATS_CACHE_KEY = "survey_stats"
