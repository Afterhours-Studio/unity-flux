import type { Project, Schema, DataEntry, Version, ActivityLog } from '@/types/project'

let _id = 0
const id = () => `seed-${++_id}-${Math.random().toString(36).slice(2, 7)}`
const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString()
const apiKey = () => 'flux_' + Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')
const anonKey = () => 'anon_' + Array.from({ length: 40 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')

// ─── Projects ─────────────────────────────────────────

const projects: Project[] = [
  { id: 'coin-sort-x8k2f', name: 'Coin Sort: Coin Merge Puzzle', slug: 'coin-sort', description: 'Merge coins on a grid to reach higher tiers. Casual puzzle with idle mechanics.', createdAt: ago(720), updatedAt: ago(2), apiKey: apiKey(), anonKey: anonKey(), supabaseUrl: 'https://coin-sort.supabase.co', r2BucketUrl: 'https://cdn.coinsort.game', environment: 'production' },
  { id: 'idle-heroes-p3m9', name: 'Idle Heroes: AFK Arena', slug: 'idle-heroes', description: 'Idle RPG with hero collection, gacha, and guild PvP.', createdAt: ago(600), updatedAt: ago(5), apiKey: apiKey(), anonKey: anonKey(), supabaseUrl: 'https://idle-heroes.supabase.co', r2BucketUrl: 'https://cdn.idleheroes.io', environment: 'staging' },
  { id: 'tower-def-r7n4q', name: 'Tower Defense: Castle Guard', slug: 'tower-defense', description: 'Strategic tower placement with wave-based enemy combat and boss fights.', createdAt: ago(500), updatedAt: ago(1), apiKey: apiKey(), anonKey: anonKey(), supabaseUrl: 'https://tower-def.supabase.co', r2BucketUrl: 'https://cdn.castleguard.com', environment: 'development' },
  { id: 'racing-drift-w5j8', name: 'Racing Drift: Street Kings', slug: 'racing-drift', description: 'Arcade drift racing with car tuning, leagues, and seasonal content.', createdAt: ago(400), updatedAt: ago(10), apiKey: apiKey(), anonKey: anonKey(), supabaseUrl: 'https://racing.supabase.co', r2BucketUrl: 'https://cdn.streetkings.racing', environment: 'staging' },
  { id: 'farm-life-k2d6m', name: 'Farm Life: Harvest Valley', slug: 'farm-life', description: 'Farming simulation with crops, animals, crafting, and NPC relationships.', createdAt: ago(300), updatedAt: ago(3), apiKey: apiKey(), anonKey: anonKey(), supabaseUrl: 'https://farmlife.supabase.co', r2BucketUrl: 'https://cdn.harvestvalley.fun', environment: 'development' },
]

// ─── Schema + Entry definitions per project ───────────

interface TableDef {
  name: string
  mode: 'data' | 'config'
  fields: Schema['fields']
  rows: Record<string, unknown>[]
}

// Helper for config tables
const cfgFields: Schema['fields'] = [
  { name: 'parameter', type: 'string', required: true },
  { name: 'description', type: 'string', required: false },
  { name: 'type', type: 'config', required: true, configRef: 'value' },
  { name: 'value', type: 'string', required: false },
]

function cfgRow(parameter: string, description: string, type: string, value: string): Record<string, unknown> {
  return { parameter, description, type, value }
}

// ════════════════════════════════════════════════════════
// Project 1: Coin Sort
// ════════════════════════════════════════════════════════

const coinSortTables: TableDef[] = [
  {
    name: 'GameConfig', mode: 'config', fields: cfgFields,
    rows: [
      cfgRow('MAX_STACK', 'Max coins per tray slot', 'int', '10'),
      cfgRow('GRID_ROWS', 'Grid row count', 'int', '5'),
      cfgRow('GRID_COLS', 'Grid column count', 'int', '3'),
      cfgRow('TOTAL_SLOTS', 'GRID_ROWS × GRID_COLS', 'int', '15'),
      cfgRow('BASE_UNLOCKED_SLOTS', 'Slots open at Era 0', 'int', '5'),
      cfgRow('MERGE_RATIO', 'Coins needed for tier+1 merge', 'int', '2'),
      cfgRow('MERGE_ANIMATION_DURATION', 'Merge animation seconds', 'float', '0.5'),
      cfgRow('AUTO_MERGE_ENABLED', 'Enable auto-merge feature', 'bool', 'true'),
      cfgRow('DIFFICULTY_MODE', 'Default difficulty', 'enum', 'normal'),
    ],
  },
  {
    name: 'CoinTiers', mode: 'data',
    fields: [
      { name: 'tier', type: 'integer', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'baseValue', type: 'float', required: true },
      { name: 'color', type: 'color', required: true },
      { name: 'unlockEra', type: 'integer', required: true },
    ],
    rows: [
      { tier: 1, name: 'Copper Penny', baseValue: 0.01, color: '#B87333', unlockEra: 0 },
      { tier: 2, name: 'Silver Nickel', baseValue: 0.05, color: '#C0C0C0', unlockEra: 0 },
      { tier: 3, name: 'Gold Dime', baseValue: 0.10, color: '#FFD700', unlockEra: 1 },
      { tier: 4, name: 'Platinum Quarter', baseValue: 0.25, color: '#E5E4E2', unlockEra: 1 },
      { tier: 5, name: 'Diamond Dollar', baseValue: 1.00, color: '#B9F2FF', unlockEra: 2 },
      { tier: 6, name: 'Ruby Crown', baseValue: 5.00, color: '#E0115F', unlockEra: 3 },
      { tier: 7, name: 'Emerald Star', baseValue: 25.00, color: '#50C878', unlockEra: 4 },
      { tier: 8, name: 'Mythic Token', baseValue: 100.00, color: '#9B59B6', unlockEra: 5 },
    ],
  },
  {
    name: 'MergeRules', mode: 'data',
    fields: [
      { name: 'fromTier', type: 'integer', required: true },
      { name: 'toTier', type: 'integer', required: true },
      { name: 'requiredCount', type: 'integer', required: true },
      { name: 'bonusMultiplier', type: 'float', required: true },
    ],
    rows: [
      { fromTier: 1, toTier: 2, requiredCount: 3, bonusMultiplier: 1.0 },
      { fromTier: 2, toTier: 3, requiredCount: 3, bonusMultiplier: 1.1 },
      { fromTier: 3, toTier: 4, requiredCount: 3, bonusMultiplier: 1.2 },
      { fromTier: 4, toTier: 5, requiredCount: 4, bonusMultiplier: 1.3 },
      { fromTier: 5, toTier: 6, requiredCount: 4, bonusMultiplier: 1.5 },
      { fromTier: 6, toTier: 7, requiredCount: 5, bonusMultiplier: 2.0 },
      { fromTier: 7, toTier: 8, requiredCount: 5, bonusMultiplier: 3.0 },
    ],
  },
  {
    name: 'Rewards', mode: 'data',
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'type', type: 'enum', required: true, values: ['coins', 'gems', 'booster', 'skin'] },
      { name: 'amount', type: 'integer', required: true },
      { name: 'rarity', type: 'enum', required: true, values: ['common', 'rare', 'epic', 'legendary'] },
    ],
    rows: [
      { id: 'rwd_001', name: 'Coin Pack S', type: 'coins', amount: 100, rarity: 'common' },
      { id: 'rwd_002', name: 'Coin Pack M', type: 'coins', amount: 500, rarity: 'rare' },
      { id: 'rwd_003', name: 'Gem Bundle', type: 'gems', amount: 50, rarity: 'rare' },
      { id: 'rwd_004', name: 'Speed Booster', type: 'booster', amount: 1, rarity: 'epic' },
      { id: 'rwd_005', name: 'Golden Tray Skin', type: 'skin', amount: 1, rarity: 'legendary' },
    ],
  },
  {
    name: 'DailyBonuses', mode: 'data',
    fields: [
      { name: 'day', type: 'integer', required: true },
      { name: 'rewardId', type: 'string', required: true },
      { name: 'multiplier', type: 'float', required: true },
    ],
    rows: Array.from({ length: 7 }, (_, i) => ({ day: i + 1, rewardId: `rwd_00${(i % 5) + 1}`, multiplier: 1 + i * 0.25 })),
  },
  {
    name: 'ShopItems', mode: 'data',
    fields: [
      { name: 'sku', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'priceUSD', type: 'float', required: true },
      { name: 'gems', type: 'integer', required: true },
      { name: 'featured', type: 'boolean', required: true },
    ],
    rows: [
      { sku: 'gems_s', name: 'Small Gem Pack', priceUSD: 0.99, gems: 80, featured: false },
      { sku: 'gems_m', name: 'Medium Gem Pack', priceUSD: 4.99, gems: 500, featured: true },
      { sku: 'gems_l', name: 'Large Gem Pack', priceUSD: 9.99, gems: 1200, featured: false },
      { sku: 'gems_xl', name: 'Mega Gem Pack', priceUSD: 19.99, gems: 3000, featured: true },
      { sku: 'starter', name: 'Starter Bundle', priceUSD: 2.99, gems: 300, featured: true },
      { sku: 'vip_weekly', name: 'VIP Weekly Pass', priceUSD: 1.99, gems: 700, featured: false },
    ],
  },
  {
    name: 'Achievements', mode: 'data',
    fields: [
      { name: 'key', type: 'string', required: true },
      { name: 'title', type: 'string', required: true },
      { name: 'description', type: 'string', required: true },
      { name: 'target', type: 'integer', required: true },
      { name: 'gemReward', type: 'integer', required: true },
    ],
    rows: [
      { key: 'first_merge', title: 'First Merge!', description: 'Merge coins for the first time', target: 1, gemReward: 10 },
      { key: 'merge_100', title: 'Merge Master', description: 'Perform 100 merges', target: 100, gemReward: 50 },
      { key: 'tier_5', title: 'Diamond Collector', description: 'Reach Tier 5', target: 1, gemReward: 100 },
      { key: 'earn_1m', title: 'Millionaire', description: 'Earn 1,000,000 total coins', target: 1000000, gemReward: 500 },
      { key: 'daily_7', title: 'Weekly Warrior', description: 'Log in 7 days in a row', target: 7, gemReward: 75 },
    ],
  },
  {
    name: 'SoundSettings', mode: 'config', fields: cfgFields,
    rows: [
      cfgRow('MASTER_VOLUME', 'Global volume 0-100', 'int', '80'),
      cfgRow('MUSIC_VOLUME', 'Background music volume', 'int', '60'),
      cfgRow('SFX_VOLUME', 'Sound effects volume', 'int', '90'),
      cfgRow('HAPTIC_ENABLED', 'Vibration feedback', 'bool', 'true'),
      cfgRow('MERGE_SOUND', 'Sound on merge', 'string', 'sfx_merge_01'),
    ],
  },
  {
    name: 'Eras', mode: 'data',
    fields: [
      { name: 'era', type: 'integer', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'requiredCoins', type: 'integer', required: true },
      { name: 'slotsUnlocked', type: 'integer', required: true },
      { name: 'bgColor', type: 'color', required: true },
    ],
    rows: [
      { era: 0, name: 'Stone Age', requiredCoins: 0, slotsUnlocked: 5, bgColor: '#8B7355' },
      { era: 1, name: 'Bronze Age', requiredCoins: 1000, slotsUnlocked: 8, bgColor: '#CD7F32' },
      { era: 2, name: 'Silver Age', requiredCoins: 10000, slotsUnlocked: 10, bgColor: '#C0C0C0' },
      { era: 3, name: 'Gold Age', requiredCoins: 100000, slotsUnlocked: 12, bgColor: '#FFD700' },
      { era: 4, name: 'Diamond Age', requiredCoins: 1000000, slotsUnlocked: 14, bgColor: '#B9F2FF' },
      { era: 5, name: 'Mythic Age', requiredCoins: 10000000, slotsUnlocked: 15, bgColor: '#9B59B6' },
    ],
  },
  {
    name: 'AdPlacements', mode: 'data',
    fields: [
      { name: 'placement', type: 'string', required: true },
      { name: 'type', type: 'enum', required: true, values: ['rewarded', 'interstitial', 'banner'] },
      { name: 'cooldownSec', type: 'integer', required: true },
      { name: 'rewardGems', type: 'integer', required: true },
      { name: 'enabled', type: 'boolean', required: true },
    ],
    rows: [
      { placement: 'post_merge_reward', type: 'rewarded', cooldownSec: 120, rewardGems: 5, enabled: true },
      { placement: 'double_coins', type: 'rewarded', cooldownSec: 300, rewardGems: 10, enabled: true },
      { placement: 'level_complete', type: 'interstitial', cooldownSec: 180, rewardGems: 0, enabled: true },
      { placement: 'bottom_banner', type: 'banner', cooldownSec: 0, rewardGems: 0, enabled: false },
    ],
  },
]

