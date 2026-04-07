# Frontend App

## Package Identity
React 18 + TypeScript frontend with Vite, shadcn/ui components, and TanStack Query. Provides employee attendance interface and admin dashboard with face recognition camera integration.

## Setup & Run
```bash
# From tap-to-attend/ directory
npm install

# Start dev server (http://localhost:8080)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Patterns & Conventions

### File Organization
- **Pages**: `src/pages/*.tsx` - Top-level route components
- **Components**: `src/components/*.tsx` - Reusable UI components
- **Hooks**: `src/hooks/*.tsx` - Custom React hooks
- **UI Library**: `src/components/ui/*.tsx` - shadcn/ui components (auto-generated)
- **Types**: `src/types/*.ts` - TypeScript interfaces
- **API Client**: `src/lib/api.ts` - Axios HTTP client
- **Utils**: `src/lib/*.ts` - Utility functions

### Code Patterns
- **DO**: Use absolute imports with `@/` prefix
  - Example: `import { Button } from "@/components/ui/button"` in `src/pages/Index.tsx:5`
- **DO**: Use custom hooks for API calls
  - Example: `useAttendance()` in `src/hooks/useAttendance.tsx`, used in `src/pages/Absen.tsx:12`
- **DO**: Use TanStack Query for data fetching
  - Example: `useQuery` in `src/hooks/useEmployees.tsx:10-15`
- **DO**: Use React Hook Form + Zod for forms
  - Example: Form validation in admin components
- **DON'T**: Fetch data directly in components, use hooks
- **DON'T**: Modify shadcn/ui components in `src/components/ui/`, customize via wrapper components

### Component Structure
```tsx
// Standard component pattern
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function MyComponent() {
  const { user } = useAuth();
  
  return (
    <div>
      {/* Component content */}
    </div>
  );
}
```

### Routing
- React Router v6 setup in `src/App.tsx:15-30`
- Routes: `/`, `/login`, `/absen`, `/daftar-hadir`, `/buku-tamu`, `/survey`
- Admin routes: `/admin/*` (dashboard, pegawai, absensi, etc.)
- Protected routes wrapped with auth check

### State Management
- **Auth**: `useAuth()` hook in `src/hooks/useAuth.tsx`
- **Settings**: `useSettings()` hook in `src/hooks/useSettings.tsx`
- **Attendance**: `useAttendance()` hook in `src/hooks/useAttendance.tsx`
- **Server state**: TanStack Query (React Query) for API data
- **Local state**: React useState/useReducer

### API Integration
- Base client in `src/lib/api.ts:5-15`
- Backend URL from `VITE_API_URL` env variable
- All endpoints use `/api/v1` prefix
- Example usage in `src/hooks/useEmployees.tsx:20-30`

### shadcn/ui Components
- Installed components in `src/components/ui/`
- Configuration in `components.json`
- Usage: Import and use directly
  - Example: `import { Button } from "@/components/ui/button"`
- Add new components: `npx shadcn@latest add [component-name]`

### Styling
- **Tailwind CSS**: Configured in `tailwind.config.ts`
- **CSS Variables**: Defined in `src/index.css:1-50`
- **Theme**: Uses next-themes for dark mode
- **DO**: Use Tailwind utility classes
  - Example: `className="flex items-center gap-4"` in components
- **DON'T**: Write custom CSS unless absolutely necessary

### Face Recognition
- Camera integration in `src/components/CameraView.tsx`
- Face detection using MediaPipe in `src/lib/faceDetection.ts`
- Capture and upload in `src/pages/Absen.tsx:40-60`

## Key Files
- **Main entry**: `src/main.tsx` - React app mount point
- **App router**: `src/App.tsx` - Route configuration
- **API client**: `src/lib/api.ts` - Axios instance with interceptors
- **Styles**: `src/index.css` - Global styles, Tailwind imports
- **Vite config**: `vite.config.ts` - Build config, PWA setup
- **Components config**: `components.json` - shadcn/ui settings

## JIT Index Hints
```bash
# Find page component
rg -n "export.*function.*Page" src/pages/

# Find custom hook
rg -n "export.*function use[A-Z]" src/hooks/

# Find component
rg -n "export.*function \w+" src/components/

# Find API call
rg -n "api\.(get|post|put|delete)" src/

# Find route definition
rg -n "<Route.*path=" src/App.tsx

# Find shadcn component usage
rg -n "from \"@/components/ui/" src/
```

## Admin Features
Admin pages in `src/pages/admin/`:
- **Dashboard**: `AdminDashboard.tsx` - Overview stats
- **Pegawai**: `AdminPegawai.tsx` - Employee management
- **Absensi**: `AdminAbsensi.tsx` - Attendance management
- **Pengaturan**: `AdminPengaturan.tsx` - Settings configuration
- **Riwayat**: `AdminRiwayat.tsx` - Attendance history
- **Buku Tamu**: `AdminBukuTamu.tsx` - Guestbook management
- **Survey**: `AdminSurvey.tsx` - Survey management
- **Log**: `AdminLog.tsx` - Audit logs

## Common Gotchas
- **Absolute imports**: MUST use `@/` prefix, configured in `vite.config.ts:83-85`
- **shadcn components**: Don't modify files in `src/components/ui/`, wrap them instead
- **API errors**: Check Network tab in browser DevTools, backend must be running
- **Environment**: Create `.env` with `VITE_API_URL=http://localhost:8000`
- **Camera permissions**: HTTPS required for camera in production (localhost OK for dev)
- **PWA**: Service worker registered automatically, see `vite.config.ts:16-80`

## TypeScript
- Config in `tsconfig.json` and `tsconfig.app.json`
- Strict mode enabled
- Path alias `@/*` → `./src/*`
- Type definitions in `src/types/`

## Pre-PR Checks
```bash
# From tap-to-attend/ directory
npm run lint  # ESLint check
npm run build  # Ensure production build works
# Manual test: Check all routes work with backend
```

## Environment Variables
Create `.env`:
```bash
VITE_API_URL=http://localhost:8000
```

## Development Workflow
1. Backend must be running on port 8000
2. Frontend dev server on port 8080
3. Hot reload enabled via Vite
4. API calls proxied to backend (no CORS issues in dev)
5. Browser DevTools → Network tab for debugging API calls

## Component Examples
- **Form with validation**: See admin employee forms in `src/pages/admin/AdminPegawai.tsx:50-100`
- **Data table**: See attendance list in `src/components/AttendanceList.tsx`
- **Modal dialog**: See face enrollment in `src/components/admin/FaceEnrollmentDialog.tsx`
- **Camera capture**: See face capture in `src/components/CameraView.tsx`
- **API hook**: See employee hook in `src/hooks/useEmployees.tsx`
