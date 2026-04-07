import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check, Trash2, Image as ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Employee, FaceEnrollment } from '@/types/attendance';
import { toast } from 'sonner';

interface FaceEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
  onSave: (employee: Employee, enrollments: FaceEnrollment[]) => void;
}

export function FaceEnrollmentDialog({
  open,
  onOpenChange,
  employee,
  onSave,
}: FaceEnrollmentDialogProps) {
  const [enrollments, setEnrollments] = useState<FaceEnrollment[]>(
    employee.faceEnrollments || []
  );
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraActive(true);
    } catch (error) {
      toast.error('Gagal mengakses kamera');
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const photoUrl = canvas.toDataURL('image/jpeg', 0.8);
        addEnrollment(photoUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('File harus berupa gambar');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const photoUrl = event.target?.result as string;
        addEnrollment(photoUrl);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addEnrollment = (photoUrl: string) => {
    const newEnrollment: FaceEnrollment = {
      id: String(Date.now()),
      photoUrl,
      capturedAt: new Date(),
      isVerified: false,
    };
    setEnrollments((prev) => [...prev, newEnrollment]);
    toast.success('Foto wajah berhasil ditambahkan');
  };

  const removeEnrollment = (id: string) => {
    setEnrollments((prev) => prev.filter((e) => e.id !== id));
    toast.success('Foto wajah dihapus');
  };

  const handleSave = () => {
    onSave(employee, enrollments);
    onOpenChange(false);
  };

  const handleClose = () => {
    stopCamera();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            Enrolment Wajah - {employee.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Camera View */}
          {isCameraActive ? (
            <div className="space-y-4">
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-4 border-primary/50 rounded-lg pointer-events-none" />
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={capturePhoto} size="lg">
                  <Camera className="w-5 h-5" />
                  Ambil Foto
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  <X className="w-4 h-4" />
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 justify-center">
              <Button onClick={startCamera} variant="outline" size="lg">
                <Camera className="w-5 h-5" />
                Ambil dari Kamera
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-5 h-5" />
                Upload Foto
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Enrolled Photos */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Foto Terdaftar ({enrollments.length})
            </h4>
            {enrollments.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {enrollments.map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="relative group aspect-square rounded-lg overflow-hidden border border-border"
                  >
                    <img
                      src={enrollment.photoUrl}
                      alt="Face enrollment"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeEnrollment(enrollment.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {enrollment.isVerified && (
                      <div className="absolute top-1 right-1 bg-success text-success-foreground rounded-full p-1">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Belum ada foto terdaftar</p>
                <p className="text-sm">
                  Ambil foto atau upload untuk mendaftarkan wajah
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={handleClose}>
              Batal
            </Button>
            <Button onClick={handleSave}>
              <Check className="w-4 h-4" />
              Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
