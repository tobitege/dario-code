import { execSync } from 'child_process'
import { PNG } from 'pngjs'

const WINDOWS_CLIPBOARD_SIZE_COMMAND = [
  'Add-Type -AssemblyName System.Windows.Forms',
  'if ([Windows.Forms.Clipboard]::ContainsImage()) {',
  "  $img = [Windows.Forms.Clipboard]::GetImage()",
  "  Write-Output ($img.Width.ToString() + ',' + $img.Height.ToString())",
  '}'
].join('; ')

let ClipboardCtorPromise = null

async function getClipboardCtor() {
  if (!ClipboardCtorPromise) {
    ClipboardCtorPromise = import('@napi-rs/clipboard')
      .then((mod) => mod.Clipboard)
      .catch(() => null)
  }
  return ClipboardCtorPromise
}

async function getClipboardInstance() {
  const Clipboard = await getClipboardCtor()
  return Clipboard ? new Clipboard() : null
}

export function getWindowsClipboardImageSize() {
  try {
    const output = execSync(
      `powershell -NoProfile -STA -Command "${WINDOWS_CLIPBOARD_SIZE_COMMAND}"`,
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true
      }
    ).trim()

    if (!output) return null

    const [widthStr, heightStr] = output.split(',')
    const width = Number(widthStr)
    const height = Number(heightStr)

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null
    }

    return { width, height }
  } catch {
    return null
  }
}

export async function getWindowsClipboardText() {
  try {
    const clipboard = await getClipboardInstance()
    if (!clipboard) return null
    const text = clipboard.getText()
    return typeof text === 'string' ? text : null
  } catch {
    return null
  }
}

export async function setWindowsClipboardText(text) {
  const clipboard = await getClipboardInstance()
  if (!clipboard) throw new Error('Windows clipboard binding unavailable')
  clipboard.setText(text ?? '')
}

export async function getWindowsClipboardImageRaw() {
  try {
    const clipboard = await getClipboardInstance()
    if (!clipboard) return null
    const image = clipboard.getImage()
    if (!image || image.length < 4) return null
    return image
  } catch {
    return null
  }
}

export async function setWindowsClipboardImageRaw(width, height, rgbaBuffer) {
  const clipboard = await getClipboardInstance()
  if (!clipboard) throw new Error('Windows clipboard binding unavailable')
  clipboard.setImage(width, height, rgbaBuffer)
}

export async function getWindowsClipboardImagePng() {
  const size = getWindowsClipboardImageSize()
  if (!size) return null

  const raw = await getWindowsClipboardImageRaw()
  if (!raw) return null

  const expectedBytes = size.width * size.height * 4
  if (raw.length !== expectedBytes) {
    return null
  }

  const png = new PNG({ width: size.width, height: size.height })
  raw.copy(png.data)
  const data = PNG.sync.write(png)

  return {
    data,
    type: 'png',
    size: data.length,
    width: size.width,
    height: size.height
  }
}

