import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AdminRoute() {
  const { currentUser, isAdmin, loading } = useAuth();

  // isAdmin comes from the users/ profile read, so it is false until that
  // resolves — without the gate an admin refreshing /admin/* is kicked to /.
  if (loading) {
    return <LoadingSpinner fullPage />;
  }
  if (!currentUser || !isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
