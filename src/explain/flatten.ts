export type ResolveTheme = (key: string) => string | null

export const INITIAL_ROOT_FONT_SIZE_PX = 16
const VAR_PATTERN = /var\((--[\w-]+)(?:,([^()]*))?\)/g
const CALC_PATTERN = /calc\(([^()]*)\)/
const DIMENSION = /^(-?[\d.]+)([a-z%]*)$/
const FRACTION = /^(-?[\d.]+)\/(-?[\d.]+)$/

function evaluateFraction(token: string): string {
  const match = FRACTION.exec(token)
  if (!match) return token
  const numerator = Number.parseFloat(match[1] as string)
  const denominator = Number.parseFloat(match[2] as string)
  if (denominator === 0) return token
  return String(numerator / denominator)
}

function combineDimensions(left: string, operator: string, right: string): string | null {
  const leftMatch = DIMENSION.exec(left)
  const rightMatch = DIMENSION.exec(right)
  if (!leftMatch || !rightMatch) return null

  const leftUnit = leftMatch[2] as string
  const rightUnit = rightMatch[2] as string
  if (leftUnit && rightUnit && leftUnit !== rightUnit) return null

  const a = Number.parseFloat(leftMatch[1] as string)
  const b = Number.parseFloat(rightMatch[1] as string)

  let result: number
  if (operator === '*') result = a * b
  else if (operator === '/') result = b === 0 ? Number.NaN : a / b
  else if (operator === '+') result = a + b
  else if (operator === '-') result = a - b
  else return null
  if (Number.isNaN(result)) return null

  return `${Number.parseFloat(result.toFixed(6))}${leftUnit || rightUnit}`
}

function evaluateExpression(expression: string): string | null {
  const tokens = expression.trim().split(/\s+/).map(evaluateFraction)
  if (tokens.length === 1) return tokens[0] as string
  if (tokens.length < 3 || tokens.length % 2 === 0) return null

  const operators: string[] = []
  for (let i = 1; i < tokens.length; i += 2) operators.push(tokens[i] as string)

  const isMultiplicativeChain = operators.every((op) => op === '*' || op === '/')
  if (tokens.length > 3 && !isMultiplicativeChain) return null

  let accumulator = tokens[0] as string
  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i] as string
    const operand = tokens[i + 1] as string
    const next = combineDimensions(accumulator, operator, operand)
    if (next === null) return null
    accumulator = next
  }
  return accumulator
}

function evaluateCalc(value: string): string {
  let current = value
  for (let guard = 0; guard < 20; guard++) {
    const match = CALC_PATTERN.exec(current)
    if (!match) return current
    const evaluated = evaluateExpression(match[1] as string)
    if (evaluated === null) return current
    current =
      current.slice(0, match.index) + evaluated + current.slice(match.index + match[0].length)
  }
  return current
}

export function flattenValue(value: string, resolve: ResolveTheme): string {
  let current = value
  for (let guard = 0; guard < 10; guard++) {
    const substituted = current.replace(VAR_PATTERN, (whole, name: string, fallback?: string) => {
      const resolved = resolve(name)
      if (resolved !== null) return resolved
      if (fallback !== undefined) {
        const trimmed = fallback.trim()
        if (name.startsWith('--tw-') && trimmed === '') return whole
        return trimmed
      }
      return whole
    })
    const next = evaluateCalc(substituted)
    if (next === current) return current
    current = next
  }
  return current
}

const QUOTED_OR_URL = /("[^"]*"|'[^']*'|url\([^)]*\))/g
const REM_LENGTH = /(-?[\d.]+)rem\b/g

function convertRem(value: string, rootFontSize: number): string {
  return value.replace(
    REM_LENGTH,
    (_, n: string) => `${Number.parseFloat((Number.parseFloat(n) * rootFontSize).toFixed(4))}px`,
  )
}

export function remToPx(value: string, rootFontSize = INITIAL_ROOT_FONT_SIZE_PX): string {
  const size =
    Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : INITIAL_ROOT_FONT_SIZE_PX

  return value
    .split(QUOTED_OR_URL)
    .map((part, index) => (index % 2 === 1 ? part : convertRem(part, size)))
    .join('')
}
