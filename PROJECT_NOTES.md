# Part 8 — Screenshot Annotator

Build Log serisinin 8. parçası. Bir ekran görüntüsü yükle, ok / kutu / highlight / metin / blur ekle, bitmiş görseli indir.

---

## Konsept

Slidelardaki mesaj: *"Make screenshots clear"* ve *"Explain anything visually."* Birine bir şey gösterirken tam olarak nereye bakması gerektiğini işaretle, hassas bilgiyi gizle, tek tıkla indir. CTA: **"MARK"** yorumu.

---

## Tasarım Dili (seri ile birebir)

`timestamp-converter` ve `nickname-generator` referans alındı:

- Dark-first zemin `#0a0a0c` + radial gradient, tokenlar birebir kopya
- Tek UI aksanı indigo `#6366f1` (aktif tool, focus, seçim çerçevesi, primary CTA)
- Anotasyon renk paleti (7 renk) *içerik rengi* — UI aksanı değil
- Toolbar: glass panel (backdrop-blur) + sticky, segment/pill grupları
- Stage: surface kart + noktalı grid arka plan, canvas soft shadow ile
- Inline SVG ikonlar (stroke 1.6), Inter font, 180ms micro-interactions
- Header/main/footer iskeleti ve credit footer seriyle aynı

---

## Stack

| Katman | Seçim | Neden |
|---|---|---|
| Framework | React 19 + Vite 5 | Seri standardı |
| Styling | Pure CSS + design tokens | Seri standardı |
| Çizim | Canvas 2D (vanilla) | Fabric/Konva gibi ağır kütüphanelere gerek yok |
| State | `useState` + ref'ler | Pointer akışında stale-closure olmaması için ref senkronu |

---

## Özellikler

1. **Yükleme** — drag & drop (tüm sayfa), file picker, clipboard paste
2. **Araçlar** — Select, Arrow, Box, Highlight, Text, Blur
3. **Renk (7) + boyut (S/M/L)** — seçili anotasyona da uygulanır
4. **Select** — sürükleyerek taşı, çift tıkla metni düzenle, Del ile sil
5. **Undo / Redo** — 100 adımlık geçmiş
6. **Shift snap** — okta 45°, kutuda kare
7. **Export** — orijinal çözünürlükte PNG indir veya panoya kopyala
8. **Demo** — canvas ile üretilmiş sahte "Account settings" ekranı + hazır anotasyonlar

---

## Mimari Notlar

```
screenshot-annotator/
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── PROJECT_NOTES.md
└── src/
    ├── main.jsx
    ├── App.jsx      (UI, pointer akışı, history, export, shortcuts)
    ├── draw.js      (render motoru, hit-test, demo görsel)
    └── styles.css
```

- **Koordinatlar image-pixel uzayında** tutulur; canvas intrinsic boyutu = orijinal görsel, CSS ile ekrana sığdırılır. Pointer → image dönüşümü `getBoundingClientRect` oranıyla.
- **`getUnit(w, h)`** — stroke, font ve blur blok boyutu görsel boyutuyla ölçeklenir.
- **Blur** — `ctx.filter` yerine (Safari desteği zayıf) bölgeyi küçük offscreen canvas'a downsample edip smooth upscale. Detay gerçekten yok olur; altındaki anotasyonları da kapsar (z-order korunur).
- **Metin** — pointerup'ta canvas üzerine absolute `<input>` açılır (pointerdown'da açılırsa mousedown focus'u çalıyor). Toolbar `mousedown` preventDefault ile düzenleme sırasında renk/boyut değişimi focus'u bozmaz.
- **History** — `past` / `future` snapshot dizileri; taşıma sırasında history'ye yazılmaz, bırakınca tek adım eklenir.
- **Export** — seçim çerçevesi olmadan ayrı canvas'a render → `toBlob` → download / `ClipboardItem`.

### Anotasyon şeması
```js
{ id, type: 'arrow', x1, y1, x2, y2, color, size }
{ id, type: 'box' | 'highlight' | 'blur', x, y, w, h, color, size }
{ id, type: 'text', x, y, text, color, size }
```

---

## Tamamlandı / Test

- `npm install` — temiz
- `npm run build` — temiz (CSS 9.1kB / gzip 2.5kB, JS ~245kB / gzip ~77kB)
- `npm run dev` — 200 OK
- Playwright ile test edildi: demo yükleme, box çizimi, metin ekleme + düzenlerken renk değişimi, taşıma, undo/redo, silme, çift tıkla düzenleme, blur, PNG indirme
- Mobil (390px) — yatay scroll yok, toolbar sadece ikonlara düşüyor

---

## Sonraki Adımlar (opsiyonel)

- Resize handle'ları (şu an sadece taşıma)
- Numaralı adım rozetleri (1, 2, 3…)
- Crop aracı
- Pen / serbest çizim
