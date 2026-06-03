import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import Analytics from '@/pages/Analytics';
import Compare from '@/pages/Compare';
import Benchmarks from '@/pages/Benchmarks';
import Copilot from '@/pages/Copilot';
import Import from '@/pages/Import';
import PDFImport from '@/pages/PDFImport';
import DataWarehouse from '@/pages/DataWarehouse';
import Estimator from '@/pages/Estimator';
import SavedEstimates from '@/pages/SavedEstimates';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/benchmarks" element={<Benchmarks />} />
          <Route path="/copilot" element={<Copilot />} />
          <Route path="/import" element={<Import />} />
          <Route path="/pdf-import" element={<PDFImport />} />
          <Route path="/data-warehouse" element={<DataWarehouse />} />
          <Route path="/estimator/new" element={<Estimator />} />
          <Route path="/estimator/:id" element={<Estimator />} />
          <Route path="/estimates" element={<SavedEstimates />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
