import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context'

interface Props {
  roles: string[]
}

export default function RequireRole({ roles }: Props) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return roles.includes(user.role) ? <Outlet /> : <Navigate to="/403" replace />
}
