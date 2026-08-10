import { describe, expect, it } from 'vitest'
import { createBacklog } from './backlog'
import type { Declaration, ExplainedClass } from './types'

const explained = (text: string, overrides: Partial<ExplainedClass> = {}): ExplainedClass => ({
  candidate: { text, range: { start: 0, end: text.length }, index: 0 },
  valid: true,
  root: text,
  declarations: [{ prop: 'display', value: 'flex' }],
  prose: null,
  condition: null,
  group: 'other',
  variants: [],
  swatch: null,
  numericValue: null,
  modifier: null,
  arbitraryValue: null,
  ...overrides,
})

const scoped: Declaration[] = [
  { prop: 'border-top-width', value: '1px', selector: ':where(& > :not(:last-child))' },
]

describe('createBacklog', () => {
  it('records a class that compiled but has no plain-English entry', () => {
    const backlog = createBacklog()
    backlog.record([explained('divide-y')])

    expect(backlog.size()).toBe(1)
  })

  it('ignores a class that already has prose, since there is nothing to curate', () => {
    const backlog = createBacklog()
    backlog.record([explained('flex', { prose: 'lays children out in a row' })])

    expect(backlog.size()).toBe(0)
  })

  it('ignores a class Tailwind rejected, which is a typo rather than a gap', () => {
    const backlog = createBacklog()
    backlog.record([explained('nope-999', { valid: false, declarations: [] })])

    expect(backlog.size()).toBe(0)
  })

  it('ignores a class that only sets internal variables', () => {
    const backlog = createBacklog()
    backlog.record([explained('from-blue-500', { declarations: [] })])

    expect(backlog.size()).toBe(0)
  })

  it('counts a class seen twice only once', () => {
    const backlog = createBacklog()
    backlog.record([explained('divide-y')])
    backlog.record([explained('divide-y')])

    expect(backlog.size()).toBe(1)
  })

  it('forgets everything when cleared', () => {
    const backlog = createBacklog()
    backlog.record([explained('divide-y')])
    backlog.clear()

    expect(backlog.size()).toBe(0)
  })
})

describe('the backlog report', () => {
  it('says there is nothing to curate when nothing was recorded', () => {
    expect(createBacklog().report()).toContain('Nothing to curate')
  })

  it('groups candidates under the root an override entry would be keyed on', () => {
    const backlog = createBacklog()
    backlog.record([
      explained('divide-y', { root: 'divide-y', declarations: scoped }),
      explained('divide-y-2', { root: 'divide-y', declarations: scoped }),
    ])

    const report = backlog.report()
    expect(report).toContain('## divide-y')
    expect(report.match(/^## /gm)).toHaveLength(1)
  })

  it('lists the roots alphabetically so the report is stable between runs', () => {
    const backlog = createBacklog()
    backlog.record([explained('space-x-4', { root: 'space-x' }), explained('divide-y')])

    const roots = backlog.report().match(/^## .+$/gm)
    expect(roots).toEqual(['## divide-y', '## space-x'])
  })

  it('shows the raw CSS with the scope it is actually limited to', () => {
    const backlog = createBacklog()
    backlog.record([explained('divide-y', { declarations: scoped })])

    expect(backlog.report()).toContain(':where(& > :not(:last-child)) {')
    expect(backlog.report()).toContain('border-top-width: 1px')
  })

  it('reports how many classes are waiting', () => {
    const backlog = createBacklog()
    backlog.record([explained('divide-y'), explained('space-x-4', { root: 'space-x' })])

    expect(backlog.report()).toContain('2 classes')
  })

  it('files a class Tailwind could not name a root for under a heading of its own', () => {
    const backlog = createBacklog()
    backlog.record([explained('weird', { root: null })])

    expect(backlog.report()).toContain('## (no root)')
  })
})
