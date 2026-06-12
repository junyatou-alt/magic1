import { useState, useEffect } from 'react';
import { seedDatabaseIfEmpty } from './db';
import { playMagicSound } from './utils';
import SparkleCanvas from './components/SparkleCanvas';
import DayViewTimeline from './components/DayViewTimeline';
import MonthViewCalendar from './components/MonthViewCalendar';
import WishStore from './components/WishStore';
import GuardianPanel from './components/GuardianPanel';
import { Sparkles, Calendar, Gift, ShieldAlert, Heart, Trophy, Crown, HelpCircle } from 'lucide-react';

export default function App() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // default to today's date formatted as YYYY-MM-DD
    return new Date().toISOString().split('T')[0];
  });
  
  // Crystal bank balance (synchronized with LocalStorage)
  const [crystals, setCrystals] = useState<number>(() => {
    const saved = localStorage.getItem('royal_magic_crystals');
    return saved ? parseInt(saved, 10) : 100; // default seed starts with 100 crystals
  });

  const [activeTab, setActiveTab] = useState<'day' | 'month' | 'wish' | 'guardian'>('day');
  const [isGuardianUnlocked, setIsGuardianUnlocked] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  
  // Sparkle particle emitter booster trigger
  const [sparkleCount, setSparkleCount] = useState<number>(0);

  // Auto seed database and load setup
  useEffect(() => {
    const bootstrap = async () => {
      await seedDatabaseIfEmpty();
      setRefreshTrigger((prev) => prev + 1);
    };
    bootstrap();
  }, []);

  const handleUpdateCrystals = (newBalance: number) => {
    setCrystals(newBalance);
    localStorage.setItem('royal_magic_crystals', newBalance.toString());
  };

  const handleFireSparkles = () => {
    setSparkleCount((c) => c + 1);
  };

  const triggerDataRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleGlassJarClick = () => {
    playMagicSound();
    handleFireSparkles();
  };

  return (
    <div className="min-h-screen bg-[#FFF0F5] bg-gradient-to-tr from-[#FFF0F5] via-[#FFFBFB] to-[#FFE4E1] overflow-hidden flex flex-col relative select-none">
      
      {/* Sparkles backdrop particle layer */}
      <SparkleCanvas fireCount={sparkleCount} />

      {/* MASTER TOP ROYAL BANNER HEADER */}
      <header className="bg-gradient-to-r from-[#FFB6C1] to-[#BA55D3] border-b-4 border-[#FFD700] p-3 px-6 flex flex-col md:flex-row justify-between items-center gap-4 z-40 select-none shadow-lg">
        
        {/* Brand logo & titles with gold crown */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md border-2 border-[#FFD700] animate-float-magic">
            <Crown className="w-7 h-7 text-[#FFD700] filter drop-shadow" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white filter drop-shadow-sm font-serif leading-none">
              皇家魔法日历
            </h1>
            <p className="text-[10px] text-[#FFF0F5] font-black tracking-widest mt-1 uppercase">
              ROYAL MAGIC CALENDAR • Princess Elena's Daily Journey
            </p>
          </div>
        </div>

        {/* ROYAL NAVIGATION TABS */}
        <div className="flex items-center gap-1.5 bg-black/15 p-1 rounded-2xl border border-white/20">
          <button
            onClick={() => setActiveTab('day')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'day'
                ? 'bg-[#FFD700] text-[#BA55D3] shadow-md border border-[#FFD700]'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-4.5 h-4.5" />
            <span>🌞 魔法今日</span>
          </button>

          <button
            onClick={() => setActiveTab('month')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'month'
                ? 'bg-[#FFD700] text-[#BA55D3] shadow-md border border-[#FFD700]'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Calendar className="w-4.5 h-4.5" />
            <span>📅 城堡月历</span>
          </button>

          <button
            onClick={() => setActiveTab('wish')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'wish'
                ? 'bg-[#FFD700] text-[#BA55D3] shadow-md border border-[#FFD700]'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Gift className="w-4.5 h-4.5" />
            <span>✨ 愿望商店</span>
          </button>

          <button
            onClick={() => setActiveTab('guardian')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === 'guardian'
                ? isGuardianUnlocked
                  ? 'bg-fuchsia-600 text-white shadow-md border border-[#FFD700]'
                  : 'bg-[#FFD700] text-purple-900 font-black shadow-md border border-[#FFD700]'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Trophy className="w-4.5 h-4.5" />
            <span>🛡️ 守护者法典</span>
          </button>
        </div>

        {/* Dynamic Glass Crystal Money Jar display */}
        <div
          onClick={handleGlassJarClick}
          className="flex items-center gap-3 magic-glass py-1.5 px-4 rounded-2xl border-2 border-[#FFD700] shadow-md group cursor-pointer hover:scale-105 active:scale-95 transition-all select-none animate-pulse-magic animate-none"
          title="点击收获城堡魔法尘埃！"
        >
          {/* Jar representation (glass bubble containing gold/pink elements) */}
          <div className="relative w-8 h-10 bg-white/40 rounded-t-lg rounded-b-2xl border-2 border-pink-300 flex flex-col justify-end p-0.5 overflow-hidden shadow-inner">
            {/* Crown cap */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-300 to-amber-400 rounded-full" />
            {/* Sparkly crystals level filled up */}
            <div className="w-full h-[65%] bg-gradient-to-t from-pink-400 via-fuchsia-400 to-pink-300 rounded-b-xl relative flex justify-center items-center">
              <span className="text-[8px] text-white animate-pulse-magic">💎</span>
            </div>
            {/* Glowing shine line */}
            <div className="absolute top-1 right-1 w-1 h-6 bg-white/40 rounded-full" />
          </div>

          <div className="text-right">
            <span className="block text-[9px] text-[#4A4A4A] font-black uppercase leading-none">Crystals</span>
            <span className="text-lg md:text-xl font-black text-[#BA55D3] font-mono tracking-tight leading-none">
              💎 {crystals}
            </span>
          </div>

          {isGuardianUnlocked && (
            <span className="text-[10px] bg-fuchsia-100 text-fuchsia-700 italic font-black border border-fuchsia-200 px-1.5 py-0.5 rounded-lg shadow-sm">
              🛡️ 守护中
            </span>
          )}
        </div>
      </header>

      {/* CORE DISPLAY WINDOW STAGE CONTENT */}
      <main className="flex-1 overflow-hidden relative p-4 max-w-7xl mx-auto w-full z-10 flex flex-col justify-center">
        
        {activeTab === 'day' && (
          <DayViewTimeline
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onUpdateCrystals={handleUpdateCrystals}
            crystals={crystals}
            onFireSparkles={handleFireSparkles}
            isGuardianMode={isGuardianUnlocked}
            refreshTrigger={refreshTrigger}
          />
        )}

        {activeTab === 'month' && (
          <MonthViewCalendar
            currentDateStr={selectedDate}
            onSelectDate={(d) => {
              setSelectedDate(d);
              setActiveTab('day'); // transition back to day-view instantly when day is clicked
            }}
            onRefreshTrigger={triggerDataRefresh}
            refreshTrigger={refreshTrigger}
          />
        )}

        {activeTab === 'wish' && (
          <WishStore
            crystals={crystals}
            onUpdateCrystals={handleUpdateCrystals}
            onFireSparkles={handleFireSparkles}
            isGuardianMode={isGuardianUnlocked}
          />
        )}

        {activeTab === 'guardian' && (
          <GuardianPanel
            crystals={crystals}
            onUpdateCrystals={handleUpdateCrystals}
            isGuardianMode={isGuardianUnlocked}
            onToggleGuardianMode={setIsGuardianUnlocked}
            onRefreshData={triggerDataRefresh}
          />
        )}

      </main>

      {/* Bottom Floating Credit Bar */}
      <footer className="py-2 text-center text-[10px] text-pink-400 select-none pointer-events-none z-10">
        👑 皇家城堡魔法历险记 • 9-12 岁每日计划修炼工具 V1.0.0
      </footer>
    </div>
  );
}
