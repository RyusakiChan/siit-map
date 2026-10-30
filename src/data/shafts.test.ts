import { describe, expect, it } from 'vitest'
import { buildingData as data } from './index'

describe('real floors 2, 3 and 4', () => {
  const real = [2, 3, 4]

  it('put every stair core and lift at the same x,z on each real floor it serves', () => {
    for (const c of data.walkways.connectors) {
      const rooms = real.flatMap((f) => {
        const node = c.nodes[String(f)]
        const room = node ? data.rooms.find((r) => r.floor === f && r.door === node) : undefined
        return room ? [room] : []
      })
      for (const r of rooms) expect(r.polygon, `${c.id} on floor ${r.floor}`).toEqual(rooms[0]!.polygon)
    }
  })

  it('gives the lower-floor shafts a connector on all three floors, new cores included', () => {
    const s = data.walkways.connectors.find((c) => c.id === 'stairs-s')
    expect(Object.keys(s?.nodes ?? {}).sort()).toEqual(['2', '3', '4'])
  })

  it('keeps floor-2 divisions out of the departments and shares the BCET/MSME office', () => {
    for (const n of ['1-210', '1-211', '1-212', '1-213']) {
      const r = data.rooms.find((x) => x.floor === 2 && x.number === n)!
      expect(r.departmentId, n).toBeNull()
      expect(r.departmentIds, n).toBeUndefined()
    }
    const shared = data.rooms.find((r) => r.floor === 4 && r.number === '1-414')!
    expect(shared.departmentIds).toEqual(['d-bcet', 'd-msme'])
    expect(data.rooms.find((r) => r.floor === 4 && r.number === '1-413')!.departmentId).toBe('d-bcet')
    expect(data.rooms.find((r) => r.floor === 4 && r.number === '1-415')!.departmentId).toBe('d-msme')
  })

  it('gives floors 3 and 4 the same atrium and floor 2 none', () => {
    const v = (l: number) => data.floors.find((f) => f.level === l)!.voids
    expect(v(4)).toEqual(v(3))
    expect(v(2)).toBeUndefined()
  })
})
