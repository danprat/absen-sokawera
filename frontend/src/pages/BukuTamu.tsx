import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ArrowLeft, Send, Loader2, CheckCircle, User, Building2, FileText, Calendar, Home, ArrowRight, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Header } from '@/components/Header';
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/api';
import { toast } from 'sonner';
import { BackendGuestBookMeetingTarget } from '@/types/guestbook';

// Common institution suggestions for autocomplete
const INSTITUTION_SUGGESTIONS = [
  'Masyarakat Umum',
  'Dinas Pendidikan',
  'Dinas Kesehatan',
  'Kecamatan',
  'Kelurahan',
  'Sekolah',
  'Universitas',
  'Perusahaan Swasta',
  'Lembaga Pemerintah',
  'Lainnya',
];

// Step indicator component
const StepIndicator = ({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) => (
  <div className="flex items-center justify-center gap-2 mb-4">
    {Array.from({ length: totalSteps }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: i * 0.05 }}
        className={`h-2 rounded-full transition-all duration-500 ${
          i === currentStep 
            ? 'w-10 bg-emerald-500' 
            : i < currentStep 
              ? 'w-2 bg-emerald-400' 
              : 'w-2 bg-muted'
        }`}
      />
    ))}
  </div>
);

// Kiosk-optimized Guest Book with large touch targets
export function BukuTamu() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [currentStep, setCurrentStep] = useState(0);
  const [meetingTargets, setMeetingTargets] = useState<BackendGuestBookMeetingTarget[]>([]);
  const [isLoadingTargets, setIsLoadingTargets] = useState(true);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const institutionInputRef = useRef<HTMLInputElement>(null);
  const meetingTargetManualInputRef = useRef<HTMLInputElement>(null);
  const purposeInputRef = useRef<HTMLTextAreaElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const totalSteps = 5; // Name, Institution, Meeting Target, Purpose, Date

  // Get today's date in local timezone (Indonesia)
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    name: '',
    institution: '',
    meeting_target_id: null as number | null,
    meeting_target_manual: '',
    purpose: '',
    visit_date: getTodayDate(),
  });

  useEffect(() => {
    const loadMeetingTargets = async () => {
      try {
        const items = await api.guestBook.getMeetingTargets();
        setMeetingTargets(items);
      } catch (error) {
        console.error('Failed to load meeting targets:', error);
        toast.error('Gagal memuat daftar tujuan ketemu');
      } finally {
        setIsLoadingTargets(false);
      }
    };

    loadMeetingTargets();
  }, []);

  // Auto-focus input on step change
  useEffect(() => {
    // Wait for AnimatePresence transition (duration: 0.2s) plus buffer
    const timer = setTimeout(() => {
      if (currentStep === 0 && nameInputRef.current) {
        nameInputRef.current.focus();
      } else if (currentStep === 1 && institutionInputRef.current) {
        institutionInputRef.current.focus();
      } else if (currentStep === 2 && formData.meeting_target_id === null && meetingTargetManualInputRef.current) {
        meetingTargetManualInputRef.current.focus();
      } else if (currentStep === 3 && purposeInputRef.current) {
        purposeInputRef.current.focus();
      } else if (currentStep === 4 && dateInputRef.current) {
        dateInputRef.current.focus();
      }
    }, 250); // 200ms animation + 50ms buffer

    return () => clearTimeout(timer);
  }, [currentStep, formData.meeting_target_id]);

  // Countdown and auto-redirect after success
  useEffect(() => {
    if (isSuccess) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isSuccess, navigate]);

  const canProceed = () => {
    if (currentStep === 0) return formData.name.trim() !== '';
    if (currentStep === 1) return formData.institution.trim() !== '';
    if (currentStep === 2) return formData.meeting_target_id !== null || formData.meeting_target_manual.trim() !== '';
    if (currentStep === 3) return formData.purpose.trim() !== '';
    if (currentStep === 4) return formData.visit_date !== '';
    return true;
  };

  const handleNext = () => {
    if (canProceed() && currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Nama lengkap harus diisi');
      return;
    }
    if (!formData.institution.trim()) {
      toast.error('Instansi/asal harus diisi');
      return;
    }
    if (formData.meeting_target_id === null && !formData.meeting_target_manual.trim()) {
      toast.error('Tujuan ketemu harus dipilih atau diisi manual');
      return;
    }
    if (!formData.purpose.trim()) {
      toast.error('Keperluan harus diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.guestBook.submit(formData);
      setIsSuccess(true);
      toast.success('Data berhasil disimpan!');
    } catch (error) {
      console.error('Failed to submit guest book:', error);
      toast.error('Gagal menyimpan data. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success State - Kiosk optimized
  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10">
        <Header villageName={settings.villageName} officerName={settings.officerName} logoUrl={settings.logoUrl} />
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center space-y-6 max-w-xl"
          >
            {/* Success Animation */}
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2, bounce: 0.5 }}
              className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40"
            >
              <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              <h2 className="text-3xl font-bold text-foreground">Terima Kasih! 🙏</h2>
              <p className="text-lg text-muted-foreground">
                Data kunjungan Anda telah tercatat
              </p>
            </motion.div>

            {/* Countdown */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 backdrop-blur-sm rounded-3xl p-4 space-y-1 border border-emerald-500/20"
            >
              <p className="text-muted-foreground font-medium">Kembali ke beranda dalam</p>
              <div className="text-4xl font-bold bg-gradient-to-br from-emerald-500 to-emerald-600 bg-clip-text text-transparent">
                {countdown}
              </div>
              <p className="text-sm text-muted-foreground">detik</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Link to="/">
                <Button size="lg" className="h-12 px-10 text-lg rounded-2xl gap-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all">
                  <Home className="w-5 h-5" />
                  Kembali Sekarang
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </main>
      </div>
    );
  }

  const renderStepContent = () => {
    // Step 0: Name
    if (currentStep === 0) {
      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-1 sm:mb-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
              <User className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold">Nama Lengkap</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Siapa nama Anda?</p>
          </div>
          
          <div>
            <Input
              ref={nameInputRef}
              placeholder="Ketik nama lengkap Anda..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-12 sm:h-14 text-base sm:text-lg px-4 sm:px-5 rounded-xl border-2 focus:border-emerald-500 focus:ring-emerald-500/20 text-center"
              onKeyDown={(e) => e.key === 'Enter' && canProceed() && handleNext()}
            />
          </div>
        </div>
      );
    }

    // Step 1: Institution
    if (currentStep === 1) {
      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-1 sm:mb-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
              <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold">Instansi / Asal</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Ketik manual atau pilih dari saran</p>
          </div>
          
          <div className="space-y-3">
            {/* Manual Input */}
            <Input
              ref={institutionInputRef}
              placeholder="Ketik nama instansi..."
              value={formData.institution}
              onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
              className="h-12 sm:h-14 text-base sm:text-lg px-4 sm:px-5 rounded-xl border-2 focus:border-emerald-500 focus:ring-emerald-500/20 text-center"
              onKeyDown={(e) => e.key === 'Enter' && canProceed() && handleNext()}
            />
            
            {/* Suggestion Buttons */}
            <div className="max-h-[240px] sm:max-h-[280px] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {INSTITUTION_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, institution: suggestion });
                      // Focus input after selection for easy editing if needed
                      setTimeout(() => institutionInputRef.current?.focus(), 100);
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                      formData.institution === suggestion
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg shadow-emerald-500/20'
                        : 'border-muted hover:border-emerald-300 hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-sm font-medium">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Step 2: Meeting target
    if (currentStep === 2) {
      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-1 sm:mb-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
              <Users className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold">Tujuan Ketemu Siapa</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Pilih dari daftar atau isi manual</p>
          </div>

          {isLoadingTargets ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="max-h-[220px] sm:max-h-[260px] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {meetingTargets.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, meeting_target_id: target.id, meeting_target_manual: '' })}
                      className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                        formData.meeting_target_id === target.id
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg shadow-emerald-500/20'
                          : 'border-muted hover:border-emerald-300 hover:bg-muted/50'
                      }`}
                    >
                      <span className="text-sm font-medium">{target.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, meeting_target_id: null, meeting_target_manual: formData.meeting_target_manual })}
                    className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                      formData.meeting_target_id === null
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg shadow-emerald-500/20'
                        : 'border-muted hover:border-emerald-300 hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-sm font-medium">Lainnya / Isi Manual</span>
                  </button>
                </div>
              </div>

              {formData.meeting_target_id === null && (
                <Input
                  ref={meetingTargetManualInputRef}
                  placeholder="Contoh: Kasi Pemerintahan"
                  value={formData.meeting_target_manual}
                  onChange={(e) => setFormData({ ...formData, meeting_target_manual: e.target.value })}
                  className="h-12 sm:h-14 text-base sm:text-lg px-4 sm:px-5 rounded-xl border-2 focus:border-emerald-500 focus:ring-emerald-500/20 text-center"
                />
              )}
            </div>
          )}
        </div>
      );
    }

    // Step 3: Purpose
    if (currentStep === 3) {
      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-1 sm:mb-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
              <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold">Keperluan</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Apa keperluan kunjungan Anda?</p>
          </div>

          <div>
            <Textarea
              ref={purposeInputRef}
              placeholder="Jelaskan keperluan kunjungan Anda..."
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              rows={4}
              className="text-base sm:text-lg px-4 sm:px-5 py-3 sm:py-4 rounded-xl border-2 resize-none focus:border-emerald-500 focus:ring-emerald-500/20"
            />
          </div>
        </div>
      );
    }

    // Step 4: Date
    if (currentStep === 4) {
      // Use local timezone for comparison
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const isToday = formData.visit_date === todayStr;

      // Format date for display (Hari, Tanggal Bulan Tahun)
      const formatDateDisplay = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00'); // Add time to avoid timezone issues

        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                       'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        const dayName = days[date.getDay()];
        const day = date.getDate();
        const monthName = months[date.getMonth()];
        const year = date.getFullYear();

        return `${dayName}, ${day} ${monthName} ${year}`;
      };

      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-1 sm:mb-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
              <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold">Tanggal Kunjungan</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Kapan Anda berkunjung?</p>
          </div>

          <div className="space-y-3">
            {/* Quick action button for today */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, visit_date: getTodayDate() })}
                className={`flex-1 h-12 sm:h-14 px-4 rounded-xl border-2 font-medium transition-all duration-200 ${
                  isToday
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : 'border-muted hover:border-emerald-300 hover:bg-muted/50 text-muted-foreground'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isToday ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`}></span>
                  <span className="text-sm sm:text-base">Hari ini</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker?.()}
                className="h-12 sm:h-14 px-4 rounded-xl border-2 border-muted hover:border-emerald-300 hover:bg-muted/50 transition-all duration-200"
              >
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Hidden date input for picker */}
            <Input
              ref={dateInputRef}
              type="date"
              value={formData.visit_date}
              onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
              className="h-0 w-0 opacity-0 pointer-events-none absolute"
            />

            {/* Display formatted date */}
            {formData.visit_date && (
              <div className="text-center p-4 bg-muted/30 rounded-xl">
                <p className="text-base sm:text-lg font-semibold text-foreground">
                  {formatDateDisplay(formData.visit_date)}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }
  };

  const isLastStep = currentStep === totalSteps - 1;

  // Form State - Survey-like UX
  return (
    <div className="min-h-screen h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10 overflow-hidden">
      <Header villageName={settings.villageName} officerName={settings.officerName} logoUrl={settings.logoUrl} />

      <main className="flex-1 flex flex-col px-3 sm:px-4 py-2 sm:py-3 overflow-hidden">
        <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col landscape:flex-row landscape:gap-6 landscape:items-center">
          
          {/* Header & Steps Section (Left side in landscape) */}
          <div className="w-full landscape:w-1/4 flex flex-col justify-center landscape:h-full">
          {/* Header */}
          <div className="text-center mb-1 sm:mb-2 landscape:mb-0">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
              className="w-12 h-12 sm:w-14 sm:h-14 landscape:w-8 landscape:h-8 mx-auto mb-1 sm:mb-2 landscape:mb-1 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-500/20"
            >
              <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 landscape:w-4 landscape:h-4 text-white" />
            </motion.div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground landscape:text-lg">Buku Tamu</h1>
            <p className="hidden landscape:block text-muted-foreground text-[10px]">Silakan isi data kunjungan Anda</p>
          </div>

          {/* Step Indicator */}
          <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
          </div>

          {/* Content Card */}
          <div className="flex-1 w-full landscape:w-3/4 bg-card/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl border-0 p-3 sm:p-4 md:p-6 landscape:p-4 flex flex-col overflow-y-auto landscape:max-h-[85vh]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1"
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
              {currentStep === 0 ? (
                <Link to="/" className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full h-10 sm:h-12 text-base sm:text-lg rounded-xl gap-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    Kembali
                  </Button>
                </Link>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handlePrev}
                  className="flex-1 h-10 sm:h-12 text-base sm:text-lg rounded-xl gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Sebelumnya
                </Button>
              )}

              {isLastStep ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !canProceed()}
                  className="flex-1 h-10 sm:h-12 text-base sm:text-lg rounded-xl gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Kirim Data
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="flex-1 h-10 sm:h-12 text-base sm:text-lg rounded-xl gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30 disabled:opacity-50"
                >
                  Selanjutnya
                  <ArrowRight className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default BukuTamu;