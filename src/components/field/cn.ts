import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Class names that merge cleanly: a caller's `className` overrides a default
// (`px-4` replaces `px-[18px]`) instead of both landing on the element.
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
