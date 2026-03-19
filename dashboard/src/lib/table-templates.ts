import type { SchemaField } from '@/types/project'

export interface TableTemplate {
  id: string
  name: string
  description: string
  icon: string
  mode: 'data' | 'config'
  fields: SchemaField[]
  sampleRows?: Record<string, unknown>[]
}

export const TABLE_TEMPLATES: TableTemplate[] = [
  // 1. Config Parameters
  {
    id: 'config-parameters',
    name: 'Config Parameters',
    description: 'Key-value configuration parameters for game settings and tuning values.',
    icon: 'Settings',
    mode: 'config',
    fields: [
      { name: 'parameter', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { name: 'type', type: 'config', required: true, configRef: 'value' },
      { name: 'value', type: 'string', required: false },
    ],
    sampleRows: [
      { parameter: 'max_hp', description: 'Maximum player hit points', type: 'int', value: '100' },
      { parameter: 'speed', description: 'Base movement speed', type: 'float', value: '3.5' },
      { parameter: 'difficulty', description: 'Default difficulty level', type: 'enum', value: 'normal' },
    ],
  },

  // 2. Items / Equipment
  {
    id: 'items-equipment',
    name: 'Items / Equipment',
    description: 'Game items and equipment with rarity tiers, pricing, and stat definitions.',
    icon: 'Sword',
    mode: 'data',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { name: 'rarity', type: 'enum', required: true, values: ['common', 'uncommon', 'rare', 'epic', 'legendary'] },
      { name: 'price', type: 'integer', required: true, min: 0 },
      { name: 'stats', type: 'string', required: false },
      { name: 'icon', type: 'string', required: false },
    ],
    sampleRows: [
      { name: 'Iron Sword', description: 'A sturdy blade forged from iron.', rarity: 'common', price: 150, stats: '{"attack": 12}', icon: 'iron_sword' },
      { name: 'Golden Shield', description: 'A shield plated in gold.', rarity: 'rare', price: 800, stats: '{"defense": 25}', icon: 'golden_shield' },
      { name: 'Health Potion', description: 'Restores 50 HP.', rarity: 'common', price: 50, stats: '{"heal": 50}', icon: 'health_potion' },
    ],
  },

  // 3. Level Progression
  {
    id: 'level-progression',
    name: 'Level Progression',
    description: 'Experience thresholds, rewards, and feature unlocks for each player level.',
    icon: 'TrendingUp',
    mode: 'data',
    fields: [
      { name: 'level', type: 'integer', required: true, min: 1 },
      { name: 'xpRequired', type: 'integer', required: true, min: 0 },
      { name: 'reward', type: 'string', required: false },
      { name: 'unlocksFeature', type: 'string', required: false },
    ],
    sampleRows: [
      { level: 1, xpRequired: 0, reward: 'Starter Pack', unlocksFeature: 'Tutorial' },
      { level: 2, xpRequired: 100, reward: 'New Skill Slot', unlocksFeature: 'Skill Tree' },
      { level: 3, xpRequired: 300, reward: 'PvP Arena', unlocksFeature: 'PvP Arena' },
    ],
  },

  // 4. Shop / Store
  {
    id: 'shop-store',
    name: 'Shop / Store',
    description: 'Storefront listings with pricing, currency types, and promotional discounts.',
    icon: 'ShoppingCart',
    mode: 'data',
    fields: [
      { name: 'sku', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'price', type: 'float', required: true, min: 0 },
      { name: 'currency', type: 'enum', required: true, values: ['coins', 'gems', 'usd'] },
      { name: 'discount', type: 'float', required: false, min: 0, max: 1 },
      { name: 'featured', type: 'boolean', required: false },
    ],
    sampleRows: [
      { sku: 'gem_pack_s', name: 'Small Gem Pack', price: 0.99, currency: 'usd', discount: 0, featured: false },
      { sku: 'coin_bundle', name: 'Coin Bundle', price: 500, currency: 'gems', discount: 0.1, featured: true },
      { sku: 'starter_kit', name: 'Starter Kit', price: 4.99, currency: 'usd', discount: 0.2, featured: true },
    ],
  },

  // 5. Loot Table
  {
    id: 'loot-table',
    name: 'Loot Table',
    description: 'Drop rates and quantity ranges for loot pools used by enemies and chests.',
    icon: 'Gift',
    mode: 'data',
    fields: [
      { name: 'item', type: 'string', required: true },
      { name: 'weight', type: 'float', required: true, min: 0 },
      { name: 'rarity', type: 'enum', required: false, values: ['common', 'uncommon', 'rare', 'epic', 'legendary'] },
      { name: 'pool', type: 'string', required: false },
      { name: 'minQuantity', type: 'integer', required: false, min: 1 },
      { name: 'maxQuantity', type: 'integer', required: false, min: 1 },
    ],
    sampleRows: [
      { item: 'Gold Coins', weight: 50, rarity: 'common', pool: 'default', minQuantity: 10, maxQuantity: 100 },
      { item: 'Diamond', weight: 1, rarity: 'legendary', pool: 'boss', minQuantity: 1, maxQuantity: 1 },
      { item: 'Iron Ore', weight: 25, rarity: 'uncommon', pool: 'default', minQuantity: 1, maxQuantity: 5 },
    ],
  },

  // 6. Enemy Waves
  {
    id: 'enemy-waves',
    name: 'Enemy Waves',
    description: 'Wave-based enemy spawns with health, damage, speed, and gold drop values.',
    icon: 'Skull',
    mode: 'data',
    fields: [
      { name: 'wave', type: 'integer', required: true, min: 1 },
      { name: 'enemyType', type: 'string', required: true },
      { name: 'count', type: 'integer', required: true, min: 1 },
      { name: 'hp', type: 'integer', required: true, min: 1 },
      { name: 'damage', type: 'integer', required: false, min: 0 },
      { name: 'speed', type: 'float', required: false, min: 0 },
      { name: 'goldDrop', type: 'integer', required: false, min: 0 },
    ],
    sampleRows: [
      { wave: 1, enemyType: 'Goblin', count: 5, hp: 100, damage: 10, speed: 1.0, goldDrop: 20 },
      { wave: 2, enemyType: 'Skeleton', count: 8, hp: 200, damage: 20, speed: 0.8, goldDrop: 40 },
      { wave: 3, enemyType: 'Orc Brute', count: 3, hp: 500, damage: 45, speed: 0.5, goldDrop: 100 },
    ],
  },

  // 7. Achievements
  {
    id: 'achievements',
    name: 'Achievements',
    description: 'Player achievements with progress targets and reward payouts.',
    icon: 'Trophy',
    mode: 'data',
    fields: [
      { name: 'key', type: 'string', required: true },
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: true },
      { name: 'target', type: 'integer', required: true, min: 1 },
      { name: 'rewardType', type: 'enum', required: false, values: ['coins', 'gems', 'item', 'title'] },
      { name: 'rewardAmount', type: 'integer', required: false, min: 0 },
    ],
    sampleRows: [
      { key: 'first_kill', title: 'First Blood', description: 'Defeat your first enemy.', target: 1, rewardType: 'gems', rewardAmount: 10 },
      { key: 'collect_100', title: 'Hoarder', description: 'Collect 100 items.', target: 100, rewardType: 'coins', rewardAmount: 500 },
      { key: 'reach_lv10', title: 'Veteran', description: 'Reach player level 10.', target: 10, rewardType: 'title', rewardAmount: 0 },
    ],
  },

  // 8. Gacha / Summon Rates
  {
    id: 'gacha-summon-rates',
    name: 'Gacha / Summon Rates',
    description: 'Banner pull rates and pity thresholds for gacha summoning systems.',
    icon: 'Sparkles',
    mode: 'data',
    fields: [
      { name: 'banner', type: 'string', required: true },
      { name: 'rarity', type: 'enum', required: true, values: ['common', 'rare', 'epic', 'legendary', 'mythic'] },
      { name: 'rate', type: 'float', required: true, min: 0, max: 100 },
      { name: 'pityCount', type: 'integer', required: false, min: 0 },
    ],
    sampleRows: [
      { banner: 'Standard', rarity: 'common', rate: 50.0, pityCount: 0 },
      { banner: 'Standard', rarity: 'legendary', rate: 4.5, pityCount: 80 },
      { banner: 'Limited', rarity: 'mythic', rate: 0.6, pityCount: 200 },
    ],
  },
  {
    id: 'season-pass',
    name: 'Season Pass',
    description: 'Tiered battle/season pass with free and premium reward tracks.',
    icon: 'Trophy',
    mode: 'data',
    fields: [
      { name: 'tier', type: 'integer', required: true, min: 1 },
      { name: 'xpRequired', type: 'integer', required: true, min: 0 },
      { name: 'freeReward', type: 'string', required: true },
      { name: 'premiumReward', type: 'string', required: true },
      { name: 'isMilestone', type: 'boolean', required: false },
    ],
    sampleRows: [
      { tier: 1, xpRequired: 0, freeReward: '100 coins', premiumReward: '200 gems', isMilestone: false },
      { tier: 5, xpRequired: 2000, freeReward: '500 coins', premiumReward: 'Epic Crate', isMilestone: true },
      { tier: 10, xpRequired: 5000, freeReward: '1000 coins', premiumReward: 'Exclusive Skin', isMilestone: true },
    ],
  },
]

export function getTemplateById(id: string): TableTemplate | undefined {
  return TABLE_TEMPLATES.find((t) => t.id === id)
}
