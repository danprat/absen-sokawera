import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, UserCheck, Clock, UserX, TrendingUp, Activity, Loader2, Building2, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api, BackendAttendanceTodayAdminResponse, BackendAuditLog } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface DashboardStats {
  totalEmployees: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  sick: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    present: 0,
    late: 0,
    absent: 0,
    onLeave: 0,
    sick: 0,
  });
  const [activityLogs, setActivityLogs] = useState<BackendAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [villageName, setVillageName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      try {
        if (isMounted) setIsLoading(true);

        // Parallel data fetching for performance
        const [attendanceData, logsData, settings] = await Promise.all([
          api.admin.attendance.today(),
          api.admin.auditLogs.list({ page_size: 5 }),
          api.admin.settings.get()
        ]);

        if (!isMounted) return;

        setStats({
          totalEmployees: attendanceData.summary.total_employees,
          present: attendanceData.summary.present,
          late: attendanceData.summary.late,
          absent: attendanceData.summary.absent,
          onLeave: attendanceData.summary.on_leave,
          sick: attendanceData.summary.sick,
        });

        setActivityLogs(logsData.items);
        setVillageName(settings.village_name);
        setLogoUrl(settings.logo_url);

      } catch (error: unknown) {
        // Ignore aborted requests (happens on unmount/navigation)
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNABORTED') return;
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDashboardData();

    // Refresh data every 60s
    const interval = setInterval(fetchDashboardData, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const statsCards = [
    {
      label: 'Sbg. Pegawai',
      value: stats.totalEmployees,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      desc: 'Total terdaftar'
    },
    {
      label: 'Hadir',
      value: stats.present,
      icon: UserCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      desc: 'Tepat waktu'
    },
    {
      label: 'Terlambat',
      value: stats.late,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      desc: 'Lewat jam masuk'
    },
    {
      label: 'Tidak Hadir',
      value: stats.absent + stats.onLeave + stats.sick,
      icon: UserX,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      desc: 'Absen / Izin / Sakit'
    },
  ];

  const attendanceRate = stats.totalEmployees > 0
    ? Math.round(((stats.present + stats.late) / stats.totalEmployees) * 100)
    : 0;

  // Weekly data placeholder
  const weeklyData = [
    { day: 'Sen', hadir: 0, terlambat: 0, tidakHadir: 0 },
    { day: 'Sel', hadir: 0, terlambat: 0, tidakHadir: 0 },
    { day: 'Rab', hadir: 0, terlambat: 0, tidakHadir: 0 },
    { day: 'Kam', hadir: 0, terlambat: 0, tidakHadir: 0 },
    { day: 'Jum', hadir: 0, terlambat: 0, tidakHadir: 0 },
    { day: 'Sab', hadir: 0, terlambat: 0, tidakHadir: 0 },
  ];

  const today = new Date().getDay();
  const dayIndex = today === 0 ? 5 : today - 1;
  if (dayIndex >= 0 && dayIndex < 6) {
    weeklyData[dayIndex] = {
      day: weeklyData[dayIndex].day,
      hadir: stats.present,
      terlambat: stats.late,
      tidakHadir: stats.absent + stats.onLeave + stats.sick,
    };
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-10"
    >
      {/* Hero Section */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-primary/10 via-primary/5 to-background p-4 md:p-6 rounded-2xl md:rounded-3xl border border-primary/10 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center gap-3 md:gap-5">
            <div className="bg-background p-2 md:p-3 rounded-xl md:rounded-2xl shadow-sm border border-border/50">
              {logoUrl ? (
                <img
                  src={`${API_BASE_URL}${logoUrl}`}
                  alt="Logo"
                  className="w-10 h-10 md:w-16 md:h-16 object-contain"
                />
              ) : (
                <Building2 className="w-10 h-10 md:w-16 md:h-16 text-primary/40" />
              )}
            </div>
            <div>
              <h1 className="text-xl md:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">{villageName}</h1>
              <p className="text-muted-foreground mt-0.5 md:mt-1 text-sm md:text-lg flex items-center gap-1.5 md:gap-2">
                <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="hidden sm:inline">{currentDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span className="sm:hidden">{currentDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4 bg-background/50 backdrop-blur-sm p-3 md:p-4 rounded-xl md:rounded-2xl border border-border/50">
            <div className="text-right">
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Tingkat Kehadiran</p>
              <p className="text-2xl md:text-3xl font-bold text-primary">{attendanceRate}%</p>
            </div>
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-full border-4 border-primary/20 flex items-center justify-center relative">
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="35%"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="4"
                  strokeDasharray={`${attendanceRate * 1.13} 113`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Abstract shapes background - hidden on mobile */}
        <div className="hidden md:block absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="hidden md:block absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4"
      >
        {statsCards.map((stat) => (
          <motion.div key={stat.label} variants={itemVariants}>
            <Card className="border-none shadow-sm hover:shadow-md transition-all hover:-translate-y-1 bg-gradient-to-br from-white to-slate-50">
              <CardContent className="p-3 md:p-5">
                <div className="flex items-start justify-between mb-2 md:mb-4">
                  <div className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${stat.bgColor} ${stat.color}`}>
                    <stat.icon className="w-4 h-4 md:w-6 md:h-6" />
                  </div>
                  {stat.value > 0 && (
                    <Badge variant="secondary" className="font-normal bg-white/80 text-[10px] md:text-xs px-1.5 md:px-2 hidden sm:inline-flex">Hari Ini</Badge>
                  )}
                </div>
                <div>
                  <h3 className="text-xl md:text-3xl font-bold text-slate-800">{stat.value}</h3>
                  <p className="font-medium text-slate-500 text-xs md:text-base">{stat.label}</p>
                  <p className="text-[10px] md:text-xs text-slate-400 mt-0.5 md:mt-1 hidden sm:block">{stat.desc}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="border-none shadow-sm h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
                Statistik Mingguan
              </CardTitle>
              <CardDescription>Perbandingan kehadiran dalam 7 hari terakhir</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] md:h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="day"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Bar dataKey="hadir" fill="#22c55e" name="Hadir" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="terlambat" fill="#eab308" name="Terlambat" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="tidakHadir" fill="#ef4444" name="Tidak Hadir" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-none shadow-sm h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-primary" />
                Log Aktivitas
              </CardTitle>
              <CardDescription>Aktivitas terbaru sistem</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative border-l border-border/50 ml-2 space-y-6 pl-6 pb-2">
                {activityLogs.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 italic">Belum ada aktivitas</div>
                ) : activityLogs.map((log, i) => (
                  <div key={log.id} className="relative">
                    <span className="absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20" />
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-foreground leading-none">{log.description}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-primary/80">{log.performed_by}</span>
                        <span>•</span>
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
