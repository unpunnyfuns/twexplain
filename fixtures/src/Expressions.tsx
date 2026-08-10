import { cva } from 'class-variance-authority'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

declare const cn: (...parts: unknown[]) => string
declare const tv: (config: unknown) => string

export function Ternary({ isLight }: { isLight: boolean }) {
  return (
    <div className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>
      both branches are separate class strings
    </div>
  )
}

export function LogicalAnd({ isActive }: { isActive: boolean }) {
  return <div className={`flex gap-2 ${isActive ? 'ring-2 ring-brand-500' : ''}`}>template</div>
}

export function TemplateLiteral({ extra }: { extra: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 ${extra} py-2`}>
      the interpolation is never offered as a class, and a cursor inside it explains nothing
    </div>
  )
}

export function Helpers({ isOpen }: { isOpen: boolean }) {
  return (
    <>
      <div className={clsx('flex gap-2', isOpen && 'opacity-100', !isOpen && 'opacity-0')} />
      <div className={cn('rounded-md border p-4', 'shadow-sm')} />
      <div className={twMerge('px-2 py-1', 'px-4')} />
    </>
  )
}

export const button = cva('inline-flex items-center rounded-md font-medium transition-colors', {
  variants: {
    intent: {
      primary: 'bg-brand-500 text-white hover:bg-brand-900',
      ghost: 'bg-transparent text-brand-900 hover:bg-brand-50',
    },
    size: {
      sm: 'h-8 px-3 text-sm',
      lg: 'h-12 px-6 text-lg',
    },
  },
  defaultVariants: { intent: 'primary', size: 'sm' },
})

export const card = tv({
  base: 'rounded-lg border bg-white p-6',
  slots: {
    header: 'flex items-center justify-between gap-4 border-b pb-4',
    body: 'space-y-4 pt-4',
  },
})

const notAClassString = console.log('flex gap-2 px-4')
export { notAClassString }
