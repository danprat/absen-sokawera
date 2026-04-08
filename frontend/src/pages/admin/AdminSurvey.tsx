import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star, Download, Loader2, Calendar, BarChart3, MessageSquare,
  Plus, Trash2, GripVertical, Edit, Building2,
  TrendingUp, Users, CheckCircle2, AlertCircle, ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  BackendServiceType,
  BackendSurveyQuestion,
  BackendSurveyStats,
  BackendSurveyResponse,
  SatisfactionRating,
  SATISFACTION_LABELS,
  SATISFACTION_COLOR_HEX,
  BackendQuestionStatsResponse,
} from '@/types/survey';
import { cn } from '@/lib/utils';

// --- Components for UI/UX Pro Max ---

const StatCard = ({ title, value, icon: Icon, trend, color, delay = 0, tooltip }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: "easeOut" }}
    className="relative group"
  >
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl rounded-xl z-0" />
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="relative z-10 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/20 dark:border-white/10 cursor-pointer group-hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-white/5 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={cn("p-3.5 rounded-2xl bg-opacity-15 shadow-[inset_0_1px_3px_rgba(255,255,255,0.4)] transition-transform duration-500 group-hover:scale-110", color)}>
                  <Icon className={cn("w-6 h-6", color.replace('bg-', 'text-'))} />
                </div>
                {trend && (
                  <Badge variant={trend > 0 ? "default" : "destructive"} className="text-xs shadow-sm bg-opacity-90 backdrop-blur-md">
                    {trend > 0 ? "+" : ""}{trend}%
                    <TrendingUp className={cn("w-3 h-3 ml-1", trend < 0 && "rotate-180")} />
                  </Badge>
                )}
              </div>
              <div className="mt-5 relative">
                <h3 className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-300">{title}</h3>
                <p className="text-4xl font-extrabold mt-1 tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                  {value}
                </p>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent className="bg-slate-900/90 backdrop-blur-md border border-white/10">
            <p>{tooltip}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  </motion.div>
);

// Chart data type for donut chart
interface ChartDataItem {
  rating: SatisfactionRating;
  count: number;
}

