// Checks the production posters: npm run qr-poster:check (after npm run qr-poster).
// Renders print/qr-posters.html in Chrome, decodes every QR code from a 150 dpi raster of its page and asserts it is
// exactly that poster's #/at/<id> link, then writes print/qr-posters.pdf and PNG previews (colour and greyscale).
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const htmlPath = join(root, 'print/qr-posters.html')
const preview = (process.env.PREVIEW ?? 'f2-lift,f2-stairs-e').split(',')
const jsqr = readFileSync(join(root, 'node_modules/jsqr/dist/jsQR.js'), 'utf8')

const browser = await chromium.launch({ channel: 'chrome' })
// 150 dpi: A4 is 210 mm = 794 CSS px at 96 dpi; scale 1.5625 gives 1240 px across.
const page = await browser.newPage({ viewport: { width: 860, height: 1200 }, deviceScaleFactor: 1.5625 })
await page.goto(pathToFileURL(htmlPath).href)
await page.waitForFunction(() => document.documentElement.dataset.ready === '1')
await page.addStyleTag({ content: 'body{background:#fff!important}.page{margin:0 auto!important;box-shadow:none!important}' })

const decoder = await browser.newPage()
await decoder.addScriptTag({ content: jsqr })

const posters = await page.$$('.page')
let bad = 0
for (const el of posters) {
  const { id, url } = await el.evaluate((n) => ({ id: n.dataset.id, url: n.dataset.url }))
  const png = await el.screenshot({ type: 'png' })
  const got = await decoder.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const px = ctx.getImageData(0, 0, c.width, c.height)
    return globalThis.jsQR(px.data, px.width, px.height)?.data ?? null
  }, png.toString('base64'))
  const ok = got === url
  if (!ok) bad++
  console.log(`${ok ? 'ok ' : 'BAD'} ${id}${ok ? '' : `  got ${got}`}`)
  if (preview.includes(id)) {
    await el.screenshot({ path: join(root, `print/poster-${id}.png`) })
    await page.addStyleTag({ content: '.poster{filter:grayscale(1)}' })
    await el.screenshot({ path: join(root, `print/poster-${id}-grey.png`) })
    await page.addStyleTag({ content: '.poster{filter:none}' })
  }
}

await page.emulateMedia({ media: 'print' })
await page.pdf({ path: join(root, 'print/qr-posters.pdf'), preferCSSPageSize: true, printBackground: true })
await browser.close()
console.log(`${posters.length - bad}/${posters.length} QR codes decode to their own link; print/qr-posters.pdf written`)
if (bad || posters.length === 0) process.exit(1)
