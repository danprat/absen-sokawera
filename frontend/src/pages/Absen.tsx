import { useCallback, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { Header } from '@/components/Header';
import { CameraView } from '@/components/CameraView';
import { AttendanceResult } from '@/components/AttendanceResult';
import { Employee } from '@/types/attendance';
import { useSettings } from '@/hooks/useSettings';
import { api, type BackendAttendanceGateResponse } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const Absen = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [lateThreshold, setLateThreshold] = useState('08:15');
  const [attendanceGate, setAttendanceGate] = useState<BackendAttendanceGateResponse | null>(null);
  const [gateLoading, setGateLoading] = useState(true);
  const [gateError, setGateError] = useState<string | null>(null);
  const [capturedEmployee, setCapturedEmployee] = useState<{
    employee: Employee;
    confidence: number;
    attendanceStatus?: 'belum_absen' | 'sudah_check_in' | 'sudah_lengkap';
  } | null>(null);

  // Cleanup on unmount to ensure camera stops
  useEffect(() => {
    return () => {
      // Force cleanup when page unmounts
      console.log('Absen page unmounting - camera should be stopped');
    };
  }, []);

  const loadAttendanceGate = useCallback(async () => {
    setGateLoading(true);
    setGateError(null);

    try {
      const data = await api.attendance.gate();
      setAttendanceGate(data);
      setLateThreshold(data.schedule?.check_in_end || '08:15');
    } catch (error) {
      console.error('Failed to load attendance gate:', error);
      const axiosError = error as { response?: { data?: { detail?: string } }; message?: string };
      setGateError(axiosError.response?.data?.detail || axiosError.message || 'Gagal mengecek jadwal absensi');
      setAttendanceGate(null);
    } finally {
      setGateLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAttendanceGate();
  }, [loadAttendanceGate]);

  const isLate = () => {
    const now = new Date();
    const [lateHour, lateMinute] = lateThreshold.split(':').map(Number);
    const lateTime = new Date();
    lateTime.setHours(lateHour, lateMinute, 0, 0);
    return now > lateTime;
  };

  const handleCapture = (employee: Employee, confidence: number, attendanceStatus?: 'belum_absen' | 'sudah_check_in' | 'sudah_lengkap') => {
    setCapturedEmployee({ employee, confidence, attendanceStatus });
  };

  const handleConfirmAttendance = async () => {
    if (!capturedEmployee) return;

    try {
      const result = await api.attendance.confirm(
        parseInt(capturedEmployee.employee.id),
        capturedEmployee.confidence * 100
      );

      toast.success(result.message, {
        description: result.attendance?.status === 'terlambat' ? 'Terlambat' : 'Tepat waktu',
      });

      setCapturedEmployee(null);

      // Auto-redirect to daftar-hadir after check-in (not check-out)
      if (capturedEmployee.attendanceStatus === 'belum_absen') {
        setTimeout(() => {
          navigate('/daftar-hadir');
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to confirm attendance:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      const errorMessage = axiosError.response?.data?.detail || 'Gagal menyimpan absensi';
      toast.error('Gagal Absen', {
        description: errorMessage,
      });
      setCapturedEmployee(null);
    }
  };

  const handleCancelCapture = () => {
    setCapturedEmployee(null);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header
        villageName={settings.villageName}
        officerName={settings.officerName}
        logoUrl={settings.logoUrl}
        compact
      />
      
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <AnimatePresence mode="wait">
          {gateLoading ? (
            <motion.div
              key="gate-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-base font-medium text-foreground">Mengecek jadwal absensi</p>
            </motion.div>
          ) : gateError ? (
            <motion.div
              key="gate-error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-4 bg-background px-6 text-center"
            >
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div className="max-w-sm space-y-1">
                <p className="text-lg font-semibold text-foreground">Jadwal belum bisa dicek</p>
                <p className="text-sm text-muted-foreground">{gateError}</p>
              </div>
              <Button onClick={loadAttendanceGate} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Coba Lagi
              </Button>
            </motion.div>
          ) : attendanceGate?.can_scan ? (
            <CameraView key="camera" onCapture={handleCapture} isPaused={!!capturedEmployee} />
          ) : (
            <motion.div
              key="gate-blocked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center"
            >
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              <div className="max-w-sm space-y-1">
                <p className="text-lg font-semibold text-foreground">Absensi belum tersedia</p>
                <p className="text-sm text-muted-foreground">
                  {attendanceGate?.message || 'Hari ini tidak tersedia untuk absensi wajah'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back button */}
        <div className="absolute bottom-4 landscape:bottom-6 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <Link to="/">
            <Button variant="secondary" className="shadow-lg pointer-events-auto landscape:px-8 landscape:py-6 landscape:text-lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke Menu
            </Button>
          </Link>
        </div>
      </main>

      {capturedEmployee && (
        <AttendanceResult
          employee={capturedEmployee.employee}
          confidence={capturedEmployee.confidence}
          onConfirm={handleConfirmAttendance}
          onCancel={handleCancelCapture}
          isLate={isLate()}
          attendanceStatus={capturedEmployee.attendanceStatus}
        />
      )}
    </div>
  );
};

export default Absen;
