import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "./hooks/useAuth";
import Index from "./pages/Index";
import Pegawai from "./pages/Pegawai";
import Umum from "./pages/Umum";
import Absen from "./pages/Absen";
import DaftarHadir from "./pages/DaftarHadir";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import BukuTamu from "./pages/BukuTamu";
import Survey from "./pages/Survey";
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminPegawai } from "./pages/admin/AdminPegawai";
import { AdminAbsensi } from "./pages/admin/AdminAbsensi";
import { AdminRiwayat } from "./pages/admin/AdminRiwayat";
import { AdminPengaturan } from "./pages/admin/AdminPengaturan";
import { AdminLog } from "./pages/admin/AdminLog";
import { AdminBukuTamu } from "./pages/admin/AdminBukuTamu";
import { AdminSurvey } from "./pages/admin/AdminSurvey";

const queryClient = new QueryClient();

function AppRoutes() {
  const location = useLocation();
  
  return (
    <Routes location={location} key={location.pathname}>
      {/* Public Routes */}
      <Route path="/" element={<Index />} />
      <Route path="/pegawai" element={<Pegawai />} />
      <Route path="/umum" element={<Umum />} />
      <Route path="/absen" element={<Absen />} />
      <Route path="/daftar-hadir" element={<DaftarHadir />} />
      <Route path="/login" element={<Login />} />
      <Route path="/buku-tamu" element={<BukuTamu />} />
      <Route path="/survey" element={<Survey />} />
      
      {/* Protected Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="pegawai" element={<AdminPegawai />} />
        <Route path="absensi" element={<AdminAbsensi />} />
        <Route path="riwayat" element={<AdminRiwayat />} />
        <Route path="buku-tamu" element={<AdminBukuTamu />} />
        <Route path="survey" element={<AdminSurvey />} />
        <Route path="pengaturan" element={<AdminPengaturan />} />
        <Route path="log" element={<AdminLog />} />
      </Route>
      
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
