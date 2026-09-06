import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

type ToolbarDropdownProps = {
  label: string
  children: ReactNode
  panelClassName?: string
  align?: 'left' | 'right'
}

export default function ToolbarDropdown({
  label,
  children,
  panelClassName,
  align = 'left',
}: ToolbarDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelId = useId()
  const panelAlign = align === 'right' ? 'right-0' : 'left-0'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(prev => !prev)}
        className="h-8 px-2.5 rounded-md border border-[#e5e4e7] text-xs text-[#08060d] bg-white cursor-pointer hover:bg-[#f7f6f3] inline-flex items-center gap-1.5 whitespace-nowrap"
      >
        <span>{label}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-3.5 w-3.5 text-[#6b6375] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          id={panelId}
          className={`${panelAlign} absolute mt-1 z-20 bg-white border border-[#e5e4e7] rounded-md shadow-sm p-3 min-w-40 ${panelClassName ?? ''}`.trim()}
        >
          {children}
        </div>
      )}
    </div>
  )
}
