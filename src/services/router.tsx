import { useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'

const subscribe = (onChange: () => void) => {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}
const getPath = () => window.location.pathname
export const usePathname = () => useSyncExternalStore(subscribe, getPath, () => '/')

export function navigate(path: string, replace = false) {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function Link({ to, children, ...props }: { to: string; children: ReactNode; className?: string; 'aria-current'?: 'page' | undefined }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(to)
  }
  return <a href={to} onClick={handleClick} {...props}>{children}</a>
}
