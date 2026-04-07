import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Header } from '@/components/Header';
import { CameraView } from '@/components/CameraView';
import { AttendanceResult } from '@/components/AttendanceResult';
import { Employee } from '@/types/attendance';
import { useSettings } from '@/hooks/useSettings';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const Absen = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [lateThreshold, setLateThreshold] = useState('08:15');
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

  // Fetch late threshold from schedule
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const data = await api.public.settings();
        if (data.today_schedule?.check_in_end) {
          setLateThreshold(data.today_schedule.check_in_end);
        }
      } catch {
        // Use default
      }
    };
    fetchSchedule();
  }, []);

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
          <CameraView key="camera" onCapture={handleCapture} isPaused={!!capturedEmployee} />
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
