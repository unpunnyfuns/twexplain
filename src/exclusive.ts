export type BreakpointPort = {
  theme: { namespace(prefix: string): Iterable<[string, string]> }
}

function breakpointNames(ds: BreakpointPort): Set<string> {
  const names = new Set<string>()
  for (const [name] of ds.theme.namespace('--breakpoint')) {
    if (name !== null && name !== '') names.add(name)
  }
  return names
}

export function conflictingVariants(
  present: string[],
  adding: string,
  ds: BreakpointPort,
): string[] {
  const breakpoints = breakpointNames(ds)
  if (!breakpoints.has(adding)) return []
  return present.filter((variant) => variant !== adding && breakpoints.has(variant))
}
