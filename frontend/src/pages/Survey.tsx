import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ArrowLeft, ArrowRight, Send, Loader2, CheckCircle, Home, ClipboardList, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Header } from '@/components/Header';
import { useSettings } from '@/hooks/useSettings';
import api from '@/lib/api';
import { toast } from 'sonner';
import { 
  BackendServiceType, 
  BackendSurveyQuestion,
  SatisfactionRating,
  SATISFACTION_LABELS,
  SATISFACTION_ICONS,
} from '@/types/survey';

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
            ? 'w-10 bg-amber-500' 
            : i < currentStep 
              ? 'w-2 bg-amber-400' 
              : 'w-2 bg-muted'
        }`}
      />
    ))}
  </div>
);

export function Survey() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [currentStep, setCurrentStep] = useState(0);
  const [serviceTypes, setServiceTypes] = useState<BackendServiceType[]>([]);
  const [questions, setQuestions] = useState<BackendSurveyQuestion[]>([]);
  const feedbackInputRef = useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState<{
    service_type_id: number | null;
    filled_by: 'sendiri' | 'diwakilkan' | null;
    responses: Record<number, string>;
    feedback: string;
  }>({
    service_type_id: null,
    filled_by: null,
    responses: {},
    feedback: '',
  });

  // Calculate total steps: Service Type + Filled By + Questions + Feedback
  const totalSteps = 2 + questions.length + 1;

  // Auto-focus feedback textarea on last step
  useEffect(() => {
    const isLastStep = currentStep === totalSteps - 1;
    if (isLastStep && feedbackInputRef.current) {
      // Wait for AnimatePresence transition (duration: 0.2s) plus buffer
      const timer = setTimeout(() => {
        feedbackInputRef.current?.focus();
      }, 250); // 200ms animation + 50ms buffer
      return () => clearTimeout(timer);
    }
  }, [currentStep, totalSteps]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [typesData, questionsData] = await Promise.all([
          api.survey.getServiceTypes(),
          api.survey.getQuestions(),
        ]);
        setServiceTypes(typesData.filter(t => t.is_active));
        setQuestions(questionsData.filter(q => q.is_active).sort((a, b) => a.order - b.order));
      } catch (error) {
        console.error('Failed to load survey data:', error);
        toast.error('Gagal memuat data survey');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Countdown after success
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

  const handleResponseChange = (questionId: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      responses: {
        ...prev.responses,
        [questionId]: value,
      },
    }));
  };

  const canProceed = () => {
    if (currentStep === 0) return formData.service_type_id !== null;
    if (currentStep === 1) return formData.filled_by !== null;
    if (currentStep >= 2 && currentStep < 2 + questions.length) {
      const question = questions[currentStep - 2];
      if (question.is_required) {
        return !!formData.responses[question.id];
      }
      return true;
    }
    return true; // Feedback step is optional
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

  const handleSubmit = async () => {
    if (!formData.service_type_id || !formData.filled_by) {
      toast.error('Data tidak lengkap');
      return;
    }

    // Check required questions
    const requiredQuestions = questions.filter(q => q.is_required);
    for (const q of requiredQuestions) {
      if (!formData.responses[q.id]) {
        toast.error(`Pertanyaan "${q.question_text}" wajib diisi`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await api.survey.submit({
        service_type_id: formData.service_type_id,
        filled_by: formData.filled_by,
        responses: formData.responses,
        feedback: formData.feedback || undefined,
      });
      setIsSuccess(true);
      toast.success('Survey berhasil dikirim!');
    } catch (error) {
      console.error('Failed to submit survey:', error);
      toast.error('Gagal mengirim survey. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-background to-amber-50/30 dark:from-amber-950/20 dark:via-background dark:to-amber-950/10">
        <Header villageName={settings.villageName} officerName={settings.officerName} logoUrl={settings.logoUrl} />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
            <p className="text-xl text-muted-foreground">Memuat survey...</p>
          </div>
        </main>
      </div>
    );
  }

  // Success State - Kiosk optimized
  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-background to-amber-50/30 dark:from-amber-950/20 dark:via-background dark:to-amber-950/10">
        <Header villageName={settings.villageName} officerName={settings.officerName} logoUrl={settings.logoUrl} />
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center space-y-6 max-w-lg"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-24 h-24 mx-auto bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-2xl shadow-amber-500/30"
            >
              <CheckCircle className="w-12 h-12 text-white" />
            </motion.div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground">🎉 Terima Kasih!</h2>
              <p className="text-lg text-muted-foreground">
                Atas partisipasi Anda dalam survey kepuasan
              </p>
            </div>

            <div className="bg-muted/50 rounded-2xl p-4 space-y-1">
              <p className="text-muted-foreground">Kembali ke beranda dalam</p>
              <div className="text-4xl font-bold text-amber-500">{countdown}</div>
              <p className="text-sm text-muted-foreground">detik</p>
            </div>

            <Link to="/">
              <Button size="lg" className="h-12 px-10 text-lg rounded-2xl gap-3 bg-gradient-to-r from-amber-500 to-amber-600">
                <Home className="w-5 h-5" />
                Kembali Sekarang
              </Button>
            </Link>
          </motion.div>
        </main>
      </div>
    );
  }

  const satisfactionOptions: SatisfactionRating[] = ['sangat_puas', 'puas', 'cukup_puas', 'tidak_puas', 'sangat_tidak_puas'];

  // Render current step content
  const renderStepContent = () => {
    // Step 0: Service Type Selection
    if (currentStep === 0) {
      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-lg sm:text-xl font-bold">Jenis Layanan</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Pilih layanan yang Anda terima</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {serviceTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  setFormData({ ...formData, service_type_id: type.id });
                }}
                className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  formData.service_type_id === type.id
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-lg shadow-amber-500/20'
                    : 'border-muted hover:border-amber-300 hover:bg-muted/50'
                }`}
              >
                <span className="text-base font-medium">{type.name}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Step 1: Filled By Selection
    if (currentStep === 1) {
      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-lg sm:text-xl font-bold">Pengisi Survey</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Siapa yang mengisi survey ini?</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, filled_by: 'sendiri' })}
              className={`p-4 sm:p-6 md:p-8 rounded-2xl border-2 text-center transition-all duration-200 ${
                formData.filled_by === 'sendiri'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-lg shadow-amber-500/20'
                  : 'border-muted hover:border-amber-300 hover:bg-muted/50'
              }`}
            >
              <span className="text-4xl sm:text-5xl mb-2 sm:mb-3 block">👤</span>
              <span className="text-base sm:text-lg md:text-xl font-medium">Diri Sendiri</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, filled_by: 'diwakilkan' })}
              className={`p-4 sm:p-6 md:p-8 rounded-2xl border-2 text-center transition-all duration-200 ${
                formData.filled_by === 'diwakilkan'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-lg shadow-amber-500/20'
                  : 'border-muted hover:border-amber-300 hover:bg-muted/50'
              }`}
            >
              <span className="text-4xl sm:text-5xl mb-2 sm:mb-3 block">👥</span>
              <span className="text-base sm:text-lg md:text-xl font-medium">Diwakilkan</span>
            </button>
          </div>
        </div>
      );
    }

    // Question Steps
    if (currentStep >= 2 && currentStep < 2 + questions.length) {
      const question = questions[currentStep - 2];
      
      return (
        <div className="space-y-4 sm:space-y-6">
          <div className="text-center space-y-1 sm:space-y-2">
            <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold leading-tight px-2">
              {question.question_text}
              {question.is_required && <span className="text-red-500 ml-1">*</span>}
            </h2>
          </div>

          {question.question_type === 'rating' && (
            <div className="grid grid-cols-5 gap-2 sm:gap-3 md:gap-4">
              {satisfactionOptions.map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => handleResponseChange(question.id, rating)}
                  className={`p-3 sm:p-4 md:p-6 landscape:p-2 rounded-2xl border-2 text-center transition-all duration-200 ${
                    formData.responses[question.id] === rating
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-lg shadow-amber-500/20 scale-105'
                      : 'border-muted hover:border-amber-300 hover:bg-muted/50'
                  }`}
                >
                  <span className="text-4xl sm:text-5xl md:text-6xl landscape:text-4xl mb-2 sm:mb-3 landscape:mb-1 block">{SATISFACTION_ICONS[rating]}</span>
                  <span className="text-xs sm:text-sm md:text-base landscape:text-[10px] font-medium leading-tight block">
                    {SATISFACTION_LABELS[rating]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {question.question_type === 'multiple_choice' && question.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {question.options.map((option, optIndex) => (
                <button
                  key={optIndex}
                  type="button"
                  onClick={() => handleResponseChange(question.id, option)}
                  className={`p-6 rounded-2xl border-2 text-left transition-all duration-200 ${
                    formData.responses[question.id] === option
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-lg shadow-amber-500/20'
                      : 'border-muted hover:border-amber-300 hover:bg-muted/50'
                  }`}
                >
                  <span className="text-lg font-medium">{option}</span>
                </button>
              ))}
            </div>
          )}

          {question.question_type === 'text' && (
            <Textarea
              value={formData.responses[question.id] || ''}
              onChange={(e) => handleResponseChange(question.id, e.target.value)}
              placeholder="Tulis jawaban Anda..."
              rows={4}
              className="text-xl p-6 rounded-2xl border-2 resize-none focus:border-amber-500"
            />
          )}
        </div>
      );
    }

    // Feedback Step (Last)
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="text-center space-y-1 sm:space-y-2">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Saran & Masukan</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Bagikan pendapat Anda (opsional)</p>
        </div>
        
        <Textarea
          ref={feedbackInputRef}
          value={formData.feedback}
          onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
          placeholder="Tuliskan saran atau masukan Anda untuk peningkatan layanan..."
          rows={4}
          className="text-base sm:text-lg md:text-xl p-4 sm:p-5 md:p-6 rounded-2xl border-2 resize-none focus:border-amber-500"
        />
      </div>
    );
  };

  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="min-h-screen h-screen flex flex-col bg-gradient-to-br from-amber-50 via-background to-amber-50/30 dark:from-amber-950/20 dark:via-background dark:to-amber-950/10 overflow-hidden">
      <Header villageName={settings.villageName} officerName={settings.officerName} logoUrl={settings.logoUrl} />

      <main className="flex-1 flex flex-col px-3 sm:px-4 py-2 sm:py-3 overflow-hidden">
        <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col landscape:flex-row landscape:gap-6 landscape:items-center">
          
          {/* Header & Steps Section (Left in landscape) */}
          <div className="w-full landscape:w-1/4 flex flex-col justify-center landscape:h-full">
          {/* Header */}
          <div className="text-center mb-1 sm:mb-2 landscape:mb-0">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
              className="w-12 h-12 sm:w-14 sm:h-14 landscape:w-8 landscape:h-8 mx-auto mb-1 sm:mb-2 landscape:mb-1 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-xl shadow-amber-500/20"
            >
              <Star className="w-6 h-6 sm:w-7 sm:h-7 landscape:w-4 landscape:h-4 text-white" />
            </motion.div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground landscape:text-lg">Survey Kepuasan</h1>
            <p className="hidden landscape:block text-muted-foreground text-[10px]">Masukan Anda sangat berharga bagi kami</p>
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
                  disabled={isSubmitting}
                  className="flex-1 h-10 sm:h-12 text-base sm:text-lg rounded-xl gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Kirim Survey
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  onClick={handleNext}
                  disabled={!canProceed()}
                  className="flex-1 h-10 sm:h-12 text-base sm:text-lg rounded-xl gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30 disabled:opacity-50"
                >
                  Selanjutnya
                  <ArrowRight className="w-6 h-6" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Survey;