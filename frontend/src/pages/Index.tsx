import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Globe } from 'lucide-react';
import { Header } from '@/components/Header';
import { useSettings } from '@/hooks/useSettings';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const menuItems = [
  {
    id: 'pegawai',
    title: 'PEGAWAI',
    subtitle: 'Absen & Daftar Hadir',
    icon: Users,
    to: '/pegawai',
    color: 'from-green-600 to-green-700',
    iconBg: 'bg-green-500/20',
  },
  {
    id: 'umum',
    title: 'UMUM',
    subtitle: 'Buku Tamu & Survey',
    icon: Globe,
    to: '/umum',
    color: 'from-blue-600 to-blue-700',
    iconBg: 'bg-blue-500/20',
  },
];

const Index = () => {
  const { settings } = useSettings();
  const hasBackground = !!settings.backgroundUrl;

  return (
    <div className={`min-h-screen h-screen flex flex-col overflow-hidden relative ${hasBackground ? 'bg-transparent' : 'bg-gradient-to-br from-background via-primary/5 to-background'}`}>
      {/* Background Image Layer */}
      {hasBackground && (
        <div
          className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${API_BASE_URL}${settings.backgroundUrl})` }}
        >
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      <Header
        villageName={settings.villageName}
        officerName={settings.officerName}
        logoUrl={settings.logoUrl}
      />
      
      <main className="flex-1 flex items-center justify-center px-3 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-3 md:py-4 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-4xl flex flex-col justify-center h-full"
        >
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-3 sm:mb-4 md:mb-6 lg:mb-8 landscape:mb-4"
          >
            <h1 className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2 ${hasBackground ? 'text-white drop-shadow-lg' : 'text-foreground'}`}>
              Sistem Absensi dan Layanan Desa
            </h1>
            <p className={`text-sm sm:text-base md:text-lg ${hasBackground ? 'text-white/90 drop-shadow' : 'text-muted-foreground'}`}>Pilih menu layanan</p>
          </motion.div>

          {/* Menu Grid - 2 columns for 2 main menus */}
          <div className="grid grid-cols-1 sm:grid-cols-2 landscape:grid-cols-2 gap-3 sm:gap-4 md:gap-6 lg:gap-8 landscape:gap-4 max-w-3xl mx-auto w-full">
            {menuItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.1, type: "spring" }}
                className="h-full"
              >
                <Link to={item.to}>
                  <div className={`group relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl bg-gradient-to-br ${item.color} p-4 sm:p-6 md:p-8 lg:p-10 landscape:p-4 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] h-32 sm:h-40 md:h-48 lg:h-56 landscape:h-auto landscape:min-h-[120px] flex flex-col justify-between cursor-pointer`}>
                    {/* Icon */}
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-18 md:h-18 lg:w-20 lg:h-20 landscape:w-14 landscape:h-14 rounded-lg sm:rounded-xl md:rounded-2xl ${item.iconBg} backdrop-blur-sm flex items-center justify-center transition-transform group-hover:scale-110`}>
                      <item.icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 lg:w-10 lg:h-10 landscape:w-7 landscape:h-7 text-white" strokeWidth={2} />
                    </div>

                    {/* Text */}
                    <div className="space-y-1 landscape:space-y-0.5">
                      <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl landscape:text-xl font-bold leading-tight">{item.title}</h3>
                      <p className="text-white/90 text-xs sm:text-sm md:text-base lg:text-lg landscape:text-sm font-medium">{item.subtitle}</p>
                    </div>

                    {/* Decorative elements */}
                    <div className="absolute -bottom-6 -right-6 sm:-bottom-8 sm:-right-8 md:-bottom-10 md:-right-10 w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-40 lg:h-40 rounded-full bg-white/10 transition-transform group-hover:scale-110" />
                    <div className="absolute top-1/2 -left-4 sm:-left-6 md:-left-8 w-14 h-14 sm:w-18 sm:h-18 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full bg-white/5" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="p-1.5 sm:p-2 md:p-3 text-center landscape:py-1">
        <p className={`text-[10px] sm:text-xs md:text-sm ${hasBackground ? 'text-white/70' : 'text-muted-foreground'}`}>
          Dibuat oleh <span className={`font-medium ${hasBackground ? 'text-white' : 'text-foreground'}`}>Dany Pratmanto</span> ·
          <a
            href="https://wa.me/628974041777"
            target="_blank"
            rel="noopener noreferrer"
            className={`ml-1 hover:underline ${hasBackground ? 'text-white/90' : 'text-primary'}`}
          >
            WA 0897 4041 777
          </a>
        </p>
      </footer>
    </div>
  );
};

export default Index;
