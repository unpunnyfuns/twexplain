import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { type IconName, ICON_NAMES, Icon } from './Icon'

async function renderIcon(name: IconName): Promise<HTMLElement> {
  await render(<Icon name={name} />)
  const element = document.querySelector<HTMLElement>('span[aria-hidden="true"]')
  if (element === null) throw new Error('Icon rendered nothing')
  return element
}

describe('Icon renders a class the codicon font actually defines', () => {
  it.each(ICON_NAMES)('renders codicon-%s', async (name) => {
    const element = await renderIcon(name)

    expect(element.className).toBe(`codicon codicon-${name}`)
  })

  it('picks up the codicon font, so the glyph is not blank', async () => {
    const element = await renderIcon('add')

    expect(getComputedStyle(element).fontFamily).toContain('codicon')
  })

  it('takes its size from the surrounding text, not the vendor default of 16px', async () => {
    await render(
      <span style={{ fontSize: '11px' }}>
        <Icon name="add" />
      </span>,
    )
    const element = document.querySelector<HTMLElement>('span[aria-hidden="true"]')

    expect(getComputedStyle(element as HTMLElement).fontSize).toBe('11px')
  })
})
