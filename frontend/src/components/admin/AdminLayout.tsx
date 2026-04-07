import { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  History,
  Settings,
  FileText,
  Menu,
  X,
  LogOut,
  Home,
  BookOpen,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const navItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Beranda', exact: true },
  { path: '/admin/pegawai', icon: Users, label: 'Pegawai' },
  { path: '/admin/absensi', icon: CalendarCheck, label: 'Absensi Harian' },
  { path: '/admin/riwayat', icon: History, label: 'Riwayat & Laporan' },
  { path: '/admin/buku-tamu', icon: BookOpen, label: 'Buku Tamu' },
  { path: '/admin/survey', icon: Star, label: 'Survey Kepuasan' },
  { path: '/admin/pengaturan', icon: Settings, label: 'Pengaturan' },
  { path: '/admin/log', icon: FileText, label: 'Log Aktivitas' },
];

export function AdminLayout() {
  const location = useLocation();
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [villageName, setVillageName] = useState('Admin Panel');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await api.admin.settings.get();
        setVillageName(settings.village_name);
        setLogoUrl(settings.logo_url);
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();
  }, []);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
      else setSidebarOpen(false);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex bg-secondary/30">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop */}
      {!isMobile && (
        <aside
          className={`bg-background border-r border-border flex flex-col shrink-0 h-screen sticky top-0 transition-[width] duration-300 ease-in-out ${
            sidebarOpen ? 'w-[260px]' : 'w-[72px]'
          }`}
        >
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            <div
              className={`flex items-center gap-3 transition-opacity duration-200 ${
                sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
              }`}
            >
              {logoUrl && (
                <img
                  src={`${API_BASE_URL}${logoUrl}`}
                  alt="Logo"
                  className="w-10 h-10 object-contain shrink-0"
                />
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-foreground text-sm md:text-base truncate" title={villageName}>
                  {villageName}
                </span>
                <span className="text-xs text-muted-foreground truncate">Admin Panel</span>
              </div>
            </div>

            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="shrink-0"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = isActive(item.path, item.exact);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span
                    className={`font-medium whitespace-nowrap overflow-hidden text-sm transition-[opacity,width] duration-300 ease-in-out ${
                      sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Footer Actions */}
          <div className="p-2 border-t border-border space-y-1">
            <Link
              to="/"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
              title={!sidebarOpen ? 'Ke Mesin Absensi' : undefined}
            >
              <Home className="w-5 h-5 shrink-0" />
              <span
                className={`font-medium whitespace-nowrap overflow-hidden text-sm transition-[opacity,width] duration-300 ease-in-out ${
                  sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
                }`}
              >
                Ke Mesin Absensi
              </span>
            </Link>
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
              title={!sidebarOpen ? 'Keluar' : undefined}
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span
                className={`font-medium whitespace-nowrap overflow-hidden text-sm transition-[opacity,width] duration-300 ease-in-out ${
                  sidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'
                }`}
              >
                Keluar
              </span>
            </button>
          </div>
        </aside>
      )}

      {/* Sidebar - Mobile */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="bg-background border-r border-border flex flex-col w-[260px] h-screen fixed inset-y-0 left-0 z-50"
          >
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-border">
              <div className="flex items-center gap-3">
                {logoUrl && (
                  <img
                    src={`${API_BASE_URL}${logoUrl}`}
                    alt="Logo"
                    className="w-10 h-10 object-contain"
                  />
                )}
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-foreground text-sm truncate" title={villageName}>{villageName}</span>
                  <span className="text-xs text-muted-foreground truncate">Admin Panel</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = isActive(item.path, item.exact);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Footer Actions */}
            <div className="p-2 border-t border-border space-y-1">
              <Link
                to="/"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
              >
                <Home className="w-5 h-5 shrink-0" />
                <span className="font-medium text-sm">Ke Mesin Absensi</span>
              </Link>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span className="font-medium text-sm">Keluar</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Mobile Header */}
        {isMobile && (
          <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border h-14 flex items-center px-4 gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            {logoUrl && (
              <img
                src={`${API_BASE_URL}${logoUrl}`}
                alt="Logo"
                className="w-6 h-6 object-contain"
              />
            )}
            <span className="font-semibold text-foreground text-sm truncate">{villageName}</span>
          </header>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="p-4 md:p-6 flex-1 pb-16"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Fixed Footer - only covers main content area, not sidebar */}
      <footer
        className="fixed bottom-0 right-0 bg-background/90 backdrop-blur-sm border-t border-border py-2 px-4 z-30 transition-all duration-300 w-full md:w-[calc(100%-72px)]"
        style={{ width: isMobile ? '100%' : `calc(100% - ${sidebarOpen ? '260px' : '72px'})` }}
      >
        <p className="text-[10px] md:text-xs text-muted-foreground text-center">
          Dibuat oleh <span className="font-medium text-foreground">Dany Pratmanto</span> ·
          <a
            href="https://wa.me/628974041777"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-primary hover:underline"
          >
            WA 0897 4041 777
          </a>
        </p>
      </footer>
    </div>
  );
}
