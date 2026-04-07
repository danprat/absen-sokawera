import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Employee } from '@/types/attendance';

interface AttendanceResultProps {
  employee: Employee;
  confidence: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLate: boolean;
  attendanceStatus?: 'belum_absen' | 'sudah_check_in' | 'sudah_lengkap';
}

export function AttendanceResult({
  employee,
  confidence,
  onConfirm,
  onCancel,
  isLate,
  attendanceStatus = 'belum_absen'
}: AttendanceResultProps) {
  // Determine UI text based on attendance status
  const getConfirmationText = () => {
    switch (attendanceStatus) {
      case 'sudah_check_in':
        return 'Konfirmasi pulang';
      case 'sudah_lengkap':
        return 'Sudah absen lengkap hari ini';
      case 'belum_absen':
      default:
        return 'Konfirmasi kehadiran';
    }
  };

  const getButtonText = () => {
    switch (attendanceStatus) {
      case 'sudah_check_in':
        return 'Pulang';
      case 'belum_absen':
      default:
        return 'Hadir';
    }
  };

  const showConfirmButton = attendanceStatus !== 'sudah_lengkap';

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
        onClick={onCancel}
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 50 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-card rounded-2xl w-full max-w-sm overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Status indicator */}
          {isLate && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-2 px-5 py-3 bg-warning/10 border-b border-warning/20"
            >
              <AlertCircle className="w-4 h-4 text-warning" />
              <span className="text-sm font-medium text-warning">Terlambat</span>
            </motion.div>
          )}
          
          {/* Main content */}
          <div className="p-6 space-y-6">
            {/* Confirmation text */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <p className="text-sm text-muted-foreground mb-1">{getConfirmationText()}</p>
              <h2 className="text-2xl font-bold text-foreground">{employee.name}</h2>
              <p className="text-muted-foreground">{employee.position}</p>
            </motion.div>

            {/* Confidence & Time */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-between py-3 px-4 bg-secondary rounded-xl"
            >
              <div>
                <p className="text-xs text-muted-foreground">Akurasi</p>
                <p className="font-semibold text-foreground">{(confidence * 100).toFixed(1)}%</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Waktu</p>
                <p className="font-semibold text-foreground">
                  {new Date().toLocaleTimeString('id-ID', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </motion.div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex gap-3"
            >
              <Button
                variant="outline"
                size="lg"
                onClick={onCancel}
                className="flex-1"
              >
                <X className="w-5 h-5" />
                {showConfirmButton ? 'Batal' : 'Tutup'}
              </Button>
              {showConfirmButton && (
                <Button
                  variant={isLate ? 'warning' : 'success'}
                  size="lg"
                  onClick={onConfirm}
                  className="flex-1"
                >
                  <Check className="w-5 h-5" />
                  {getButtonText()}
                </Button>
              )}
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
