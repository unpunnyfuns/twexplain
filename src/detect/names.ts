export type ClassNames = {
  attributes?: string[]
  functions?: string[]
}

export const DEFAULT_ATTRIBUTES = ['class', 'className', 'ngClass', 'class:list']

export const DEFAULT_FUNCTIONS = ['cva', 'cn', 'clsx', 'classnames', 'cx', 'twMerge', 'tw', 'tv']

export function attributesFrom(names: ClassNames | undefined, extra: string[] = []): string[] {
  return [...new Set([...DEFAULT_ATTRIBUTES, ...extra, ...(names?.attributes ?? [])])]
}

export function functionsFrom(names: ClassNames | undefined): string[] {
  return [...new Set([...DEFAULT_FUNCTIONS, ...(names?.functions ?? [])])]
}
