import { useEffect } from 'react'
import { useNavigate } from 'react-router'

export function GiveawaysPage() {
  const navigate = useNavigate()
  useEffect(() => { navigate('/announcements', { replace: true }) }, [navigate])
  return null
}