const CustomDonutChart = ({ data }: { data: ChartDataItem[] }) => {
  const total = data.reduce((acc, curr) => acc + curr.count, 0);
  let currentAngle = 0;
  const radius = 80;
  const center = 100;
  
  // Map rating to numeric score
  const ratingScoreMap: Record<SatisfactionRating, number> = {
    'sangat_puas': 5,
    'puas': 4,
    'cukup_puas': 3,
    'tidak_puas': 2,
    'sangat_tidak_puas': 1,
  };
  
  // Calculate average score
  const averageScore = total > 0 
    ? (data.reduce((acc, curr) => acc + (ratingScoreMap[curr.rating] * curr.count), 0) / total).toFixed(1)
    : "0.0";

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-8 h-full">
      <div className="relative w-48 h-48 flex-shrink-0 group">
        <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-700" />
        <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90 relative z-10 filter drop-shadow-md">
          {/* Background Circle */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth="16" className="text-slate-100/50 dark:text-slate-800/50" />
          
          {/* Segments */}
          {data.map((item, index) => {
            const percentage = total > 0 ? item.count / total : 0;
            const angle = percentage * 360;
            const dashArray = (angle / 360) * (2 * Math.PI * radius);
            const circumference = 2 * Math.PI * radius;
            
            const segment = (
              <motion.circle
                key={item.rating}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={SATISFACTION_COLOR_HEX[item.rating]}
                strokeWidth="16"
                strokeDasharray={`${dashArray} ${circumference}`}
                strokeDashoffset={-((currentAngle / 360) * circumference)}
                strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${dashArray} ${circumference}` }}
                transition={{ duration: 1.2, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="drop-shadow-sm hover:stroke-width-20 transition-all cursor-pointer"
              />
            );
            currentAngle += angle;
            return segment;
          })}
        </svg>
        
        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
          <span className="text-5xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
            {averageScore}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Rata-rata
          </span>
          <div className="flex mt-2 gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star 
                key={star} 
                className={cn(
                  "w-3.5 h-3.5 transition-colors", 
                  star <= Math.round(parseFloat(averageScore)) 
                    ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" 
                    : "text-slate-200 dark:text-slate-800"
                )} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-1 gap-2.5 w-full max-w-xs">
        {[...data].reverse().map((item, index) => (
          <motion.div 
            key={item.rating}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + (index * 0.1), ease: "easeOut" }}
            className="group flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/60 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-3.5 h-3.5 rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)] group-hover:scale-125 transition-transform duration-300" 
                style={{ backgroundColor: SATISFACTION_COLOR_HEX[item.rating] }} 
              />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-foreground transition-colors">
                {SATISFACTION_LABELS[item.rating as keyof typeof SATISFACTION_LABELS]}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {item.count}
              </span>
              <div className="w-10 text-right">
                <span className="text-xs font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-muted-foreground group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                  {total > 0 ? Math.round((item.count / total) * 100) : 0}%
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export function AdminSurvey() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('laporan');
  
  // Laporan state
  const [stats, setStats] = useState<BackendSurveyStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsErrorMessage, setStatsErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'xlsx'>('pdf');
  
  // Question stats state
  const [questionStats, setQuestionStats] = useState<BackendQuestionStatsResponse | null>(null);
  const [isLoadingQuestionStats, setIsLoadingQuestionStats] = useState(true);
  const [questionStatsErrorMessage, setQuestionStatsErrorMessage] = useState<string | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  // Responses with feedback
  const [responses, setResponses] = useState<BackendSurveyResponse[]>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState(true);
  const [responsesErrorMessage, setResponsesErrorMessage] = useState<string | null>(null);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [totalFeedback, setTotalFeedback] = useState(0);
  const feedbackPerPage = 5;
  
  // Filter state
  const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const today = new Date();
  const firstDayOfMonth = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDayOfMonth = formatLocalDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);
  const [filterServiceType, setFilterServiceType] = useState<string>('all');
  
  // Questions state
  const [questions, setQuestions] = useState<BackendSurveyQuestion[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<BackendSurveyQuestion | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    question_type: 'rating' as 'rating' | 'text' | 'multiple_choice',
    is_required: true,
  });
  
  // Service types state
  const [serviceTypes, setServiceTypes] = useState<BackendServiceType[]>([]);
  const [isLoadingServiceTypes, setIsLoadingServiceTypes] = useState(true);
  const [isServiceTypeDialogOpen, setIsServiceTypeDialogOpen] = useState(false);
  const [editingServiceType, setEditingServiceType] = useState<BackendServiceType | null>(null);
  const [newServiceTypeName, setNewServiceTypeName] = useState('');
  const statsRequestVersionRef = useRef(0);
  const questionStatsRequestVersionRef = useRef(0);
  const responsesRequestVersionRef = useRef(0);
  const hasShownInvalidDateRangeToastRef = useRef(false);

  const hasInvalidDateRange = useMemo(() => startDate > endDate, [startDate, endDate]);

  const validateDateRange = (showToast = true) => {
    if (!hasInvalidDateRange) {
      hasShownInvalidDateRangeToastRef.current = false;
      return true;
    }

    if (showToast && !hasShownInvalidDateRangeToastRef.current) {
      toast.error('Rentang tanggal tidak valid. Tanggal mulai tidak boleh melebihi tanggal akhir.');
      hasShownInvalidDateRangeToastRef.current = true;
    }

    return false;
  };

  const getCurrentReportFilters = () => ({
    start_date: startDate,
    end_date: endDate,
    service_type_id: filterServiceType !== 'all' ? parseInt(filterServiceType) : undefined,
  });

  // Fetch stats
  const fetchStats = async () => {
    const requestVersion = ++statsRequestVersionRef.current;
    setIsLoadingStats(true);
    setStatsErrorMessage(null);
    try {
      const data = await api.admin.survey.responses.stats(getCurrentReportFilters());
      if (requestVersion !== statsRequestVersionRef.current) {
        return;
      }
      setStats(data);
      setStatsErrorMessage(null);
    } catch (error) {
      if (requestVersion !== statsRequestVersionRef.current) {
        return;
      }
      console.error('Failed to fetch stats:', error);
      setStatsErrorMessage('Statistik terbaru gagal dimuat. Menampilkan data terakhir yang tersedia.');
      toast.error('Gagal memuat statistik survey');
    } finally {
      if (requestVersion === statsRequestVersionRef.current) {
        setIsLoadingStats(false);
      }
    }

  };

  // Fetch question stats
  const fetchQuestionStats = async () => {
    const requestVersion = ++questionStatsRequestVersionRef.current;
    setIsLoadingQuestionStats(true);
    setQuestionStatsErrorMessage(null);
    try {
      const data = await api.admin.survey.responses.questionStats(getCurrentReportFilters());
      if (requestVersion !== questionStatsRequestVersionRef.current) {
        return;
      }
      setQuestionStats(data);
      setQuestionStatsErrorMessage(null);
    } catch (error) {
      if (requestVersion !== questionStatsRequestVersionRef.current) {
        return;
      }
      console.error('Failed to fetch question stats:', error);
      setQuestionStats(null);
      setQuestionStatsErrorMessage('Statistik per pertanyaan terbaru gagal dimuat. Periksa filter atau coba lagi.');
      toast.error('Gagal memuat statistik per pertanyaan');
    } finally {
      if (requestVersion === questionStatsRequestVersionRef.current) {
        setIsLoadingQuestionStats(false);
      }
    }
  };

  // Toggle expanded question
  const toggleExpandQuestion = (questionId: number) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  // Fetch responses with feedback
  const fetchResponses = async (page: number = 1) => {
    const requestVersion = ++responsesRequestVersionRef.current;
    setIsLoadingResponses(true);
    setResponsesErrorMessage(null);
    try {
      const reportFilters = getCurrentReportFilters();
      const perPage = 100;
      const firstPage = await api.admin.survey.responses.list({
        ...reportFilters,
        page: 1,
        per_page: perPage,
      });

      if (requestVersion !== responsesRequestVersionRef.current) {
        return;
      }

      let allResponses = [...firstPage.items];
      const totalPages = Math.ceil(firstPage.total / perPage);

      for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
        const nextPage = await api.admin.survey.responses.list({
          ...reportFilters,
          page: currentPage,
          per_page: perPage,
        });

        if (requestVersion !== responsesRequestVersionRef.current) {
          return;
        }

        allResponses = allResponses.concat(nextPage.items);
      }

      const responsesWithFeedback = allResponses.filter((response) => response.feedback && response.feedback.trim());
      const totalFilteredFeedback = responsesWithFeedback.length;
      const totalPagesWithFeedback = Math.max(1, Math.ceil(totalFilteredFeedback / feedbackPerPage));
      const safePage = Math.min(page, totalPagesWithFeedback);
      const startIndex = (safePage - 1) * feedbackPerPage;
      const endIndex = startIndex + feedbackPerPage;

      if (requestVersion !== responsesRequestVersionRef.current) {
        return;
      }

      setTotalFeedback(totalFilteredFeedback);
      setResponses(responsesWithFeedback.slice(startIndex, endIndex));
      setFeedbackPage(safePage);
      setResponsesErrorMessage(null);
    } catch (error) {
      if (requestVersion !== responsesRequestVersionRef.current) {
        return;
      }
      console.error('Failed to fetch responses:', error);
      setResponses([]);
      setTotalFeedback(0);
      setFeedbackPage(1);
      setResponsesErrorMessage('Feedback terbaru gagal dimuat. Periksa filter atau coba lagi.');
      toast.error('Gagal memuat feedback');
    } finally {
      if (requestVersion === responsesRequestVersionRef.current) {
        setIsLoadingResponses(false);
      }
    }
  };

  // Fetch questions
  const fetchQuestions = async () => {
    setIsLoadingQuestions(true);
    try {
      const data = await api.admin.survey.questions.list(true);
      setQuestions(data.sort((a, b) => a.order - b.order));
    } catch (error) {
      console.error('Failed to fetch questions:', error);
      toast.error('Gagal memuat pertanyaan');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // Fetch service types
  const fetchServiceTypes = async () => {
    setIsLoadingServiceTypes(true);
    try {
      const data = await api.admin.survey.serviceTypes.list(true);
      setServiceTypes(data);
    } catch (error) {
      console.error('Failed to fetch service types:', error);
      toast.error('Gagal memuat jenis layanan');
    } finally {
      setIsLoadingServiceTypes(false);
    }
  };

  const refreshQuestionViews = async () => {
    await fetchQuestions();

    if (activeTab === 'laporan' && !hasInvalidDateRange) {
      await fetchQuestionStats();
    }
  };

  useEffect(() => {
    fetchQuestions();
    fetchServiceTypes();
  }, []);

  useEffect(() => {
    if (activeTab !== 'laporan') {
      return;
    }

    if (!validateDateRange()) {
      statsRequestVersionRef.current += 1;
      questionStatsRequestVersionRef.current += 1;
      responsesRequestVersionRef.current += 1;
      setStats(null);
      setStatsErrorMessage('Statistik laporan dinonaktifkan sampai rentang tanggal valid.');
      setQuestionStats(null);
      setQuestionStatsErrorMessage('Statistik per pertanyaan dinonaktifkan sampai rentang tanggal valid.');
      setResponses([]);
      setTotalFeedback(0);
      setFeedbackPage(1);
      setResponsesErrorMessage('Feedback dinonaktifkan sampai rentang tanggal valid.');
      setIsLoadingStats(false);
      setIsLoadingQuestionStats(false);
      setIsLoadingResponses(false);
      return;
    }

    fetchStats();
    fetchQuestionStats();
    setFeedbackPage(1);
    fetchResponses(1);
  }, [activeTab, startDate, endDate, filterServiceType]);

  // Export handler
  const handleExport = async () => {
    if (!validateDateRange()) {
      return;
    }

    setIsExporting(true);
    try {
      const blob = await api.admin.survey.responses.export({
        start_date: startDate,
        end_date: endDate,
        service_type_id: filterServiceType !== 'all' ? parseInt(filterServiceType) : undefined,
        format: exportFormat,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `survey-kepuasan_${startDate}_${endDate}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Berhasil export data survey (${exportFormat.toUpperCase()})`);
    } catch (error) {
      console.error('Failed to export:', error);
      toast.error('Gagal export data');
    } finally {
      setIsExporting(false);
    }
  };

  // Question handlers
  const handleSaveQuestion = async () => {
    if (!newQuestion.question_text.trim()) {
      toast.error('Teks pertanyaan harus diisi');
      return;
    }

    try {
      if (editingQuestion) {
        await api.admin.survey.questions.update(editingQuestion.id, {
          question_text: newQuestion.question_text,
          is_required: newQuestion.is_required,
        });
        toast.success('Pertanyaan berhasil diperbarui');
      } else {
        await api.admin.survey.questions.create(newQuestion);
        toast.success('Pertanyaan berhasil ditambahkan');
      }
      
      setIsQuestionDialogOpen(false);
      setEditingQuestion(null);
      setNewQuestion({ question_text: '', question_type: 'rating', is_required: true });
      await refreshQuestionViews();
    } catch (error) {
      console.error('Failed to save question:', error);
      toast.error('Gagal menyimpan pertanyaan');
    }
  };

  const handleToggleQuestion = async (question: BackendSurveyQuestion) => {
    try {
      await api.admin.survey.questions.update(question.id, {
        is_active: !question.is_active,
      });
      toast.success(question.is_active ? 'Pertanyaan dinonaktifkan' : 'Pertanyaan diaktifkan');
      await refreshQuestionViews();
    } catch (error) {
      console.error('Failed to toggle question:', error);
      toast.error('Gagal mengubah status pertanyaan');
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    try {
      await api.admin.survey.questions.delete(id);
      toast.success('Pertanyaan berhasil dihapus');
      await refreshQuestionViews();
    } catch (error) {
      console.error('Failed to delete question:', error);
      toast.error('Gagal menghapus pertanyaan');
    }
  };

  // Service type handlers
  const handleSaveServiceType = async () => {
    if (!newServiceTypeName.trim()) {
      toast.error('Nama jenis layanan harus diisi');
      return;
    }

    try {
      if (editingServiceType) {
        await api.admin.survey.serviceTypes.update(editingServiceType.id, {
          name: newServiceTypeName,
        });
        toast.success('Jenis layanan berhasil diperbarui');
      } else {
        await api.admin.survey.serviceTypes.create({ name: newServiceTypeName });
        toast.success('Jenis layanan berhasil ditambahkan');
      }
      
      setIsServiceTypeDialogOpen(false);
      setEditingServiceType(null);
      setNewServiceTypeName('');
      fetchServiceTypes();
    } catch (error) {
      console.error('Failed to save service type:', error);
      toast.error('Gagal menyimpan jenis layanan');
    }
  };

  const handleToggleServiceType = async (serviceType: BackendServiceType) => {
    try {
      await api.admin.survey.serviceTypes.update(serviceType.id, {
        is_active: !serviceType.is_active,
      });
      toast.success(serviceType.is_active ? 'Jenis layanan dinonaktifkan' : 'Jenis layanan diaktifkan');
      fetchServiceTypes();
    } catch (error) {
      console.error('Failed to toggle service type:', error);
      toast.error('Gagal mengubah status');
    }
  };

  const handleDeleteServiceType = async (id: number) => {
    try {
      await api.admin.survey.serviceTypes.delete(id);
      toast.success('Jenis layanan berhasil dihapus');
      fetchServiceTypes();
    } catch (error) {
      console.error('Failed to delete service type:', error);
      toast.error('Gagal menghapus jenis layanan');
    }
  };

  // Calculate percentages
  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const satisfactionOrder: SatisfactionRating[] = ['sangat_puas', 'puas', 'cukup_puas', 'tidak_puas', 'sangat_tidak_puas'];

  const totalComplaints = useMemo(() => {
    if (!questionStats) return 0;
    return questionStats.questions.reduce((total, question) => {
      return total + (question.complaint_responses?.length || 0);
    }, 0);
  }, [questionStats]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-8 shadow-sm">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
          <Star className="w-64 h-64 text-primary" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 mb-2">Survey Kepuasan</h1>
            <p className="text-muted-foreground text-lg">Kelola survey, analisis feedback, dan pantau performa layanan.</p>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
            <Badge variant="outline" className="text-sm px-4 py-2 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-primary/20 shadow-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-bold text-base">{stats?.total_responses || 0}</span> Responden
            </Badge>
          </motion.div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="p-1.5 bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-xl inline-flex shadow-inner">
          <TabsTrigger
            value="laporan"
            className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm data-[state=active]:text-primary px-6 py-2.5 font-medium transition-all"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Laporan & Analisis
          </TabsTrigger>
          <TabsTrigger
            value="pertanyaan"
            className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm data-[state=active]:text-primary px-6 py-2.5 font-medium transition-all"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Kelola Pertanyaan
          </TabsTrigger>
          <TabsTrigger
            value="layanan"
            className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm data-[state=active]:text-primary px-6 py-2.5 font-medium transition-all"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Jenis Layanan
          </TabsTrigger>
        </TabsList>

        {/* TAB: Laporan */}
        <TabsContent value="laporan" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
          {/* Filters Command Bar */}
          <Card className="border border-white/20 dark:border-slate-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0" />
            <CardContent className="p-5 md:p-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-5 items-end">
                  <div className="space-y-2 flex-1">
                    <Label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Filter Periode</Label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1 group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="pl-9 h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-700/60 transition-shadow focus:shadow-[0_0_0_2px_rgba(var(--primary),0.2)]"
                        />
                      </div>
                      <span className="text-muted-foreground font-medium">-</span>
                      <div className="relative flex-1 group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="pl-9 h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-700/60 transition-shadow focus:shadow-[0_0_0_2px_rgba(var(--primary),0.2)]"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 min-w-[260px]">
                    <Label className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Jenis Layanan</Label>
                    <Select value={filterServiceType} onValueChange={setFilterServiceType}>
                      <SelectTrigger className="h-11 bg-white/50 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-700/60">
                        <SelectValue placeholder="Semua Layanan" />
                      </SelectTrigger>
                      <SelectContent className="backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border-slate-200/50 dark:border-slate-800/50">
                        <SelectItem value="all">Semua Layanan</SelectItem>
                        {serviceTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id.toString()}>
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'csv' | 'pdf' | 'xlsx')}>
                      <SelectTrigger className="h-11 w-32 bg-white/50 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-700/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF Report</SelectItem>
                        <SelectItem value="xlsx">Excel File</SelectItem>
                        <SelectItem value="csv">CSV Data</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleExport}
                      disabled={isExporting}
                      className="h-11 px-6 bg-primary font-medium shadow-[0_4px_14px_0_rgba(var(--primary),0.39)] hover:shadow-[0_6px_20px_rgba(var(--primary),0.23)] hover:-translate-y-0.5 transition-all w-full md:w-auto"
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Unduh
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Statistik laporan, keluhan spesifik, dan feedback umum otomatis disesuaikan dengan filter yang aktif.
                  </p>
                  <AnimatePresence>
                    {hasInvalidDateRange && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 rounded-lg border border-rose-200/50 bg-rose-50/50 px-3 py-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                      >
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="font-medium">Kesalahan Filter: Tanggal awal tidak boleh melewati tanggal akhir. Laporan tidak dapat dimuat atau diunduh.</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoadingStats && !stats ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="overflow-hidden border-none shadow-md">
                    <CardContent className="p-6 space-y-4">
                      <Skeleton className="h-12 w-12 rounded-2xl" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-none shadow-md">
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                  </CardHeader>
                  <CardContent className="py-12">
                    <div className="flex items-center justify-center">
                      <Skeleton className="h-64 w-64 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-md">
                  <CardHeader>
                    <Skeleton className="h-6 w-40" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : stats ? (
            <div className="space-y-6">
              {!isLoadingStats && (
                <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900/80">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{statsErrorMessage ?? 'Data statistik ditampilkan sesuai filter laporan yang sedang aktif.'}</span>
                </div>
              )}
              {/* Overview Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                  title="Total Responden"
                  value={stats.total_responses}
                  icon={Users}
                  color="bg-blue-500"
                  delay={0}
                  tooltip="Total responden yang telah mengisi survey"
                />

                <StatCard
                  title="Tingkat Kepuasan"
                  value={`${stats.total_responses > 0
                    ? Math.round(((stats.rating_distribution['sangat_puas'] || 0) + (stats.rating_distribution['puas'] || 0)) / stats.total_responses * 100)
                    : 0}%`}
                  icon={CheckCircle2}
                  color="bg-emerald-500"
                  delay={0.1}
                  tooltip="Persentase responden yang memberikan rating Puas atau Sangat Puas"
                />
                <StatCard
                  title="Total Keluhan"
                  value={totalComplaints}
                  icon={AlertCircle}
                  color="bg-rose-500"
                  delay={0.2}
                  tooltip="Akumulasi keluhan pada pertanyaan rating sesuai filter yang aktif"
                />
                <StatCard
                  title="Mengisi Sendiri"
                  value={stats.by_filled_by.sendiri}
                  icon={Edit}
                  color="bg-violet-500"
                  delay={0.3}
                  tooltip="Responden yang mengisi survey secara mandiri"
                />
                <StatCard
                  title="Diwakilkan"
                  value={stats.by_filled_by.diwakilkan}
                  icon={Users}
                  color="bg-amber-500"
                  delay={0.4}
                  tooltip="Responden yang diwakilkan oleh petugas"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Satisfaction Chart */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Card className="h-full border-none shadow-md bg-white dark:bg-slate-950">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                          <Star className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        Analisis Kepuasan
                      </CardTitle>
                      <CardDescription>
                        Distribusi penilaian dari {stats.total_responses} responden
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {stats.total_responses > 0 ? (
                        <div className="py-2">
                          <CustomDonutChart 
                            data={satisfactionOrder
                              .map(rating => ({
                                rating,
                                count: stats.rating_distribution[rating] || 0
                              }))
                              .filter(item => item.count > 0)} 
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <BarChart3 className="w-8 h-8 opacity-50" />
                          </div>
                          <p>Belum ada data survey</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Service Performance List */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card className="h-full border-none shadow-md bg-white dark:bg-slate-950 flex flex-col">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                          <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        Performa Layanan
                      </CardTitle>
                      <CardDescription>
                        Peringkat kepuasan {stats.by_service_type.length} layanan terdaftar
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ScrollArea className="h-[400px] pr-2">
                        <div className="space-y-2">
                          {stats.by_service_type.length > 0 ? (
                            stats.by_service_type
                              .map(item => {
                                const satisfiedCount = (item.rating_distribution['sangat_puas'] || 0) + (item.rating_distribution['puas'] || 0);
                                const satisfactionPercent = item.total > 0 ? Math.round(satisfiedCount / item.total * 100) : 0;
                                return { ...item, satisfactionPercent };
                              })
                              .sort((a, b) => b.satisfactionPercent - a.satisfactionPercent)
                              .map((item, index) => (
                                <div key={item.service_type_id} className="group relative p-3 rounded-xl border border-transparent hover:border-slate-200/70 dark:hover:border-slate-700/70 hover:bg-white dark:hover:bg-slate-900 hover:shadow-sm transition-all duration-200">
                                  <div className="flex items-center gap-3">
                                    {/* Rank Badge */}
                                    <div className={cn(
                                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 shadow-sm transition-transform group-hover:scale-110 duration-300",
                                      index === 0 ? "bg-gradient-to-br from-yellow-300 to-amber-400 text-yellow-900 border border-yellow-300" :
                                      index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800 border border-slate-300" :
                                      index === 2 ? "bg-gradient-to-br from-orange-300 to-amber-500 text-orange-900 border border-orange-300" :
                                      "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                                    )}>
                                      {index + 1}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate group-hover:text-primary transition-colors" title={item.service_type_name}>
                                          {item.service_type_name}
                                        </span>
                                        {/* Status Pill */}
                                        <span className={cn(
                                          "shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border",
                                          item.satisfactionPercent >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50" :
                                          item.satisfactionPercent >= 60 ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50" :
                                          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50"
                                        )}>
                                          {item.satisfactionPercent}%
                                        </span>
                                      </div>

                                      {/* Progress Bar */}
                                      <div className="relative h-2 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden shadow-inner mb-1.5">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${item.satisfactionPercent}%` }}
                                          transition={{ duration: 1.2, delay: 0.5 + (index * 0.1), ease: "easeOut" }}
                                          className={cn(
                                            "h-full rounded-full relative overflow-hidden",
                                            item.satisfactionPercent >= 80 ? "bg-gradient-to-r from-emerald-400 to-emerald-600" :
                                            item.satisfactionPercent >= 60 ? "bg-gradient-to-r from-blue-400 to-blue-600" :
                                            "bg-gradient-to-r from-amber-400 to-amber-600"
                                          )}
                                        >
                                          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] w-[200%] animate-[shimmer_2s_infinite]" />
                                        </motion.div>
                                      </div>

                                      {/* Meta info row */}
                                      <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                                        <div className="flex items-center gap-3">
                                          <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                                            {(item.rating_distribution['sangat_puas'] || 0) + (item.rating_distribution['puas'] || 0)} puas
                                          </span>
                                          {((item.rating_distribution['tidak_puas'] || 0) + (item.rating_distribution['sangat_tidak_puas'] || 0)) > 0 && (
                                            <span className="flex items-center gap-1">
                                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                                              {(item.rating_distribution['tidak_puas'] || 0) + (item.rating_distribution['sangat_tidak_puas'] || 0)} tidak puas
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-slate-400">{item.total} resp.</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl border-slate-200 dark:border-slate-800">
                              Belum ada data layanan
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Per-Question Detail & General Feedback - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Per-Question Detail Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <Card className="border-none shadow-md bg-white dark:bg-slate-950 h-full flex flex-col">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <div className="p-2 bg-violet-100 dark:bg-violet-900/20 rounded-lg">
                          <MessageSquare className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        Detail Per Pertanyaan
                      </CardTitle>
                      <CardDescription>
                        Statistik per pertanyaan dan daftar keluhan spesifik untuk rating rendah.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                      {questionStatsErrorMessage && !isLoadingQuestionStats && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{questionStatsErrorMessage}</span>
                        </div>
                      )}
                      {isLoadingQuestionStats ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          <p className="text-muted-foreground animate-pulse">Memuat data pertanyaan...</p>
                        </div>
                      ) : questionStats && questionStats.questions.length > 0 ? (
                        <ScrollArea className="h-[600px]">
                          <div className="space-y-4 pr-4">
                            {questionStats.questions.map((question, index) => {
                              const complaintCount = question.complaint_responses?.length || 0;
                              const lowRatingCount = question.question_type === 'rating' && question.rating_distribution
                                ? (question.rating_distribution.tidak_puas || 0) + (question.rating_distribution.sangat_tidak_puas || 0)
                                : 0;
                              const lowRatingPercentage = question.response_count > 0
                                ? Math.round((lowRatingCount / question.response_count) * 100)
                                : 0;
                              const avgScore = question.question_type === 'rating' && question.rating_distribution && question.response_count > 0
                                ? (() => {
                                    const ratingScoreMap: Record<SatisfactionRating, number> = {
                                      sangat_puas: 5,
                                      puas: 4,
                                      cukup_puas: 3,
                                      tidak_puas: 2,
                                      sangat_tidak_puas: 1,
                                    };
                                    const totalScore = satisfactionOrder.reduce((acc, rating) => {
                                      const count = question.rating_distribution?.[rating] || 0;
                                      return acc + (ratingScoreMap[rating] * count);
                                    }, 0);
                                    return (totalScore / question.response_count).toFixed(1);
                                  })()
                                : null;

                                return (
                                  <div
                                    key={question.question_id}
                                    className={cn(
                                      "border rounded-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg",
                                      complaintCount > 0 && "border-rose-200/50 bg-rose-50/30 dark:border-rose-900/40 dark:bg-rose-950/20"
                                    )}
                                  >
                                    {/* Question Header */}
                                    <div
                                      className={cn(
                                        "flex items-center justify-between p-4 cursor-pointer transition-colors",
                                        complaintCount > 0
                                          ? "hover:bg-rose-100/50 dark:hover:bg-rose-950/30"
                                          : "hover:bg-slate-100/60 dark:hover:bg-slate-800/60"
                                      )}
                                      onClick={() => toggleExpandQuestion(question.question_id)}
                                    >
                                      <div className="flex items-start gap-4 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-extrabold text-primary shrink-0 shadow-inner">
                                          {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0 pt-0.5">
                                          <p className="font-semibold text-sm text-foreground/90 leading-tight">{question.question_text}</p>
                                          <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <Badge variant="secondary" className="text-[10px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-none transition-colors">
                                              {question.question_type === 'rating'
                                                ? 'Rating'
                                                : question.question_type === 'multiple_choice'
                                                  ? 'Pilihan Ganda'
                                                  : 'Teks'}
                                            </Badge>
                                            <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                                              <Users className="w-3 h-3" />
                                              {question.response_count} respons
                                            </span>
                                            {avgScore && (
                                              <Badge className="text-[10px] font-bold bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 border-none shadow-sm pb-0.5">
                                                <Star className="w-3 h-3 mr-1 fill-white opacity-80" />
                                                {avgScore} / 5
                                              </Badge>
                                            )}
                                            {question.question_type === 'rating' && (
                                              <>
                                                <Badge
                                                  variant={complaintCount > 0 ? 'destructive' : 'secondary'}
                                                  className={cn(
                                                    "text-[10px] border-none shadow-sm pb-0.5",
                                                    complaintCount === 0 && "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 opacity-50"
                                                  )}
                                                >
                                                  {complaintCount} keluhan
                                                </Badge>
                                                {lowRatingCount > 0 && (
                                                  <Badge
                                                    variant="outline"
                                                    className="text-[10px] border-rose-200 text-rose-600 bg-rose-50/50 dark:border-rose-900/50 dark:text-rose-400 dark:bg-rose-950/30"
                                                  >
                                                    {lowRatingCount} rating rendah ({lowRatingPercentage}%)
                                                  </Badge>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <motion.div
                                        animate={{ rotate: expandedQuestions.has(question.question_id) ? 90 : 0 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                        className="shrink-0 ml-4 rounded-full p-2 bg-slate-50 dark:bg-slate-800"
                                      >
                                        <ArrowRight className="w-4 h-4 text-slate-400" />
                                      </motion.div>
                                    </div>

                              {/* Expanded Content */}
                              <AnimatePresence>
                                {expandedQuestions.has(question.question_id) && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                    className="overflow-hidden bg-slate-50/50 dark:bg-slate-900/30"
                                  >
                                    <div className="p-5 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                                      {question.question_type === 'rating' && question.rating_distribution ? (
                                        /* Rating Distribution */
                                        <div className="space-y-6">
                                          <div className="space-y-3.5">
                                            {satisfactionOrder.map((rating) => {
                                              const count = question.rating_distribution?.[rating] || 0;
                                              const percentage = question.response_count > 0
                                                ? Math.round((count / question.response_count) * 100)
                                                : 0;
                                              return (
                                                <div key={rating} className="space-y-2 group/rating">
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2.5">
                                                      <div className="w-2.5 h-2.5 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] group-hover/rating:scale-125 transition-transform" style={{ backgroundColor: SATISFACTION_COLOR_HEX[rating] }} />
                                                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{SATISFACTION_LABELS[rating]}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                      <span className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{count}</span>
                                                      <div className="text-[10px] font-bold text-muted-foreground w-8 text-right bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded shadow-sm opacity-80 group-hover/rating:opacity-100 transition-opacity">
                                                        {percentage}%
                                                      </div>
                                                    </div>
                                                  </div>
                                                  <div className="relative h-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-full overflow-hidden shadow-inner">
                                                    <motion.div
                                                      initial={{ width: 0 }}
                                                      animate={{ width: `${percentage}%` }}
                                                      transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                                                      className="h-full rounded-full relative overflow-hidden"
                                                      style={{ backgroundColor: SATISFACTION_COLOR_HEX[rating] }}
                                                    >
                                                      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.25)_50%,transparent_100%)] w-[200%] animate-[shimmer_2s_infinite]" />
                                                    </motion.div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>

                                          <div className="space-y-4 pt-2">
                                            <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-950 p-3 rounded-xl border shadow-sm border-slate-100 dark:border-slate-800">
                                              <div>
                                                <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300">Keluhan pada pertanyaan ini</p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                                                  Alasan spesifik dari responden yang memberikan rating rendah.
                                                </p>
                                              </div>
                                              <Badge variant="secondary" className={cn(
                                                "text-xs font-bold px-2.5 py-1 whitespace-nowrap",
                                                (question.complaint_responses?.length || 0) > 0 ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" : ""
                                              )}>
                                                {question.complaint_responses?.length || 0} keluhan
                                              </Badge>
                                            </div>

                                            {question.complaint_responses && question.complaint_responses.length > 0 ? (
                                              <ScrollArea className="h-[260px] rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur pb-2">
                                                <div className="p-3 space-y-3">
                                                  {question.complaint_responses.map((complaint, idx) => (
                                                    <motion.div
                                                      key={`${complaint.response_id}-${idx}`}
                                                      initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                                      transition={{ delay: idx * 0.05 + 0.1, type: "spring", stiffness: 200, damping: 20 }}
                                                      className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group/complaint"
                                                  >
                                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                                      <Badge variant="outline" className="text-xs">
                                                        {SATISFACTION_LABELS[complaint.rating]}
                                                      </Badge>
                                                      <Badge variant="secondary" className="text-xs">
                                                        <Building2 className="w-3 h-3 mr-1" />
                                                        {complaint.service_type_name}
                                                      </Badge>
                                                      <Badge variant="outline" className="text-xs">
                                                        <Calendar className="w-3 h-3 mr-1" />
                                                        {new Date(complaint.submitted_at).toLocaleDateString('id-ID', {
                                                          day: 'numeric',
                                                          month: 'short',
                                                          year: 'numeric',
                                                          hour: '2-digit',
                                                          minute: '2-digit'
                                                        })}
                                                      </Badge>
                                                    </div>
                                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{complaint.complaint}</p>
                                                  </motion.div>
                                                ))}
                                              </div>
                                            </ScrollArea>
                                          ) : (
                                            <div className="text-center py-4 text-muted-foreground text-sm rounded-lg border border-dashed">
                                              Belum ada keluhan yang tercatat untuk rating rendah pada pertanyaan ini
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ) : question.text_responses && question.text_responses.length > 0 ? (
                                      /* Text Feedback List */
                                      <ScrollArea className="h-[300px]">
                                        <div className="space-y-3 pr-4">
                                          {question.text_responses.map((feedback, idx) => (
                                            <motion.div
                                              key={feedback.response_id}
                                              initial={{ opacity: 0, x: -10 }}
                                              animate={{ opacity: 1, x: 0 }}
                                              transition={{ delay: idx * 0.05 }}
                                              className="p-3 rounded-lg bg-white dark:bg-slate-800 border shadow-sm hover:shadow-md transition-shadow"
                                            >
                                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{feedback.answer}</p>
                                              <Separator className="my-2" />
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="secondary" className="text-xs">
                                                  <Building2 className="w-3 h-3 mr-1" />
                                                  {feedback.service_type_name}
                                                </Badge>
                                                <Badge variant="outline" className="text-xs">
                                                  <Calendar className="w-3 h-3 mr-1" />
                                                  {new Date(feedback.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </Badge>
                                              </div>
                                            </motion.div>
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    ) : (
                                      <div className="text-center py-6 text-muted-foreground text-sm">
                                        Belum ada respons untuk pertanyaan ini
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                          <MessageSquare className="w-8 h-8 opacity-50" />
                        </div>
                        <p>Belum ada data pertanyaan</p>
                      </div>
                    )}
                    </CardContent>
                  </Card>
                </motion.div>

              {/* General Feedback Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <Card className="border-none shadow-md bg-white dark:bg-slate-950 h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/40 rounded-lg shadow-sm">
                        <MessageSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      Feedback & Saran Umum
                    </CardTitle>
                    <CardDescription>
                      Komentar dan saran umum responden, terpisah dari keluhan per pertanyaan rating.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    {responsesErrorMessage && !isLoadingResponses && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{responsesErrorMessage}</span>
                      </div>
                    )}
                    {isLoadingResponses ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-muted-foreground animate-pulse">Memuat feedback...</p>
                      </div>
                    ) : responses.length > 0 || totalFeedback > 0 ? (
                      <div className="space-y-4 h-full flex flex-col">
                        <ScrollArea className="flex-1 h-[520px]">
                          <div className="space-y-3 pr-4">
                          {responses.map((response, idx) => (
                            <motion.div
                              key={response.id}
                              initial={{ opacity: 0, scale: 0.98, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={{ delay: idx * 0.05, type: "spring", stiffness: 200, damping: 20 }}
                              className="p-4 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 backdrop-blur-sm shadow-sm hover:shadow-lg transition-all duration-300"
                            >
                              <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200/50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 flex items-center justify-center flex-shrink-0 shadow-inner border border-amber-200/50 dark:border-amber-800/30">
                                  <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="flex-1 mt-0.5">
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mb-3">{response.feedback}</p>
                                  <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-slate-100 dark:border-slate-800/60">
                                    <Badge variant="secondary" className="text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-none transition-colors px-2 py-0.5">
                                      <Building2 className="w-3 h-3 mr-1" />
                                      {response.service_type_name}
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 px-2 py-0.5">
                                      <Calendar className="w-3 h-3 mr-1 opacity-70" />
                                      {new Date(response.submitted_at).toLocaleDateString('id-ID', { 
                                        day: 'numeric', 
                                        month: 'short', 
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </Badge>
                                    <Badge variant={response.filled_by === 'sendiri' ? 'default' : 'secondary'} className={cn(
                                      "text-[10px] px-2 py-0.5 border-none",
                                      response.filled_by === 'sendiri' ? "bg-primary/10 text-primary hover:bg-primary/20" : ""
                                    )}>
                                      {response.filled_by === 'sendiri' ? 'Mandiri' : 'Diwakilkan'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                        </ScrollArea>

                        {/* Pagination Controls */}
                        {totalFeedback > feedbackPerPage && (
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="text-sm font-medium text-muted-foreground">
                              Menampilkan {((feedbackPage - 1) * feedbackPerPage) + 1}-{Math.min(feedbackPage * feedbackPerPage, totalFeedback)} dari <span className="text-foreground">{totalFeedback}</span> feedback
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchResponses(feedbackPage - 1)}
                                disabled={feedbackPage === 1 || isLoadingResponses}
                              >
                                <ArrowRight className="w-4 h-4 mr-1 rotate-180" />
                                Sebelumnya
                              </Button>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: Math.ceil(totalFeedback / feedbackPerPage) }, (_, i) => i + 1)
                                  .filter(page => {
                                    // Show first page, last page, current page, and pages around current
                                    return page === 1 || 
                                           page === Math.ceil(totalFeedback / feedbackPerPage) ||
                                           Math.abs(page - feedbackPage) <= 1;
                                  })
                                  .map((page, index, array) => (
                                    <div key={page} className="flex items-center">
                                      {index > 0 && array[index - 1] !== page - 1 && (
                                        <span className="px-2 text-muted-foreground">...</span>
                                      )}
                                      <Button
                                        variant={feedbackPage === page ? "default" : "ghost"}
                                        size="sm"
                                        className="w-8 h-8 p-0"
                                        onClick={() => fetchResponses(page)}
                                        disabled={isLoadingResponses}
                                      >
                                        {page}
                                      </Button>
                                    </div>
                                  ))}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchResponses(feedbackPage + 1)}
                                disabled={feedbackPage >= Math.ceil(totalFeedback / feedbackPerPage) || isLoadingResponses}
                              >
                                Selanjutnya
                                <ArrowRight className="w-4 h-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                          <MessageSquare className="w-8 h-8 opacity-50" />
                        </div>
                        <p>Belum ada feedback tambahan dari responden</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
              </div>
            </div>
          ) : (
            <Card className="border-none shadow-md bg-white dark:bg-slate-950">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <AlertCircle className="h-8 w-8 opacity-60" />
                </div>
                <p className="font-medium text-foreground">Statistik laporan belum tersedia</p>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {statsErrorMessage ?? 'Belum ada data statistik yang bisa ditampilkan untuk filter yang sedang dipilih.'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB: Kelola Pertanyaan */}
        <TabsContent value="pertanyaan" className="space-y-6">
          <Card className="border-none shadow-sm bg-white dark:bg-slate-950">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5 text-primary" />
                Daftar Pertanyaan Survey
              </CardTitle>
              {isAdmin && (
                <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingQuestion(null);
                        setNewQuestion({ question_text: '', question_type: 'rating', is_required: true });
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Tambah Pertanyaan
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingQuestion ? 'Edit Pertanyaan' : 'Tambah Pertanyaan Baru'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Teks Pertanyaan</Label>
                        <Input
                          value={newQuestion.question_text}
                          onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                          placeholder="Contoh: Bagaimana kepuasan Anda?"
                        />
                      </div>
                      {!editingQuestion && (
                        <div className="space-y-2">
                          <Label>Tipe Pertanyaan</Label>
                          <Select
                            value={newQuestion.question_type}
                            onValueChange={(value) => setNewQuestion({ ...newQuestion, question_type: value as 'rating' | 'text' })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rating">Rating (Sangat Puas - Tidak Puas)</SelectItem>
                              <SelectItem value="text">Teks Bebas</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <Label>Wajib Diisi</Label>
                        <Switch
                          checked={newQuestion.is_required}
                          onCheckedChange={(checked) => setNewQuestion({ ...newQuestion, is_required: checked })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsQuestionDialogOpen(false)}>
                        Batal
                      </Button>
                      <Button onClick={handleSaveQuestion}>
                        {editingQuestion ? 'Simpan Perubahan' : 'Tambah'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {isLoadingQuestions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada pertanyaan survey</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div
                      key={question.id}
                      className={`flex items-start gap-3 p-4 rounded-lg border ${
                        question.is_active ? 'bg-card' : 'bg-muted/30 opacity-60'
                      }`}
                    >
                      <GripVertical className="w-5 h-5 text-muted-foreground mt-1 cursor-move" />
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium">
                                {index + 1}. {question.question_text}
                                {question.is_required && <span className="text-red-500 ml-1">*</span>}
                              </p>
                              {!question.is_active && (
                                <Badge variant="secondary" className="text-xs">Nonaktif</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {question.question_type === 'rating'
                                  ? 'Rating'
                                  : question.question_type === 'multiple_choice'
                                    ? 'Pilihan Ganda'
                                    : 'Teks'}
                              </Badge>
                              {question.is_required && (
                                <Badge variant="outline" className="text-xs text-red-500 border-red-200">
                                  Wajib
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <>
                                <Switch
                                  checked={question.is_active}
                                  onCheckedChange={() => handleToggleQuestion(question)}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingQuestion(question);
                                    setNewQuestion({
                                      question_text: question.question_text,
                                      question_type: question.question_type,
                                      is_required: question.is_required,
                                    });
                                    setIsQuestionDialogOpen(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Hapus Pertanyaan?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Pertanyaan ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Batal</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteQuestion(question.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Hapus
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Jenis Layanan */}
        <TabsContent value="layanan" className="space-y-6">
          <Card className="border-none shadow-sm bg-white dark:bg-slate-950">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5 text-primary" />
                Jenis Layanan
              </CardTitle>
              {isAdmin && (
                <Dialog open={isServiceTypeDialogOpen} onOpenChange={setIsServiceTypeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingServiceType(null);
                        setNewServiceTypeName('');
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Tambah Layanan
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingServiceType ? 'Edit Jenis Layanan' : 'Tambah Jenis Layanan'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Nama Jenis Layanan</Label>
                        <Input
                          value={newServiceTypeName}
                          onChange={(e) => setNewServiceTypeName(e.target.value)}
                          placeholder="Contoh: Kependudukan"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsServiceTypeDialogOpen(false)}>
                        Batal
                      </Button>
                      <Button onClick={handleSaveServiceType}>
                        {editingServiceType ? 'Simpan Perubahan' : 'Tambah'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {isLoadingServiceTypes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : serviceTypes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada jenis layanan</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {serviceTypes.map((type) => (
                    <div
                      key={type.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        type.is_active ? 'bg-card hover:shadow-md' : 'bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          type.is_active ? "bg-blue-100 dark:bg-blue-900/30" : "bg-slate-100 dark:bg-slate-800"
                        )}>
                          <Building2 className={cn(
                            "w-5 h-5",
                            type.is_active ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                          )} />
                        </div>
                        <div>
                          <p className="font-medium">{type.name}</p>
                          {!type.is_active && (
                            <Badge variant="secondary" className="text-xs mt-1">Nonaktif</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <>
                            <Switch
                              checked={type.is_active}
                              onCheckedChange={() => handleToggleServiceType(type)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingServiceType(type);
                                setNewServiceTypeName(type.name);
                                setIsServiceTypeDialogOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Jenis Layanan?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Jenis layanan "{type.name}" akan dihapus. Pastikan tidak ada survey yang menggunakan jenis layanan ini.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteServiceType(type.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