// ════════════════════════════════════════════════════════
// Project 2: Idle Heroes
// ════════════════════════════════════════════════════════

const idleHeroesTables: TableDef[] = [
  {
    name: 'HeroStats', mode: 'data',
    fields: [
      { name: 'id', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'class', type: 'enum', required: true, values: ['warrior', 'mage', 'ranger', 'assassin', 'support'] },
      { name: 'rarity', type: 'enum', required: true, values: ['common', 'rare', 'epic', 'legendary', 'mythic'] },
      { name: 'hp', type: 'integer', required: true },
      { name: 'atk', type: 'integer', required: true },
      { name: 'def', type: 'integer', required: true },
      { name: 'speed', type: 'integer', required: true },
    ],
    rows: [
      { id: 'hero_001', name: 'Thorin Ironfist', class: 'warrior', rarity: 'legendary', hp: 12000, atk: 850, def: 720, speed: 45 },
      { id: 'hero_002', name: 'Lyra Starweaver', class: 'mage', rarity: 'mythic', hp: 7500, atk: 1200, def: 350, speed: 60 },
      { id: 'hero_003', name: 'Shadow Fang', class: 'assassin', rarity: 'epic', hp: 6000, atk: 1050, def: 280, speed: 95 },
      { id: 'hero_004', name: 'Elena Lightbearer', class: 'support', rarity: 'legendary', hp: 9000, atk: 400, def: 600, speed: 55 },
      { id: 'hero_005', name: 'Hawk Swiftarrow', class: 'ranger', rarity: 'epic', hp: 7000, atk: 980, def: 420, speed: 80 },
      { id: 'hero_006', name: 'Grunt Basher', class: 'warrior', rarity: 'common', hp: 5000, atk: 500, def: 500, speed: 30 },
      { id: 'hero_007', name: 'Fira Flamecaster', class: 'mage', rarity: 'rare', hp: 5500, atk: 750, def: 300, speed: 50 },
      { id: 'hero_008', name: 'Nyx Shadowstep', class: 'assassin', rarity: 'legendary', hp: 6500, atk: 1100, def: 300, speed: 100 },
    ],
  },
  {
    name: 'HeroSkills', mode: 'data',
    fields: [
      { name: 'heroId', type: 'string', required: true },
      { name: 'skillName', type: 'string', required: true },
      { name: 'damage', type: 'integer', required: true },
      { name: 'cooldown', type: 'float', required: true },
      { name: 'aoe', type: 'boolean', required: true },
    ],
    rows: [
      { heroId: 'hero_001', skillName: 'Shield Slam', damage: 450, cooldown: 3.0, aoe: false },
      { heroId: 'hero_001', skillName: 'War Cry', damage: 0, cooldown: 8.0, aoe: true },
      { heroId: 'hero_002', skillName: 'Starfall', damage: 900, cooldown: 5.0, aoe: true },
      { heroId: 'hero_002', skillName: 'Arcane Barrier', damage: 0, cooldown: 10.0, aoe: false },
      { heroId: 'hero_003', skillName: 'Backstab', damage: 1200, cooldown: 2.5, aoe: false },
      { heroId: 'hero_004', skillName: 'Holy Light', damage: -500, cooldown: 4.0, aoe: true },
      { heroId: 'hero_005', skillName: 'Multi-Shot', damage: 600, cooldown: 3.5, aoe: true },
      { heroId: 'hero_008', skillName: 'Death Mark', damage: 2000, cooldown: 12.0, aoe: false },
    ],
  },
  {
    name: 'EquipmentData', mode: 'data',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'slot', type: 'enum', required: true, values: ['weapon', 'armor', 'helmet', 'boots', 'ring', 'amulet'] },
      { name: 'rarity', type: 'enum', required: true, values: ['common', 'rare', 'epic', 'legendary'] },
      { name: 'atkBonus', type: 'integer', required: true },
      { name: 'defBonus', type: 'integer', required: true },
      { name: 'hpBonus', type: 'integer', required: true },
    ],
    rows: [
      { name: 'Rusty Sword', slot: 'weapon', rarity: 'common', atkBonus: 50, defBonus: 0, hpBonus: 0 },
      { name: 'Flamebrand', slot: 'weapon', rarity: 'legendary', atkBonus: 350, defBonus: 0, hpBonus: 200 },
      { name: 'Iron Plate', slot: 'armor', rarity: 'rare', atkBonus: 0, defBonus: 150, hpBonus: 500 },
      { name: 'Shadow Hood', slot: 'helmet', rarity: 'epic', atkBonus: 80, defBonus: 100, hpBonus: 300 },
      { name: 'Winged Boots', slot: 'boots', rarity: 'rare', atkBonus: 30, defBonus: 60, hpBonus: 200 },
      { name: 'Ruby Ring', slot: 'ring', rarity: 'epic', atkBonus: 120, defBonus: 40, hpBonus: 0 },
    ],
  },
  {
    name: 'StageConfig', mode: 'data',
    fields: [
      { name: 'stage', type: 'integer', required: true },
      { name: 'chapter', type: 'integer', required: true },
      { name: 'enemyCount', type: 'integer', required: true },
      { name: 'bossHp', type: 'integer', required: true },
      { name: 'expReward', type: 'integer', required: true },
      { name: 'goldReward', type: 'integer', required: true },
    ],
    rows: Array.from({ length: 10 }, (_, i) => ({
      stage: i + 1, chapter: Math.floor(i / 5) + 1, enemyCount: 3 + i, bossHp: 5000 * (i + 1),
      expReward: 100 * (i + 1), goldReward: 200 * (i + 1),
    })),
  },
  {
    name: 'GachaRates', mode: 'data',
    fields: [
      { name: 'banner', type: 'string', required: true },
      { name: 'rarity', type: 'enum', required: true, values: ['common', 'rare', 'epic', 'legendary', 'mythic'] },
      { name: 'rate', type: 'float', required: true },
      { name: 'pityCount', type: 'integer', required: true },
    ],
    rows: [
      { banner: 'Standard', rarity: 'common', rate: 50.0, pityCount: 0 },
      { banner: 'Standard', rarity: 'rare', rate: 30.0, pityCount: 0 },
      { banner: 'Standard', rarity: 'epic', rate: 15.0, pityCount: 50 },
      { banner: 'Standard', rarity: 'legendary', rate: 4.5, pityCount: 80 },
      { banner: 'Standard', rarity: 'mythic', rate: 0.5, pityCount: 100 },
      { banner: 'Premium', rarity: 'epic', rate: 25.0, pityCount: 30 },
      { banner: 'Premium', rarity: 'legendary', rate: 10.0, pityCount: 50 },
      { banner: 'Premium', rarity: 'mythic', rate: 2.0, pityCount: 80 },
    ],
  },
  {
    name: 'GuildConfig', mode: 'config', fields: cfgFields,
    rows: [
      cfgRow('MAX_MEMBERS', 'Max guild size', 'int', '30'),
      cfgRow('DAILY_DONATIONS', 'Max donations per day', 'int', '5'),
      cfgRow('BOSS_ATTEMPTS', 'Guild boss attempts per day', 'int', '3'),
      cfgRow('MIN_LEVEL_JOIN', 'Min player level to join', 'int', '10'),
    ],
  },
  {
    name: 'PvPSettings', mode: 'config', fields: cfgFields,
    rows: [
      cfgRow('SEASON_DAYS', 'PvP season length in days', 'int', '14'),
      cfgRow('MATCHES_PER_DAY', 'Max PvP matches daily', 'int', '10'),
      cfgRow('ELO_BASE', 'Starting ELO rating', 'int', '1000'),
      cfgRow('ELO_K_FACTOR', 'ELO K-factor', 'float', '32'),
      cfgRow('REWARD_MULTIPLIER', 'Rank reward multiplier', 'float', '1.5'),
    ],
  },
  {
    name: 'DailyQuests', mode: 'data',
    fields: [
      { name: 'key', type: 'string', required: true },
      { name: 'description', type: 'string', required: true },
      { name: 'target', type: 'integer', required: true },
      { name: 'reward', type: 'string', required: true },
      { name: 'rewardAmount', type: 'integer', required: true },
    ],
    rows: [
      { key: 'battle_3', description: 'Win 3 battles', target: 3, reward: 'gold', rewardAmount: 500 },
      { key: 'summon_1', description: 'Perform 1 summon', target: 1, reward: 'gems', rewardAmount: 20 },
      { key: 'upgrade_hero', description: 'Upgrade a hero', target: 1, reward: 'exp_potion', rewardAmount: 2 },
      { key: 'guild_donate', description: 'Donate to guild', target: 1, reward: 'guild_coins', rewardAmount: 100 },
      { key: 'pvp_3', description: 'Play 3 PvP matches', target: 3, reward: 'honor', rewardAmount: 50 },
    ],
  },
  {
    name: 'VIPLevels', mode: 'data',
    fields: [
      { name: 'level', type: 'integer', required: true },
      { name: 'requiredSpend', type: 'float', required: true },
      { name: 'dailyGems', type: 'integer', required: true },
      { name: 'extraBattles', type: 'integer', required: true },
      { name: 'expBoost', type: 'float', required: true },
    ],
    rows: Array.from({ length: 10 }, (_, i) => ({
      level: i + 1, requiredSpend: [0, 5, 15, 30, 50, 100, 200, 500, 1000, 2000][i],
      dailyGems: 10 * (i + 1), extraBattles: Math.floor(i / 2), expBoost: 1 + i * 0.1,
    })),
  },
  {
    name: 'DungeonWaves', mode: 'data',
    fields: [
      { name: 'dungeon', type: 'string', required: true },
      { name: 'wave', type: 'integer', required: true },
      { name: 'enemyType', type: 'string', required: true },
      { name: 'count', type: 'integer', required: true },
      { name: 'isBoss', type: 'boolean', required: true },
    ],
    rows: [
      { dungeon: 'Fire Cavern', wave: 1, enemyType: 'Fire Imp', count: 5, isBoss: false },
      { dungeon: 'Fire Cavern', wave: 2, enemyType: 'Lava Golem', count: 3, isBoss: false },
      { dungeon: 'Fire Cavern', wave: 3, enemyType: 'Inferno Drake', count: 1, isBoss: true },
      { dungeon: 'Ice Fortress', wave: 1, enemyType: 'Frost Archer', count: 6, isBoss: false },
      { dungeon: 'Ice Fortress', wave: 2, enemyType: 'Ice Giant', count: 2, isBoss: false },
      { dungeon: 'Ice Fortress', wave: 3, enemyType: 'Blizzard Lord', count: 1, isBoss: true },
    ],
  },
]

