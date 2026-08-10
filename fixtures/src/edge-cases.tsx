export function Invalid() {
  return <div className="flex nope-999 definitely-not-a-class px-4">two struck-through classes</div>
}

export function ChildScoped() {
  return (
    <ul className="divide-y divide-red-500 space-y-2">
      the divide colour lands on the children, and the panel says so rather than implying a border
      on this element
    </ul>
  )
}

export function InternalVariablesOnly() {
  return (
    <div className="from-brand-500 via-purple-500 to-pink-500 ring-inset ring-offset-2 space-x-reverse">
      these set only Tailwind-internal variables
    </div>
  )
}

export function Negated() {
  return (
    <div className="shadow-none ring-0 border-none filter-none transform-none animate-none blur-none transition-none">
      every one of these is described as the removal it is, never as the positive effect
    </div>
  )
}

export function Opaque() {
  return (
    <div className="shadow-lg inset-shadow-sm ring-2 blur-sm backdrop-blur transition scale-95 translate-x-2">
      compiles to --tw-* machinery, so the prose is curated rather than derived
    </div>
  )
}

export function ColourOnlyRoots() {
  return (
    <div className="shadow-brand-500 ring-brand-500 ring-offset-white">
      these set a colour on a root whose prose describes the whole effect, so the panel declines to
      describe them rather than lending them the wrong sentence
    </div>
  )
}

export function ClassStrategyDark() {
  return (
    <div className="dark:bg-slate-900 dark:text-slate-50 dark:hover:bg-slate-800">
      app.css declares the class strategy, so these compile to a selector rather than a media query
    </div>
  )
}

export function Container() {
  return <div className="container mx-auto">five conditional max-widths</div>
}

export function Steppable() {
  return <div className="p-4 gap-2 mt-8 w-1/2 text-2xl rounded-md border-2">steppers</div>
}

export function Sortable() {
  return <div className="text-white p-4 flex bg-brand-500 my-widget items-center">unsorted</div>
}
