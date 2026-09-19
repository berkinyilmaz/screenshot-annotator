// Canvas drawing helpers. All annotation coordinates live in image pixels.

export const COLORS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#facc15', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#ffffff', label: 'White' },
  { value: '#111827', label: 'Black' },
]

export const SIZES = [
  { id: 's', label: 'S', name: 'Small' },
  { id: 'm', label: 'M', name: 'Medium' },
  { id: 'l', label: 'L', name: 'Large' },
]

const STROKE = { s: 3, m: 5, l: 8 }
const FONT = { s: 22, m: 30, l: 44 }
const BLUR = { s: 8, m: 14, l: 22 }
const SELECTION = '#6366f1'
const FONT_STACK = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

// Scale strokes & text with the screenshot so a 4K capture doesn't get hairlines.
export const getUnit = (w, h) => Math.max(1, Math.max(w, h) / 1400)

export const fontSizeFor = (size, unit) => Math.round(FONT[size] * unit)
const fontFor = (size, unit) => `600 ${fontSizeFor(size, unit)}px ${FONT_STACK}`

export function normRect(a) {
  return {
    x: Math.min(a.x, a.x + a.w),
    y: Math.min(a.y, a.y + a.h),
    w: Math.abs(a.w),
    h: Math.abs(a.h),
  }
}

function isLight(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
}

function softShadow(ctx, unit) {
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)'
  ctx.shadowBlur = 6 * unit
  ctx.shadowOffsetY = 1.5 * unit
}

function drawArrow(ctx, a, unit) {
  const lw = STROKE[a.size] * unit
  const dx = a.x2 - a.x1
  const dy = a.y2 - a.y1
  const len = Math.hypot(dx, dy)
  if (len < 1) return
  const ang = Math.atan2(dy, dx)
  const head = Math.min(len * 0.6, Math.max(lw * 3.4, 16 * unit))
  const spread = Math.PI / 7

  ctx.save()
  softShadow(ctx, unit)
  ctx.strokeStyle = a.color
  ctx.fillStyle = a.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.moveTo(a.x1, a.y1)
  ctx.lineTo(a.x2 - Math.cos(ang) * head * 0.7, a.y2 - Math.sin(ang) * head * 0.7)
  ctx.lineWidth = lw
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(a.x2, a.y2)
  ctx.lineTo(a.x2 - head * Math.cos(ang - spread), a.y2 - head * Math.sin(ang - spread))
  ctx.lineTo(a.x2 - head * Math.cos(ang + spread), a.y2 - head * Math.sin(ang + spread))
  ctx.closePath()
  ctx.lineWidth = lw * 0.5
  ctx.stroke()
  ctx.fill()
  ctx.restore()
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2))
  else ctx.rect(x, y, w, h)
}

function drawBox(ctx, a, unit) {
  const { x, y, w, h } = normRect(a)
  if (w < 1 || h < 1) return
  ctx.save()
  softShadow(ctx, unit)
  ctx.strokeStyle = a.color
  ctx.lineWidth = STROKE[a.size] * unit
  ctx.lineJoin = 'round'
  roundRectPath(ctx, x, y, w, h, 8 * unit)
  ctx.stroke()
  ctx.restore()
}

function drawHighlight(ctx, a, unit) {
  const { x, y, w, h } = normRect(a)
  if (w < 1 || h < 1) return
  ctx.save()
  ctx.globalAlpha = 0.36
  ctx.fillStyle = a.color
  roundRectPath(ctx, x, y, w, h, 4 * unit)
  ctx.fill()
  ctx.restore()
}

let blurCanvas = null

// Downsample the region already on the canvas, then scale it back up smoothly.
// Works everywhere (no ctx.filter needed) and destroys the underlying detail.
function drawBlur(ctx, a, unit) {
  const cw = ctx.canvas.width
  const ch = ctx.canvas.height
  const r = normRect(a)
  const x = Math.max(0, Math.floor(r.x))
  const y = Math.max(0, Math.floor(r.y))
  const w = Math.min(cw - x, Math.ceil(r.w))
  const h = Math.min(ch - y, Math.ceil(r.h))
  if (w < 2 || h < 2) return

  const block = BLUR[a.size] * unit
  const sw = Math.max(1, Math.round(w / block))
  const sh = Math.max(1, Math.round(h / block))
  if (!blurCanvas) blurCanvas = document.createElement('canvas')
  blurCanvas.width = sw
  blurCanvas.height = sh
  const b = blurCanvas.getContext('2d')
  b.imageSmoothingEnabled = true
  b.imageSmoothingQuality = 'high'
  b.drawImage(ctx.canvas, x, y, w, h, 0, 0, sw, sh)

  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(blurCanvas, 0, 0, sw, sh, x, y, w, h)
  ctx.restore()
}

