// Copies the lottery dataset from ../data into public/data so Vite serves it statically.
// Runs automatically before `npm run dev` and `npm run build` (predev / prebuild).
//
// Only xsmb-2-digits.json is shipped: the per-day frequency matrix in xsmb-sparse.json
// is fully derivable from it in the browser, so shipping it would add ~9 MB for nothing.
// The JSON is re-serialised without indentation, roughly halving the download size.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = resolve(root, '..', 'data')
const targetDir = join(root, 'public', 'data')

const FILES = ['xsmb-2-digits.json']

await mkdir(targetDir, { recursive: true })

for (const file of FILES) {
  const source = join(sourceDir, file)
  const target = join(targetDir, file)

  const records = JSON.parse(await readFile(source, 'utf-8'))
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(`${source} does not contain a non-empty JSON array`)
  }

  await writeFile(target, JSON.stringify(records))

  const before = (await stat(source)).size
  const after = (await stat(target)).size
  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2)
  console.log(`copied ${file}: ${records.length} draws, ${mb(before)} MB -> ${mb(after)} MB`)
}

// The 2-digit file drops the leading digits, so the latest draw is also published in full
// (e.g. special prize 31922 instead of 22) for the "Kỳ quay mới nhất" card.
const full = JSON.parse(await readFile(join(sourceDir, 'xsmb.json'), 'utf-8'))
const latest = full.reduce((a, b) => (b.date > a.date ? b : a))
await writeFile(join(targetDir, 'xsmb-latest.json'), JSON.stringify(latest))
console.log(`wrote xsmb-latest.json: ${latest.date.slice(0, 10)}`)