// ════════════════════════════════════════════════════════
// Project 3: Tower Defense
// ════════════════════════════════════════════════════════

const towerDefTables: TableDef[] = [
  {
    name: 'TowerStats', mode: 'data',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'damage', type: 'integer', required: true },
      { name: 'range', type: 'float', required: true },
      { name: 'fireRate', type: 'float', required: true },
      { name: 'cost', type: 'integer', required: true },
      { name: 'element', type: 'enum', required: true, values: ['fire', 'ice', 'lightning', 'poison', 'physical'] },
    ],
    rows: [
      { name: 'Arrow Tower', damage: 25, range: 3.5, fireRate: 1.2, cost: 100, element: 'physical' },
      { name: 'Flame Turret', damage: 40, range: 2.5, fireRate: 0.8, cost: 200, element: 'fire' },
      { name: 'Frost Spire', damage: 15, range: 3.0, fireRate: 1.5, cost: 180, element: 'ice' },
      { name: 'Tesla Coil', damage: 60, range: 2.0, fireRate: 0.5, cost: 350, element: 'lightning' },
      { name: 'Venom Tower', damage: 10, range: 3.0, fireRate: 2.0, cost: 150, element: 'poison' },
      { name: 'Cannon', damage: 100, range: 4.0, fireRate: 0.3, cost: 500, element: 'physical' },
    ],
  },
  {
    name: 'EnemyWaves', mode: 'data',
    fields: [
      { name: 'wave', type: 'integer', required: true },
      { name: 'enemyType', type: 'string', required: true },
      { name: 'count', type: 'integer', required: true },
      { name: 'hp', type: 'integer', required: true },
      { name: 'speed', type: 'float', required: true },
      { name: 'goldDrop', type: 'integer', required: true },
    ],
    rows: Array.from({ length: 10 }, (_, i) => ({
      wave: i + 1, enemyType: ['Goblin', 'Skeleton', 'Orc', 'Troll', 'Dark Knight', 'Wraith', 'Dragon Whelp', 'Golem', 'Lich', 'Demon Lord'][i],
      count: 10 + i * 3, hp: 100 * (i + 1), speed: 1.0 + i * 0.15, goldDrop: 10 + i * 5,
    })),
  },
  {
    name: 'MapConfig', mode: 'data',
    fields: [
      { name: 'mapId', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'difficulty', type: 'enum', required: true, values: ['easy', 'medium', 'hard', 'nightmare'] },
      { name: 'pathLength', type: 'integer', required: true },
      { name: 'towerSlots', type: 'integer', required: true },
      { name: 'waves', type: 'integer', required: true },
    ],
    rows: [
      { mapId: 'map_01', name: 'Green Valley', difficulty: 'easy', pathLength: 20, towerSlots: 8, waves: 10 },
      { mapId: 'map_02', name: 'Desert Oasis', difficulty: 'easy', pathLength: 25, towerSlots: 10, waves: 12 },
      { mapId: 'map_03', name: 'Frozen Peaks', difficulty: 'medium', pathLength: 30, towerSlots: 9, waves: 15 },
      { mapId: 'map_04', name: 'Volcanic Ridge', difficulty: 'medium', pathLength: 28, towerSlots: 7, waves: 18 },
      { mapId: 'map_05', name: 'Shadow Realm', difficulty: 'hard', pathLength: 35, towerSlots: 6, waves: 20 },
      { mapId: 'map_06', name: 'Demon Gate', difficulty: 'nightmare', pathLength: 40, towerSlots: 5, waves: 30 },
    ],
  },
  {
    name: 'UpgradePaths', mode: 'data',
    fields: [
      { name: 'tower', type: 'string', required: true },
      { name: 'level', type: 'integer', required: true },
      { name: 'dmgIncrease', type: 'integer', required: true },
      { name: 'cost', type: 'integer', required: true },
    ],
    rows: [
      { tower: 'Arrow Tower', level: 2, dmgIncrease: 15, cost: 80 },
      { tower: 'Arrow Tower', level: 3, dmgIncrease: 25, cost: 150 },
      { tower: 'Flame Turret', level: 2, dmgIncrease: 20, cost: 120 },
      { tower: 'Flame Turret', level: 3, dmgIncrease: 35, cost: 250 },
      { tower: 'Tesla Coil', level: 2, dmgIncrease: 30, cost: 200 },
      { tower: 'Tesla Coil', level: 3, dmgIncrease: 50, cost: 400 },
    ],
  },
  {
    name: 'SpellData', mode: 'data',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'damage', type: 'integer', required: true },
      { name: 'radius', type: 'float', required: true },
      { name: 'cooldown', type: 'float', required: true },
      { name: 'manaCost', type: 'integer', required: true },
    ],
    rows: [
      { name: 'Fireball', damage: 200, radius: 2.0, cooldown: 15.0, manaCost: 30 },
      { name: 'Blizzard', damage: 50, radius: 4.0, cooldown: 20.0, manaCost: 40 },
      { name: 'Lightning Strike', damage: 500, radius: 1.0, cooldown: 25.0, manaCost: 50 },
      { name: 'Earthquake', damage: 150, radius: 5.0, cooldown: 30.0, manaCost: 60 },
      { name: 'Heal Aura', damage: -100, radius: 3.0, cooldown: 12.0, manaCost: 20 },
    ],
  },
  {
    name: 'BossConfig', mode: 'data',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'hp', type: 'integer', required: true },
      { name: 'damage', type: 'integer', required: true },
      { name: 'resistance', type: 'enum', required: true, values: ['fire', 'ice', 'lightning', 'poison', 'none'] },
      { name: 'goldDrop', type: 'integer', required: true },
    ],
    rows: [
      { name: 'Orc Warlord', hp: 5000, damage: 80, resistance: 'physical', goldDrop: 500 },
      { name: 'Frost Wyrm', hp: 8000, damage: 120, resistance: 'ice', goldDrop: 800 },
      { name: 'Inferno Dragon', hp: 12000, damage: 200, resistance: 'fire', goldDrop: 1200 },
      { name: 'Shadow Lich', hp: 15000, damage: 250, resistance: 'poison', goldDrop: 1500 },
    ],
  },
  {
    name: 'SeasonRewards', mode: 'data',
    fields: [
      { name: 'rank', type: 'string', required: true },
      { name: 'minStars', type: 'integer', required: true },
      { name: 'gems', type: 'integer', required: true },
      { name: 'exclusiveTower', type: 'boolean', required: true },
    ],
    rows: [
      { rank: 'Bronze', minStars: 0, gems: 50, exclusiveTower: false },
      { rank: 'Silver', minStars: 10, gems: 150, exclusiveTower: false },
      { rank: 'Gold', minStars: 30, gems: 300, exclusiveTower: false },
      { rank: 'Platinum', minStars: 60, gems: 500, exclusiveTower: true },
      { rank: 'Diamond', minStars: 100, gems: 1000, exclusiveTower: true },
    ],
  },
  {
    name: 'BalanceParams', mode: 'config', fields: cfgFields,
    rows: [
      cfgRow('GOLD_PER_WAVE', 'Base gold earned per wave', 'int', '50'),
      cfgRow('MANA_REGEN', 'Mana regen per second', 'float', '2.5'),
      cfgRow('STARTING_GOLD', 'Gold at map start', 'int', '200'),
      cfgRow('STARTING_LIVES', 'Player lives', 'int', '20'),
      cfgRow('ENEMY_HP_SCALE', 'HP multiplier per wave', 'float', '1.15'),
      cfgRow('SELL_REFUND_PCT', 'Tower sell refund %', 'float', '0.6'),
    ],
  },
  {
    name: 'PlayerLevels', mode: 'data',
    fields: [
      { name: 'level', type: 'integer', required: true },
      { name: 'expRequired', type: 'integer', required: true },
      { name: 'unlocksMap', type: 'string', required: true },
    ],
    rows: Array.from({ length: 8 }, (_, i) => ({
      level: i + 1, expRequired: 500 * Math.pow(2, i),
      unlocksMap: ['map_01', 'map_01', 'map_02', 'map_03', 'map_03', 'map_04', 'map_05', 'map_06'][i],
    })),
  },
  {
    name: 'AbilityTree', mode: 'data',
    fields: [
      { name: 'key', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'description', type: 'string', required: true },
      { name: 'cost', type: 'integer', required: true },
      { name: 'prerequisite', type: 'string', required: false },
    ],
    rows: [
      { key: 'tower_dmg_1', name: 'Sharper Arrows', description: '+10% tower damage', cost: 1, prerequisite: '' },
      { key: 'tower_dmg_2', name: 'Deadly Aim', description: '+20% tower damage', cost: 2, prerequisite: 'tower_dmg_1' },
      { key: 'mana_1', name: 'Mana Flow', description: '+25% mana regen', cost: 1, prerequisite: '' },
      { key: 'spell_dmg', name: 'Arcane Power', description: '+15% spell damage', cost: 2, prerequisite: 'mana_1' },
      { key: 'gold_1', name: 'Gold Rush', description: '+10% gold drops', cost: 1, prerequisite: '' },
    ],
  },
]

