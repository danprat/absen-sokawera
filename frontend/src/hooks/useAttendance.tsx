import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { AttendanceRecord } from '@/types/attendance';
import { toast } from 'sonner';

/**
 * Custom hook for managing attendance records with API integration
 * 
 * @example
 * ```tsx
 * const { records, loading, error, refetch, correctAttendance } = useAttendance();
 * ```
 */
export const useAttendance = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.admin.attendance.list();
      setRecords(data);
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
      setError(err as Error);
      toast.error('Gagal memuat data absensi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const correctAttendance = async (
    id: string,
    data: {
      status: string;
      notes?: string;
    }
  ): Promise<AttendanceRecord | null> => {
    try {
      const updated = await api.admin.attendance.correct(id, data);
      setRecords((prev) =>
        prev.map((record) => (record.id === id ? updated : record))
      );
      toast.success('Absensi berhasil dikoreksi');
      return updated;
    } catch (err) {
      console.error('Failed to correct attendance:', err);
      const errorMessage = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Gagal mengoreksi absensi';
      toast.error(errorMessage);
      return null;
    }
  };

  return {
    records,
    loading,
    error,
    refetch: fetchAttendance,
    correctAttendance,
  };
};

/**
 * Custom hook for fetching today's attendance with summary
 */
export const useTodayAttendance = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    hadir: number;
    terlambat: number;
    izin: number;
    sakit: number;
    alfa: number;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.admin.attendance.today();
      setRecords(data.records);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Failed to fetch today attendance:', err);
      setError(err as Error);
      toast.error('Gagal memuat data absensi hari ini');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayAttendance();
  }, []);

  return {
    records,
    summary,
    loading,
    error,
    refetch: fetchTodayAttendance,
  };
};
