export function Plain() {
  return <div className="flex items-center gap-2 px-4 py-2">plain attribute</div>
}

export function Wrapped() {
  return (
    <article
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm
        hover:border-slate-300 hover:shadow-md
        focus-within:border-brand-500 focus-within:ring-2
        dark:border-slate-700 dark:bg-slate-900
        dark:hover:border-slate-600
        sm:p-8 md:p-10 lg:p-12
        grid grid-cols-1 gap-4
        md:grid-cols-2 lg:grid-cols-3
        motion-reduce:transition-none print:hidden
        transition-colors duration-200"
    >
      twelve lines, which the old eight-newline cap silently refused to read
    </article>
  )
}

export function Variants() {
  return (
    <button
      type="button"
      className="bg-brand-500 text-white hover:bg-brand-900 focus:outline-none active:scale-95 disabled:opacity-50 md:text-lg dark:bg-brand-900"
    >
      stacked and responsive variants
    </button>
  )
}

export function ArbitraryValues() {
  return (
    <div className="p-[13px] top-[1.5rem] grid-cols-[repeat(2,minmax(0,1fr))] bg-[#4f46e5] text-(--color-brand-500) [&>*]:mt-2">
      arbitrary values, an arbitrary variant, and a CSS-variable shorthand
    </div>
  )
}

export function Modifiers() {
  return <div className="bg-brand-500/50 text-black/80 ring-brand-500/25">opacity modifiers</div>
}

export function LowercaseClassAttribute() {
  return <div class="flex gap-2">React also accepts a lowercase class attribute</div>
}
