import { PRIZE_GROUPS, PRIZE_KEYS, formatPrize, numberAt, type Dataset, type FullDraw } from '../services/dataLoader.ts'
import { formatDate } from '../utils/format.ts'
import { lotoTable, mutedDigits } from '../utils/lotteryStats.ts'
import { Modal } from './Modal.tsx'

interface LatestResultModalProps {
  dataset: Dataset
  latest: FullDraw | null
  onClose: () => void
}

/** Full prize table of the most recent draw plus its đầu–đuôi (loto) table, like the README. */
export function LatestResultModal({ dataset, latest, onClose }: LatestResultModalProps) {
  const draw = dataset.size - 1
  const date = dataset.dates[draw]
  // Fall back to the last two digits if the full-number file is missing or out of date.
  const full = latest?.date === date ? latest : null
  const loto = lotoTable(dataset, draw)
  const muted = mutedDigits(dataset, draw)

  return (
    <Modal title="Kết quả kỳ quay mới nhất" subtitle={`Ngày ${formatDate(date)}`} onClose={onClose} size="max-w-4xl">
      <div className="grid gap-5 md:grid-cols-5">
        <table className="w-full text-sm md:col-span-3">
          <tbody className="divide-y divide-slate-800">
            {PRIZE_GROUPS.map((group) => (
              <tr key={group.label}>
                <th scope="row" className="w-24 py-2 pr-3 text-left text-xs font-medium text-slate-400">
                  {group.label}
                </th>
                <td className="flex flex-wrap gap-x-4 gap-y-1 py-2 font-mono text-base tabular-nums">
                  {group.keys.map((key) => {
                    const text = full
                      ? formatPrize(group, full.prizes[key])
                      : String(numberAt(dataset, draw, PRIZE_KEYS.indexOf(key))).padStart(2, '0')
                    return (
                      <span key={key} className={group.short === 'ĐB' ? 'text-2xl font-bold text-amber-300' : 'text-slate-200'}>
                        {text.slice(0, -2)}
                        <span className={group.short === 'ĐB' ? '' : 'text-sky-300'}>{text.slice(-2)}</span>
                      </span>
                    )
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="md:col-span-2">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="w-14 py-1.5 font-medium">Đầu</th>
                <th className="py-1.5 font-medium">Đuôi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {loto.map((row) => (
                <tr key={row.head}>
                  <td className="py-1.5 text-sky-300">{row.head}</td>
                  <td className={`py-1.5 ${row.tails.length ? 'text-slate-200' : 'text-slate-600'}`}>
                    {row.tails.length ? row.tails.join(', ') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">
            Đầu câm: <b className="text-slate-200">{muted.heads.length ? muted.heads.join(', ') : 'không có'}</b> · Đuôi câm:{' '}
            <b className="text-slate-200">{muted.tails.length ? muted.tails.join(', ') : 'không có'}</b>
          </p>
          {!full && <p className="mt-2 text-xs text-amber-300">Không tải được số đầy đủ, chỉ hiển thị 2 số cuối.</p>}
        </div>
      </div>
    </Modal>
  )
}
