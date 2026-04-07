import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, UserPlus, Edit2, Trash2, Settings, RefreshCw, Loader2, FileText, Calendar, X, User, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { api, BackendAuditLog } from '@/lib/api';

const actionConfig: Record<string, { label: string; color: string; icon: typeof UserPlus }> = {
  create: { label: 'Tambah', color: 'bg-green-500', icon: UserPlus },
  update: { label: 'Edit', color: 'bg-blue-500', icon: Edit2 },
  delete: { label: 'Hapus', color: 'bg-red-500', icon: Trash2 },
  correct: { label: 'Koreksi', color: 'bg-yellow-500', icon: RefreshCw },
};

const entityConfig: Record<string, string> = {
  employee: 'Pegawai',
  attendance: 'Absensi',
  settings: 'Pengaturan',
  holiday: 'Hari Libur',
};

export function AdminLog() {
  const [logs, setLogs] = useState<BackendAuditLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const params: any = {
        page: currentPage,
        page_size: pageSize,
      };
      if (filterAction !== 'all') params.action = filterAction;
      if (filterEntity !== 'all') params.entity_type = filterEntity;
      if (debouncedSearch) params.search = debouncedSearch;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await api.admin.auditLogs.list(params);
      setLogs(response.items);
      setTotalLogs(response.total);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setFilterAction('all');
    setFilterEntity('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch data when params change
  useEffect(() => {
    fetchLogs();
  }, [currentPage, filterAction, filterEntity, debouncedSearch, startDate, endDate]);

  const handleActionChange = (value: string) => {
    setFilterAction(value);
    setCurrentPage(1);
  };

  const handleEntityChange = (value: string) => {
    setFilterEntity(value);
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(totalLogs / pageSize);

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Memuat log aktivitas...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Log Aktivitas</h1>
          <p className="text-muted-foreground">Riwayat aksi admin dan perubahan sistem</p>
        </div>
        {(search || filterAction !== 'all' || filterEntity !== 'all' || startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4 mr-2" />
            Reset Filter
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari aktivitas..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="w-full md:w-48">
                <Select value={filterAction} onValueChange={handleActionChange}>
                  <SelectTrigger>
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter Aksi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Aksi</SelectItem>
                    <SelectItem value="create">Tambah</SelectItem>
                    <SelectItem value="update">Edit</SelectItem>
                    <SelectItem value="delete">Hapus</SelectItem>
                    <SelectItem value="correct">Koreksi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-48">
                <Select value={filterEntity} onValueChange={handleEntityChange}>
                  <SelectTrigger>
                    <FileText className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter Entitas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Entitas</SelectItem>
                    <SelectItem value="employee">Pegawai</SelectItem>
                    <SelectItem value="attendance">Absensi</SelectItem>
                    <SelectItem value="settings">Pengaturan</SelectItem>
                    <SelectItem value="holiday">Hari Libur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 pt-2 border-t">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">Rentang Waktu:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex">
                <Input
                  type="date"
                  className="h-9 text-sm"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                <Input
                  type="date"
                  className="h-9 text-sm"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3 bg-secondary/50 flex-1 md:flex-none"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setStartDate(today);
                    setEndDate(today);
                    setCurrentPage(1);
                  }}
                >
                  Hari Ini
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3 bg-secondary/50 flex-1 md:flex-none"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                    setStartDate(firstDay);
                    setEndDate(lastDay);
                    setCurrentPage(1);
                  }}
                >
                  Bulan Ini
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Riwayat Aktivitas ({totalLogs})</CardTitle>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20" />
                <p className="text-muted-foreground px-4">
                  Tidak ada aktivitas ditemukan untuk filter yang dipilih
                </p>
                {(startDate || endDate || search || filterAction !== 'all' || filterEntity !== 'all') && (
                  <Button
                    variant="link"
                    onClick={resetFilters}
                    className="mt-2 text-primary"
                  >
                    Hapus semua filter
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {logs.map((log) => {
                    const config = actionConfig[log.action] || { label: log.action, color: 'bg-gray-500', icon: FileText };
                    const Icon = config.icon;
                    return (
                      <div
                        key={log.id}
                        className="flex items-start sm:items-center gap-3 py-3 px-1 hover:bg-secondary/30 transition-colors"
                      >
                        <div className={`w-8 h-8 rounded-full ${config.color} flex items-center justify-center shrink-0`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground leading-tight mb-1">{log.description}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium">
                                <span className="flex items-center gap-1.5">
                                  <User className="w-3 h-3" />
                                  {log.performed_by}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(log.created_at)}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 shrink-0">
                              <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0 h-5">
                                {config.label}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0 h-5">
                                {entityConfig[log.entity_type] || log.entity_type}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination UI */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t">
                    <p className="text-xs text-muted-foreground font-medium text-center sm:text-left">
                      <span className="hidden xs:inline">Menampilkan </span>
                      <span className="text-foreground">{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalLogs)}</span>
                      <span className="hidden xs:inline"> dari</span><span className="xs:hidden">/</span>
                      <span className="text-foreground"> {totalLogs}</span>
                      <span className="hidden xs:inline"> aktivitas</span>
                    </p>
                    <Pagination className="w-full sm:w-auto mx-0">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (currentPage > 1) setCurrentPage(currentPage - 1);
                            }}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>

                        {Array.from({ length: totalPages }).map((_, i) => {
                          const pageNum = i + 1;

                          if (
                            pageNum === 1 ||
                            pageNum === totalPages ||
                            (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                          ) {
                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  href="#"
                                  isActive={currentPage === pageNum}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setCurrentPage(pageNum);
                                  }}
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          }

                          if (
                            (pageNum === 2 && currentPage > 3) ||
                            (pageNum === totalPages - 1 && currentPage < totalPages - 2)
                          ) {
                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }

                          return null;
                        })}

                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                            }}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