function drawText(ctx, a, unit) {
  const fs = fontSizeFor(a.size, unit)
  ctx.save()
  ctx.font = fontFor(a.size, unit)
  ctx.textBaseline = 'top'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = isLight(a.color) ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.92)'
  ctx.lineWidth = fs * 0.18
  ctx.strokeText(a.text, a.x, a.y)
  ctx.fillStyle = a.color
  ctx.fillText(a.text, a.x, a.y)
  ctx.restore()
}

export function drawAnnotation(ctx, a, unit) {
  switch (a.type) {
    case 'arrow': return drawArrow(ctx, a, unit)
    case 'box': return drawBox(ctx, a, unit)
    case 'highlight': return drawHighlight(ctx, a, unit)
    case 'blur': return drawBlur(ctx, a, unit)
    case 'text': return drawText(ctx, a, unit)
  }
}

export function getBounds(ctx, a, unit) {
  if (a.type === 'arrow') {
    const pad = STROKE[a.size] * unit * 2
    const x = Math.min(a.x1, a.x2) - pad
    const y = Math.min(a.y1, a.y2) - pad
    return { x, y, w: Math.abs(a.x2 - a.x1) + pad * 2, h: Math.abs(a.y2 - a.y1) + pad * 2 }
  }
  if (a.type === 'text') {
    ctx.save()
    ctx.font = fontFor(a.size, unit)
    const w = ctx.measureText(a.text).width
    ctx.restore()
    return { x: a.x, y: a.y, w, h: fontSizeFor(a.size, unit) * 1.2 }
  }
  return normRect(a)
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export function hitTest(ctx, a, px, py, unit) {
  const tol = 10 * unit
  if (a.type === 'arrow') {
    return distToSegment(px, py, a.x1, a.y1, a.x2, a.y2) <= Math.max(tol, STROKE[a.size] * unit * 2)
  }
  const b = getBounds(ctx, a, unit)
  if (a.type === 'box') {
    // Boxes are hollow — only grab them near the stroke so you can reach what's inside.
    const inOuter = px >= b.x - tol && px <= b.x + b.w + tol && py >= b.y - tol && py <= b.y + b.h + tol
    const inInner = px > b.x + tol && px < b.x + b.w - tol && py > b.y + tol && py < b.y + b.h - tol
    return inOuter && !inInner
  }
  return px >= b.x - tol / 2 && px <= b.x + b.w + tol / 2 && py >= b.y - tol / 2 && py <= b.y + b.h + tol / 2
}

export function translate(a, dx, dy) {
  if (a.type === 'arrow') return { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy }
  return { ...a, x: a.x + dx, y: a.y + dy }
}

function drawSelection(ctx, a, unit) {
  const b = getBounds(ctx, a, unit)
  const pad = 6 * unit
  ctx.save()
  ctx.strokeStyle = SELECTION
  ctx.lineWidth = 1.5 * unit
  ctx.setLineDash([6 * unit, 4 * unit])
  roundRectPath(ctx, b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, 6 * unit)
  ctx.stroke()
  ctx.restore()
}

export function renderScene(canvas, img, annotations, { selectedId = null, hiddenId = null, draft = null } = {}) {
  const ctx = canvas.getContext('2d')
  const unit = getUnit(canvas.width, canvas.height)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const list = draft ? [...annotations, draft] : annotations
  for (const a of list) {
    if (a.id !== hiddenId) drawAnnotation(ctx, a, unit)
  }
  const selected = selectedId && annotations.find((a) => a.id === selectedId)
  if (selected) drawSelection(ctx, selected, unit)
}

// ─── Demo screenshot ──────────────────────────────────────────────
const DEMO_FONT = "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif"

export function createDemoImage() {
  const c = document.createElement('canvas')
  c.width = 1440
  c.height = 900
  const ctx = c.getContext('2d')
  const font = (w, s) => `${w} ${s}px ${DEMO_FONT}`

  ctx.fillStyle = '#e9ebf0'
  ctx.fillRect(0, 0, 1440, 900)

  // Window
  ctx.save()
  ctx.shadowColor = 'rgba(15, 23, 42, 0.18)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 12
  ctx.fillStyle = '#ffffff'
  roundRectPath(ctx, 40, 40, 1360, 820, 16)
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundRectPath(ctx, 40, 40, 1360, 820, 16)
  ctx.clip()
  ctx.fillStyle = '#f6f7f9'
  ctx.fillRect(40, 40, 1360, 52)
  ctx.fillStyle = '#fafafb'
  ctx.fillRect(40, 92, 260, 768)
  ctx.restore()
  ctx.fillStyle = '#e5e7eb'
  ctx.fillRect(40, 91, 1360, 1)
  ctx.fillRect(300, 92, 1, 768)

  ;['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(70 + i * 22, 66, 7, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.fillStyle = '#6b7280'
  ctx.font = font(500, 15)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Acme Cloud — Settings', 720, 66)
  ctx.textAlign = 'left'

  // Sidebar
  ;['Overview', 'Projects', 'Billing', 'Team', 'Settings'].forEach((label, i) => {
    const y = 124 + i * 46
    const active = label === 'Settings'
    if (active) {
      ctx.fillStyle = '#eef2ff'
      roundRectPath(ctx, 56, y, 228, 36, 8)
      ctx.fill()
    }
    ctx.fillStyle = active ? '#4f46e5' : '#4b5563'
    ctx.font = font(active ? 600 : 500, 15)
    ctx.fillText(label, 76, y + 18)
  })

  // Heading
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#111827'
  ctx.font = font(700, 30)
  ctx.fillText('Account settings', 340, 124)
  ctx.fillStyle = '#6b7280'
  ctx.font = font(400, 16)
  ctx.fillText('Manage your profile, security and API access.', 340, 166)

  // Card
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  roundRectPath(ctx, 340.5, 214.5, 1020, 404, 14)
  ctx.stroke()

  const rows = [
    ['Full name', 'Jane Cooper'],
    ['Email address', 'jane.cooper@acme.io'],
    ['Secret API key', 'sk_live_51Hf9a2Kd8QxT0pLm3VzR7'],
    ['Plan', 'Pro · renews Oct 12, 2026'],
  ]
  rows.forEach(([label, value], i) => {
    const y = 238 + i * 92
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#6b7280'
    ctx.font = font(600, 13)
    ctx.fillText(label.toUpperCase(), 364, y)
    ctx.fillStyle = '#f9fafb'
    roundRectPath(ctx, 364, y + 24, 972, 46, 10)
    ctx.fill()
    ctx.strokeStyle = '#e5e7eb'
    roundRectPath(ctx, 364.5, y + 24.5, 972, 46, 10)
    ctx.stroke()
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#111827'
    ctx.font = i === 2 ? font(500, 16).replace(DEMO_FONT, "'SF Mono', Menlo, monospace") : font(500, 16)
    ctx.fillText(value, 382, y + 47)
  })

  // Buttons
  ctx.strokeStyle = '#d1d5db'
  roundRectPath(ctx, 1040.5, 660.5, 140, 46, 10)
  ctx.stroke()
  ctx.fillStyle = '#374151'
  ctx.font = font(600, 15)
  ctx.textAlign = 'center'
  ctx.fillText('Cancel', 1110, 684)
  ctx.fillStyle = '#4f46e5'
  roundRectPath(ctx, 1196, 660, 164, 46, 10)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Save changes', 1278, 684)
  ctx.textAlign = 'left'

  return c.toDataURL('image/png')
}

export const DEMO_ANNOTATIONS = [
  { id: 'demo-hl', type: 'highlight', x: 364, y: 354, w: 250, h: 46, color: '#facc15', size: 'm' },
  { id: 'demo-blur', type: 'blur', x: 372, y: 450, w: 390, h: 38, color: '#ef4444', size: 'm' },
  { id: 'demo-box', type: 'box', x: 1184, y: 648, w: 188, h: 70, color: '#ef4444', size: 'm' },
  { id: 'demo-arrow', type: 'arrow', x1: 1010, y1: 800, x2: 1176, y2: 714, color: '#ef4444', size: 'm' },
  { id: 'demo-text', type: 'text', x: 772, y: 782, text: 'Click to save', color: '#ef4444', size: 'm' },
]
