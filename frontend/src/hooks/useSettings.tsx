import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export interface AppSettings {
  villageName: string;
  officerName: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
}

const DEFAULT_SETTINGS: AppSettings = {
  villageName: 'Desa',
  officerName: 'Admin',
  logoUrl: null,
  backgroundUrl: null,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.public.settings();
        const villageName = data.village_name || 'Desa';
        setSettings({
          villageName,
          officerName: data.officer_name || 'Admin',
          logoUrl: data.logo_url || null,
          backgroundUrl: data.background_url || null,
        });
        // Update browser tab title with village name
        document.title = `${villageName} - Sistem Absensi`;
      } catch {
        // Use defaults if settings fetch fails
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  return { settings, isLoading };
}
