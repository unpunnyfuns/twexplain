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
  [/^(display|position|top|right|bottom|left|inset|z-index|float|clear|flex|grid|align|justify|place|order|overflow|visibility)/, 'layout'],
  [/^(padding|margin|gap|row-gap|column-gap|width|height|min-|max-|space)/, 'spacing'],
  [/^(font|line-height|letter-spacing|text|white-space|word|list-style|vertical-align)/, 'typography'],
  [/^(color|background|fill|stroke|accent|caret)/, 'color'],
  [/^(border|outline|ring|divide)/, 'border'],
  [/^(box-shadow|opacity|filter|backdrop|mix-blend|transform|transition|animation|clip|mask)/, 'effects'],
]

export function groupFor(declarations: Declaration[], variants: string[]): GroupName {
  if (variants.length > 0) return 'state'
  for (const declaration of declarations) {
    for (const [pattern, group] of PREFIX_GROUPS) {
      if (pattern.test(declaration.prop)) return group
    }
  }
  return 'other'
}

export function groupAll(classes: ExplainedClass[]): ExplainGroup[] {
  return GROUP_ORDER.map((name) => ({
    name,
    classes: classes.filter((c) => c.group === name),
  })).filter((group) => group.classes.length > 0)
}
