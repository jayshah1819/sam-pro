import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context'

export default function ProtectedRoute() {
  const { token, user } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (user?.role === 'VIEWER') return <Navigate to="/403" replace />
  return <Outlet />
}
