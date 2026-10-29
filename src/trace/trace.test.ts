import { describe, expect, it } from 'vitest'
import { applyAffine, compose, invertAffine, rotateAbout, scaleAbout, solveAffine } from './affine'
import { nextNodeId, nextRoomId, qrIdProblem } from './ids'
import { snapPoint } from './snap'
import { addEdge, nearestEdge, planDoor, splitEdge } from './walk'
import type { BuildingData, Point } from '../data/types'

const near = (a: Point, b: Point, d = 1e-6) => expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(d)

describe('affine solve', () => {
  it('maps three points exactly, including scale, rotation and skew', () => {
    const from: [Point, Point, Point] = [[100, 80], [900, 120], [500, 700]]
    // a made-up skewed, rotated, scaled target
    const truth = [0.04, 0.007, -0.01, 0.045, -20, 5] as const
    const to = from.map((p) => applyAffine([...truth], p)) as [Point, Point, Point]
    const m = solveAffine(from, to)!
    expect(m).not.toBeNull()
    m.forEach((v, i) => expect(v).toBeCloseTo(truth[i]!, 9))
    from.forEach((p, i) => near(applyAffine(m, p), to[i]!))
    // a fourth point follows the same skew
    near(applyAffine(m, [300, 300]), applyAffine([...truth], [300, 300]))
  })

  it('rejects three points in a line and inverts back', () => {
    expect(solveAffine([[0, 0], [1, 1], [2, 2]], [[0, 0], [1, 0], [2, 0]])).toBeNull()
    const m = solveAffine([[0, 0], [10, 0], [0, 10]], [[5, 5], [25, 8], [3, 20]])!
    near(applyAffine(invertAffine(m)!, applyAffine(m, [4, 7])), [4, 7])
  })

  it('rotates and scales about a point', () => {
    near(applyAffine(rotateAbout(90, [1, 1]), [2, 1]), [1, 2])
    near(applyAffine(scaleAbout(2, [1, 1]), [2, 1]), [3, 1])
    near(applyAffine(compose(rotateAbout(90, [0, 0]), scaleAbout(2, [0, 0])), [1, 0]), [0, 2])
  })
})

describe('snapping', () => {
  const outline: Point[] = [[0, 0], [40, 0], [40, 20], [0, 20]]
  const room: Point[] = [[10, 5], [20, 5], [20, 12], [10, 12]]
  const ctx = { outline, rooms: [room], radius: 0.5 }

  it('snaps to corners first, then walls, for the outline and other rooms', () => {
    expect(snapPoint([20.2, 4.9], ctx)).toEqual({ point: [20, 5], kind: 'corner' })
    expect(snapPoint([0.2, 0.3], ctx)).toEqual({ point: [0, 0], kind: 'corner' })
    const wall = snapPoint([15, 12.3], ctx)
    expect(wall.kind).toBe('edge')
    near(wall.point, [15, 12])
    const out = snapPoint([25, 19.8], ctx)
    expect(out.kind).toBe('edge')
    near(out.point, [25, 20])
  })

  it('snaps to right angles from the last point, and Shift draws free', () => {
    const drawn: Point[] = [[25, 6]]
    const s = snapPoint([30.2, 6.3], { ...ctx, drawn })
    expect(s.kind).toBe('angle')
    near(s.point, [30.2, 6])
    expect(snapPoint([30.2, 6.3], { ...ctx, drawn, free: true }).kind).toBe('none')
    // after one edge, "across" means 90 degrees from that edge, even on a tilted wall
    const tilted: Point[] = [[25, 6], [27, 7]]
    const t = snapPoint([26.3, 9.2], { ...ctx, drawn: tilted })
    expect(t.kind).toBe('angle')
    const v: Point = [t.point[0] - 27, t.point[1] - 7]
    expect(v[0] * 2 + v[1] * 1).toBeCloseTo(0, 6)
  })

  it('leaves a point alone when nothing is close', () => {
    expect(snapPoint([30, 15], ctx)).toEqual({ point: [30, 15], kind: 'none' })
  })
})

