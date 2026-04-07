import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface HeaderProps {
  villageName?: string;
  officerName?: string;
  logoUrl?: string | null;
  compact?: boolean;
}

export function Header({ villageName = 'Desa', officerName = 'Admin', logoUrl, compact = false }: HeaderProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const dateString = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Compact header for camera/absen page
  if (compact) {
    return (
      <header className="px-4 py-2 bg-background/80 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {logoUrl && (
              <img
                src={`${API_BASE_URL}${logoUrl}`}
                alt="Logo"
                className="w-8 h-8 object-contain"
              />
            )}
            <div>
              <h1 className="text-sm font-semibold text-foreground">{villageName}</h1>
              <p className="text-xs text-muted-foreground">{dateString}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground tabular-nums">{timeString}</p>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="px-6 py-4 bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <img
              src={`${API_BASE_URL}${logoUrl}`}
              alt="Logo"
              className="w-10 h-10 object-contain"
            />
          )}
          <div>
            <h1 className="text-lg font-semibold text-foreground">{villageName}</h1>
            <p className="text-sm text-muted-foreground">{dateString}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-foreground tabular-nums">{timeString}</p>
          <p className="text-xs text-muted-foreground">{officerName}</p>
        </div>
      </div>
    </header>
  );
}