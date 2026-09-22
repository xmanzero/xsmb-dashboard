const integer = new Intl.NumberFormat('vi-VN')

/** 1234 -> "1.234" */
export function formatInt(n: number): string {
  return integer.format(n)
}

/** 3.14159 -> "3,1" */
export function formatDecimal(n: number, digits = 1): string {
  return n.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** 0.0124 -> "1,24%" */
export function formatPercent(ratio: number, digits = 2): string {
  return `${formatDecimal(ratio * 100, digits)}%`
}

/** 0.24 -> "+24%", -0.1 -> "−10%" */
export function formatSignedPercent(ratio: number, digits = 0): string {
  const text = formatPercent(Math.abs(ratio), digits)
  return ratio > 0 ? `+${text}` : ratio < 0 ? `−${text}` : text
}

/** "2026-09-22" -> "22/09/2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
