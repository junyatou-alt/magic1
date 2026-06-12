import React, { useState, useEffect } from 'react';
import { db, RoyalWish } from '../db';
import { playWishSound } from '../utils';
import { Sparkles, Trash2, Plus, Gift, Check, Lock, X } from 'lucide-react';

interface WishStoreProps {
  crystals: number;
  onUpdateCrystals: (newVal: number) => void;
  onFireSparkles: () => void;
  isGuardianMode: boolean; // if parent is currently unlocked
}

export default function WishStore({
  crystals,
  onUpdateCrystals,
  onFireSparkles,
  isGuardianMode
}: WishStoreProps) {
  const [wishes, setWishes] = useState<RoyalWish[]>([]);
  const [showAddWish, setShowAddWish] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCost, setNewCost] = useState(100);

  // Padlock State
  const [pincodeModal, setPincodeModal] = useState<{ isOpen: boolean; wish: RoyalWish | null }>({
    isOpen: false,
    wish: null
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Load Wishes
  const loadWishes = async () => {
    const list = await db.magic_wishes.toArray();
    setWishes(list);
  };

  useEffect(() => {
    loadWishes();
  }, []);

  const handleCreateWish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newCost <= 0) return;

    const newWish: RoyalWish = {
      id: `wish_${Date.now()}`,
      title: newTitle.trim(),
      cost: newCost,
      count: 0
    };

    await db.magic_wishes.add(newWish);
    setNewTitle('');
    setNewCost(100);
    setShowAddWish(false);
    loadWishes();
  };

  const handleDeleteWish = async (id: string) => {
    await db.magic_wishes.delete(id);
    loadWishes();
  };

  // Open transaction verification
  const handleRedeemClick = (wish: RoyalWish) => {
    if (crystals < wish.cost) {
      alert('🌟 抱歉，魔力水晶不足，继续加油完成魔法挑战吧！');
      return;
    }

    if (isGuardianMode) {
      // Parents are already verified, redeem immediately!
      executeRedeem(wish);
    } else {
      // Ask parents passcode
      setPinInput('');
      setPinError(false);
      setPincodeModal({ isOpen: true, wish });
    }
  };

  const handlePinKeyPress = (num: string) => {
    if (pinInput.length >= 4) return;
    const nextVal = pinInput + num;
    setPinInput(nextVal);
    setPinError(false);

    if (nextVal.length === 4) {
      verifyGuardianPasscode(nextVal);
    }
  };

  const handleBackspace = () => {
    setPinInput(pinInput.slice(0, -1));
  };

  const verifyGuardianPasscode = (code: string) => {
    const savedPin = localStorage.getItem('royal_guardian_password') || '1234';
    if (code === savedPin) {
      if (pincodeModal.wish) {
        executeRedeem(pincodeModal.wish);
      }
      setPincodeModal({ isOpen: false, wish: null });
    } else {
      setPinError(true);
      setPinInput('');
      playNotesError();
    }
  };

  const playNotesError = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const executeRedeem = async (wish: RoyalWish) => {
    // Deduct
    const updatedCrystals = crystals - wish.cost;
    onUpdateCrystals(updatedCrystals);

    // Update count in database
    await db.magic_wishes.update(wish.id, {
      count: wish.count + 1
    });

    playWishSound();
    onFireSparkles();
    loadWishes();
  };

  return (
    <div id="wish-store" className="bg-white/80 p-5 rounded-2xl lace-border shadow-xl overflow-y-auto max-h-[80vh] font-sans">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-[#FFD700] to-[#BA55D3] rounded-full flex items-center justify-center text-white shadow-md animate-float-magic">
            <Gift className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#BA55D3] font-serif">皇室愿望商店</h2>
            <p className="text-xs text-neutral-500 font-bold">用自律和特训积累的魔力水晶，唤醒心中的美妙心愿</p>
          </div>
        </div>

        {isGuardianMode && (
          <button
            onClick={() => setShowAddWish(!showAddWish)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-400 to-[#BA55D3] text-white rounded-xl text-xs font-bold shadow-md hover:brightness-110 transition-all border border-[#FFD700]"
          >
            <Plus className="w-3.5 h-3.5" />
            添加新愿望
          </button>
        )}
      </div>

      {/* Add New Wish Form */}
      {showAddWish && (
        <form onSubmit={handleCreateWish} className="bg-white p-4 rounded-2xl border-2 border-pink-200 mb-6 shadow-inner animate-fade-in">
          <h3 className="text-sm font-bold text-[#BA55D3] mb-3 flex items-center gap-1">🌟 添加皇家魔法心愿</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-pink-600 font-bold mb-1">愿望名称 (推荐带 Emoji)</label>
              <input
                type="text"
                placeholder="例如：🎠 享受家庭草坪野餐一次"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full text-sm px-3 py-2 rounded-xl border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-pink-600 font-bold mb-1">消耗水晶数</label>
              <input
                type="number"
                min="10"
                value={newCost}
                onChange={(e) => setNewCost(parseInt(e.target.value, 10) || 100)}
                className="w-full text-sm px-3 py-2 rounded-xl border border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-300"
                required
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowAddWish(false)}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-semibold"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl text-xs font-bold shadow"
            >
              确立愿望
            </button>
          </div>
        </form>
      )}

      {/* Wishes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {wishes.map((w) => {
          const canAfford = crystals >= w.cost;
          return (
            <div
              key={w.id}
              className={`relative bg-gradient-to-b from-white to-pink-50/35 p-4 rounded-2xl border-2 transition-all duration-300 shadow-xs ${
                canAfford ? 'border-[#FFD700] hover:scale-[1.01] hover:shadow-md bg-white' : 'border-neutral-200 opacity-90'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-2">
                  <span className="text-xl filter drop-shadow">📜</span>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 leading-tight">{w.title}</h4>
                    <p className="text-[11px] text-pink-500 font-semibold mt-1 flex items-center gap-0.5">
                      💎 {w.cost} 水晶
                    </p>
                    {w.count > 0 && (
                      <span className="inline-block mt-1 px-1.5 py-0.5 bg-pink-100/60 text-[9px] text-pink-700 rounded font-bold">
                        👑 已唤醒 {w.count} 次
                      </span>
                    )}
                  </div>
                </div>

                {isGuardianMode && (
                  <button
                    onClick={() => handleDeleteWish(w.id)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    title="删除此愿望"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => handleRedeemClick(w)}
                  disabled={!canAfford}
                  className={`relative overflow-hidden flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black shadow-sm transition-all focus:outline-none ${
                    canAfford
                      ? 'bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-amber-950 font-bold hover:brightness-105 active:scale-95 cursor-pointer border border-yellow-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                  }`}
                >
                  {canAfford ? (
                    <>
                      <Sparkles className="w-3 h-3 text-amber-700 animate-pulse-magic" />
                      <span>魔法兑换</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-gray-400" />
                      <span>水晶不足</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {wishes.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-400 text-sm">
            🎐 目前没有魔法愿望，请在右上角解锁“守护者模式”添加些愿望吧！
          </div>
        )}
      </div>

      {/* Pads Lock Guardian Verification Overlay Modals */}
      {pincodeModal.isOpen && pincodeModal.wish && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-white to-pink-50 p-6 rounded-3xl border-4 border-pink-200 shadow-2xl max-w-sm w-full relative font-sans animate-float-magic text-center">
            
            <button
              onClick={() => setPincodeModal({ isOpen: false, wish: null })}
              className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-neutral-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 bg-gradient-to-tr from-pink-400 to-fuchsia-500 rounded-full flex items-center justify-center text-white mx-auto shadow-md mb-3">
              <Lock className="w-8 h-8 text-white" />
            </div>

            <h3 className="text-lg font-bold text-pink-700 font-serif">守护者密码验证</h3>
            <p className="text-xs text-pink-500 mt-1 mb-3">
              正在激活：{pincodeModal.wish.title} (<span className="text-amber-600 font-bold">💎{pincodeModal.wish.cost}</span>)<br/>
              请爸爸/妈妈输入 4 位魔法密码确认：
            </p>

            {/* Bubble Code View */}
            <div className={`flex justify-center gap-3 mb-5 py-2 px-4 bg-white/75 rounded-2xl border-2 max-w-[200px] mx-auto ${pinError ? 'border-red-300 bg-red-50/50 animate-shake-magic' : 'border-pink-200'}`}>
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    idx < pinInput.length
                      ? 'bg-pink-500 border-pink-600 scale-110 shadow-md'
                      : 'bg-pink-100 border-pink-200'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-[11px] text-red-500 font-bold mb-3 animate-pulse">
                ❌ 魔法密码错误，悄悄问父母试试！默认是 1234
              </p>
            )}

            {/* Numerical Pad */}
            <div className="grid grid-cols-3 gap-3 max-w-[220px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinKeyPress(num)}
                  className="w-14 h-14 bg-white hover:bg-pink-100 text-pink-700 font-bold rounded-2xl border border-pink-150 shadow-sm text-lg active:scale-95 transition-all flex items-center justify-center"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleBackspace}
                className="w-14 h-14 bg-pink-100 hover:bg-pink-200 text-pink-700 rounded-2xl flex items-center justify-center font-bold"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => handlePinKeyPress('0')}
                className="w-14 h-14 bg-white hover:bg-pink-100 text-pink-700 font-bold rounded-2xl border border-pink-150 shadow-sm text-lg flex items-center justify-center"
              >
                0
              </button>
              <div className="w-14 h-14 flex items-center justify-center text-xs text-pink-300 font-bold">
                城堡
              </div>
            </div>
            
            <div className="text-[10px] text-pink-400 mt-4 leading-normal">
              守护者密码可在“守护者法典”板块更改
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
