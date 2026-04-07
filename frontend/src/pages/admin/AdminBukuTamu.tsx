import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Search, Download, Trash2, Loader2, Calendar, Users, Plus, Edit, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { toast } from 'sonner';
import { BackendGuestBookEntry, BackendGuestBookMeetingTarget } from '@/types/guestbook';
import { useAuth } from '@/hooks/useAuth';

export function AdminBukuTamu() {
  const { isAdmin } = useAuth();
  const [entries, setEntries] = useState<BackendGuestBookEntry[]>([]);
  const [meetingTargets, setMeetingTargets] = useState<BackendGuestBookMeetingTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTargets, setIsLoadingTargets] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'xlsx'>('pdf');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('entries');
  const [isTargetDialogOpen, setIsTargetDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<BackendGuestBookMeetingTarget | null>(null);
  const [targetName, setTargetName] = useState('');
  
  // Date filter - default to current month
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await api.admin.guestBook.list({
        start_date: startDate,
        end_date: endDate,
        search: search || undefined,
        page,
        per_page: 20,
      });
      setEntries(response.items);
      setTotal(response.total);
    } catch (error) {
      console.error('Failed to fetch guest book:', error);
      toast.error('Gagal memuat data buku tamu');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMeetingTargets = async () => {
    setIsLoadingTargets(true);
    try {
      const items = await api.admin.guestBook.meetingTargets.list();
      setMeetingTargets(items);
    } catch (error) {
      console.error('Failed to fetch meeting targets:', error);
      toast.error('Gagal memuat tujuan ketemu');
    } finally {
      setIsLoadingTargets(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchMeetingTargets();
  }, [page, startDate, endDate]);

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await api.admin.guestBook.export({
        start_date: startDate,
        end_date: endDate,
        format: exportFormat,
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `buku-tamu_${startDate}_${endDate}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Berhasil export data buku tamu (${exportFormat.toUpperCase()})`);
    } catch (error) {
      console.error('Failed to export:', error);
      toast.error('Gagal export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.admin.guestBook.delete(id);
      toast.success('Data berhasil dihapus');
      fetchData();
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Gagal menghapus data');
    }
  };

  const handleSaveMeetingTarget = async () => {
    if (!targetName.trim()) {
      toast.error('Nama tujuan ketemu harus diisi');
      return;
    }

    try {
      if (editingTarget) {
        await api.admin.guestBook.meetingTargets.update(editingTarget.id, { name: targetName });
        toast.success('Tujuan ketemu berhasil diperbarui');
      } else {
        await api.admin.guestBook.meetingTargets.create({ name: targetName });
        toast.success('Tujuan ketemu berhasil ditambahkan');
      }
      setIsTargetDialogOpen(false);
      setEditingTarget(null);
      setTargetName('');
      fetchMeetingTargets();
    } catch (error) {
      console.error('Failed to save meeting target:', error);
      toast.error('Gagal menyimpan tujuan ketemu');
    }
  };

  const handleToggleMeetingTarget = async (target: BackendGuestBookMeetingTarget) => {
    try {
      await api.admin.guestBook.meetingTargets.update(target.id, { is_active: !target.is_active });
      toast.success(target.is_active ? 'Tujuan ketemu dinonaktifkan' : 'Tujuan ketemu diaktifkan');
      fetchMeetingTargets();
    } catch (error) {
      console.error('Failed to toggle meeting target:', error);
      toast.error('Gagal mengubah status tujuan ketemu');
    }
  };

  const handleDeleteMeetingTarget = async (id: number) => {
    try {
      await api.admin.guestBook.meetingTargets.delete(id);
      toast.success('Tujuan ketemu berhasil dihapus');
      fetchMeetingTargets();
    } catch (error) {
      console.error('Failed to delete meeting target:', error);
      toast.error('Gagal menghapus tujuan ketemu');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Buku Tamu</h1>
        <p className="text-muted-foreground">Kelola daftar tamu yang berkunjung</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-none shadow-sm bg-card/50">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-sm text-muted-foreground">Total Tamu</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card/50">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {entries.filter(e => e.visit_date === today.toISOString().split('T')[0]).length}
              </p>
              <p className="text-sm text-muted-foreground">Tamu Hari Ini</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent space-x-6">
          <TabsTrigger value="entries" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-medium">
            <BookOpen className="w-4 h-4 mr-2" />
            Daftar Buku Tamu
          </TabsTrigger>
          <TabsTrigger value="targets" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 font-medium">
            <Building2 className="w-4 h-4 mr-2" />
            Tujuan Ketemu
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
      {/* Filters */}
      <Card className="border-none shadow-sm bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="w-5 h-5 text-primary" />
            Daftar Buku Tamu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter row */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex flex-col md:flex-row gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Dari Tanggal</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full md:w-auto"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sampai Tanggal</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full md:w-auto"
                />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs text-muted-foreground">Cari</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nama atau instansi..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button variant="secondary" onClick={handleSearch}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-end gap-2">
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
              <Button onClick={handleExport} disabled={isExporting} variant="outline">
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export
              </Button>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada data tamu</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[50px]">No</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Instansi</TableHead>
                      <TableHead>Tujuan Ketemu</TableHead>
                      <TableHead>Keperluan</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="w-[80px]">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry, index) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground">
                          {(page - 1) * 20 + index + 1}
                        </TableCell>
                        <TableCell className="font-medium">{entry.name}</TableCell>
                        <TableCell>{entry.institution}</TableCell>
                        <TableCell>{entry.meeting_target_name || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={entry.purpose}>
                          {entry.purpose}
                        </TableCell>
                        <TableCell>{formatDate(entry.visit_date)}</TableCell>
                        <TableCell>
                          {isAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Data Tamu?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Data tamu "{entry.name}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(entry.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} dari {total} data
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p - 1)}
                      disabled={page === 1}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= totalPages}
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="targets">
          <Card className="border-none shadow-sm bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="w-5 h-5 text-primary" />
                Tujuan Ketemu
              </CardTitle>
              {isAdmin && (
                <Dialog open={isTargetDialogOpen} onOpenChange={setIsTargetDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        setEditingTarget(null);
                        setTargetName('');
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Tambah Tujuan
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingTarget ? 'Edit Tujuan Ketemu' : 'Tambah Tujuan Ketemu'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Nama Tujuan</Label>
                        <Input
                          value={targetName}
                          onChange={(e) => setTargetName(e.target.value)}
                          placeholder="Contoh: Kades"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsTargetDialogOpen(false)}>
                        Batal
                      </Button>
                      <Button onClick={handleSaveMeetingTarget}>
                        {editingTarget ? 'Simpan Perubahan' : 'Tambah'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {isLoadingTargets ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : meetingTargets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada tujuan ketemu</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {meetingTargets.map((target) => (
                    <div
                      key={target.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        target.is_active ? 'bg-card hover:shadow-md' : 'bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${target.is_active ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          <Building2 className={`w-5 h-5 ${target.is_active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium">{target.name}</p>
                          {!target.is_active && (
                            <Badge variant="secondary" className="text-xs mt-1">Nonaktif</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && (
                          <>
                            <Switch
                              checked={target.is_active}
                              onCheckedChange={() => handleToggleMeetingTarget(target)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingTarget(target);
                                setTargetName(target.name);
                                setIsTargetDialogOpen(true);
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
                                  <AlertDialogTitle>Hapus Tujuan Ketemu?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tujuan ketemu "{target.name}" akan dihapus jika belum dipakai data buku tamu.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteMeetingTarget(target.id)}
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
