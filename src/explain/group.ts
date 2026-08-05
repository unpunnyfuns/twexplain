import type { Declaration, ExplainGroup, ExplainedClass, GroupName } from '../types'

const GROUP_ORDER: GroupName[] = [
  'layout',
  'spacing',
  'typography',
  'color',
  'border',
  'effects',
  'state',
  'other',
]

const PREFIX_GROUPS: [RegExp, GroupName][] = [
  [/^(display|position|top|right|bottom|left|inset|z-index|float|clear|flex|grid|align|justify|place|order|overflow(?!-wrap)|visibility)/, 'layout'],
  [/^(padding|margin|gap|row-gap|column-gap|width|height|min-|max-|space)/, 'spacing'],
  [/^(font|line-height|letter-spacing|text|white-space|word|overflow-wrap|list-style|vertical-align)/, 'typography'],
  [/^(color|background|fill|stroke|accent|caret)/, 'color'],
  [/^(border|outline|ring|divide)/, 'border'],
  [/^(box-shadow|opacity|filter|backdrop|mix-blend|transform|transition|animation|clip|mask)/, 'effects'],
]

export function groupFor(declarations: Declaration[], variants: string[]): GroupName {
  if (variants.length > 0) return 'state'

  const votes = new Map<GroupName, number>()
  const firstIndex = new Map<GroupName, number>()

  for (const [i, declaration] of declarations.entries()) {
    for (const [pattern, group] of PREFIX_GROUPS) {
      if (pattern.test(declaration.prop)) {
        if (!votes.has(group)) {
          firstIndex.set(group, i)
        }
        votes.set(group, (votes.get(group) ?? 0) + 1)
        break
      }
    }
  }

  if (votes.size === 0) return 'other'

  let maxVotes = 0
  for (const count of votes.values()) {
    if (count > maxVotes) maxVotes = count
  }

  let winningGroup: GroupName | null = null
  let earliestIndex = Infinity

  for (const [group, count] of votes) {
    if (count === maxVotes) {
      const index = firstIndex.get(group) ?? Infinity
      if (index < earliestIndex) {
        earliestIndex = index
        winningGroup = group
      }
    }
  }

  return winningGroup ?? 'other'
}

export function groupAll(classes: ExplainedClass[]): ExplainGroup[] {
  return GROUP_ORDER.map((name) => ({
    name,
    classes: classes.filter((c) => c.group === name),
  })).filter((group) => group.classes.length > 0)
}
