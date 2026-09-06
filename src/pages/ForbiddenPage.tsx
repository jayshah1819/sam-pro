import { Link } from 'react-router-dom'

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#f7f6f3]">
      <span className="text-4xl font-semibold text-[#08060d]">403</span>
      <p className="text-sm text-[#6b6375]">Your account does not have access yet. Contact your admin.</p>
      <Link to="/login" className="text-sm text-[#08060d] underline underline-offset-4">
        Back to login
      </Link>
    </div>
  )
}
