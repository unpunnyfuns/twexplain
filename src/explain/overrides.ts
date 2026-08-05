const OVERRIDES: Record<string, string> = {
  'sr-only': 'visually hidden, but still announced by screen readers',
  'not-sr-only': 'undoes sr-only, making the element visible again',
  truncate: 'one line, cut off with an ellipsis',
  antialiased: 'smoother font rendering',
  isolate: 'creates a new stacking context',
  shadow: 'drop shadow',
  'inset-shadow': 'inner drop shadow',
  ring: 'outline ring drawn outside the border',
  'space-x': 'horizontal gap between children, except the last',
  'space-y': 'vertical gap between children, except the last',
  divide: 'dividing lines drawn between children',
  animate: 'runs a named animation',
  transform: 'applies a geometric transform',
  filter: 'applies a visual filter',
  'backdrop-filter': 'applies a filter to what is behind the element',
}

export function overrideFor(root: string): string | null {
  return OVERRIDES[root] ?? null
}
