import { motion } from 'framer-motion';
import { Camera, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttendanceRecord, AttendanceStatus } from '@/types/attendance';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useState } from 'react';

interface AttendanceListProps {
  records: AttendanceRecord[];
  onBackToCamera: () => void;
}

const statusConfig: Record<AttendanceStatus, {
  label: string;
  color: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  bgColor: string;
}> = {
  hadir: {
    label: 'Hadir',
    color: 'text-green-600',
    badgeVariant: 'default',
    bgColor: 'bg-green-100'
  },
  terlambat: {
    label: 'Terlambat',
    color: 'text-yellow-600',
    badgeVariant: 'secondary',
    bgColor: 'bg-yellow-100'
  },
  belum: {
    label: 'Belum',
    color: 'text-gray-500',
    badgeVariant: 'outline',
    bgColor: 'bg-gray-100'
  },
  izin: {
    label: 'Izin',
    color: 'text-blue-600',
    badgeVariant: 'secondary',
    bgColor: 'bg-blue-100'
  },
  sakit: {
    label: 'Sakit',
    color: 'text-orange-600',
    badgeVariant: 'secondary',
    bgColor: 'bg-orange-100'
  },
  alfa: {
    label: 'Alfa',
    color: 'text-red-600',
    badgeVariant: 'destructive',
    bgColor: 'bg-red-100'
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export function AttendanceList({ records, onBackToCamera }: AttendanceListProps) {
  const [search, setSearch] = useState('');

  const filteredRecords = records.filter(r =>
    r.employee.name.toLowerCase().includes(search.toLowerCase()) ||
    r.employee.position.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = {
    hadir: filteredRecords.filter(r => r.status === 'hadir'),
    terlambat: filteredRecords.filter(r => r.status === 'terlambat'),
    belum: filteredRecords.filter(r => r.status === 'belum'),
    lainnya: filteredRecords.filter(r => ['izin', 'sakit', 'alfa'].includes(r.status)),
  };

  const stats = {
    hadir: records.filter(r => r.status === 'hadir').length,
    terlambat: records.filter(r => r.status === 'terlambat').length,
    belum: records.filter(r => r.status === 'belum').length,
    total: records.length
  };

  const renderSection = (title: string, items: AttendanceRecord[], colorClass: string) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className={`text-sm font-semibold mb-3 px-1 flex items-center gap-2 ${colorClass}`}>
          {title} <Badge variant="secondary" className="text-xs h-5 px-1.5 min-w-5 justify-center">{items.length}</Badge>
        </h3>
        <div className="space-y-3">
          {items.map((record) => {
            const config = statusConfig[record.status];

            return (
              <motion.div
                key={record.id}
                variants={itemVariants}
              >
                <Card className="p-3 hover:shadow-md transition-shadow duration-200 border-l-4" style={{ borderLeftColor: record.status === 'hadir' ? '#22c55e' : record.status === 'terlambat' ? '#eab308' : record.status === 'belum' ? '#94a3b8' : '#3b82f6' }}>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 border border-muted">
                      <AvatarImage src={record.employee.photoUrl} alt={record.employee.name} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {record.employee.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{record.employee.name}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {record.employee.position}
                      </p>
                    </div>

                    <div className="text-right">
                      {record.timestamp ? (
                        <>
                          <div className={`text-lg font-bold tracking-tight ${config.color}`}>
                            {record.timestamp.toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          {record.checkOut && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Pulang: {record.checkOut.toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs font-normal">Belum Absen</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex-1 flex flex-col bg-slate-50/50 h-full overflow-hidden"
    >
      {/* Header Stats */}
      <div className="px-5 py-4 bg-background border-b shadow-sm z-10 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center border-green-200 bg-green-50/30">
            <div className="text-2xl font-bold text-green-600">{stats.hadir}</div>
            <div className="text-[10px] uppercase font-bold text-green-700/60 tracking-wider">Hadir</div>
          </Card>

          <Card className="p-3 text-center border-yellow-200 bg-yellow-50/30">
            <div className="text-2xl font-bold text-yellow-600">{stats.terlambat}</div>
            <div className="text-[10px] uppercase font-bold text-yellow-700/60 tracking-wider">Terlambat</div>
          </Card>

          <Card className="p-3 text-center border-slate-200 bg-slate-50/30">
            <div className="text-2xl font-bold text-slate-600">{stats.belum}</div>
            <div className="text-[10px] uppercase font-bold text-slate-700/60 tracking-wider">Belum</div>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau jabatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-muted/40 border-none focus-visible:ring-1"
          />
        </div>
      </div>

      {/* List Area */}
      <ScrollArea className="flex-1 px-5 py-2">
        <motion.div
          className="pb-20 pt-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {renderSection('Hadir Tepat Waktu', grouped.hadir, 'text-green-700')}
          {renderSection('Terlambat', grouped.terlambat, 'text-yellow-700')}
          {renderSection('Izin / Sakit / Alfa', grouped.lainnya, 'text-blue-700')}
          {renderSection('Belum Presensi', grouped.belum, 'text-slate-500')}

          {filteredRecords.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <p>Tidak ada data ditemukan</p>
            </div>
          )}
        </motion.div>
      </ScrollArea>

      {/* Footer Action */}
      <div className="p-5 bg-background border-t absolute bottom-0 left-0 right-0 z-20">
        <Button
          onClick={onBackToCamera}
          className="w-full h-12 text-lg font-medium shadow-lg hover:shadow-xl transition-all"
          size="lg"
        >
          <Camera className="w-5 h-5 mr-2" />
          Kembali ke Kamera
        </Button>
      </div>
    </motion.div>
  );
}