describe('doors', () => {
  const room: Point[] = [[0, 0], [10, 0], [10, 6], [0, 6]]
  const corridor = [
    { id: 'f2-c1', floor: 2, position: [2, 7.5] as Point },
    { id: 'f2-c2', floor: 2, position: [8, 7.5] as Point },
    { id: 'far', floor: 2, position: [4, -3] as Point },
  ]

  it('puts the door 0.25 m outside the clicked wall and links the nearest reachable corridor node', () => {
    const plan = planDoor(room, [7.6, 6.2], corridor, [])!
    near(plan.position, [7.6, 6.25])
    expect(plan.linkTo).toBe('f2-c2')
    const top = planDoor(room, [4, -0.3], corridor, [])!
    near(top.position, [4, -0.25])
    expect(top.linkTo).toBe('far')
  })

  it('skips corridor nodes that would need a path through a room', () => {
    const wall: Point[] = [[-1, 6.6], [11, 6.6], [11, 7], [-1, 7]]
    const plan = planDoor(room, [7.6, 6.2], corridor, [wall])!
    expect(plan.linkTo).not.toBe('f2-c2')
    expect(planDoor(room, [7.6, 6.2], [], [])!.linkTo).toBeNull()
  })

  it('splits an edge for a new node and does not add the same edge twice', () => {
    const nodes = [{ id: 'a', floor: 1, position: [0, 0] as Point }, { id: 'b', floor: 1, position: [10, 0] as Point }]
    const edges = [{ a: 'a', b: 'b' }]
    const hit = nearestEdge([5, 0.3], nodes, edges, 0.5)!
    near(hit.point, [5, 0])
    expect(nearestEdge([5, 3], nodes, edges, 0.5)).toBeNull()
    expect(splitEdge(edges, hit.edge, 'm')).toEqual([{ a: 'a', b: 'm' }, { a: 'm', b: 'b' }])
    expect(addEdge(edges, 'b', 'a')).toBe(edges)
    expect(addEdge(edges, 'a', 'c')).toHaveLength(2)
  })
})

describe('ids', () => {
  const data = {
    rooms: [{ id: 'r-f2-1' }, { id: 'r-f2-3' }, { id: 'r-f3-1' }],
    qrPoints: [{ id: 'sample-qr' }],
    amenities: [],
    usedIds: ['r-f2-7', 'qr-lobby'],
    walkways: { nodes: [{ id: 'f2-c4' }, { id: 'f2-d2' }], edges: [], connectors: [{ id: 'lift-1' }] },
  } as unknown as BuildingData

  it('never reuses a room id, even a deleted one', () => {
    expect(nextRoomId(data, 2)).toBe('r-f2-8')
    expect(nextRoomId(data, 4)).toBe('r-f4-1')
    expect(nextRoomId({ ...data, usedIds: [...data.usedIds!, 'r-f2-8'] }, 2)).toBe('r-f2-9')
  })

  it('numbers corridor and door nodes separately', () => {
    expect(nextNodeId(data, 2, 'c')).toBe('f2-c5')
    expect(nextNodeId(data, 2, 'd')).toBe('f2-d3')
  })

  it('refuses a QR id that exists anywhere, including retired ids', () => {
    expect(qrIdProblem('', data)).toBeTruthy()
    expect(qrIdProblem('Bad Id', data)).toBeTruthy()
    expect(qrIdProblem('sample-qr', data)).toMatch(/already/)
    expect(qrIdProblem('qr-lobby', data)).toMatch(/retired/)
    expect(qrIdProblem('r-f2-1', data)).toMatch(/room/)
    expect(qrIdProblem('qr-room-201', data)).toBeNull()
    expect(qrIdProblem('sample-qr', data, 'sample-qr')).toBeNull()
  })
})
