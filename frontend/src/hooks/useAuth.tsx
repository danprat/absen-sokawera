import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, AdminShellSettings, LoginRequest } from '@/lib/api';
import { toast } from 'sonner';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: string | null;
  settings: AdminShellSettings | null;
  isAdmin: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [role, setRole] = useState<string | null>(null);
  const [settings, setSettings] = useState<AdminShellSettings | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.auth.getCurrentUser();
        setIsAuthenticated(true);
        setRole(response.role);
        setSettings(response.settings ?? null);
      } catch (error) {
        localStorage.removeItem('access_token');
        setIsAuthenticated(false);
        setRole(null);
        setSettings(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const isAdmin = role === 'admin';

  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await api.auth.login(credentials);

      localStorage.setItem('access_token', response.access_token);
      setIsAuthenticated(true);
      setRole(response.role);
      setSettings(null);

      const roleLabel = response.role === 'kepala_desa' ? 'Kepala Desa' : 'Admin';
      toast.success('Login berhasil', {
        description: `Selamat datang di panel ${roleLabel}`,
      });

      // Redirect to admin dashboard
      navigate('/admin');
    } catch (error) {
      console.error('Login error:', error);

      const errorMessage = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Username atau password salah';

      toast.error('Login gagal', {
        description: errorMessage,
      });

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      // Call backend logout endpoint to clear cookie and revoke token
      await api.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with logout even if API call fails
    }

    localStorage.removeItem('access_token');
    setIsAuthenticated(false);
    setRole(null);
    setSettings(null);

    toast.info('Logout berhasil', {
      description: 'Anda telah keluar dari sistem',
    });

    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        role,
        settings,
        isAdmin,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

// Protected Route Component
interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast.warning('Akses ditolak', {
        description: 'Silakan login terlebih dahulu',
      });
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  // Show nothing if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Render children if authenticated
  return <>{children}</>;
};
