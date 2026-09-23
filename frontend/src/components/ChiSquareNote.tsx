import { formatDecimal } from '../utils/format.ts'
import type { ChiSquareResult } from '../utils/lotteryStats.ts'

/**
 * One-line verdict of a chi-square test for a panel footer. Pass `minExpected` (smallest expected count)
 * to warn when the sample is too small for the test to be reliable.
 */
export function ChiSquareNote({ test, minExpected }: { test: ChiSquareResult; minExpected?: number }) {
  const stats = `Kiểm định χ²: χ² = ${formatDecimal(test.statistic, 1)}, bậc tự do ${test.degreesOfFreedom}, p = ${test.pValue < 0.001 ? '< 0,001' : formatDecimal(test.pValue, 3)}.`
  if (minExpected !== undefined && minExpected < 5) return <>{stats} Mẫu quá nhỏ (có nhóm kỳ vọng dưới 5 lần) nên kiểm định không đáng tin cậy.</>
  return test.pValue >= 0.05 ? (
    <>
      {stats} <span className="text-emerald-300">Không có bằng chứng về sai lệch so với ngẫu nhiên; chênh lệch nằm trong mức dao động thông thường.</span>
    </>
  ) : (
    <>
      {stats} <span className="text-amber-300">Chênh lệch có ý nghĩa thống kê ở mức 5%. Khi thử nhiều phép kiểm định, khoảng 1/20 phép sẽ cho kết quả như vậy dù dữ liệu hoàn toàn ngẫu nhiên.</span>
    </>
  )
}
