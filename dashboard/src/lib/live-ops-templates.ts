import type { LiveOpsEventType } from '@/types/project'

export interface LiveOpsTemplate {
  type: LiveOpsEventType
  name: string
  description: string
  icon: string
  color: string
  defaultDurationDays: number
  defaultConfig: Record<string, unknown>
}

export const LIVE_OPS_TEMPLATES: LiveOpsTemplate[] = [
  {
    type: 'daily_login',
    name: 'Daily Login',
    description: 'Reward players for logging in each day. Support streak bonuses.',
    icon: 'CalendarCheck',
    color: '#22c55e',
    defaultDurationDays: 30,
    defaultConfig: {
      rewards: [
        { day: 1, reward: '100 coins' },
        { day: 2, reward: '200 coins' },
        { day: 3, reward: '1 gem' },
        { day: 7, reward: '5 gems + rare item' },
      ],
      streakBonus: true,
      streakMultiplier: 1.5,
    },
  },
  {
    type: 'flash_sale',
    name: 'Flash Sale',
    description: 'Limited-time discounts on shop items. Creates urgency.',
    icon: 'Zap',
    color: '#f59e0b',
    defaultDurationDays: 1,
    defaultConfig: {
      discountPercent: 50,
      items: ['gems_m', 'gems_l', 'starter'],
      limitPerPlayer: 1,
      banner: 'flash_sale_banner',
    },
  },
  {
    type: 'limited_shop',
    name: 'Limited-Time Shop',
    description: 'Temporary shop with exclusive items not available in the regular store.',
    icon: 'ShoppingBag',
    color: '#8b5cf6',
    defaultDurationDays: 7,
    defaultConfig: {
      items: [
        { sku: 'exclusive_skin_01', name: 'Limited Skin', price: 500, stock: 100 },
        { sku: 'rare_pack', name: 'Rare Pack', price: 1000, stock: 50 },
      ],
      currency: 'gems',
    },
  },
  {
    type: 'tournament',
    name: 'Tournament',
    description: 'Competitive event with leaderboard, entry fee, and prize pool.',
    icon: 'Trophy',
    color: '#ef4444',
    defaultDurationDays: 5,
    defaultConfig: {
      entryFee: 100,
      entryFeeCurrency: 'gems',
      prizePool: [
        { rank: '1', reward: '10000 coins + legendary item' },
        { rank: '2-3', reward: '5000 coins + epic item' },
        { rank: '4-10', reward: '2000 coins' },
      ],
      maxParticipants: 1000,
      rules: 'Highest score wins',
    },
  },
  {
    type: 'season_pass',
    name: 'Season Pass',
    description: 'Multi-tier progression with free and premium reward tracks.',
    icon: 'Award',
    color: '#3b82f6',
    defaultDurationDays: 60,
    defaultConfig: {
      totalTiers: 30,
      xpPerTier: 1000,
      premiumPrice: 9.99,
      premiumCurrency: 'USD',
    },
  },
  {
    type: 'maintenance',
    name: 'Maintenance',
    description: 'Scheduled downtime for updates or server maintenance.',
    icon: 'Wrench',
    color: '#6b7280',
    defaultDurationDays: 0,
    defaultConfig: {
      estimatedHours: 2,
      message: 'Game is under maintenance. We will be back soon!',
      redirectUrl: '',
      compensation: '500 coins',
    },
  },
  {
    type: 'world_boss',
    name: 'World Boss',
    description: 'Cooperative boss fight where all players contribute damage for shared rewards.',
    icon: 'Skull',
    color: '#7c3aed',
    defaultDurationDays: 2,
    defaultConfig: {
      bossName: 'Ancient Dragon',
      bossHp: 100000000,
      maxAttemptsPerDay: 5,
      damageRewardRatio: 0.01,
      milestoneRewards: [
        { hpPercent: 75, reward: 'All players: 100 gems' },
        { hpPercent: 50, reward: 'All players: 500 coins + rare chest' },
        { hpPercent: 25, reward: 'All players: 200 gems' },
        { hpPercent: 0, reward: 'All players: legendary chest + exclusive title' },
      ],
      topDamageRewards: [
        { rank: '1', reward: 'Legendary weapon skin' },
        { rank: '2-10', reward: 'Epic weapon skin' },
        { rank: '11-100', reward: '1000 gems' },
      ],
    },
  },
]

export const EVENT_TYPE_LABELS: Record<LiveOpsEventType, string> = {
  daily_login: 'Daily Login',
  flash_sale: 'Flash Sale',
  limited_shop: 'Limited Shop',
  tournament: 'Tournament',
  season_pass: 'Season Pass',
  maintenance: 'Maintenance',
  world_boss: 'World Boss',
  custom: 'Custom',
}

export const EVENT_TYPE_COLORS: Record<LiveOpsEventType, string> = {
  daily_login: '#22c55e',
  flash_sale: '#f59e0b',
  limited_shop: '#8b5cf6',
  tournament: '#ef4444',
  season_pass: '#3b82f6',
  maintenance: '#6b7280',
  world_boss: '#7c3aed',
  custom: '#06b6d4',
}
