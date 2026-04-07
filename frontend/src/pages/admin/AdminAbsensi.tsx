import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Check, Edit2, Calendar, Loader2, Users, UserCheck, UserX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, BackendAttendanceTodayItem, BackendAttendanceSummary } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

type AttendanceStatus = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alfa';

const statusOptions: { value: AttendanceStatus; label: string }[] = [
  { value: 'hadir', label: 'Hadir' },
  { value: 'terlambat', label: 'Terlambat' },
  { value: 'izin', label: 'Izin' },
  { value: 'sakit', label: 'Sakit' },
  { value: 'alfa', label: 'Alfa' },
];

const statusConfig: Record<AttendanceStatus, { color: string; badge: string; bg: string }> = {
  hadir: { color: 'text-green-600', badge: 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200', bg: 'bg-green-50' },
  terlambat: { color: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200', bg: 'bg-yellow-50' },
  izin: { color: 'text-blue-600', badge: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200', bg: 'bg-blue-50' },
  sakit: { color: 'text-orange-600', badge: 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200', bg: 'bg-orange-50' },
  alfa: { color: 'text-red-600', badge: 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200', bg: 'bg-red-50' },
};

export function AdminAbsensi() {
  const { isAdmin } = useAuth();
  const [records, setRecords] = useState<BackendAttendanceTodayItem[]>([]);
  const [summary, setSummary] = useState<BackendAttendanceSummary>({
    total_employees: 0,
    present: 0,
    late: 0,
    absent: 0,
    on_leave: 0,
    sick: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<BackendAttendanceTodayItem | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<AttendanceStatus>('hadir');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const fetchAttendance = async () => {
    try {
      setIsLoading(true);
      const response = await api.admin.attendance.today();
      setRecords(response.items);
      setSummary(response.summary);
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
      toast.error('Gagal memuat data absensi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    const interval = setInterval(fetchAttendance, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCorrection = async () => {
    if (!editingRecord) return;

    setIsSubmitting(true);
    try {
      await api.admin.attendance.correct(editingRecord.id, {
        status: correctionStatus,
        correction_notes: correctionNotes,
      });

      toast.success('Koreksi absensi berhasil disimpan');
      setEditingRecord(null);
      setCorrectionNotes('');
      fetchAttendance();
    } catch (error) {
      console.error('Failed to correct attendance:', error);
      toast.error('Gagal menyimpan koreksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCorrection = (record: BackendAttendanceTodayItem) => {
    setEditingRecord(record);
    setCorrectionStatus(record.status);
    setCorrectionNotes('');
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading && records.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const summaryCards = [
    { label: 'Total Pegawai', value: summary.total_employees, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Hadir', value: summary.present, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Terlambat', value: summary.late, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { label: 'Izin', value: summary.on_leave, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Sakit', value: summary.sick, icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-100' },
    { label: 'Alfa', value: summary.absent, icon: UserX, color: 'text-red-600', bg: 'bg-red-100' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-10"
    >
      {/* Simple Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Absensi Harian</h1>
          <p className="text-muted-foreground">Monitor kehadiran pegawai hari ini ({today})</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-none shadow-sm hover:shadow-md transition-all hover:-translate-y-1 bg-gradient-to-br from-white to-slate-50">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className={`p-3 rounded-full mb-3 ${card.bg} ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">{card.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Daftar Kehadiran</CardTitle>
              <CardDescription>Status kehadiran pegawai hari ini</CardDescription>
            </div>
            <Badge variant="outline" className="font-normal text-xs">
              Live Update
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[300px]">Pegawai</TableHead>
                  <TableHead>Jam Masuk</TableHead>
                  <TableHead>Jam Pulang</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Clock className="w-10 h-10 text-slate-200" />
                        <p>Belum ada data absensi hari ini</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-slate-100">
                            {record.employee_photo && (
                              <AvatarImage src={`${API_BASE_URL}${record.employee_photo}`} className="object-cover" />
                            )}
                            <AvatarFallback className="bg-primary/5 text-primary text-xs font-medium">
                              {record.employee_name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm text-foreground">{record.employee_name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {record.employee_position}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium tabular-nums text-slate-600">
                        {formatTime(record.check_in_at)}
                      </TableCell>
                      <TableCell className="font-medium tabular-nums text-slate-500">
                        {formatTime(record.check_out_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-normal ${statusConfig[record.status].badge}`}>
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCorrection(record)}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {records.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <Clock className="w-10 h-10 text-slate-200" />
                <p>Belum ada data absensi hari ini</p>
              </div>
            ) : (
              records.map((record) => (
                <div key={record.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-slate-100">
                        {record.employee_photo && (
                          <AvatarImage src={`${API_BASE_URL}${record.employee_photo}`} className="object-cover" />
                        )}
                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-medium">
                          {record.employee_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{record.employee_name}</p>
                        <p className="text-xs text-muted-foreground">{record.employee_position}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={`font-normal text-xs ${statusConfig[record.status].badge}`}>
                      {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground block">Masuk</span>
                        <span className="font-medium tabular-nums text-slate-700">{formatTime(record.check_in_at)}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Pulang</span>
                        <span className="font-medium tabular-nums text-slate-500">{formatTime(record.check_out_at)}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openCorrection(record)}
                      className="text-muted-foreground hover:text-primary h-8 px-2"
                      disabled={!isAdmin}
                      style={{ display: isAdmin ? 'inline-flex' : 'none' }}
                    >
                      <Edit2 className="w-4 h-4 mr-1" />
                      <span className="text-xs">Koreksi</span>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Correction Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Koreksi Absensi</DialogTitle>
            <DialogDescription>
              Ubah status kehadiran pegawai secara manual
            </DialogDescription>
          </DialogHeader>

          {editingRecord && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Avatar className="h-10 w-10">
                  {editingRecord.employee_photo && (
                    <AvatarImage src={`${API_BASE_URL}${editingRecord.employee_photo}`} />
                  )}
                  <AvatarFallback>{editingRecord.employee_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{editingRecord.employee_name}</p>
                  <p className="text-xs text-muted-foreground">{editingRecord.employee_position}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status Baru</Label>
                <Select
                  value={correctionStatus}
                  onValueChange={(v) => setCorrectionStatus(v as AttendanceStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Catatan Koreksi</Label>
                <Textarea
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  placeholder="Contoh: Pegawai lupa check-in..."
                  className="resize-none h-24"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditingRecord(null)} disabled={isSubmitting}>
                  Batal
                </Button>
                <Button onClick={handleCorrection} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Simpan Perubahan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
