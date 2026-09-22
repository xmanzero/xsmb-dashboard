import { Grid3x3, Hourglass, Network, Radar, type LucideIcon } from 'lucide-react'

export type TabId = 'frequency' | 'streaks' | 'groups' | 'pairs'

export const TABS: readonly { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'frequency', label: 'Tần suất & Bản đồ nhiệt', icon: Grid3x3 },
  { id: 'streaks', label: 'Lô gan & Nhịp rơi', icon: Hourglass },
  { id: 'groups', label: 'Đầu – Đuôi – Tổng', icon: Radar },
  { id: 'pairs', label: 'Cặp số & Lô xiên', icon: Network },
]
