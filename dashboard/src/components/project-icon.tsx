import { cn } from '@/lib/utils'

const EMOJI_BG_COLORS = [
  'bg-blue-500/15',
  'bg-violet-500/15',
  'bg-pink-500/15',
  'bg-rose-500/15',
  'bg-orange-500/15',
  'bg-amber-500/15',
  'bg-emerald-500/15',
  'bg-teal-500/15',
  'bg-cyan-500/15',
  'bg-indigo-500/15',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function isEmoji(str: string): boolean {
  return !!str && !str.startsWith('http') && !str.startsWith('data:') && !str.startsWith('/')
}

export function ProjectIcon({
  icon,
  name,
  size = 'md',
  className,
}: {
  icon: string
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeClasses = {
    sm: 'h-8 w-8 text-base rounded-lg',
    md: 'h-10 w-10 text-xl rounded-xl',
    lg: 'h-16 w-16 text-3xl rounded-2xl',
  }

  const fallbackSizeClasses = {
    sm: 'h-8 w-8 text-xs rounded-lg',
    md: 'h-10 w-10 text-sm rounded-xl',
    lg: 'h-16 w-16 text-lg rounded-2xl',
  }

  if (icon && isEmoji(icon)) {
    const bgColor = EMOJI_BG_COLORS[hashString(icon) % EMOJI_BG_COLORS.length]
    return (
      <div className={cn('flex items-center justify-center shrink-0', bgColor, sizeClasses[size], className)}>
        {icon}
      </div>
    )
  }

  if (icon) {
    return (
      <img
        src={icon}
        alt={name}
        className={cn('object-cover shrink-0', sizeClasses[size], className)}
      />
    )
  }

  // Fallback: first letter
  const bgColor = EMOJI_BG_COLORS[hashString(name) % EMOJI_BG_COLORS.length]
  return (
    <div className={cn('flex items-center justify-center shrink-0 font-bold', bgColor, fallbackSizeClasses[size], className)}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}
