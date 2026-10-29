import { describe, expect, it } from 'vitest'
import { readReply } from './api'

describe('readReply', () => {
  it('reads a reply with actions and drops unknown or unsafe ones', () => {
    const out = readReply({
      reply: 'Hi',
      actions: [
        { type: 'show_room', roomId: 'a' },
        { type: 'show_route', fromId: null, toId: 'b' },
        { type: 'source', url: 'javascript:alert(1)' },
        { type: 'source', url: 'https://www.siit.tu.ac.th/' },
        { type: 'launch_rocket' },
        null,
      ],
    })
    expect(out?.actions).toEqual([
      { type: 'show_room', roomId: 'a' },
      { type: 'show_route', fromId: null, toId: 'b' },
      { type: 'source', url: 'https://www.siit.tu.ac.th/' },
    ])
  })

  it('rejects a body without a reply', () => {
    expect(readReply({})).toBeNull()
    expect(readReply({ reply: '' })).toBeNull()
    expect(readReply('x')).toBeNull()
  })
})
