import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Camera, UserCheck, UserX, Loader2, Upload, X, ScanFace } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { api, BackendEmployee, BackendFaceEmbedding } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export function AdminPegawai() {
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState<BackendEmployee[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<BackendEmployee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    position: '',
    nik: '',
    phone: '',
    address: '',
  });

  // Face enrollment states
  const [faceDialogOpen, setFaceDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<BackendEmployee | null>(null);
  const [facePhotos, setFacePhotos] = useState<BackendFaceEmbedding[]>([]);
  const [isUploadingFace, setIsUploadingFace] = useState(false);
  const [isLoadingFaces, setIsLoadingFaces] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera states for face enrollment
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const response = await api.employees.list({ search: search || undefined });
      setEmployees(response.items);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      toast.error('Gagal memuat data pegawai');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    
    // Cleanup camera on unmount
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => {
          track.stop();
          console.log('Admin camera track stopped on unmount');
        });
      }
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployees();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchFacePhotos = async (employeeId: number) => {
    try {
      setIsLoadingFaces(true);
      const photos = await api.employees.face.list(employeeId);
      setFacePhotos(photos);
    } catch (error) {
      console.error('Failed to fetch face photos:', error);
      toast.error('Gagal memuat foto wajah');
    } finally {
      setIsLoadingFaces(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingEmployee) {
        await api.employees.update(editingEmployee.id, {
          name: formData.name,
          position: formData.position,
          nik: formData.nik || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
        });
        toast.success('Pegawai berhasil diperbarui');
      } else {
        await api.employees.create({
          name: formData.name,
          position: formData.position,
          nik: formData.nik || undefined,
          phone: formData.phone || undefined,
          address: formData.address || undefined,
        });
        toast.success('Pegawai berhasil ditambahkan');
      }
      setIsDialogOpen(false);
      setEditingEmployee(null);
      setFormData({ name: '', position: '', nik: '', phone: '', address: '' });
      fetchEmployees();
    } catch (error) {
      console.error('Failed to save employee:', error);
      toast.error('Gagal menyimpan data pegawai');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (employee: BackendEmployee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      position: employee.position,
      nik: employee.nik || '',
      phone: employee.phone || '',
      address: employee.address || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menonaktifkan pegawai ini?')) return;

    try {
      await api.employees.delete(id);
      toast.success('Pegawai berhasil dinonaktifkan');
      fetchEmployees();
    } catch (error) {
      console.error('Failed to delete employee:', error);
      toast.error('Gagal menonaktifkan pegawai');
    }
  };

  const toggleStatus = async (employee: BackendEmployee) => {
    try {
      await api.employees.update(employee.id, { is_active: !employee.is_active });
      toast.success('Status pegawai diperbarui');
      fetchEmployees();
    } catch (error) {
      console.error('Failed to toggle status:', error);
      toast.error('Gagal mengubah status pegawai');
    }
  };

  const openFaceDialog = (employee: BackendEmployee) => {
    setSelectedEmployee(employee);
    setFaceDialogOpen(true);
    fetchFacePhotos(employee.id);
  };

  const closeFaceDialog = () => {
    stopCamera();
    setFaceDialogOpen(false);
    setSelectedEmployee(null);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      setCameraStream(stream);
      setIsCameraActive(true);
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Gagal mengakses kamera');
    }
  };

  // Connect camera stream to video element when both are available
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(console.error);
    }
  }, [cameraStream, isCameraActive]);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => {
        track.stop();
        console.log('Admin camera track stopped');
      });
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureFromCamera = async () => {
    if (!videoRef.current || !canvasRef.current || !selectedEmployee) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });

      try {
        setIsUploadingFace(true);
        const result = await api.employees.face.upload(selectedEmployee.id, file);
        toast.success(result.message);
        fetchFacePhotos(selectedEmployee.id);
      } catch (error) {
        console.error('Failed to upload face:', error);
        const axiosError = error as { response?: { data?: { detail?: string } } };
        toast.error(axiosError.response?.data?.detail || 'Gagal menyimpan foto wajah');
      } finally {
        setIsUploadingFace(false);
      }
    }, 'image/jpeg', 0.9);
  };

  const handleFaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEmployee) return;

    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 5MB');
      return;
    }

    try {
      setIsUploadingFace(true);
      const result = await api.employees.face.upload(selectedEmployee.id, file);
      toast.success(result.message);
      fetchFacePhotos(selectedEmployee.id);
    } catch (error) {
      console.error('Failed to upload face:', error);
      const axiosError = error as { response?: { data?: { detail?: string } } };
      toast.error(axiosError.response?.data?.detail || 'Gagal mengupload foto wajah');
    } finally {
      setIsUploadingFace(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteFace = async (faceId: number) => {
    if (!selectedEmployee) return;
    if (!confirm('Yakin ingin menghapus foto wajah ini?')) return;

    try {
      await api.employees.face.delete(selectedEmployee.id, faceId);
      toast.success('Foto wajah berhasil dihapus');
      fetchFacePhotos(selectedEmployee.id);
    } catch (error) {
      console.error('Failed to delete face:', error);
      toast.error('Gagal menghapus foto wajah');
    }
  };

  if (isLoading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Memuat data pegawai...</p>
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pegawai</h1>
          <p className="text-muted-foreground">Kelola data pegawai desa ({employees.length} pegawai)</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {isAdmin && (
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingEmployee(null); setFormData({ name: '', position: '', nik: '', phone: '', address: '' }); }}>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Pegawai
              </Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? 'Edit Pegawai' : 'Tambah Pegawai Baru'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Jabatan *</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nik">NIK</Label>
                <Input
                  id="nik"
                  value={formData.nik}
                  onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                  placeholder="16 digit NIK"
                  maxLength={16}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">No HP</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Alamat Rumah</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Alamat lengkap"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingEmployee ? 'Simpan' : 'Tambah'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari pegawai..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Table - Desktop */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>NIK</TableHead>
                <TableHead>Jabatan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Foto Wajah</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {search ? 'Tidak ada pegawai yang cocok' : 'Belum ada data pegawai'}
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {employee.photo_url ? (
                          <img
                            src={`${API_BASE_URL}${employee.photo_url}`}
                            alt={employee.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {employee.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{employee.name}</p>
                          <p className="text-xs text-muted-foreground">{employee.phone || '-'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{employee.nik || '-'}</TableCell>
                    <TableCell>{employee.position}</TableCell>
                    <TableCell>
                      <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                        {employee.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <Badge
                          variant={employee.face_count > 0 ? "outline" : "destructive"}
                          className={`w-fit ${employee.face_count > 0 ? 'bg-green-50 text-green-700 border-green-200' : ''}`}
                        >
                          {employee.face_count} Foto
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openFaceDialog(employee)}
                          className="w-fit h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                        >
                          <ScanFace className="w-3 h-3 mr-1" />
                          Kelola
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleStatus(employee)}
                              title={employee.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            >
                              {employee.is_active ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(employee)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(employee.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* List - Mobile */}
      <div className="md:hidden space-y-4">
        {employees.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
            {search ? 'Tidak ada pegawai yang cocok' : 'Belum ada data pegawai'}
          </div>
        ) : (
          employees.map((employee) => (
            <Card key={employee.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {employee.photo_url ? (
                      <img
                        src={`${API_BASE_URL}${employee.photo_url}`}
                        alt={employee.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg font-medium text-primary">
                          {employee.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{employee.name}</p>
                      <p className="text-sm text-muted-foreground">{employee.position}</p>
                    </div>
                  </div>
                  <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                    {employee.is_active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">NIK</span>
                    <span>{employee.nik || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">No HP</span>
                    <span className="truncate block">{employee.phone || '-'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openFaceDialog(employee)}
                    className="p-0 h-auto gap-1 text-muted-foreground hover:text-primary"
                  >
                    <Badge
                      variant={employee.face_count > 0 ? "outline" : "destructive"}
                      className={`mr-1 px-1.5 py-0 text-[10px] ${employee.face_count > 0 ? 'bg-green-50 text-green-700 border-green-200' : ''}`}
                    >
                      {employee.face_count}
                    </Badge>
                    Foto Wajah
                  </Button>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleStatus(employee)}
                      >
                        {employee.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(employee)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(employee.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Face Enrollment Dialog */}
      <Dialog open={faceDialogOpen} onOpenChange={closeFaceDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Foto Wajah - {selectedEmployee?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Camera View */}
            {isCameraActive ? (
              <div className="space-y-3">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-4 border-primary/50 rounded-lg pointer-events-none" />
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={captureFromCamera} disabled={isUploadingFace}>
                    {isUploadingFace ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Camera className="w-4 h-4 mr-2" />
                    )}
                    Ambil Foto
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    <X className="w-4 h-4 mr-2" />
                    Tutup Kamera
                  </Button>
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Posisikan wajah menghadap kamera dengan pencahayaan yang baik
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={startCamera} variant="outline">
                  <Camera className="w-4 h-4 mr-2" />
                  Ambil dari Kamera
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFaceUpload}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFace}
                >
                  {isUploadingFace ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Upload Foto
                </Button>
                <p className="text-sm text-muted-foreground">
                  Tambahkan 3-5 foto dari berbagai angle untuk akurasi terbaik
                </p>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {/* Face photos grid */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">
                Foto Terdaftar ({facePhotos.length})
              </h4>
              {isLoadingFaces ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : facePhotos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <ScanFace className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Belum ada foto wajah</p>
                  <p className="text-sm">Tambahkan foto untuk mengaktifkan face recognition</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {facePhotos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={`${API_BASE_URL}${photo.photo_url}`}
                        alt="Face"
                        className="w-full aspect-square object-cover rounded-lg border"
                      />
                      {photo.is_primary && (
                        <Badge className="absolute top-1 left-1 text-xs" variant="secondary">
                          Utama
                        </Badge>
                      )}
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6"
                        onClick={() => handleDeleteFace(photo.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
