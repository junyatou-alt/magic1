import Dexie, { type Table } from 'dexie';

export interface MagicTask {
  id: string;
  date: string; // YYYY-MM-DD
  title: string; // Princess-themed task string (with emojis)
  startTime: string | null; // e.g. "14:30", or null if in pocket (task storage area)
  durationSlots: number; // 5-minute blocks
  isCompleted: number; // 0 or 1
  isRecurring: number; // 0 or 1 (refresh at midnight)
  crystalReward: number; // default e.g. 10 or 15
}

export type RuleType = 'single' | 'tier';

export interface TierConfig {
  score: number;
  crystals: number;
}

export interface MagicRule {
  id: string;
  ruleName: string;
  type: RuleType;
  config: string; // JSON string of TierConfig[] or {crystals: number}
}

export interface RoyalWish {
  id: string;
  title: string;
  cost: number;
  count: number; // how many times redeemed
}

class RoyalMagicDatabase extends Dexie {
  magic_tasks!: Table<MagicTask>;
  magic_rules!: Table<MagicRule>;
  magic_wishes!: Table<RoyalWish>;

  constructor() {
    super('RoyalMagicCalendarDB');
    this.version(1).stores({
      magic_tasks: 'id, date, startTime, isCompleted',
      magic_rules: 'id, ruleName, type',
      magic_wishes: 'id, title, cost'
    });
  }
}

export const db = new RoyalMagicDatabase();

let seedingPromise: Promise<void> | null = null;

// Seed function to initialize database with cute default values if empty
export function seedDatabaseIfEmpty(): Promise<void> {
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    const taskCount = await db.magic_tasks.count();
    const ruleCount = await db.magic_rules.count();
    const wishCount = await db.magic_wishes.count();

    const today = new Date().toISOString().split('T')[0];

    if (taskCount === 0) {
      const defaultTasks: MagicTask[] = [
        {
          id: 'task_001',
          date: today,
          title: '🩰 练习芭蕾琴键舞步',
          startTime: '08:30',
          durationSlots: 6, // 30 mins
          isCompleted: 1,
          isRecurring: 1,
          crystalReward: 15
        },
        {
          id: 'task_002',
          date: today,
          title: '🦄 谱写星空魔法乐章',
          startTime: '10:00',
          durationSlots: 9, // 45 mins
          isCompleted: 0,
          isRecurring: 1,
          crystalReward: 15
        },
        {
          id: 'task_003',
          date: today,
          title: '👑 倾听皇家公主礼仪课',
          startTime: '14:00',
          durationSlots: 4, // 20 mins
          isCompleted: 0,
          isRecurring: 1,
          crystalReward: 10
        },
        {
          id: 'task_004',
          date: today,
          title: '🧹 整理爱丽丝闪光裙橱',
          startTime: '16:30',
          durationSlots: 6, // 30 mins
          isCompleted: 0,
          isRecurring: 1,
          crystalReward: 10
        },
        // In-pocket items (startTime is null)
        {
          id: 'task_005',
          date: today,
          title: '📖 撰写魔法日记',
          startTime: null,
          durationSlots: 3, // 15 mins
          isCompleted: 0,
          isRecurring: 0,
          crystalReward: 10
        },
        {
          id: 'task_006',
          date: today,
          title: '🎨 绘制星空城堡手卷',
          startTime: null,
          durationSlots: 9, // 45 mins
          isCompleted: 0,
          isRecurring: 0,
          crystalReward: 15
        },
        {
          id: 'task_007',
          date: today,
          title: '🍭 烤制水晶草莓塔糖',
          startTime: null,
          durationSlots: 6, // 30 mins
          isCompleted: 0,
          isRecurring: 0,
          crystalReward: 15
        }
      ];

      await db.magic_tasks.bulkPut(defaultTasks);
    }

    if (ruleCount === 0) {
      const defaultRules: MagicRule[] = [
        {
          id: 'rule_001',
          ruleName: '📝 语文期末挑战',
          type: 'tier',
          config: JSON.stringify([
            { score: 95, crystals: 200 },
            { score: 96, crystals: 250 },
            { score: 100, crystals: 500 }
          ])
        },
        {
          id: 'rule_002',
          ruleName: '🎹 皇家钢琴考级',
          type: 'single',
          config: JSON.stringify([{ score: 100, crystals: 300 }])
        },
        {
          id: 'rule_003',
          ruleName: '🧹 城堡大扫除',
          type: 'single',
          config: JSON.stringify([{ score: 1, crystals: 50 }]) // 1 means complete
        }
      ];

      await db.magic_rules.bulkPut(defaultRules);
    }

    if (wishCount === 0) {
      const defaultWishes: RoyalWish[] = [
        {
          id: 'wish_001',
          title: '🎟️ 看粉红猪小妹/动画 30分钟',
          cost: 300,
          count: 0
        },
        {
          id: 'wish_002',
          title: '🍨 享用梦幻双色马卡龙冰淇淋',
          cost: 450,
          count: 0
        },
        {
          id: 'wish_003',
          title: '🧸 兑换独角兽水晶闪光挂件',
          cost: 600,
          count: 0
        },
        {
          id: 'wish_004',
          title: '🎠 城堡梦幻旋转木马半日游',
          cost: 1500,
          count: 0
        }
      ];

      await db.magic_wishes.bulkPut(defaultWishes);
    }
  })();

  return seedingPromise;
}
