import { useCallback, useEffect, useRef, useState } from 'react'
import {
  COLORS,
  SIZES,
  DEMO_ANNOTATIONS,
  createDemoImage,
  fontSizeFor,
  getUnit,
  hitTest,
  normRect,
  renderScene,
  translate,
} from './draw.js'
import './styles.css'

// ─── Icons (thin-line, inline) ─────────────────────────────────────
const Svg = ({ children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
const IconSelect = () => <Svg><path d="M5 3l14 8-6.5 1.5L9 19z" /></Svg>
const IconArrow = () => <Svg><path d="M5 19L19 5" /><path d="M9 5h10v10" /></Svg>
const IconBox = () => <Svg><rect x="4" y="5" width="16" height="14" rx="2.5" /></Svg>
const IconHighlight = () => <Svg><path d="M9 11l-5 5v3h3l5-5" /><path d="M14.5 4.5l5 5L12 17l-5-5z" /></Svg>
const IconText = () => <Svg><path d="M5 6V5h14v1" /><path d="M12 5v14" /><path d="M9.5 19h5" /></Svg>
const IconBlur = () => (
  <Svg>
    <circle cx="6" cy="6" r="1" /><circle cx="12" cy="6" r="1" /><circle cx="18" cy="6" r="1" />
    <circle cx="6" cy="12" r="1" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="12" r="1" />
    <circle cx="6" cy="18" r="1" /><circle cx="12" cy="18" r="1" /><circle cx="18" cy="18" r="1" />
  </Svg>
)
const IconUndo = () => <Svg><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></Svg>
const IconRedo = () => <Svg><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 000 11H13" /></Svg>
const IconTrash = () => <Svg><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" /><path d="M9 7V4h6v3" /></Svg>
const IconClear = () => <Svg><path d="M3 12a9 9 0 1015.5-6.2" /><path d="M19 3v4h-4" /></Svg>
const IconDownload = () => <Svg size={14}><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" /></Svg>
const IconCopy = () => <Svg size={14}><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></Svg>
const IconImage = () => <Svg size={14}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-9 9" /></Svg>
const IconUpload = () => <Svg size={26}><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></Svg>

const TOOLS = [
  { id: 'select', label: 'Select', key: 'V', Icon: IconSelect },
  { id: 'arrow', label: 'Arrow', key: 'A', Icon: IconArrow },
  { id: 'box', label: 'Box', key: 'R', Icon: IconBox },
  { id: 'highlight', label: 'Highlight', key: 'H', Icon: IconHighlight },
  { id: 'text', label: 'Text', key: 'T', Icon: IconText },
  { id: 'blur', label: 'Blur', key: 'B', Icon: IconBlur },
]
const TOOL_BY_KEY = Object.fromEntries(TOOLS.map((t) => [t.key.toLowerCase(), t.id]))

const HISTORY_LIMIT = 100
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl+'

let idCounter = 0
const uid = () => `a${Date.now().toString(36)}${(idCounter++).toString(36)}`

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function App() {
  const [image, setImage] = useState(null) // { img, name, width, height, url }
  const [annotations, setAnnotations] = useState([])
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const [tool, setTool] = useState('arrow')
  const [color, setColor] = useState(COLORS[0].value)
  const [size, setSize] = useState('m')
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [editing, setEditing] = useState(null) // { id|null, x, y, text, color, size }
  const [scale, setScale] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [toast, setToast] = useState(null)
  const [fontTick, setFontTick] = useState(0)

  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const annotationsRef = useRef(annotations)
  const draftRef = useRef(null)
  const dragRef = useRef(null)
  const editingRef = useRef(null)
  const wasEditingRef = useRef(false)
  const toastTimer = useRef(null)

  annotationsRef.current = annotations

  const showToast = useCallback((text, kind = 'ok') => {
    clearTimeout(toastTimer.current)
    setToast({ text, kind })
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }, [])

  // ─── History ───────────────────────────────────────────────
  const commit = useCallback((next) => {
    const prev = annotationsRef.current
    setPast((p) => [...p.slice(-HISTORY_LIMIT + 1), prev])
    setFuture([])
    annotationsRef.current = next
    setAnnotations(next)
  }, [])

  const undo = useCallback(() => {
    if (!past.length) return
    const prev = past[past.length - 1]
    const current = annotationsRef.current
    setPast(past.slice(0, -1))
    setFuture((f) => [current, ...f])
    annotationsRef.current = prev
    setAnnotations(prev)
    setSelectedId(null)
  }, [past])

  const redo = useCallback(() => {
    if (!future.length) return
    const next = future[0]
    const current = annotationsRef.current
    setFuture(future.slice(1))
    setPast((p) => [...p, current])
    annotationsRef.current = next
    setAnnotations(next)
    setSelectedId(null)
  }, [future])

  // ─── Loading ───────────────────────────────────────────────
  const openImage = useCallback(async (src, name, seed = []) => {
    try {
      const img = await loadImage(src)
      setImage((old) => {
        if (old?.url && old.url.startsWith('blob:')) URL.revokeObjectURL(old.url)
        return { img, name, width: img.naturalWidth, height: img.naturalHeight, url: src }
      })
      annotationsRef.current = seed
      setAnnotations(seed)
      setPast([])
      setFuture([])
      setSelectedId(null)
      setDraft(null)
      editingRef.current = null
      setEditing(null)
    } catch {
      showToast('Could not read that image', 'error')
    }
  }, [showToast])

  const loadFile = useCallback((file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('That file is not an image', 'error')
      return
    }
    const base = (file.name || 'screenshot').replace(/\.[^.]+$/, '') || 'screenshot'
    openImage(URL.createObjectURL(file), base)
  }, [openImage, showToast])

  const loadDemo = () => openImage(createDemoImage(), 'demo-screenshot', DEMO_ANNOTATIONS.map((a) => ({ ...a })))

  // Paste from clipboard anywhere on the page
  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))
      if (!item) return
      e.preventDefault()
      loadFile(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [loadFile])

  // Redraw once web fonts are ready so text annotations use Inter
  useEffect(() => {
    document.fonts?.ready.then(() => setFontTick((t) => t + 1))
  }, [])

  // ─── Rendering ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    if (canvas.width !== image.width) canvas.width = image.width
    if (canvas.height !== image.height) canvas.height = image.height
    renderScene(canvas, image.img, annotations, {
      selectedId: editing ? null : selectedId,
      hiddenId: editing?.id,
      draft,
    })
  }, [image, annotations, selectedId, draft, editing, fontTick])

  // Track displayed scale (CSS px per image px) for the text editor overlay
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const update = () => {
      const w = canvas.getBoundingClientRect().width
      if (w) setScale(w / image.width)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [image])

  // ─── Text editing ──────────────────────────────────────────
  const setEditingState = (next) => {
    editingRef.current = next
    setEditing(next)
  }

  const commitText = useCallback(() => {
    const ed = editingRef.current
    if (!ed) return
    editingRef.current = null
    setEditing(null)
    const text = ed.text.trim()
    const current = annotationsRef.current
    if (ed.id) {
      const existing = current.find((a) => a.id === ed.id)
      if (!existing) return
      if (!text) commit(current.filter((a) => a.id !== ed.id))
      else if (text !== existing.text || ed.color !== existing.color || ed.size !== existing.size) {
        commit(current.map((a) => (a.id === ed.id ? { ...a, text, color: ed.color, size: ed.size } : a)))
      }
      setSelectedId(ed.id)
    } else if (text) {
      const a = { id: uid(), type: 'text', x: ed.x, y: ed.y, text, color: ed.color, size: ed.size }
      commit([...current, a])
      setSelectedId(a.id)
    }
  }, [commit])

  const cancelText = () => setEditingState(null)

  const editExistingText = (a) => {
    setSelectedId(a.id)
    setEditingState({ id: a.id, x: a.x, y: a.y, text: a.text, color: a.color, size: a.size })
  }

  // ─── Pointer interaction ───────────────────────────────────
  const getPoint = (e) => {
    const canvas = canvasRef.current
    const r = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) * canvas.width) / r.width,
      y: ((e.clientY - r.top) * canvas.height) / r.height,
    }
  }

  const hitAt = (p, filter = () => true) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const unit = getUnit(canvas.width, canvas.height)
    return [...annotationsRef.current].reverse().find((a) => filter(a) && hitTest(ctx, a, p.x, p.y, unit))
  }

  const onPointerDown = (e) => {
    if (!image || e.button !== 0) return
    wasEditingRef.current = !!editingRef.current
    if (editingRef.current) {
      commitText()
      return
    }
    const canvas = canvasRef.current
    const p = getPoint(e)

    if (tool === 'select') {
      const hit = hitAt(p)
      setSelectedId(hit?.id ?? null)
      if (hit) {
        dragRef.current = { mode: 'move', id: hit.id, start: p, base: annotationsRef.current, moved: false }
        canvas.setPointerCapture(e.pointerId)
        setDragging(true)
      }
      return
    }
    if (tool === 'text') return // placed on pointerup to keep focus in the editor

    const common = { id: uid(), color, size }
    const d = tool === 'arrow'
      ? { ...common, type: 'arrow', x1: p.x, y1: p.y, x2: p.x, y2: p.y }
      : { ...common, type: tool, x: p.x, y: p.y, w: 0, h: 0 }
    draftRef.current = d
    dragRef.current = { mode: 'draw' }
    setDraft(d)
    setSelectedId(null)
    canvas.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag) return
    const p = getPoint(e)

    if (drag.mode === 'draw') {
      const d = draftRef.current
      let next
      if (d.type === 'arrow') {
        let { x, y } = p
        if (e.shiftKey) {
          // Snap to 45° increments
          const ang = Math.round(Math.atan2(y - d.y1, x - d.x1) / (Math.PI / 4)) * (Math.PI / 4)
          const len = Math.hypot(x - d.x1, y - d.y1)
          x = d.x1 + Math.cos(ang) * len
          y = d.y1 + Math.sin(ang) * len
        }
        next = { ...d, x2: x, y2: y }
      } else {
        let w = p.x - d.x
        let h = p.y - d.y
        if (e.shiftKey) {
          const s = Math.max(Math.abs(w), Math.abs(h))
          w = Math.sign(w || 1) * s
          h = Math.sign(h || 1) * s
        }
        next = { ...d, w, h }
      }
      draftRef.current = next
      setDraft(next)
      return
    }

    const dx = p.x - drag.start.x
    const dy = p.y - drag.start.y
    if (!drag.moved && Math.hypot(dx, dy) < 2) return
    drag.moved = true
    const next = drag.base.map((a) => (a.id === drag.id ? translate(a, dx, dy) : a))
    annotationsRef.current = next
    setAnnotations(next)
  }

  const finishDrag = () => {
    const drag = dragRef.current
    dragRef.current = null
    setDragging(false)
    if (!drag) return

    if (drag.mode === 'draw') {
      const d = draftRef.current
      draftRef.current = null
      setDraft(null)
      if (!d) return
      const unit = getUnit(image.width, image.height)
      const min = 4 * unit
      let final = null
      if (d.type === 'arrow') {
        if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) >= min * 2) final = d
      } else {
        const r = normRect(d)
        if (r.w >= min && r.h >= min) final = { ...d, ...r }
      }
      if (final) {
        commit([...annotationsRef.current, final])
        setSelectedId(final.id)
      }
    } else if (drag.moved) {
      setPast((p) => [...p.slice(-HISTORY_LIMIT + 1), drag.base])
      setFuture([])
    }
  }

  const onPointerUp = (e) => {
    if (!image) return
    if (tool === 'text' && !dragRef.current && e.button === 0) {
      if (wasEditingRef.current) {
        wasEditingRef.current = false
        return
      }
      const p = getPoint(e)
      const hit = hitAt(p, (a) => a.type === 'text')
      if (hit) {
        editExistingText(hit)
        return
      }
      const fs = fontSizeFor(size, getUnit(image.width, image.height))
      setSelectedId(null)
      setEditingState({ id: null, x: p.x, y: p.y - fs * 0.6, text: '', color, size })
      return
    }
    wasEditingRef.current = false
    finishDrag()
  }

  const onDoubleClick = (e) => {
    if (tool !== 'select' || !image) return
    const hit = hitAt(getPoint(e), (a) => a.type === 'text')
    if (hit) editExistingText(hit)
  }

  // ─── Style changes apply to the selection too ──────────────
  const updateSelected = (patch) => {
    if (editingRef.current) {
      setEditingState({ ...editingRef.current, ...patch })
      return
    }
    if (!selectedId) return
    commit(annotationsRef.current.map((a) => (a.id === selectedId ? { ...a, ...patch } : a)))
  }

  const pickColor = (value) => {
    setColor(value)
    updateSelected({ color: value })
  }

  const pickSize = (value) => {
    setSize(value)
    updateSelected({ size: value })
  }

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    commit(annotationsRef.current.filter((a) => a.id !== selectedId))
    setSelectedId(null)
  }, [selectedId, commit])

  const clearAll = () => {
    if (!annotationsRef.current.length) return
    commit([])
    setSelectedId(null)
    showToast('Cleared — undo to bring them back')
  }

  const pickTool = (id) => {
    if (editingRef.current) commitText()
    setTool(id)
    if (id !== 'select') setSelectedId(null)
  }

  // ─── Export ────────────────────────────────────────────────
  const exportBlob = useCallback(() => new Promise((resolve, reject) => {
    const c = document.createElement('canvas')
    c.width = image.width
    c.height = image.height
    renderScene(c, image.img, annotationsRef.current)
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png')
  }), [image])

  const download = useCallback(async () => {
    if (!image) return
    if (editingRef.current) commitText()
    try {
      const blob = await exportBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${image.name}-annotated.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      showToast('PNG downloaded')
    } catch {
      showToast('Export failed', 'error')
    }
  }, [image, exportBlob, commitText, showToast])

  const copyImage = async () => {
    if (!image) return
    if (editingRef.current) commitText()
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      showToast('Clipboard images not supported here', 'error')
      return
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': exportBlob() })])
      showToast('Copied to clipboard')
    } catch {
      showToast('Copy failed — try Download', 'error')
    }
  }

  // ─── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, [contenteditable="true"]')) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod && key === 's') {
        e.preventDefault()
        download()
        return
      }
      if (mod || e.altKey || !image) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        deleteSelected()
        return
      }
      if (e.key === 'Escape') {
        setSelectedId(null)
        return
      }
      if (TOOL_BY_KEY[key]) pickTool(TOOL_BY_KEY[key])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ─── Drag & drop files ─────────────────────────────────────
  const onDragOver = (e) => {
    if (![...e.dataTransfer.types].includes('Files')) return
    e.preventDefault()
    setDropActive(true)
  }
  const onDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDropActive(false)
  }
  const onDrop = (e) => {
    e.preventDefault()
    setDropActive(false)
    loadFile(e.dataTransfer.files?.[0])
  }

  const selected = annotations.find((a) => a.id === selectedId)
  const activeColor = editing ? editing.color : selected && selected.type !== 'blur' ? selected.color : color
  const activeSize = editing ? editing.size : selected ? selected.size : size
  const unit = image ? getUnit(image.width, image.height) : 1
  const cursor = tool === 'select' ? (dragging ? 'grabbing' : 'default') : tool === 'text' ? 'text' : 'crosshair'

  return (
    <div className="app" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <header className="header">
        <div className="header-inner">
          <div className="header-left">
            <div>
              <h1 className="header-title">Screenshot Annotator</h1>
              <p className="header-sub">Arrows, boxes, highlights, text &amp; blur — then download</p>
            </div>
          </div>
          <div className="header-right">
            {image && (
              <>
                <button className="btn-ghost btn-icon" onClick={() => fileInputRef.current?.click()} aria-label="Open a new image">
                  <IconImage /> <span className="hide-sm">New</span>
                </button>
                <button className="btn-ghost btn-icon" onClick={copyImage} aria-label="Copy annotated image to clipboard">
                  <IconCopy /> <span className="hide-sm">Copy</span>
                </button>
                <button className="btn-primary btn-icon" onClick={download} aria-label="Download annotated PNG">
                  <IconDownload /> Download
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          loadFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <main className="main">
        {!image ? (
          <section className={`dropzone${dropActive ? ' active' : ''}`} aria-label="Upload a screenshot">
            <div className="dropzone-icon"><IconUpload /></div>
            <h2 className="dropzone-title">Drop a screenshot to start</h2>
            <p className="dropzone-hint">
              or paste it with <kbd>{MOD}V</kbd> · PNG, JPG, WebP
            </p>
            <div className="dropzone-actions">
              <button className="btn-primary btn-lg" onClick={() => fileInputRef.current?.click()} aria-label="Choose an image file">
                Choose image
              </button>
              <button className="btn-ghost btn-lg" onClick={loadDemo} aria-label="Load a demo screenshot">
                Try a demo
              </button>
            </div>
            <ul className="feature-pills" aria-label="Available tools">
              {TOOLS.slice(1).map(({ id, label, Icon }) => (
                <li key={id}><Icon /> {label}</li>
              ))}
            </ul>
          </section>
        ) : (
          <>
            <div
              className="toolbar"
              role="toolbar"
              aria-label="Annotation tools"
              onMouseDown={(e) => {
                // Keep focus in the text editor while picking a color or size
                if (editingRef.current) e.preventDefault()
              }}
            >
              <div className="tool-group" role="group" aria-label="Tools">
                {TOOLS.map(({ id, label, key, Icon }) => (
                  <button
                    key={id}
                    className={`tool-btn${tool === id ? ' active' : ''}`}
                    onClick={() => pickTool(id)}
                    aria-pressed={tool === id}
                    aria-label={`${label} (${key})`}
                    title={`${label} — ${key}`}
                  >
                    <Icon />
                    <span className="tool-label">{label}</span>
                  </button>
                ))}
              </div>

              <div className="toolbar-divider" />

              <div className="swatches" role="group" aria-label="Color">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={`swatch${activeColor === c.value ? ' active' : ''}`}
                    style={{ '--swatch': c.value }}
                    onClick={() => pickColor(c.value)}
                    aria-pressed={activeColor === c.value}
                    aria-label={`${c.label} color`}
                    title={c.label}
                  />
                ))}
              </div>

              <div className="toolbar-divider" />

              <div className="segment" role="group" aria-label="Size">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    className={`segment-btn${activeSize === s.id ? ' active' : ''}`}
                    onClick={() => pickSize(s.id)}
                    aria-pressed={activeSize === s.id}
                    aria-label={`${s.name} size`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="toolbar-spacer" />

              <div className="tool-group plain" role="group" aria-label="History">
                <button className="icon-btn" onClick={undo} disabled={!past.length} aria-label={`Undo (${MOD}Z)`} title={`Undo — ${MOD}Z`}>
                  <IconUndo />
                </button>
                <button className="icon-btn" onClick={redo} disabled={!future.length} aria-label={`Redo (${MOD}⇧Z)`} title={`Redo — ${MOD}⇧Z`}>
                  <IconRedo />
                </button>
                <button className="icon-btn" onClick={deleteSelected} disabled={!selectedId} aria-label="Delete selected annotation" title="Delete selected — Del">
                  <IconTrash />
                </button>
                <button className="icon-btn" onClick={clearAll} disabled={!annotations.length} aria-label="Clear all annotations" title="Clear all">
                  <IconClear />
                </button>
              </div>
            </div>

            <div className={`stage${dropActive ? ' active' : ''}`}>
              <div className="canvas-wrap">
                <canvas
                  ref={canvasRef}
                  className="canvas"
                  style={{ cursor }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={finishDrag}
                  onDoubleClick={onDoubleClick}
                  aria-label="Screenshot canvas — draw with the selected tool"
                  role="img"
                />
                {editing && (
                  <input
                    className="text-editor"
                    autoFocus
                    value={editing.text}
                    placeholder="Type…"
                    onChange={(e) => setEditingState({ ...editingRef.current, text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        commitText()
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        cancelText()
                      }
                    }}
                    onBlur={commitText}
                    aria-label="Annotation text"
                    style={{
                      left: editing.x * scale,
                      top: editing.y * scale,
                      fontSize: fontSizeFor(editing.size, unit) * scale,
                      color: editing.color,
                      width: `${Math.max(6, editing.text.length + 2)}ch`,
                    }}
                  />
                )}
              </div>
            </div>

            <div className="stage-meta">
              <span>
                <span className="mono">{image.width} × {image.height}</span>
                <span className="meta-sep">·</span>
                {annotations.length} {annotations.length === 1 ? 'annotation' : 'annotations'}
              </span>
              <span className="hint">
                {tool === 'text'
                  ? 'Click to place text · Enter to confirm'
                  : tool === 'select'
                    ? 'Drag to move · Double-click text to edit · Del to remove'
                    : 'Drag on the image · Shift to snap'}
              </span>
            </div>
          </>
        )}
      </main>

      <footer className="credit">
        Coded by{' '}
        <a href="https://instagram.com/berkindev" target="_blank" rel="noopener noreferrer" className="credit-link">
          berkindev
        </a>
      </footer>

      {toast && (
        <div className={`toast${toast.kind === 'error' ? ' error' : ''}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}
    </div>
  )
}
