import {
  CalendarDays,
  ChartScatter,
  Gem,
  Grid3x3,
  Hourglass,
  LineChart,
  Network,
  Radar,
  Shuffle,
  type LucideIcon,
} from 'lucide-react'

export type TabId =
  | 'frequency'
  | 'streaks'
  | 'groups'
  | 'pairs'
  | 'markov'
  | 'calendar'
  | 'special5'
  | 'clustering'
  | 'backtest'

export type TabGroup = 'basic' | 'advanced'

export const TAB_GROUPS: readonly { id: TabGroup; label: string }[] = [
  { id: 'basic', label: 'Cơ bản' },
  { id: 'advanced', label: 'Chuyên sâu' },
]

export const TABS: readonly { id: TabId; label: string; icon: LucideIcon; group: TabGroup }[] = [
  { id: 'frequency', label: 'Tần suất & Bản đồ nhiệt', icon: Grid3x3, group: 'basic' },
  { id: 'streaks', label: 'Lô gan & Nhịp rơi', icon: Hourglass, group: 'basic' },
  { id: 'groups', label: 'Đầu – Đuôi – Tổng', icon: Radar, group: 'basic' },
  { id: 'pairs', label: 'Cặp số & Lô xiên', icon: Network, group: 'basic' },
  { id: 'markov', label: 'Bạc nhớ & Chuỗi', icon: Shuffle, group: 'advanced' },
  { id: 'calendar', label: 'Chu kỳ lịch', icon: CalendarDays, group: 'advanced' },
  { id: 'special5', label: 'Giải ĐB 5 số', icon: Gem, group: 'advanced' },
  { id: 'clustering', label: 'PCA & Xiên 3', icon: ChartScatter, group: 'advanced' },
  { id: 'backtest', label: 'Mô phỏng chiến thuật', icon: LineChart, group: 'advanced' },
]
