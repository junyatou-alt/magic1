import React, { useState, useEffect, useRef } from 'react';
import { db, MagicTask } from '../db';
import { playMagicSound } from '../utils';
import { Calendar, ChevronLeft, ChevronRight, Share2, HelpCircle, FileCheck, CheckCircle, ArrowRight } from 'lucide-react';

interface MonthViewCalendarProps {
  currentDateStr: string;
  onSelectDate: (dStr: string) => void;
  onRefreshTrigger: () => void;
  refreshTrigger: number;
}

export default function MonthViewCalendar({
  currentDateStr,
  onSelectDate,
  onRefreshTrigger,
  refreshTrigger
}: MonthViewCalendarProps) {
  const [activeMonthDate, setActiveMonthDate] = useState<Date>(new Date(currentDateStr));
  const [monthTasks, setMonthTasks] = useState<MagicTask[]>([]);
  
  // Dragging states
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [movingTaskTitle, setMovingTaskTitle] = useState<string>('');

  // Read tasks for the whole month grid view
  const loadMonthTasks = async () => {
    // Read all tasks so we can sort them by date locally
    const list = await db.magic_tasks.toArray();
    setMonthTasks(list);
  };

  useEffect(() => {
    loadMonthTasks();
  }, [activeMonthDate, refreshTrigger]);

  // Calendar grid calculations
  const year = activeMonthDate.getFullYear();
  const month = activeMonthDate.getMonth(); // 0-11

  const getDaysInGrid = () => {
    // First day of current month
    const firstDay = new Date(year, month, 1);
    // Index of first day 0 (Sunday) to 6 (Saturday)
    const startOfWeekDay = firstDay.getDay();

    // Total days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const gridCells: { dateStr: string; isCurrentMonth: boolean; dayNum: number }[] = [];

    // Back-fill previous month's days
    const prevMonthDaysCount = new Date(year, month, 0).getDate();
    for (let i = startOfWeekDay - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthDaysCount - i);
      const mStr = (prevDate.getMonth() + 1).toString().padStart(2, '0');
      const dStr = prevDate.getDate().toString().padStart(2, '0');
      gridCells.push({
        dateStr: `${prevDate.getFullYear()}-${mStr}-${dStr}`,
        isCurrentMonth: false,
        dayNum: prevDate.getDate()
      });
    }

    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      const mStr = (month + 1).toString().padStart(2, '0');
      const dStr = i.toString().padStart(2, '0');
      gridCells.push({
        dateStr: `${year}-${mStr}-${dStr}`,
        isCurrentMonth: true,
        dayNum: i
      });
    }

    // Front-fill next month's days to fit standard 35 grid or 42 grid
    const totalCellsNeeded = gridCells.length <= 35 ? 35 : 42;
    const nextMonthDaysAdded = totalCellsNeeded - gridCells.length;
    for (let i = 1; i <= nextMonthDaysAdded; i++) {
      const nextDate = new Date(year, month + 1, i);
      const mStr = (nextDate.getMonth() + 1).toString().padStart(2, '0');
      const dStr = nextDate.getDate().toString().padStart(2, '0');
      gridCells.push({
        dateStr: `${nextDate.getFullYear()}-${mStr}-${dStr}`,
        isCurrentMonth: false,
        dayNum: i
      });
    }

    return gridCells;
  };

  // Move month
  const handleMoveMonth = (offset: number) => {
    const nextVal = new Date(activeMonthDate);
    nextVal.setMonth(nextVal.getMonth() + offset);
    setActiveMonthDate(nextVal);
  };

  // -----------------------------------------------------------------
  // Gesture-driven Calendar Drag And Drop Migration ("任务搬家")
  // -----------------------------------------------------------------
  const handleTaskPointerDown = (e: React.PointerEvent, task: MagicTask) => {
    e.stopPropagation();
    setMovingTaskId(task.id);
    setMovingTaskTitle(task.title);
    setDragPosition({ x: e.clientX, y: e.clientY });

    // Capture pointers
    const target = e.target as HTMLElement;
    target.setPointerCapture(e.pointerId);
  };

  const handleTaskPointerMove = (e: React.PointerEvent) => {
    if (!movingTaskId) return;
    setDragPosition({ x: e.clientX, y: e.clientY });
  };

  const handleTaskPointerUp = async (e: React.PointerEvent) => {
    if (!movingTaskId) return;
    const target = e.target as HTMLElement;
    target.releasePointerCapture(e.pointerId);

    // Capture whatever element is lying under the cursor
    const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
    let targetDayCell = elementUnderCursor?.closest('[data-cell-date]');

    if (targetDayCell) {
      const targetDate = targetDayCell.getAttribute('data-cell-date');
      if (targetDate) {
        // Carry out the date change migration!
        await db.magic_tasks.update(movingTaskId, {
          date: targetDate
        });
        playMagicSound();
        onRefreshTrigger();
      }
    }

    setMovingTaskId(null);
    setMovingTaskTitle('');
    loadMonthTasks();
  };

  const gridDays = getDaysInGrid();

  return (
    <div className="bg-white/80 p-5 rounded-2xl lace-border shadow-xl overflow-hidden flex flex-col h-[82vh] font-sans relative">
      
      {/* Month Selection Bar */}
      <div className="flex justify-between items-center mb-4 select-none">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#BA55D3] animate-float-magic" />
          <h2 className="text-xl font-bold text-[#BA55D3] font-serif">
            {year}年 {month + 1}月 《城堡魔法日历》
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleMoveMonth(-1)}
            className="p-1 rounded-full bg-white border hover:bg-pink-100 text-pink-700 font-bold shadow-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setActiveMonthDate(new Date())}
            className="px-2.5 py-1 text-xs bg-white hover:bg-pink-100 border border-[#FFB6C1] text-pink-800 rounded-lg shadow-sm font-bold"
          >
            回到今月
          </button>

          <button
            onClick={() => handleMoveMonth(1)}
            className="p-1 rounded-full bg-white border hover:bg-pink-100 text-pink-700 font-bold shadow-sm transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="text-[11px] text-[#BA55D3] font-bold mb-2 leading-relaxed select-none">
        🪄 主角秘法：长按某一天的任务糖果块，可以拖拽至其他格子为任务搬家哦！
      </div>

      {/* Weekdays indicator heading */}
      <div className="grid grid-cols-7 text-center font-bold text-xs py-2 bg-[#FFF0F5] text-[#BA55D3] rounded-xl mb-2 select-none">
        <div>星期日</div>
        <div>星期一</div>
        <div>星期二</div>
        <div>星期三</div>
        <div>星期四</div>
        <div>星期五</div>
        <div>星期六</div>
      </div>

      {/* Calendar Matrix Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-2 overflow-hidden select-none">
        {gridDays.map((cell) => {
          // Find tasks for this day
          const dayTasks = monthTasks.filter((t) => t.date === cell.dateStr);
          const hasTasks = dayTasks.length > 0;
          const allCompleted = hasTasks && dayTasks.every((t) => t.isCompleted === 1);
          const isSelected = cell.dateStr === currentDateStr;

          return (
            <div
              key={cell.dateStr}
              id={`month-cell-${cell.dateStr}`}
              data-cell-date={cell.dateStr}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`relative p-1 md:p-2 rounded-2xl border-2 flex flex-col justify-between overflow-hidden transition-all group cursor-pointer ${
                cell.isCurrentMonth ? 'bg-white' : 'bg-[#FFF0F5]/20 opacity-60'
              } ${
                isSelected
                  ? 'border-[#BA55D3] ring-4 ring-[#FFB6C1]/45 shadow-md bg-purple-50/10'
                  : 'border-[#FFB6C1]/40 hover:border-[#BA55D3]'
              }`}
            >
              {/* Day Number / Perfect Stamp */}
              <div className="flex justify-between items-center z-10">
                <span className={`text-[11px] md:text-xs font-bold font-mono px-1.5 py-0.5 rounded-lg ${
                  cell.isCurrentMonth ? 'text-pink-900 bg-pink-100/30' : 'text-neutral-400'
                }`}>
                  {cell.dayNum}
                </span>

                {/* Perfect Stamp Gem: Spinning pink heart gem 💖 */}
                {allCompleted && (
                  <span
                    className="text-lg md:text-xl filter drop-shadow animate-float-magic"
                    title="璀璨晶钻！今天全能量打卡通关！"
                  >
                    💖
                  </span>
                )}
              </div>

              {/* Day Mini Tasks pills list */}
              <div className="flex-1 overflow-y-auto mt-1.5 space-y-1 scrollbar-none pr-0.5 max-h-[100px] z-10 pointer-events-auto">
                {dayTasks.map((t) => (
                  <div
                    key={t.id}
                    onPointerDown={(e) => handleTaskPointerDown(e, t)}
                    onPointerMove={handleTaskPointerMove}
                    onPointerUp={handleTaskPointerUp}
                    className={`text-[9px] px-1 py-0.5 rounded-lg border truncate font-bold shadow-sm transition-all select-none active:scale-95 ${
                      t.isCompleted === 1
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 line-through'
                        : 'bg-gradient-to-r from-[#FFF0F5] to-white text-[#BA55D3] border-pink-150 hover:border-pink-300'
                    }`}
                    title="按住即可拖移至明后天的格子"
                  >
                    {t.title}
                  </div>
                ))}
              </div>

              {/* Bottom decoration light bar */}
              {hasTasks && !allCompleted && (
                <div className="w-6 h-1 rounded-full bg-[#FFB6C1] mx-auto" />
              )}
            </div>
          );
        })}
      </div>

      {/* Floating drag representation element */}
      {movingTaskId && (
        <div
          className="fixed pointer-events-none bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-full px-3 py-1.5 text-xs font-bold shadow-2xl flex items-center gap-1.5 z-50 border border-yellow-200 scale-105"
          style={{
            left: `${dragPosition.x + 10}px`,
            top: `${dragPosition.y + 10}px`
          }}
        >
          <span>🧚‍♀️ 搬家中: {movingTaskTitle}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      )}

    </div>
  );
}
