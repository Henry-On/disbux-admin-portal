import { useEffect } from 'react'
import { navigate } from '../services/router'

export function GiveawaysPage() {
  useEffect(() => { navigate('/announcements', true) }, [])
  return null
}