// ════════════════════════════════════════════════════════
// Project 4: Racing Drift (abbreviated for space, still 10 tables)
// ════════════════════════════════════════════════════════

const racingDriftTables: TableDef[] = [
  { name: 'CarStats', mode: 'data', fields: [{ name: 'name', type: 'string', required: true }, { name: 'topSpeed', type: 'integer', required: true }, { name: 'acceleration', type: 'float', required: true }, { name: 'handling', type: 'float', required: true }, { name: 'driftBonus', type: 'float', required: true }, { name: 'price', type: 'integer', required: true }, { name: 'rarity', type: 'enum', required: true, values: ['stock', 'tuned', 'pro', 'legendary'] }], rows: [
    { name: 'Honda Civic Type R', topSpeed: 180, acceleration: 7.5, handling: 8.0, driftBonus: 1.2, price: 5000, rarity: 'stock' },
    { name: 'Nissan Silvia S15', topSpeed: 200, acceleration: 8.0, handling: 9.0, driftBonus: 1.5, price: 15000, rarity: 'tuned' },
    { name: 'Toyota Supra MK4', topSpeed: 220, acceleration: 8.5, handling: 8.5, driftBonus: 1.3, price: 25000, rarity: 'tuned' },
    { name: 'BMW M3 GTR', topSpeed: 240, acceleration: 9.0, handling: 8.0, driftBonus: 1.1, price: 50000, rarity: 'pro' },
    { name: 'Porsche 911 GT3', topSpeed: 260, acceleration: 9.5, handling: 9.5, driftBonus: 1.4, price: 80000, rarity: 'pro' },
    { name: 'Lamborghini Huracán', topSpeed: 300, acceleration: 10.0, handling: 9.0, driftBonus: 1.0, price: 200000, rarity: 'legendary' },
  ]},
  { name: 'TrackConfig', mode: 'data', fields: [{ name: 'name', type: 'string', required: true }, { name: 'length', type: 'float', required: true }, { name: 'turns', type: 'integer', required: true }, { name: 'difficulty', type: 'enum', required: true, values: ['easy', 'medium', 'hard', 'extreme'] }, { name: 'nightRace', type: 'boolean', required: true }], rows: [
    { name: 'Shibuya Crossing', length: 2.5, turns: 8, difficulty: 'easy', nightRace: true },
    { name: 'Mountain Pass', length: 4.0, turns: 15, difficulty: 'medium', nightRace: false },
    { name: 'Harbor Drift', length: 3.2, turns: 12, difficulty: 'medium', nightRace: true },
    { name: 'Canyon Rush', length: 5.5, turns: 20, difficulty: 'hard', nightRace: false },
    { name: 'Neon Highway', length: 6.0, turns: 10, difficulty: 'hard', nightRace: true },
    { name: 'Death Loop', length: 8.0, turns: 30, difficulty: 'extreme', nightRace: true },
  ]},
  { name: 'BoostItems', mode: 'data', fields: [{ name: 'name', type: 'string', required: true }, { name: 'type', type: 'enum', required: true, values: ['nitro', 'shield', 'magnet', 'slowmo'] }, { name: 'duration', type: 'float', required: true }, { name: 'power', type: 'float', required: true }], rows: [
    { name: 'Nitro Burst', type: 'nitro', duration: 3.0, power: 1.5 },
    { name: 'Mega Nitro', type: 'nitro', duration: 5.0, power: 2.0 },
    { name: 'Shield', type: 'shield', duration: 8.0, power: 1.0 },
    { name: 'Coin Magnet', type: 'magnet', duration: 10.0, power: 3.0 },
    { name: 'Slow Motion', type: 'slowmo', duration: 4.0, power: 0.5 },
  ]},
  { name: 'TuningParts', mode: 'data', fields: [{ name: 'name', type: 'string', required: true }, { name: 'slot', type: 'enum', required: true, values: ['engine', 'turbo', 'tires', 'suspension', 'exhaust', 'body'] }, { name: 'speedBonus', type: 'integer', required: true }, { name: 'handlingBonus', type: 'float', required: true }, { name: 'price', type: 'integer', required: true }], rows: [
    { name: 'Stage 1 Engine', slot: 'engine', speedBonus: 10, handlingBonus: 0, price: 2000 },
    { name: 'Stage 2 Turbo', slot: 'turbo', speedBonus: 20, handlingBonus: -0.5, price: 5000 },
    { name: 'Racing Slicks', slot: 'tires', speedBonus: 0, handlingBonus: 1.5, price: 3000 },
    { name: 'Coilover Kit', slot: 'suspension', speedBonus: 5, handlingBonus: 1.0, price: 4000 },
    { name: 'Titanium Exhaust', slot: 'exhaust', speedBonus: 8, handlingBonus: 0, price: 3500 },
    { name: 'Carbon Body', slot: 'body', speedBonus: 5, handlingBonus: 0.5, price: 8000 },
  ]},
  { name: 'LeagueRanks', mode: 'data', fields: [{ name: 'rank', type: 'string', required: true }, { name: 'minTrophies', type: 'integer', required: true }, { name: 'rewardCoins', type: 'integer', required: true }], rows: [
    { rank: 'Rookie', minTrophies: 0, rewardCoins: 100 }, { rank: 'Amateur', minTrophies: 100, rewardCoins: 300 },
    { rank: 'Pro', minTrophies: 500, rewardCoins: 800 }, { rank: 'Elite', minTrophies: 1500, rewardCoins: 2000 },
    { rank: 'Legend', minTrophies: 5000, rewardCoins: 5000 }, { rank: 'King', minTrophies: 10000, rewardCoins: 10000 },
  ]},
  { name: 'DailyRaces', mode: 'data', fields: [{ name: 'day', type: 'string', required: true }, { name: 'trackId', type: 'string', required: true }, { name: 'laps', type: 'integer', required: true }, { name: 'rewardMultiplier', type: 'float', required: true }], rows: [
    { day: 'Monday', trackId: 'Shibuya Crossing', laps: 3, rewardMultiplier: 1.0 },
    { day: 'Tuesday', trackId: 'Mountain Pass', laps: 2, rewardMultiplier: 1.2 },
    { day: 'Wednesday', trackId: 'Harbor Drift', laps: 3, rewardMultiplier: 1.0 },
    { day: 'Thursday', trackId: 'Canyon Rush', laps: 2, rewardMultiplier: 1.5 },
    { day: 'Friday', trackId: 'Neon Highway', laps: 3, rewardMultiplier: 1.5 },
    { day: 'Saturday', trackId: 'Death Loop', laps: 1, rewardMultiplier: 3.0 },
    { day: 'Sunday', trackId: 'Shibuya Crossing', laps: 5, rewardMultiplier: 2.0 },
  ]},
  { name: 'WeatherEffects', mode: 'data', fields: [{ name: 'type', type: 'string', required: true }, { name: 'gripMultiplier', type: 'float', required: true }, { name: 'visibility', type: 'float', required: true }, { name: 'driftBonus', type: 'float', required: true }], rows: [
    { type: 'Clear', gripMultiplier: 1.0, visibility: 1.0, driftBonus: 1.0 },
    { type: 'Rain', gripMultiplier: 0.7, visibility: 0.8, driftBonus: 1.3 },
    { type: 'Snow', gripMultiplier: 0.5, visibility: 0.6, driftBonus: 1.5 },
    { type: 'Fog', gripMultiplier: 0.9, visibility: 0.3, driftBonus: 1.1 },
    { type: 'Sandstorm', gripMultiplier: 0.6, visibility: 0.4, driftBonus: 1.4 },
  ]},
  { name: 'AIDrivers', mode: 'data', fields: [{ name: 'name', type: 'string', required: true }, { name: 'skill', type: 'float', required: true }, { name: 'aggression', type: 'float', required: true }, { name: 'preferredCar', type: 'string', required: true }], rows: [
    { name: 'Mike Storm', skill: 0.6, aggression: 0.3, preferredCar: 'Honda Civic Type R' },
    { name: 'Yuki Tanaka', skill: 0.8, aggression: 0.5, preferredCar: 'Nissan Silvia S15' },
    { name: 'Max Thunder', skill: 0.9, aggression: 0.8, preferredCar: 'BMW M3 GTR' },
    { name: 'Shadow Racer', skill: 1.0, aggression: 0.9, preferredCar: 'Lamborghini Huracán' },
  ]},
  { name: 'GarageSlots', mode: 'config', fields: cfgFields, rows: [
    cfgRow('BASE_SLOTS', 'Starting garage capacity', 'int', '3'),
    cfgRow('MAX_SLOTS', 'Max garage capacity', 'int', '20'),
    cfgRow('SLOT_PRICE', 'Price per extra slot', 'int', '500'),
    cfgRow('SLOT_PRICE_INCREASE', 'Price increase per slot', 'float', '1.5'),
  ]},
  { name: 'SeasonPass', mode: 'data', fields: [{ name: 'tier', type: 'integer', required: true }, { name: 'freeReward', type: 'string', required: true }, { name: 'premiumReward', type: 'string', required: true }, { name: 'xpRequired', type: 'integer', required: true }], rows: Array.from({ length: 10 }, (_, i) => ({
    tier: i + 1, freeReward: `${500 * (i + 1)} coins`, premiumReward: i === 9 ? 'Exclusive Car Skin' : `${100 * (i + 1)} gems`,
    xpRequired: 1000 * (i + 1),
  }))},
]

