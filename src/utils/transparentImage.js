/** Cache URL → dataURL transparent */
const cache = new Map()

/**
 * Charge une image et rend son fond blanc transparent par flood-fill
 * depuis les 4 coins. Les blancs internes au symbole sont préservés.
 * @param {string} url
 * @param {number} tolerance  distance max en RGB pour considérer un pixel "fond"
 * @returns {Promise<string>}  dataURL avec fond transparent
 */
export async function makeTransparent(url, tolerance = 30) {
  if (!url) return url
  if (cache.has(url)) return cache.get(url)

  const dataUrl = await new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      const { width: W, height: H } = canvas
      const imageData = ctx.getImageData(0, 0, W, H)
      const d = imageData.data

      // Couleur de fond = pixel (0,0)
      const bgR = d[0], bgG = d[1], bgB = d[2]

      const visited = new Uint8Array(W * H)
      const queue   = []

      const isBackground = (r, g, b) =>
        Math.abs(r - bgR) <= tolerance &&
        Math.abs(g - bgG) <= tolerance &&
        Math.abs(b - bgB) <= tolerance

      // Amorce depuis les 4 coins
      const seed = (x, y) => {
        const idx = y * W + x
        if (visited[idx]) return
        const p = idx * 4
        if (isBackground(d[p], d[p + 1], d[p + 2])) queue.push(idx)
      }
      seed(0, 0); seed(W - 1, 0); seed(0, H - 1); seed(W - 1, H - 1)

      // BFS
      while (queue.length) {
        const idx = queue.pop()
        if (visited[idx]) continue
        visited[idx] = 1
        const p = idx * 4
        if (!isBackground(d[p], d[p + 1], d[p + 2])) continue
        d[p + 3] = 0  // transparent

        const x = idx % W, y = (idx / W) | 0
        if (x > 0)     queue.push(idx - 1)
        if (x < W - 1) queue.push(idx + 1)
        if (y > 0)     queue.push(idx - W)
        if (y < H - 1) queue.push(idx + W)
      }

      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(url)
    img.src = url
  })

  cache.set(url, dataUrl)
  return dataUrl
}
