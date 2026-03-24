import Image from 'next/image'
import { cn } from '@/lib/utils'

type BrandLogoProps = {
  variant?: 'dark' | 'light'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  priority?: boolean
}

const sizes = {
  sm: { width: 168, height: 45 },
  md: { width: 212, height: 56 },
  lg: { width: 252, height: 67 },
}

export default function BrandLogo({
  variant = 'dark',
  size = 'md',
  className,
  priority = false,
}: BrandLogoProps) {
  const dim = sizes[size]
  return (
    <Image
      src={`/elecon-logo-${variant}.png`}
      alt="Elecon Timberyard logo"
      width={dim.width}
      height={dim.height}
      priority={priority}
      className={cn('h-auto w-auto select-none', className)}
    />
  )
}

