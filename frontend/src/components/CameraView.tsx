import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Camera, CameraOff, CheckCircle2 } from 'lucide-react';
import { Employee } from '@/types/attendance';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  initializeFaceDetector,
  detectFaces,
  updateStabilityTracker,
  drawFaceOverlay,
  isWebAssemblySupported,
  type FaceStability,
  type BoundingBox
} from '@/lib/faceDetection';
import type { FaceDetector } from '@mediapipe/tasks-vision';

interface CameraViewProps {
  onCapture: (employee: Employee, confidence: number, attendanceStatus?: 'belum_absen' | 'sudah_check_in' | 'sudah_lengkap') => void;
  isPaused?: boolean;
}

// Optimized constants for faster detection
const AUTO_CAPTURE_DELAY = 1000;  // Reduced from 2500ms to 1 second
const FACE_DETECTION_INTERVAL = 33;  // ~30 FPS, reduced from 500ms
const MIN_FACE_CONFIDENCE = 0.5;
const STABILITY_FRAMES_REQUIRED = 5;

export function CameraView({ onCapture, isPaused = false }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const faceDetectedTimeRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // MediaPipe face detection state
  const [faceDetector, setFaceDetector] = useState<FaceDetector | null>(null);
  const [detectorLoading, setDetectorLoading] = useState(true);
  const [detectorError, setDetectorError] = useState<string | null>(null);
  const [faceStability, setFaceStability] = useState<FaceStability>({
    detectionCount: 0,
    lastPosition: null,
    isStable: false,
  });
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setCameraReady(true);
    } catch (error) {
      console.error('Camera error:', error);
      setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
    }
  }, []);

  useEffect(() => {
    startCamera();

    return () => {
      console.log('CameraView unmounting - stopping camera');
      // Stop camera stream using ref (always has latest value)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('Camera track stopped:', track.label);
        });
        streamRef.current = null;
      }
      // Stop video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.pause();
      }
      // Clear intervals
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [startCamera]);

  // Additional cleanup on visibility change to ensure camera stops
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && streamRef.current) {
        console.log('Page hidden - pausing camera');
        streamRef.current.getTracks().forEach(track => track.enabled = false);
      } else if (!document.hidden && streamRef.current) {
        console.log('Page visible - resuming camera');
        streamRef.current.getTracks().forEach(track => track.enabled = true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Initialize MediaPipe FaceDetector
  useEffect(() => {
    const initDetector = async () => {
      try {
        // Check WebAssembly support
        if (!isWebAssemblySupported()) {
          setDetectorError('Browser tidak mendukung WebAssembly. Gunakan browser modern.');
          setDetectorLoading(false);
          return;
        }

        setDetectorLoading(true);
        const detector = await initializeFaceDetector();
        setFaceDetector(detector);
        setDetectorLoading(false);
        setDetectorError(null);
      } catch (error) {
        console.error('Failed to initialize face detector:', error);
        setDetectorError('Gagal memuat deteksi wajah. Refresh halaman untuk mencoba lagi.');
        setDetectorLoading(false);
      }
    };

    initDetector();
  }, []);

  const captureImageAsBase64 = useCallback((): string | null => {
    if (!videoRef.current) return null;

    try {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      // Draw without mirroring to match enrollment photos
      ctx.drawImage(video, 0, 0);
      
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      return base64;
    } catch (error) {
      console.error('Failed to capture image:', error);
      return null;
    }
  }, []);

  const triggerAutoCapture = useCallback(async () => {
    if (scanning) return;
    
    setScanning(true);
    setCountdown(null);

    try {
      const imageBase64 = captureImageAsBase64();
      
      if (!imageBase64) {
        throw new Error('Gagal menangkap gambar');
      }

      const result = await api.attendance.recognize(undefined, imageBase64);

      // Convert backend response to frontend Employee format
      const recognizedEmployee: Employee = {
        id: String(result.employee.id),
        name: result.employee.name,
        position: result.employee.position,
        photoUrl: result.employee.photo || undefined,
        isActive: true,
        joinDate: '',
      };

      // Don't show success toast yet - waiting for user confirmation
      // Use confidence from backend (already in percentage)
      onCapture(recognizedEmployee, result.confidence / 100, result.attendance_status);
    } catch (error) {
      console.error('Face recognition error:', error);
      
      const axiosError = error as { response?: { data?: { detail?: string } } };
      const errorMessage = axiosError.response?.data?.detail || 'Wajah tidak dikenali atau terjadi kesalahan';
      
      toast.error('Pengenalan Gagal', {
        description: errorMessage,
      });
    } finally {
      setScanning(false);
      faceDetectedTimeRef.current = null;
    }
  }, [scanning, onCapture, captureImageAsBase64]);

  // Reset state when paused
  useEffect(() => {
    if (isPaused) {
      setFaceDetected(false);
      setCountdown(null);
      faceDetectedTimeRef.current = null;
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }
  }, [isPaused]);

  // Real-time MediaPipe face detection
  useEffect(() => {
    if (!cameraReady || scanning || isPaused || !faceDetector || detectorLoading) return;

    const runDetection = async () => {
      if (!videoRef.current || !canvasRef.current) return;

      try {
        // Detect faces using MediaPipe
        const detections = await detectFaces(videoRef.current, performance.now());

        // Check if face detected with sufficient confidence
        const hasFace = detections.length > 0 &&
                       detections[0].categories?.[0]?.score >= MIN_FACE_CONFIDENCE;

        if (hasFace) {
          // Update face stability tracker
          const newStability = updateStabilityTracker(
            detections[0],
            faceStability,
            videoRef.current
          );
          setFaceStability(newStability);

          // Draw face overlay on canvas
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            drawFaceOverlay(
              ctx,
              detections[0],
              newStability.isStable,
              canvasRef.current.width,
              canvasRef.current.height,
              videoRef.current.videoWidth,
              videoRef.current.videoHeight
            );
          }

          // If face is stable, start countdown
          if (newStability.isStable) {
            setFaceDetected(true);

            if (!faceDetectedTimeRef.current) {
              faceDetectedTimeRef.current = Date.now();
              setCountdown(Math.ceil(AUTO_CAPTURE_DELAY / 1000));

              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
              }

              countdownIntervalRef.current = setInterval(() => {
                setCountdown(prev => {
                  if (prev === null || prev <= 1) {
                    if (countdownIntervalRef.current) {
                      clearInterval(countdownIntervalRef.current);
                    }
                    return null;
                  }
                  return prev - 1;
                });
              }, 1000);
            }

            const elapsed = Date.now() - faceDetectedTimeRef.current;
            if (elapsed >= AUTO_CAPTURE_DELAY) {
              triggerAutoCapture();
            }
          } else {
            // Face detected but not stable yet
            setFaceDetected(false);
            faceDetectedTimeRef.current = null;
            setCountdown(null);
          }
        } else {
          // No face detected - reset everything
          setFaceDetected(false);
          setFaceStability({
            detectionCount: 0,
            lastPosition: null,
            isStable: false,
          });
          faceDetectedTimeRef.current = null;
          setCountdown(null);
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }

          // Clear canvas overlay
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      } catch (error) {
        console.error('Face detection error:', error);
      }
    };

    const interval = setInterval(runDetection, FACE_DETECTION_INTERVAL);
    detectionIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [cameraReady, scanning, isPaused, faceDetector, detectorLoading, faceStability, triggerAutoCapture]);

  const progressPercentage = countdown !== null 
    ? ((Math.ceil(AUTO_CAPTURE_DELAY / 1000) - countdown) / Math.ceil(AUTO_CAPTURE_DELAY / 1000)) * 100 
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex flex-col items-center justify-center relative bg-black select-none overflow-hidden"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
      />

      {/* Canvas overlay for face detection rectangle */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
      />

      <div className="absolute inset-0 bg-black/30" />

      {cameraError && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 flex flex-col items-center gap-4 p-8 bg-background/90 rounded-2xl backdrop-blur-sm"
        >
          <CameraOff className="w-16 h-16 text-destructive" />
          <p className="text-center text-muted-foreground max-w-xs">{cameraError}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              startCamera();
            }}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-medium"
          >
            Coba Lagi
          </button>
        </motion.div>
      )}

      {!cameraError && (
        <div className="relative z-10 flex flex-col items-center gap-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="relative"
          >
            {countdown !== null && !scanning && (
              <svg className="absolute -inset-4 w-[calc(100%+2rem)] h-[calc(100%+2rem)]" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="hsl(var(--accent))"
                  strokeWidth="3"
                  strokeDasharray={`${progressPercentage * 3.01} 301`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  className="transition-all duration-300"
                />
              </svg>
            )}

            <div
              className={`w-56 h-72 md:w-64 md:h-80 rounded-3xl border-4 transition-all duration-500 ${
                scanning
                  ? 'border-primary shadow-[0_0_30px_rgba(var(--primary),0.5)]'
                  : faceDetected
                  ? 'border-accent shadow-[0_0_20px_rgba(var(--accent),0.3)]'
                  : 'border-white/40'
              }`}
            >
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-2xl border-inherit" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-2xl border-inherit" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-2xl border-inherit" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-2xl border-inherit" />

              {countdown !== null && !scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    key={countdown}
                    initial={{ scale: 1.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="text-6xl font-bold text-accent drop-shadow-lg"
                  >
                    {countdown}
                  </motion.div>
                </div>
              )}

              {scanning && (
                <div className="absolute inset-0 overflow-hidden rounded-3xl">
                  <motion.div
                    initial={{ top: 0 }}
                    animate={{ top: '100%' }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
                  />
                </div>
              )}

              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Camera className="w-12 h-12 text-white/60" />
                  </motion.div>
                </div>
              )}
            </div>

            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full text-sm font-semibold backdrop-blur-md transition-all duration-300 flex items-center gap-2 ${
                scanning
                  ? 'bg-primary text-primary-foreground'
                  : faceDetected
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-white/20 text-white'
              }`}
            >
              {scanning && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Camera className="w-4 h-4" /></motion.div>}
              {scanning ? 'Memproses...' : faceDetected ? 'Wajah Terdeteksi' : 'Mencari Wajah...'}
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-8"
          >
            <p className={`text-2xl font-semibold transition-colors duration-300 ${
              faceDetected && !scanning ? 'text-white' : 'text-white/70'
            }`}>
              {scanning 
                ? 'Mengenali Wajah...' 
                : faceDetected 
                ? countdown !== null 
                  ? 'Tetap Diam...' 
                  : 'Wajah Terdeteksi'
                : 'Arahkan Wajah ke Kamera'}
            </p>
            {faceDetected && !scanning && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-white/60 mt-2 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Absensi otomatis dalam {countdown || 0} detik
              </motion.p>
            )}
            {!faceDetected && !scanning && cameraReady && (
              <p className="text-white/50 mt-2 text-sm">
                Posisikan wajah dalam bingkai
              </p>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
