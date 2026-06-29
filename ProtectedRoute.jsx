import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/FirebaseAuthContext';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
      <p className="text-slate-400 text-sm">Verifying credentials...</p>
    </div>
  </div>
);

const ProtectedRoute = ({ fallback = <DefaultFallback />, unauthenticatedElement = <Navigate to="/login" replace /> }) => {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <div className="flex h-screen items-center justify-center text-white bg-slate-950">User not registered. Please contact support.</div>;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  return <Outlet />;
};

export default ProtectedRoute;