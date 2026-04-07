import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Camera } from 'lucide-react';
import { motion } from 'framer-motion';
import { Header } from '@/components/Header';
import { useSettings } from '@/hooks/useSettings';
import { AttendanceRecord } from '@/types/attendance';
import { api, BackendAttendanceTodayItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const DaftarHadir = () => {
  const { settings } = useSettings();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Convert backend response to frontend format
  const convertToAttendanceRecord = (item: BackendAttendanceTodayItem): AttendanceRecord => ({
    id: String(item.id),
    employee: {
      id: String(item.employee_id),
      name: item.employee_name,
      position: item.employee_position,
      photoUrl: item.employee_photo || undefined,
      isActive: true,
      joinDate: '',
    },
    status: item.status,
    timestamp: item.check_in_at ? new Date(item.check_in_at) : undefined,
    checkOut: item.check_out_at ? new Date(item.check_out_at) : undefined,
  });

  // Fetch attendance records
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setIsLoading(true);
        const response = await api.attendance.today();
        const converted = response.items.map(convertToAttendanceRecord);
        setRecords(converted);
      } catch (error) {
        console.error('Failed to fetch attendance:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendance();
    const interval = setInterval(fetchAttendance, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter and group records
  const filteredRecords = records.filter(record =>
    record.employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.employee.position.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped = {
    hadir: filteredRecords.filter(r => r.status === 'hadir'),
    terlambat: filteredRecords.filter(r => r.status === 'terlambat'),
    lainnya: filteredRecords.filter(r => ['izin', 'sakit', 'alfa', 'cuti'].includes(r.status)),
    belum: filteredRecords.filter(r => r.status === 'belum'),
  };

  const statusConfig: Record<string, { label: string; color: string }> = {
    hadir: { label: 'Hadir', color: 'bg-green-500' },
    terlambat: { label: 'Terlambat', color: 'bg-amber-500' },
    izin: { label: 'Izin', color: 'bg-blue-500' },
    sakit: { label: 'Sakit', color: 'bg-orange-500' },
    alfa: { label: 'Alfa', color: 'bg-red-500' },
    cuti: { label: 'Cuti', color: 'bg-purple-500' },
    belum: { label: 'Belum', color: 'bg-slate-400' },
  };

  const formatTime = (date?: Date) => {
    if (!date) return '-';
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const getPhotoUrl = (photoUrl?: string) => {
    if (!photoUrl) return undefined;
    if (photoUrl.startsWith('http')) return photoUrl;
    return `${API_BASE_URL}${photoUrl}`;
  };

  const renderSection = (title: string, items: AttendanceRecord[], titleColor: string) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <h3 className={`text-sm font-semibold ${titleColor} px-1`}>{title} ({items.length})</h3>
        <div className="space-y-2">
          {items.map((record) => (
            <div
              key={record.id}
              className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border"
            >
              <Avatar className="w-12 h-12 border-2 border-border">
                <AvatarImage src={getPhotoUrl(record.employee.photoUrl)} />
                <AvatarFallback className="text-sm font-medium">
                  {record.employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{record.employee.name}</p>
                <p className="text-xs text-muted-foreground truncate">{record.employee.position}</p>
              </div>
              <div className="text-right space-y-1">
                <Badge className={`${statusConfig[record.status]?.color} text-white text-xs`}>
                  {statusConfig[record.status]?.label}
                </Badge>
                {record.timestamp && (
                  <p className="text-xs text-muted-foreground">
                    {formatTime(record.timestamp)}
                    {record.checkOut && ` - ${formatTime(record.checkOut)}`}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const stats = {
    hadir: grouped.hadir.length,
    terlambat: grouped.terlambat.length,
    belum: grouped.belum.length,
    total: records.length,
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header
        villageName={settings.villageName}
        officerName={settings.officerName}
        logoUrl={settings.logoUrl}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
        <div className="flex-1 flex flex-col landscape:flex-row landscape:gap-6 overflow-hidden">
        
        {/* Left Side: Stats & Search (Landscape) */}
        <div className="flex-none space-y-4 landscape:w-1/3 landscape:flex landscape:flex-col">
        {/* Stats */}
        <div className="grid grid-cols-4 landscape:grid-cols-2 gap-2">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.hadir}</p>
            <p className="text-xs text-green-700 dark:text-green-300">Hadir</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.terlambat}</p>
            <p className="text-xs text-amber-700 dark:text-amber-300">Terlambat</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">{stats.belum}</p>
            <p className="text-xs text-slate-700 dark:text-slate-300">Belum</p>
          </div>
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.total}</p>
            <p className="text-xs text-primary">Total</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau jabatan..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Actions (Moved to left side in landscape) */}
        <div className="hidden landscape:flex gap-3 pt-2 mt-auto">
          <Link to="/" className="flex-1">
            <Button variant="outline" className="w-full h-12 text-lg">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Kembali
            </Button>
          </Link>
          <Link to="/absen" className="flex-1">
            <Button className="w-full h-12 text-lg">
              <Camera className="w-5 h-5 mr-2" />
              Absen
            </Button>
          </Link>
        </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1 landscape:w-2/3 landscape:h-full bg-card/50 rounded-xl border landscape:border-border landscape:p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 pb-20"
            >
              {renderSection('Hadir Tepat Waktu', grouped.hadir, 'text-green-700 dark:text-green-400')}
              {renderSection('Terlambat', grouped.terlambat, 'text-amber-700 dark:text-amber-400')}
              {renderSection('Izin / Sakit / Alfa / Cuti', grouped.lainnya, 'text-blue-700 dark:text-blue-400')}
              {renderSection('Belum Presensi', grouped.belum, 'text-slate-500')}

              {filteredRecords.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <p>Tidak ada data ditemukan</p>
                </div>
              )}
            </motion.div>
          )}
        </ScrollArea>
        </div>

        {/* Bottom actions */}
        <div className="flex gap-3 pt-2 landscape:hidden">
          <Link to="/" className="flex-1">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali
            </Button>
          </Link>
          <Link to="/absen" className="flex-1">
            <Button className="w-full">
              <Camera className="w-4 h-4 mr-2" />
              Absen
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default DaftarHadir;