// ════════════════════════════════════════════════════════
// Project 5: Farm Life
// ════════════════════════════════════════════════════════

const farmLifeTables: TableDef[] = [
  { name: 'CropData', mode: 'data', fields: [{ name: 'name', type: 'string', required: true }, { name: 'growTime', type: 'integer', required: true }, { name: 'sellPrice', type: 'integer', required: true }, { name: 'seedCost', type: 'integer', required: true }, { name: 'season', type: 'enum', required: true, values: ['spring', 'summer', 'fall', 'winter', 'all'] }, { name: 'xp', type: 'integer', required: true }], rows: [
    { name: 'Wheat', growTime: 4, sellPrice: 25, seedCost: 10, season: 'all', xp: 5 },
    { name: 'Tomato', growTime: 8, sellPrice: 60, seedCost: 25, season: 'summer', xp: 12 },
    { name: 'Corn', growTime: 12, sellPrice: 100, seedCost: 40, season: 'summer', xp: 20 },
    { name: 'Pumpkin', growTime: 16, sellPrice: 150, seedCost: 60, season: 'fall', xp: 30 },
    { name: 'Strawberry', growTime: 6, sellPrice: 45, seedCost: 20, season: 'spring', xp: 10 },
    { name: 'Carrot', growTime: 5, sellPrice: 35, seedCost: 15, season: 'spring', xp: 8 },
    { name: 'Blueberry', growTime: 10, sellPrice: 80, seedCost: 35, season: 'summer', xp: 15 },
    { name: 'Snow Pea', growTime: 7, sellPrice: 55, seedCost: 30, season: 'winter', xp: 12 },
  ]},
  { name: 'AnimalStats', mode: 'data', fields: [{ name: 'name', type: 'string', required: true }, { name: 'price', type: 'integer', required: true }, { name: 'product', type: 'string', required: true }, { name: 'productTime', type: 'integer', required: true }, { name: 'productValue', type: 'integer', required: true }], rows: [
    { name: 'Chicken', price: 200, product: 'Egg', productTime: 4, productValue: 30 },
    { name: 'Cow', price: 800, product: 'Milk', productTime: 8, productValue: 80 },
    { name: 'Sheep', price: 500, product: 'Wool', productTime: 12, productValue: 100 },
    { name: 'Pig', price: 600, product: 'Truffle', productTime: 16, productValue: 150 },
    { name: 'Goat', price: 700, product: 'Goat Cheese', productTime: 10, productValue: 120 },
    { name: 'Duck', price: 300, product: 'Duck Egg', productTime: 6, productValue: 50 },
  ]},
  { name: 'BuildingConfig', mode: 'data', fields: [{ name: 'name', type: 'string', required: true }, { name: 'cost', type: 'integer', required: true }, { name: 'buildTime', type: 'integer', required: true }, { name: 'capacity', type: 'integer', required: true }, { name: 'unlockLevel', type: 'integer', required: true }], rows: [
    { name: 'Barn', cost: 500, buildTime: 2, capacity: 10, unlockLevel: 1 },
    { name: 'Silo', cost: 800, buildTime: 4, capacity: 50, unlockLevel: 3 },
    { name: 'Coop', cost: 400, buildTime: 2, capacity: 6, unlockLevel: 2 },
    { name: 'Dairy', cost: 1500, buildTime: 8, capacity: 4, unlockLevel: 5 },
    { name: 'Kitchen', cost: 2000, buildTime: 12, capacity: 8, unlockLevel: 8 },
    { name: 'Greenhouse', cost: 3000, buildTime: 16, capacity: 12, unlockLevel: 10 },
    { name: 'Windmill', cost: 1200, buildTime: 6, capacity: 0, unlockLevel: 4 },
  ]},
  { name: 'RecipeBook', mode: 'data', fields: [{ name: 'name', type: 'string', required: true }, { name: 'ingredients', type: 'string', required: true }, { name: 'time', type: 'integer', required: true }, { name: 'sellPrice', type: 'integer', required: true }, { name: 'building', type: 'string', required: true }], rows: [
    { name: 'Bread', ingredients: 'Wheat x3', time: 10, sellPrice: 120, building: 'Kitchen' },
    { name: 'Tomato Soup', ingredients: 'Tomato x2, Wheat x1', time: 15, sellPrice: 200, building: 'Kitchen' },
    { name: 'Cheese', ingredients: 'Milk x2', time: 20, sellPrice: 250, building: 'Dairy' },
    { name: 'Berry Pie', ingredients: 'Blueberry x3, Wheat x2', time: 25, sellPrice: 350, building: 'Kitchen' },
    { name: 'Pumpkin Soup', ingredients: 'Pumpkin x2, Milk x1', time: 20, sellPrice: 400, building: 'Kitchen' },
    { name: 'Flour', ingredients: 'Wheat x5', time: 5, sellPrice: 80, building: 'Windmill' },
  ]},
  { name: 'SeasonEvents', mode: 'data', fields: [{ name: 'name', type: 'string', required: true }, { name: 'season', type: 'enum', required: true, values: ['spring', 'summer', 'fall', 'winter'] }, { name: 'startDay', type: 'integer', required: true }, { name: 'duration', type: 'integer', required: true }, { name: 'bonusType', type: 'string', required: true }], rows: [
    { name: 'Flower Festival', season: 'spring', startDay: 10, duration: 3, bonusType: '2x crop XP' },
    { name: 'Beach Party', season: 'summer', startDay: 15, duration: 5, bonusType: '50% off seeds' },
    { name: 'Harvest Moon', season: 'fall', startDay: 20, duration: 3, bonusType: '2x sell price' },
    { name: 'Winter Market', season: 'winter', startDay: 10, duration: 7, bonusType: 'Special recipes' },
  ]},
  { name: 'NPCDialogues', mode: 'data', fields: [{ name: 'npc', type: 'string', required: true }, { name: 'friendship', type: 'integer', required: true }, { name: 'dialogue', type: 'string', required: true }], rows: [
    { npc: 'Mayor Tom', friendship: 0, dialogue: 'Welcome to Harvest Valley! Let me know if you need anything.' },
    { npc: 'Mayor Tom', friendship: 5, dialogue: 'You\'re doing great! The town is lucky to have you.' },
    { npc: 'Farmer Jenny', friendship: 0, dialogue: 'Need some farming tips? I\'ve been at it for years.' },
    { npc: 'Farmer Jenny', friendship: 3, dialogue: 'Here\'s a rare seed. Use it well!' },
    { npc: 'Chef Marco', friendship: 0, dialogue: 'Bring me ingredients and I\'ll teach you new recipes.' },
    { npc: 'Chef Marco', friendship: 5, dialogue: 'You have real talent! Try this secret recipe.' },
  ]},
  { name: 'ToolUpgrades', mode: 'data', fields: [{ name: 'tool', type: 'string', required: true }, { name: 'level', type: 'integer', required: true }, { name: 'material', type: 'string', required: true }, { name: 'cost', type: 'integer', required: true }, { name: 'speedBonus', type: 'float', required: true }], rows: [
    { tool: 'Hoe', level: 1, material: 'Copper', cost: 500, speedBonus: 1.0 },
    { tool: 'Hoe', level: 2, material: 'Iron', cost: 1500, speedBonus: 1.5 },
    { tool: 'Hoe', level: 3, material: 'Gold', cost: 5000, speedBonus: 2.0 },
    { tool: 'Watering Can', level: 1, material: 'Copper', cost: 500, speedBonus: 1.0 },
    { tool: 'Watering Can', level: 2, material: 'Iron', cost: 1500, speedBonus: 1.5 },
    { tool: 'Axe', level: 1, material: 'Copper', cost: 500, speedBonus: 1.0 },
    { tool: 'Axe', level: 2, material: 'Iron', cost: 1500, speedBonus: 1.5 },
  ]},
  { name: 'MarketPrices', mode: 'config', fields: cfgFields, rows: [
    cfgRow('PRICE_FLUCTUATION', 'Daily price swing %', 'float', '0.15'),
    cfgRow('DEMAND_BONUS', 'High demand multiplier', 'float', '1.5'),
    cfgRow('OVERSUPPLY_PENALTY', 'Oversupply discount', 'float', '0.7'),
    cfgRow('REFRESH_HOURS', 'Market refresh interval', 'int', '6'),
    cfgRow('MAX_SELL_STACK', 'Max items per sell', 'int', '99'),
  ]},
  { name: 'WeatherPatterns', mode: 'data', fields: [{ name: 'season', type: 'enum', required: true, values: ['spring', 'summer', 'fall', 'winter'] }, { name: 'type', type: 'string', required: true }, { name: 'chance', type: 'float', required: true }, { name: 'cropEffect', type: 'float', required: true }], rows: [
    { season: 'spring', type: 'Sunny', chance: 0.5, cropEffect: 1.0 },
    { season: 'spring', type: 'Rain', chance: 0.3, cropEffect: 1.2 },
    { season: 'summer', type: 'Sunny', chance: 0.6, cropEffect: 1.0 },
    { season: 'summer', type: 'Drought', chance: 0.15, cropEffect: 0.5 },
    { season: 'fall', type: 'Cloudy', chance: 0.4, cropEffect: 0.9 },
    { season: 'fall', type: 'Storm', chance: 0.1, cropEffect: 0.3 },
    { season: 'winter', type: 'Snow', chance: 0.5, cropEffect: 0.0 },
    { season: 'winter', type: 'Clear', chance: 0.3, cropEffect: 0.5 },
  ]},
  { name: 'QuestChain', mode: 'data', fields: [{ name: 'quest', type: 'string', required: true }, { name: 'description', type: 'string', required: true }, { name: 'objective', type: 'string', required: true }, { name: 'reward', type: 'string', required: true }, { name: 'order', type: 'integer', required: true }], rows: [
    { quest: 'Getting Started', description: 'Plant your first crop', objective: 'Plant 1 Wheat', reward: '100 coins', order: 1 },
    { quest: 'First Harvest', description: 'Harvest your first crop', objective: 'Harvest 3 crops', reward: '200 coins + Tomato seeds', order: 2 },
    { quest: 'Animal Friend', description: 'Buy your first animal', objective: 'Buy 1 Chicken', reward: '5 Eggs', order: 3 },
    { quest: 'Master Chef', description: 'Cook your first recipe', objective: 'Cook Bread', reward: '500 coins', order: 4 },
    { quest: 'Community Builder', description: 'Reach friendship 3 with any NPC', objective: 'Gift 10 items', reward: 'Greenhouse blueprint', order: 5 },
  ]},
]

