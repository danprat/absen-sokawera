import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, Download, Loader2, Calendar, BarChart3, MessageSquare, 
  Settings2, Plus, Trash2, GripVertical, Edit, Building2,
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
import { Progress } from '@/components/ui/progress';
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
  SATISFACTION_ICONS,
  SATISFACTION_COLORS,
  SATISFACTION_COLOR_HEX,
  BackendQuestionStatsResponse,
  QuestionStatistics,
} from '@/types/survey';
import { cn } from '@/lib/utils';

// --- Components for UI/UX Pro Max ---

const StatCard = ({ title, value, icon: Icon, trend, color, delay = 0, tooltip }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
  >
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={cn("p-3 rounded-2xl bg-opacity-10", color)}>
                  <Icon className={cn("w-6 h-6", color.replace('bg-', 'text-'))} />
                </div>
                {trend && (
                  <Badge variant={trend > 0 ? "default" : "destructive"} className="text-xs">
                    {trend > 0 ? "+" : ""}{trend}%
                    <TrendingUp className={cn("w-3 h-3 ml-1", trend < 0 && "rotate-180")} />
                  </Badge>
                )}
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
                <p className="text-3xl font-bold mt-1 tracking-tight">{value}</p>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent>
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
      <div className="relative w-64 h-64 flex-shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
          {/* Background Circle */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth="20" className="text-slate-100 dark:text-slate-800" />
          
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
                strokeWidth="20"
                strokeDasharray={`${dashArray} ${circumference}`}
                strokeDashoffset={-((currentAngle / 360) * circumference)}
                strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${circumference}` }}
                animate={{ strokeDasharray: `${dashArray} ${circumference}` }}
                transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                className="drop-shadow-sm"
              />
            );
            currentAngle += angle;
            return segment;
          })}
        </svg>
        
        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-4xl font-bold tracking-tighter text-slate-900 dark:text-white">
            {averageScore}
          </span>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">
            Rata-rata
          </span>
          <div className="flex mt-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star 
                key={star} 
                className={cn(
                  "w-3 h-3", 
                  star <= Math.round(parseFloat(averageScore)) 
                    ? "text-amber-400 fill-amber-400" 
                    : "text-slate-200 dark:text-slate-700"
                )} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
        {[...data].reverse().map((item, index) => (
          <motion.div 
            key={item.rating}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + (index * 0.1) }}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full shadow-sm" 
                style={{ backgroundColor: SATISFACTION_COLOR_HEX[item.rating] }} 
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {SATISFACTION_LABELS[item.rating as keyof typeof SATISFACTION_LABELS]}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {item.count}
              </span>
              <span className="text-xs text-muted-foreground w-8 text-right">
                {total > 0 ? Math.round((item.count / total) * 100) : 0}%
              </span>
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
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'xlsx'>('pdf');
  
  // Question stats state
  const [questionStats, setQuestionStats] = useState<BackendQuestionStatsResponse | null>(null);
  const [isLoadingQuestionStats, setIsLoadingQuestionStats] = useState(true);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  
  // Responses with feedback
  const [responses, setResponses] = useState<BackendSurveyResponse[]>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState(true);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [totalFeedback, setTotalFeedback] = useState(0);
  const feedbackPerPage = 5;
  
  // Filter state
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
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

  // Fetch stats
  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const data = await api.admin.survey.responses.stats({
        start_date: startDate,
        end_date: endDate,
        service_type_id: filterServiceType !== 'all' ? parseInt(filterServiceType) : undefined,
      });
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast.error('Gagal memuat statistik survey');
    } finally {
      setIsLoadingStats(false);
    }

  };

  // Fetch question stats
  const fetchQuestionStats = async () => {
    setIsLoadingQuestionStats(true);
    try {
      const data = await api.admin.survey.responses.questionStats({
        start_date: startDate,
        end_date: endDate,
        service_type_id: filterServiceType !== 'all' ? parseInt(filterServiceType) : undefined,
      });
      setQuestionStats(data);
    } catch (error) {
      console.error('Failed to fetch question stats:', error);
      toast.error('Gagal memuat statistik per pertanyaan');
    } finally {
      setIsLoadingQuestionStats(false);
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
    setIsLoadingResponses(true);
    try {
      // Get all responses to filter by feedback, then paginate client-side
      const data = await api.admin.survey.responses.list({
        start_date: startDate,
        end_date: endDate,
        service_type_id: filterServiceType !== 'all' ? parseInt(filterServiceType) : undefined,
        page: 1,
        per_page: 100, // Get enough responses to filter
      });
      // Filter only responses with feedback
      const responsesWithFeedback = data.items.filter(r => r.feedback && r.feedback.trim());
      setTotalFeedback(responsesWithFeedback.length);
      
      // Paginate client-side
      const startIndex = (page - 1) * feedbackPerPage;
      const endIndex = startIndex + feedbackPerPage;
      setResponses(responsesWithFeedback.slice(startIndex, endIndex));
      setFeedbackPage(page);
    } catch (error) {
      console.error('Failed to fetch responses:', error);
      toast.error('Gagal memuat feedback');
    } finally {
      setIsLoadingResponses(false);
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
      const data = await api.admin.survey.serviceTypes.list();
      setServiceTypes(data);
    } catch (error) {
      console.error('Failed to fetch service types:', error);
      toast.error('Gagal memuat jenis layanan');
    } finally {
      setIsLoadingServiceTypes(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchQuestionStats();
    fetchResponses();
    fetchQuestions();
    fetchServiceTypes();
  }, []);

  useEffect(() => {
    if (activeTab === 'laporan') {
      fetchStats();
      fetchQuestionStats();
      setFeedbackPage(1);
      fetchResponses(1);
    }
  }, [startDate, endDate, filterServiceType]);

  // Export handler
  const handleExport = async () => {
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
      fetchQuestions();
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
      fetchQuestions();
    } catch (error) {
      console.error('Failed to toggle question:', error);
      toast.error('Gagal mengubah status pertanyaan');
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    try {
      await api.admin.survey.questions.delete(id);
      toast.success('Pertanyaan berhasil dihapus');
      fetchQuestions();
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Survey Kepuasan</h1>
            <p className="text-muted-foreground">Kelola survey dan lihat hasil</p>
          </div>
          <Badge variant="outline" className="text-sm">
            {stats?.total_responses || 0} Responden
          </Badge>
        </div>
        <Separator className="my-4" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent space-x-6">
          <TabsTrigger
            value="laporan"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-medium"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Laporan
          </TabsTrigger>
          <TabsTrigger
            value="pertanyaan"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-medium"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Kelola Pertanyaan
          </TabsTrigger>
          <TabsTrigger
            value="layanan"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-medium"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Jenis Layanan
          </TabsTrigger>
        </TabsList>

        {/* TAB: Laporan */}
        <TabsContent value="laporan" className="space-y-6">
          {/* Filters */}
          <Card className="border-none shadow-sm bg-white dark:bg-slate-950">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Periode</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                      />
                    </div>
                    <span className="text-muted-foreground">-</span>
                    <div className="relative flex-1">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 min-w-[240px]">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Filter Layanan</Label>
                  <Select value={filterServiceType} onValueChange={setFilterServiceType}>
                    <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                      <SelectValue placeholder="Semua Layanan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Layanan</SelectItem>
                      {serviceTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id.toString()}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'csv' | 'pdf' | 'xlsx')}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="xlsx">Excel</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoadingStats ? (
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
              {/* Overview Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  trend={2.5}
                  delay={0.1}
                  tooltip="Persentase responden yang memberikan rating Puas atau Sangat Puas"
                />
                <StatCard 
                  title="Mengisi Sendiri" 
                  value={stats.by_filled_by.sendiri} 
                  icon={Edit} 
                  color="bg-violet-500"
                  delay={0.2}
                  tooltip="Responden yang mengisi survey secara mandiri"
                />
                <StatCard 
                  title="Diwakilkan" 
                  value={stats.by_filled_by.diwakilkan} 
                  icon={Users} 
                  color="bg-amber-500"
                  delay={0.3}
                  tooltip="Responden yang diwakilkan oleh petugas"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Satisfaction Chart */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="lg:col-span-2"
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
                        <div className="py-6">
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
                        Peringkat kepuasan per layanan
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ScrollArea className="h-[350px] pr-4">
                        <div className="space-y-4">
                          {stats.by_service_type.length > 0 ? (
                            stats.by_service_type
                              .map(item => {
                                const satisfiedCount = (item.rating_distribution['sangat_puas'] || 0) + (item.rating_distribution['puas'] || 0);
                                const satisfactionPercent = item.total > 0 ? Math.round(satisfiedCount / item.total * 100) : 0;
                                return { ...item, satisfactionPercent };
                              })
                              .sort((a, b) => b.satisfactionPercent - a.satisfactionPercent)
                              .map((item, index) => (
                                <div key={item.service_type_id} className="group">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                      <div className={cn(
                                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                                        index < 3 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                      )}>
                                        {index + 1}
                                      </div>
                                      <span className="font-medium truncate text-sm" title={item.service_type_name}>
                                        {item.service_type_name}
                                      </span>
                                    </div>
                                    <span className={cn(
                                      "text-sm font-bold",
                                      item.satisfactionPercent >= 80 ? "text-emerald-600" :
                                      item.satisfactionPercent >= 60 ? "text-blue-600" :
                                      "text-amber-600"
                                    )}>
                                      {item.satisfactionPercent}%
                                    </span>
                                  </div>
                                  <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${item.satisfactionPercent}%` }}
                                      transition={{ duration: 1, delay: 0.5 + (index * 0.1) }}
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        item.satisfactionPercent >= 80 ? "bg-emerald-500" :
                                        item.satisfactionPercent >= 60 ? "bg-blue-500" :
                                        "bg-amber-500"
                                      )}
                                    />
                                  </div>
                                  <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                                    <span>{(item.rating_distribution['sangat_puas'] || 0) + (item.rating_distribution['puas'] || 0)}/{item.total} puas</span>
                                    <span>Target: 80%</span>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="text-center py-8 text-muted-foreground text-sm">
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
                        Statistik dan feedback untuk setiap pertanyaan survey
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      {isLoadingQuestionStats ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          <p className="text-muted-foreground animate-pulse">Memuat data pertanyaan...</p>
                        </div>
                      ) : questionStats && questionStats.questions.length > 0 ? (
                        <ScrollArea className="h-[600px]">
                          <div className="space-y-4 pr-4">
                        {questionStats.questions.map((question, index) => (
                          <div
                            key={question.question_id}
                            className="border rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50"
                          >
                            {/* Question Header */}
                            <div
                              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
                              onClick={() => toggleExpandQuestion(question.question_id)}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                  {index + 1}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{question.question_text}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {question.question_type === 'rating' ? 'Rating' : 'Teks'}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{question.response_count} respons</span>
                                    {question.question_type === 'rating' && question.rating_distribution && question.response_count > 0 && (() => {
                                      const ratingScoreMap: Record<SatisfactionRating, number> = {
                                        'sangat_puas': 5,
                                        'puas': 4,
                                        'cukup_puas': 3,
                                        'tidak_puas': 2,
                                        'sangat_tidak_puas': 1,
                                      };
                                      const totalScore = satisfactionOrder.reduce((acc, rating) => {
                                        const count = question.rating_distribution?.[rating] || 0;
                                        return acc + (ratingScoreMap[rating] * count);
                                      }, 0);
                                      const avgScore = (totalScore / question.response_count).toFixed(1);
                                      return (
                                        <>
                                          <span className="text-xs text-muted-foreground">•</span>
                                          <Badge className="text-xs font-bold bg-amber-500 hover:bg-amber-600">
                                            Rata-rata: {avgScore}/5
                                          </Badge>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                              <motion.div
                                animate={{ rotate: expandedQuestions.has(question.question_id) ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ArrowRight className="w-5 h-5 text-muted-foreground rotate-90" />
                              </motion.div>
                            </div>

                            {/* Expanded Content */}
                            <AnimatePresence>
                              {expandedQuestions.has(question.question_id) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-4 pt-0 border-t">
                                    {question.question_type === 'rating' && question.rating_distribution ? (
                                      /* Rating Distribution */
                                      <div className="space-y-3">
                                        {satisfactionOrder.map((rating) => {
                                          const count = question.rating_distribution?.[rating] || 0;
                                          const percentage = question.response_count > 0 
                                            ? Math.round((count / question.response_count) * 100) 
                                            : 0;
                                          return (
                                            <div key={rating} className="space-y-2">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SATISFACTION_COLOR_HEX[rating] }} />
                                                  <span className="text-xs font-medium">{SATISFACTION_LABELS[rating]}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm font-bold">{count}</span>
                                                  <Badge variant="outline" className="text-xs min-w-[3rem] justify-center">
                                                    {percentage}%
                                                  </Badge>
                                                </div>
                                              </div>
                                              <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <motion.div
                                                  initial={{ width: 0 }}
                                                  animate={{ width: `${percentage}%` }}
                                                  transition={{ duration: 0.8, delay: 0.1 }}
                                                  className="h-full rounded-full"
                                                  style={{ backgroundColor: SATISFACTION_COLOR_HEX[rating] }}
                                                />
                                              </div>
                                            </div>
                                          );
                                        })}
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
                        ))}
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
                      <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                        <MessageSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      Feedback & Saran Umum
                    </CardTitle>
                    <CardDescription>
                      Komentar dan saran tambahan dari responden
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
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
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className="p-4 rounded-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border shadow-sm hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                                  <MessageSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm whitespace-pre-wrap leading-relaxed mb-3">{response.feedback}</p>
                                  <Separator className="my-2" />
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="secondary" className="text-xs">
                                      <Building2 className="w-3 h-3 mr-1" />
                                      {response.service_type_name}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      {new Date(response.submitted_at).toLocaleDateString('id-ID', { 
                                        day: 'numeric', 
                                        month: 'short', 
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </Badge>
                                    <Badge variant={response.filled_by === 'sendiri' ? 'default' : 'secondary'} className="text-xs">
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
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t">
                            <div className="text-sm text-muted-foreground">
                              Menampilkan {((feedbackPage - 1) * feedbackPerPage) + 1}-{Math.min(feedbackPage * feedbackPerPage, totalFeedback)} dari {totalFeedback} feedback
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
          ) : null}
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
                                {question.question_type === 'rating' ? 'Rating' : 'Teks'}
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
