import React, { useState, useEffect } from 'react';
import { db, MagicRule, MagicTask, RoyalWish, seedDatabaseIfEmpty } from '../db';
import { playMagicSound } from '../utils';
import { ShieldCheck, LogOut, RefreshCw, Key, Download, Upload, Plus, Trash2, Trophy, Settings } from 'lucide-react';

interface GuardianPanelProps {
  crystals: number;
  onUpdateCrystals: (val: number) => void;
  isGuardianMode: boolean;
  onToggleGuardianMode: (val: boolean) => void;
  onRefreshData: () => void;
}

export default function GuardianPanel({
  crystals,
  onUpdateCrystals,
  isGuardianMode,
  onToggleGuardianMode,
  onRefreshData
}: GuardianPanelProps) {
  // Passcode login states
  const [passwordInput, setPasswordInput] = useState('');
  const [pwError, setPwError] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Rules management states
  const [rules, setRules] = useState<MagicRule[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<'single' | 'tier'>('single');
  const [singleValue, setSingleValue] = useState(50);
  const [tiers, setTiers] = useState<{ score: number; crystals: number }[]>([
    { score: 95, crystals: 100 },
    { score: 100, crystals: 300 }
  ]);

  // Awarding states
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [scoreInput, setScoreInput] = useState<number>(95);
  const [awardFeedback, setAwardFeedback] = useState<string | null>(null);

  // Storage states
  const [isPersisted, setIsPersisted] = useState(false);

  useEffect(() => {
    loadRules();
    checkPersistence();
  }, []);

  const loadRules = async () => {
    const r = await db.magic_rules.toArray();
    setRules(r);
    if (r.length > 0) {
      setSelectedRuleId(r[0].id);
    }
  };

  // Secure Persistent Storage request
  const checkPersistence = async () => {
    if (navigator.storage && navigator.storage.persist) {
      const persisted = await navigator.storage.persisted();
      setIsPersisted(persisted);
    }
  };

  const requestPersistence = async () => {
    if (navigator.storage && navigator.storage.persist) {
      const persisted = await navigator.storage.persist();
      setIsPersisted(persisted);
      if (persisted) {
        alert('✨ 成功！皇家存储空间已被系统永久锁定保护。');
      } else {
        alert('🧁 永久存储请求受限，iPad 或手机可能有系统限制，但不影响本地使用哦！');
      }
    }
  };

  // Password Unlock
  const handlePasswordUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const savedPin = localStorage.getItem('royal_guardian_password') || '1234';
    if (passwordInput === savedPin) {
      onToggleGuardianMode(true);
      setPasswordInput('');
      setPwError(false);
      playMagicSound();
    } else {
      setPwError(true);
      setPasswordInput('');
    }
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length !== 4 || !/^\d+$/.test(newPassword)) {
      alert('🔒 密码必须是 4 位纯数字哦！');
      return;
    }
    localStorage.setItem('royal_guardian_password', newPassword);
    alert(`👑 守护者密码修改成功！新密码为: ${newPassword}`);
    setNewPassword('');
    setIsChangingPw(false);
  };

  // Rule additions
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;

    let configStr = '';
    if (newRuleType === 'single') {
      configStr = JSON.stringify([{ score: 1, crystals: singleValue }]);
    } else {
      // Sort tiers ascending by score
      const sortedTiers = [...tiers].sort((a, b) => a.score - b.score);
      configStr = JSON.stringify(sortedTiers);
    }

    const newRule: MagicRule = {
      id: `rule_${Date.now()}`,
      ruleName: newRuleName.trim(),
      type: newRuleType,
      config: configStr
    };

    await db.magic_rules.add(newRule);
    setNewRuleName('');
    setShowAddRule(false);
    loadRules();
    playMagicSound();
  };

  const handleDeleteRule = async (id: string) => {
    await db.magic_rules.delete(id);
    loadRules();
  };

  const handleAddTierRow = () => {
    setTiers([...tiers, { score: 90, crystals: 50 }]);
  };

  const handleRemoveTierRow = (idx: number) => {
    setTiers(tiers.filter((_, i) => i !== idx));
  };

  const handleTierChange = (index: number, field: 'score' | 'crystals', value: number) => {
    const updated = [...tiers];
    updated[index] = { ...updated[index], [field]: value };
    setTiers(updated);
  };

  // Manual point disbursement
  const handleAwardRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setAwardFeedback(null);
    const rule = rules.find((r) => r.id === selectedRuleId);
    if (!rule) return;

    let reward = 0;
    const ruleConfig = JSON.parse(rule.config);

    if (rule.type === 'single') {
      reward = ruleConfig[0]?.crystals || 0;
    } else {
      // Ladder config search for highest matching score reached
      // e.g., if ladder is score 95 -> 200, 96 -> 250, 100 -> 500
      // and children scored 98. Reward is 250! (Since 95 and 96 are satisfied)
      let matched = null;
      for (const t of ruleConfig) {
        if (scoreInput >= t.score) {
          matched = t;
        }
      }
      if (matched) {
        reward = matched.crystals;
      } else {
        alert(`🎈 分数 ${scoreInput} 未达到任意奖励门槛哦，继续加油！`);
        return;
      }
    }

    const updatedCrystals = crystals + reward;
    onUpdateCrystals(updatedCrystals);
    playMagicSound();
    setAwardFeedback(`✨ 成功颁发水晶！【${rule.ruleName}】奖励了 💎 ${reward} 水晶！`);
    setTimeout(() => setAwardFeedback(null), 5000);
  };

  // Export Database Backup File (.json)
  const handleExportBackup = async () => {
    try {
      const allTasks = await db.magic_tasks.toArray();
      const allRules = await db.magic_rules.toArray();
      const allWishes = await db.magic_wishes.toArray();

      const backupObj = {
        meta: {
          app: 'RoyalMagicCalendar',
          exportedAt: new Date().toISOString(),
          crystalBalance: crystals,
          guardianPassword: localStorage.getItem('royal_guardian_password') || '1234'
        },
        tasks: allTasks,
        rules: allRules,
        wishes: allWishes
      };

      const jsonStr = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `royal_magic_calendar_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('备份导出失败: ' + err);
    }
  };

  // Import Database Backup File (.json)
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonContent = event.target?.result as string;
        const backupObj = JSON.parse(jsonContent);

        if (backupObj.meta?.app !== 'RoyalMagicCalendar') {
          alert('❌ 格式不正确！必须是皇家魔法日历专属备份。');
          return;
        }

        const confirmImport = window.confirm(
          '👑 确定导入备份吗？这会覆盖这台设备现有的全部魔法日历数据！'
        );
        if (!confirmImport) return;

        // Clean tables
        await db.magic_tasks.clear();
        await db.magic_rules.clear();
        await db.magic_wishes.clear();

        // Restore lists
        if (backupObj.tasks) await db.magic_tasks.bulkAdd(backupObj.tasks);
        if (backupObj.rules) await db.magic_rules.bulkAdd(backupObj.rules);
        if (backupObj.wishes) await db.magic_wishes.bulkAdd(backupObj.wishes);

        // Restore settings
        if (backupObj.meta.crystalBalance !== undefined) {
          onUpdateCrystals(backupObj.meta.crystalBalance);
        }
        if (backupObj.meta.guardianPassword) {
          localStorage.setItem('royal_guardian_password', backupObj.meta.guardianPassword);
        }

        alert('🎉 魔法水晶及所有日历日记已成功复原！');
        onRefreshData();
      } catch (err) {
        alert('解析备份文件失败，可能文件损坏：' + err);
      }
    };
    reader.readAsText(file);
  };

  // Quick reset to defaults
  const handleResetDefaults = async () => {
    const force = window.confirm('🦄 确定要重设为城堡出厂默认数据吗？(已有数据会被覆盖哦)');
    if (!force) return;
    await db.magic_tasks.clear();
    await db.magic_rules.clear();
    await db.magic_wishes.clear();
    await seedDatabaseIfEmpty();
    onUpdateCrystals(100);
    localStorage.setItem('royal_guardian_password', '1234');
    alert('✨ 城堡数据库已重设！');
    onRefreshData();
  };

  return (
    <div id="guardian-panel" className="bg-white/80 p-6 rounded-2xl lace-border shadow-xl overflow-y-auto max-h-[80vh] font-sans">
      
      {/* Top Banner */}
      <div className="flex justify-between items-center pb-4 border-b-2 border-pink-100 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-[#BA55D3] shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#BA55D3] font-serif">🛡️ 守护者法典 (家长空间)</h2>
            <p className="text-xs text-neutral-500">守护者的魔法密码用来管理奖分、编辑计划及安全备份</p>
          </div>
        </div>

        {isGuardianMode && (
          <button
            onClick={() => onToggleGuardianMode(false)}
            className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-xs font-bold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            锁定家长模式
          </button>
        )}
      </div>

      {/* Lock Screen */}
      {!isGuardianMode ? (
        <div className="py-8 max-w-sm mx-auto text-center">
          <Key className="w-12 h-12 text-[#BA55D3] mx-auto mb-3 animate-float-magic" />
          <h3 className="text-md font-bold text-neutral-700">进入守护者圣殿</h3>
          <p className="text-xs text-neutral-500 mt-1 mb-4">需要输入 4 位纯数字密码（初始密码是 1234）</p>

          <form onSubmit={handlePasswordUnlock} className="flex gap-2 justify-center max-w-xs mx-auto">
            <input
              type="password"
              maxLength={4}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value.replace(/\D/g, ''))}
              placeholder="密码"
              className="w-24 text-center px-3 py-2 border-2 border-[#FFB6C1] focus:border-[#BA55D3] focus:outline-none rounded-xl font-bold tracking-widest text-lg animate-float-magic"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-[#FFB6C1] to-[#BA55D3] text-white rounded-xl text-xs font-bold shadow hover:brightness-110"
            >
              契约开启
            </button>
          </form>

          {pwError && (
            <p className="text-xs text-red-500 font-bold mt-3 animate-shake-magic">
              ❌ 守护者魔法密码不对哦，请重新检查！
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Quick Crystals Disbursement */}
          <section className="bg-gradient-to-r from-amber-50 to-orange-50/70 p-4 rounded-2xl border-2 border-amber-200">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-1 mb-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              1. 立即派发魔法水晶奖励
            </h3>
            <p className="text-[11px] text-amber-700 mb-4 leading-normal">
              小公主实现了现实挑战（比如：测验、家务大作战）？在此登记分数并派发水晶吧：
            </p>

            {rules.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-2">目前还没有配置任何额外积分挑战法规。</p>
            ) : (
              <form onSubmit={handleAwardRule} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-[11px] text-neutral-600 mb-1 font-bold">请选择对应契约</label>
                  <select
                    value={selectedRuleId}
                    onChange={(e) => setSelectedRuleId(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-amber-200 bg-white"
                  >
                    {rules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.ruleName} ({r.type === 'single' ? '单次奖励' : '级联挑战'})
                      </option>
                    ))}
                  </select>
                </div>

                {rules.find((r) => r.id === selectedRuleId)?.type === 'tier' && (
                  <div>
                    <label className="block text-[11px] text-neutral-600 mb-1 font-bold">小公主获得的分数</label>
                    <input
                      type="number"
                      min="0"
                      max="150"
                      value={scoreInput}
                      onChange={(e) => setScoreInput(parseInt(e.target.value, 10) || 0)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-amber-200 bg-white"
                    />
                  </div>
                )}

                <div className="md:col-span-1">
                  <button
                    type="submit"
                    className="w-full px-4 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 font-bold rounded-xl text-xs hover:brightness-105 shadow-sm active:scale-95 transition-all text-center"
                  >
                    ✨ 派发水晶奖励
                  </button>
                </div>
              </form>
            )}

            {awardFeedback && (
              <p className="text-xs text-green-700 font-bold mt-3 bg-white p-2 rounded-lg border border-green-200 text-center">
                {awardFeedback}
              </p>
            )}
          </section>

          {/* Rules Configuration */}
          <section className="bg-neutral-50 p-4 rounded-xl border border-[#FFB6C1]/40">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-1">
                <Settings className="w-4 h-4 text-[#BA55D3]" />
                2. 自由法典积分契约制定
              </h3>
              <button
                onClick={() => {
                  setShowAddRule(!showAddRule);
                  setNewRuleName('');
                  setTiers([
                    { score: 95, crystals: 200 },
                    { score: 100, crystals: 500 }
                  ]);
                }}
                className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-neutral-100 border border-[#FFB6C1] rounded-lg text-xs"
              >
                <Plus className="w-3 h-3" />
                新建法则
              </button>
            </div>

            {/* Form to add rules */}
            {showAddRule && (
              <form onSubmit={handleAddRule} className="bg-white p-4 rounded-xl border border-neutral-200 mb-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">契约挑战名称 (如 📝 语文期末考)</label>
                    <input
                      type="text"
                      placeholder="文字带有公主 Emoji 更讨喜哦"
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">契约类型</label>
                    <select
                      value={newRuleType}
                      onChange={(e) => setNewRuleType(e.target.value as 'single' | 'tier')}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200"
                    >
                      <option value="single">单次目标 (做完即奖指定水晶)</option>
                      <option value="tier">阶梯目标 (根据分数不同，奖励不同)</option>
                    </select>
                  </div>
                </div>

                {newRuleType === 'single' ? (
                  <div className="mb-3">
                    <label className="block text-[11px] text-neutral-500 mb-1">达成时奖励魔力水晶数</label>
                    <input
                      type="number"
                      min="1"
                      value={singleValue}
                      onChange={(e) => setSingleValue(parseInt(e.target.value, 10) || 50)}
                      className="w-32 text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200"
                    />
                  </div>
                ) : (
                  <div className="mb-3 p-3 bg-[#FFF0F5] rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold text-[#BA55D3]">配置阶梯积分表：</span>
                      <button
                        type="button"
                        onClick={handleAddTierRow}
                        className="text-[10px] text-[#BA55D3] font-bold hover:underline"
                      >
                        ➕ 增添分数线
                      </button>
                    </div>

                    <div className="space-y-2">
                      {tiers.map((t, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-neutral-500">达到分数：</span>
                          <input
                            type="number"
                            min="1"
                            value={t.score}
                            onChange={(e) => handleTierChange(idx, 'score', parseInt(e.target.value, 10) || 0)}
                            className="w-16 text-xs px-1.5 py-1 rounded border"
                          />
                          <span className="text-xs font-semibold text-neutral-500">奖励水晶：</span>
                          <input
                            type="number"
                            min="1"
                            value={t.crystals}
                            onChange={(e) => handleTierChange(idx, 'crystals', parseInt(e.target.value, 10) || 0)}
                            className="w-20 text-xs px-1.5 py-1 rounded border"
                          />
                          {tiers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTierRow(idx)}
                              className="text-red-500 text-xs font-bold hover:underline"
                            >
                              删除
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setShowAddRule(false)}
                    className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 bg-pink-500 text-white font-bold rounded-lg text-xs hover:bg-pink-600"
                  >
                    保存法则
                  </button>
                </div>
              </form>
            )}

            {/* List of active rules */}
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {rules.map((r) => {
                const conf = JSON.parse(r.config);
                return (
                  <div key={r.id} className="flex justify-between items-center p-2.5 bg-white rounded-xl border hover:bg-neutral-50/50">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-700">{r.ruleName}</h4>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        {r.type === 'single'
                          ? `单次契约: 💎 +${conf[0]?.crystals} 水晶`
                          : `级联契约: 包括 ${conf.length} 阶层 (${conf.map((c: any) => `${c.score}分👉💎${c.crystals}`).join(', ')})`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(r.id)}
                      className="p-1 text-gray-300 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {rules.length === 0 && (
                <p className="text-xs text-neutral-400 text-center py-4">无规则。制定几条可以让孩子更加主动地学习！</p>
              )}
            </div>
          </section>

          {/* Backup, Persistent Storage & Factory Reset */}
          <section className="bg-neutral-50 p-4 rounded-2xl border-2 border-neutral-200">
            <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-1 mb-2">
              <Download className="w-4 h-4 text-fuchsia-500" />
              3. 城堡安全备份与数据稳固
            </h3>
            <p className="text-[11px] text-neutral-500 mb-4 leading-normal">
              保护魔法财产不丢失！在此备份、恢复或锁定本地储存权限，安全 100% 不留云端服务器。
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <button
                onClick={handleExportBackup}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-xl text-xs font-bold shadow-sm"
              >
                <Download className="w-4 h-4" />
                导出备份 (.json)
              </button>

              <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-fuchsia-100 hover:bg-fuchsia-200 text-fuchsia-800 rounded-xl text-xs font-bold shadow-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                导入备份卷轴
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2 p-3 bg-white rounded-xl border border-neutral-200 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-neutral-700">持久存储保护状态：</span>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  isPersisted ? 'bg-green-150 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {isPersisted ? '🔒 开启(永不清理)' : '🔑 暂未激活'}
                </span>
              </div>
              {!isPersisted && (
                <button
                  onClick={requestPersistence}
                  className="text-left text-[10px] text-pink-600 hover:underline font-bold"
                >
                  👉 点击向浏览器申请“防系统垃圾清理”特权
                </button>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-neutral-200 text-xs">
              <button
                onClick={handleResetDefaults}
                className="text-red-500 hover:underline text-[10px] font-bold"
              >
                ⚠️ 重设城堡数据库 (恢复出厂)
              </button>
              <span className="text-[10px] text-neutral-400">
                PWA 100% 离线保护中
              </span>
            </div>
          </section>

          {/* Change Lock Passcode */}
          <section className="bg-neutral-50 p-4 rounded-2xl border-2 border-neutral-200">
            <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-1 mb-2">
              <Key className="w-4 h-4 text-fuchsia-500" />
              4. 修改守护者密码
            </h3>

            {!isChangingPw ? (
              <button
                onClick={() => setIsChangingPw(true)}
                className="text-xs text-pink-600 hover:underline"
              >
                👉 点击修改当前首屏密码及愿望锁
              </button>
            ) : (
              <form onSubmit={handleUpdatePassword} className="flex items-end gap-2 max-w-xs">
                <div>
                  <label className="block text-[11px] text-neutral-500 mb-0.5">输入新密码 (4位纯数字)</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, ''))}
                    placeholder="新密码"
                    className="w-24 text-xs px-2 py-1.5 rounded-lg border border-neutral-300 font-bold tracking-widest"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-fuchsia-500 text-white rounded-lg text-xs font-bold"
                >
                  确认修改
                </button>
                <button
                  type="button"
                  onClick={() => setIsChangingPw(false)}
                  className="px-2 py-1.5 text-neutral-500 text-xs hover:underline"
                >
                  取消
                </button>
              </form>
            )}
          </section>

        </div>
      )}

    </div>
  );
}
