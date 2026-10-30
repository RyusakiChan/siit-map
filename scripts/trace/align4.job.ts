import { alignment, fit } from './floor4'
// Least-squares affine over a grid of poster points mapped by the projective fit: the best the trace tool
// (affine only) can show of the same alignment.
export function main(): void {
  const pts: [number, number][] = []
  for (let x = 790; x <= 2330; x += 160) for (let y = 1030; y <= 2240; y += 130) pts.push([x, y])
  const rows = pts.map(([x, y]) => [x, y, 1])
  const solve = (target: number[]) => {
    const ata = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    const atb = [0, 0, 0]
    rows.forEach((r, i) => { for (let a = 0; a < 3; a++) { atb[a]! += r[a]! * target[i]!; for (let b = 0; b < 3; b++) ata[a]![b]! += r[a]! * r[b]! } })
    const M = ata.map((r, i) => [...r, atb[i]!])
    for (let c = 0; c < 3; c++) { for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r]![c]! / M[c]![c]!; for (let k = c; k < 4; k++) M[r]![k]! -= f * M[c]![k]! } }
    return M.map((r, i) => r[3]! / r[i]!)
  }
  const m = pts.map((p) => fit.to(p))
  const [a, c, e] = solve(m.map((q) => q[0]))
  const [b, d, f] = solve(m.map((q) => q[1]))
  const mat = [a, b, c, d, e, f]
  const err = pts.map((p, i) => Math.hypot(a! * p[0] + c! * p[1] + e! - m[i]![0], b! * p[0] + d! * p[1] + f! - m[i]![1]))
  console.log('max error m', Math.max(...err).toFixed(2), 'mean', (err.reduce((s, v) => s + v, 0) / err.length).toFixed(2), alignment.px.length)
  console.log('ALIGN', JSON.stringify(mat))
}
