import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, Calendar, Loader2, Search, ChevronDown, ChevronUp,
  Clock, User, TrendingUp, BarChart3, X, Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
} from '@/components/ui/dialog';
import { api, BackendMonthlyReportItem, BackendEmployee } from '@/lib/api';
import { toast } from 'sonner';

const months = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

const statusColors: Record<string, string> = {
  hadir: 'bg-green-500',
  terlambat: 'bg-yellow-500',
  izin: 'bg-blue-500',
  sakit: 'bg-orange-500',
  alfa: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  alfa: 'Alfa',
};

interface DailyAttendance {
  id: number;
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
  correction_notes: string | null;
}

export function AdminRiwayat() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentDate.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(currentDate.getFullYear()));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reportData, setReportData] = useState<BackendMonthlyReportItem[]>([]);
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'xlsx'>('pdf');

  // Detail modal state
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = useState<BackendMonthlyReportItem | null>(null);
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendance[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => String(currentDate.getFullYear() - i));

  // Fetch employees for filter
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await api.employees.list({ page_size: 100, is_active: true });
        setEmployees(response.items);
      } catch (error) {
        console.error('Failed to fetch employees:', error);
      }
    };
    fetchEmployees();
  }, []);

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const response = await api.admin.reports.monthly({
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
      });
      setReportData(response.items);
    } catch (error) {
      console.error('Failed to fetch report:', error);
      toast.error('Gagal memuat data laporan');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedMonth, selectedYear]);

  // Fetch daily attendance detail
  const fetchDailyDetail = async (employeeId: number) => {
    try {
      setIsLoadingDetail(true);
      const startDate = `${selectedYear}-${selectedMonth.padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
      const endDate = `${selectedYear}-${selectedMonth.padStart(2, '0')}-${lastDay}`;

      const response = await api.admin.attendance.list({
        employee_id: employeeId,
        start_date: startDate,
        end_date: endDate,
        page_size: 31,
      });
      setDailyAttendance(response.items || []);
    } catch (error) {
      console.error('Failed to fetch daily detail:', error);
      toast.error('Gagal memuat detail harian');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleViewDetail = (employee: BackendMonthlyReportItem) => {
    setSelectedEmployeeDetail(employee);
    fetchDailyDetail(employee.employee_id);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const blob = await api.admin.reports.export({
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
        format: exportFormat,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = exportFormat;
      a.download = `rekap-absensi-${months.find((m) => m.value === selectedMonth)?.label}-${selectedYear}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`File ${ext.toUpperCase()} berhasil diunduh`);
    } catch (error) {
      console.error('Failed to export:', error);
      toast.error('Gagal mengekspor data');
    } finally {
      setIsExporting(false);
    }
  };

  // Filter data
  const filteredData = useMemo(() => {
    let data = reportData;

    if (selectedEmployee !== 'all') {
      data = data.filter(r => r.employee_id === parseInt(selectedEmployee));
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(r =>
        r.employee_name.toLowerCase().includes(query) ||
        (r.employee_nik && r.employee_nik.toLowerCase().includes(query)) ||
        r.employee_position.toLowerCase().includes(query)
      );
    }

    return data;
  }, [reportData, selectedEmployee, searchQuery]);

  // Calculate totals
  const totalStats = useMemo(() => {
    return filteredData.reduce(
      (acc, r) => ({
        hadir: acc.hadir + r.present_days,
        terlambat: acc.terlambat + r.late_days,
        izin: acc.izin + r.leave_days,
        sakit: acc.sakit + r.sick_days,
        alfa: acc.alfa + r.absent_days,
        checkout: acc.checkout + r.checkout_days,
        total: acc.total + r.total_days,
      }),
      { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0, checkout: 0, total: 0 }
    );
  }, [filteredData]);

  // Calculate chart data (percentage for visual bar)
  const chartData = useMemo(() => {
    const total = totalStats.hadir + totalStats.terlambat + totalStats.izin + totalStats.sakit + totalStats.alfa;
    if (total === 0) return { hadir: 0, terlambat: 0, izin: 0, sakit: 0, alfa: 0 };

    return {
      hadir: Math.round((totalStats.hadir / total) * 100),
      terlambat: Math.round((totalStats.terlambat / total) * 100),
      izin: Math.round((totalStats.izin / total) * 100),
      sakit: Math.round((totalStats.sakit / total) * 100),
      alfa: Math.round((totalStats.alfa / total) * 100),
    };
  }, [totalStats]);

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    return new Date(timeStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Riwayat & Laporan</h1>
          <p className="text-muted-foreground">Rekap absensi bulanan pegawai</p>
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
          <Button onClick={handleExport} disabled={isExporting || filteredData.length === 0}>
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Ekspor
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* Row 1: Period filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex gap-2 flex-1">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full sm:w-40">
                    <Calendar className="w-4 h-4 mr-2 shrink-0" />
                    <SelectValue placeholder="Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-24 sm:w-28">
                    <SelectValue placeholder="Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Employee filter & search */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-full sm:w-56">
                  <User className="w-4 h-4 mr-2 shrink-0" />
                  <SelectValue placeholder="Filter Pegawai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Pegawai</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama, NIP, atau jabatan..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-5 h-5 text-primary" />
            Statistik Kehadiran
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Visual Bar Chart */}
          <div className="space-y-3">
            <div className="h-8 rounded-full overflow-hidden flex bg-secondary">
              {chartData.hadir > 0 && (
                <div
                  className="bg-green-500 h-full transition-all duration-500 flex items-center justify-center"
                  style={{ width: `${chartData.hadir}%` }}
                >
                  {chartData.hadir >= 10 && <span className="text-xs text-white font-medium">{chartData.hadir}%</span>}
                </div>
              )}
              {chartData.terlambat > 0 && (
                <div
                  className="bg-yellow-500 h-full transition-all duration-500 flex items-center justify-center"
                  style={{ width: `${chartData.terlambat}%` }}
                >
                  {chartData.terlambat >= 10 && <span className="text-xs text-white font-medium">{chartData.terlambat}%</span>}
                </div>
              )}
              {chartData.izin > 0 && (
                <div
                  className="bg-blue-500 h-full transition-all duration-500 flex items-center justify-center"
                  style={{ width: `${chartData.izin}%` }}
                >
                  {chartData.izin >= 10 && <span className="text-xs text-white font-medium">{chartData.izin}%</span>}
                </div>
              )}
              {chartData.sakit > 0 && (
                <div
                  className="bg-orange-500 h-full transition-all duration-500 flex items-center justify-center"
                  style={{ width: `${chartData.sakit}%` }}
                >
                  {chartData.sakit >= 10 && <span className="text-xs text-white font-medium">{chartData.sakit}%</span>}
                </div>
              )}
              {chartData.alfa > 0 && (
                <div
                  className="bg-red-500 h-full transition-all duration-500 flex items-center justify-center"
                  style={{ width: `${chartData.alfa}%` }}
                >
                  {chartData.alfa >= 10 && <span className="text-xs text-white font-medium">{chartData.alfa}%</span>}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Hadir</span>
                <span className="font-semibold">{totalStats.hadir}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">Terlambat</span>
                <span className="font-semibold">{totalStats.terlambat}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">Izin</span>
                <span className="font-semibold">{totalStats.izin}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-muted-foreground">Sakit</span>
                <span className="font-semibold">{totalStats.sakit}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Alfa</span>
                <span className="font-semibold">{totalStats.alfa}</span>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-2xl font-bold text-green-500">{totalStats.hadir}</p>
              <p className="text-xs text-muted-foreground">Total Hadir</p>
            </div>
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-2xl font-bold text-yellow-500">{totalStats.terlambat}</p>
              <p className="text-xs text-muted-foreground">Total Terlambat</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-2xl font-bold text-blue-500">{totalStats.izin}</p>
              <p className="text-xs text-muted-foreground">Total Izin</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <p className="text-2xl font-bold text-orange-500">{totalStats.sakit}</p>
              <p className="text-xs text-muted-foreground">Total Sakit</p>
            </div>
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-2xl font-bold text-red-500">{totalStats.alfa}</p>
              <p className="text-xs text-muted-foreground">Total Alfa</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-2xl font-bold text-purple-500">{totalStats.checkout}</p>
              <p className="text-xs text-muted-foreground">Total Checkout</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>Rekap {months.find((m) => m.value === selectedMonth)?.label} {selectedYear}</span>
            <Badge variant="secondary">{filteredData.length} pegawai</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pegawai</TableHead>
                      <TableHead className="text-center w-16">Hadir</TableHead>
                      <TableHead className="text-center w-16">Terlambat</TableHead>
                      <TableHead className="text-center w-16">Izin</TableHead>
                      <TableHead className="text-center w-16">Sakit</TableHead>
                      <TableHead className="text-center w-16">Alfa</TableHead>
                      <TableHead className="text-center w-16">Checkout</TableHead>
                      <TableHead className="text-center w-20">Persentase</TableHead>
                      <TableHead className="text-center w-20">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Tidak ada data untuk periode ini
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.map((recap) => (
                        <TableRow key={recap.employee_id} className="hover:bg-secondary/30">
                          <TableCell>
                            <div>
                              <p className="font-medium">{recap.employee_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {recap.employee_nik || '-'} · {recap.employee_position}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="border-green-500 text-green-500 font-semibold">
                              {recap.present_days}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="border-yellow-500 text-yellow-500 font-semibold">
                              {recap.late_days}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="border-blue-500 text-blue-500 font-semibold">
                              {recap.leave_days}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="border-orange-500 text-orange-500 font-semibold">
                              {recap.sick_days}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="border-red-500 text-red-500 font-semibold">
                              {recap.absent_days}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="border-purple-500 text-purple-500 font-semibold">
                              {recap.checkout_days}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`font-bold ${
                                recap.attendance_percentage >= 90
                                  ? 'text-green-500'
                                  : recap.attendance_percentage >= 70
                                  ? 'text-yellow-500'
                                  : 'text-red-500'
                              }`}
                            >
                              {recap.attendance_percentage}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(recap)}
                            >
                              Detail
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-border">
                {filteredData.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Tidak ada data untuk periode ini
                  </p>
                ) : (
                  filteredData.map((recap) => (
                    <div
                      key={recap.employee_id}
                      className="p-4 space-y-3"
                      onClick={() => handleViewDetail(recap)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{recap.employee_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {recap.employee_nik || '-'} · {recap.employee_position}
                          </p>
                        </div>
                        <span
                          className={`text-lg font-bold ${
                            recap.attendance_percentage >= 90
                              ? 'text-green-500'
                              : recap.attendance_percentage >= 70
                              ? 'text-yellow-500'
                              : 'text-red-500'
                          }`}
                        >
                          {recap.attendance_percentage}%
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-green-500 text-green-500">
                          Hadir: {recap.present_days}
                        </Badge>
                        <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                          Terlambat: {recap.late_days}
                        </Badge>
                        <Badge variant="outline" className="border-blue-500 text-blue-500">
                          Izin: {recap.leave_days}
                        </Badge>
                        <Badge variant="outline" className="border-orange-500 text-orange-500">
                          Sakit: {recap.sick_days}
                        </Badge>
                        <Badge variant="outline" className="border-red-500 text-red-500">
                          Alfa: {recap.absent_days}
                        </Badge>
                        <Badge variant="outline" className="border-purple-500 text-purple-500">
                          Checkout: {recap.checkout_days}
                        </Badge>
                      </div>

                      <Button variant="outline" size="sm" className="w-full">
                        Lihat Detail Harian
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedEmployeeDetail} onOpenChange={() => setSelectedEmployeeDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Detail Absensi - {selectedEmployeeDetail?.employee_name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : dailyAttendance.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                Tidak ada data absensi untuk periode ini
              </p>
            ) : (
              <div className="space-y-2">
                {dailyAttendance.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/20"
                  >
                    <div className={`w-2 h-10 rounded-full ${statusColors[att.status] || 'bg-gray-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{formatDate(att.date)}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Masuk: {formatTime(att.check_in_at)}</span>
                        <span>·</span>
                        <span>Pulang: {formatTime(att.check_out_at)}</span>
                      </div>
                      {att.correction_notes && (
                        <p className="text-xs text-blue-500 mt-1">
                          Catatan: {att.correction_notes}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={`${statusColors[att.status]} text-white shrink-0`}
                    >
                      {statusLabels[att.status] || att.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