// ─── Build all data ───────────────────────────────────

const allTableDefs: [string, TableDef[]][] = [
  ['coin-sort-x8k2f', coinSortTables],
  ['idle-heroes-p3m9', idleHeroesTables],
  ['tower-def-r7n4q', towerDefTables],
  ['racing-drift-w5j8', racingDriftTables],
  ['farm-life-k2d6m', farmLifeTables],
]

export function generateSeedData() {
  const schemas: Schema[] = []
  const entries: DataEntry[] = []
  const versions: Version[] = []
  const activities: ActivityLog[] = []

  for (const [projectId, tables] of allTableDefs) {
    let actHour = 100 // spread activities over time

    for (const table of tables) {
      const schemaId = id()
      schemas.push({
        id: schemaId,
        projectId,
        name: table.name,
        mode: table.mode,
        fields: table.fields,
        createdAt: ago(actHour),
        updatedAt: ago(actHour - 5),
      })

      activities.push({
        id: id(), projectId, type: 'table_create',
        message: `Created table "${table.name}"`,
        createdAt: ago(actHour),
      })
      actHour -= 3

      for (const row of table.rows) {
        entries.push({
          id: id(),
          schemaId,
          data: row,
          environment: 'development',
          isActive: true,
          createdAt: ago(actHour),
          updatedAt: ago(actHour),
        })
      }

      activities.push({
        id: id(), projectId, type: 'row_add',
        message: `Added ${table.rows.length} rows to "${table.name}"`,
        createdAt: ago(actHour),
      })
      actHour -= 2
    }

    // Create some versions
    const buildSnapshot = () => {
      const data: Record<string, Record<string, unknown>[]> = {}
      let rowCount = 0
      const projectSchemas = schemas.filter((s) => s.projectId === projectId)
      for (const s of projectSchemas) {
        const rows = entries.filter((e) => e.schemaId === s.id).map((e) => e.data)
        data[s.name] = rows
        rowCount += rows.length
      }
      return { data, tableCount: projectSchemas.length, rowCount }
    }

    const snap = buildSnapshot()

    // dev version
    const devVer: Version = {
      id: id(), projectId, versionTag: 'development-v0.0.1',
      environment: 'development', status: 'active',
      ...snap, publishedAt: ago(20),
    }
    versions.push(devVer)
    activities.push({ id: id(), projectId, type: 'publish', message: `Published development-v0.0.1 to development`, createdAt: ago(20) })

    // staging version
    const stgVer: Version = {
      id: id(), projectId, versionTag: 'staging-v0.0.1',
      environment: 'staging', status: 'active',
      ...snap, publishedAt: ago(12),
    }
    versions.push(stgVer)
    activities.push({ id: id(), projectId, type: 'promote', message: `Promoted development-v0.0.1 → staging as staging-v0.0.1`, createdAt: ago(12) })

    // production for first 2 projects
    if (projectId === 'coin-sort-x8k2f' || projectId === 'idle-heroes-p3m9') {
      const prodVer: Version = {
        id: id(), projectId, versionTag: 'v1.0.1',
        environment: 'production', status: 'active',
        ...snap, publishedAt: ago(6),
      }
      versions.push(prodVer)
      activities.push({ id: id(), projectId, type: 'promote', message: `Promoted staging-v0.0.1 → production as v1.0.1`, createdAt: ago(6) })
    }
  }

  return { projects, schemas, entries, versions, activities }
}
