import React, { useState, useEffect, useRef } from 'react';
import { db, MagicTask } from '../db';
import { timeToSlot, slotToTime, formatSlotsDuration, playMagicSound } from '../utils';
import { Plus, Trash2, Calendar, Smile, RotateCcw, Clock, Layers, Sparkles, Check, AlertTriangle, ArrowLeft, ArrowRight, ArrowDownToLine } from 'lucide-react';

interface DayViewTimelineProps {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  onUpdateCrystals: (v: number) => void;
  crystals: number;
  onFireSparkles: () => void;
  isGuardianMode: boolean;
  refreshTrigger: number;
}

// Type for the active pointer drag state machine
interface DragState {
  type: 'pocket-drag' | 'timeline-move' | 'resize-top' | 'resize-bottom';
  taskId: string;
  initialStartTime?: string | null;
  initialDurationSlots?: number;
  startY: number;
  startSlotOffset?: number;
}

export default function DayViewTimeline({
  selectedDate,
  onSelectDate,
  onUpdateCrystals,
  crystals,
  onFireSparkles,
  isGuardianMode,
  refreshTrigger
}: DayViewTimelineProps) {
  const [tasks, setTasks] = useState<MagicTask[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);

  // Form states
  const [taskTitle, setTaskTitle] = useState('');
  const [taskEmoji, setTaskEmoji] = useState('✨');
  const [taskReward, setTaskReward] = useState(10);
  const [taskDuration, setTaskDuration] = useState(30); // in minutes
  const [taskIsRecurring, setTaskIsRecurring] = useState(1);
  const [taskAssignDirectly, setTaskAssignDirectly] = useState(false);
  const [taskDirectStartTime, setTaskDirectStartTime] = useState('09:00');

  // Edit states
  const [editingTask, setEditingTask] = useState<MagicTask | null>(null);

  // Pointer drag trackers
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragPreview, setDragPreview] = useState<{ slot: number; duration: number; visible: boolean }>({
    slot: 0,
    duration: 6,
    visible: false
  });

  const loadTasks = async () => {
    const list = await db.magic_tasks.where('date').equals(selectedDate).toArray();
    setTasks(list);
  };

  useEffect(() => {
    loadTasks();
  }, [selectedDate, refreshTrigger]);

  // Emojis library for rapid selection
  const PresetEmojis = ['🩰', '🦄', '🎹', '👸', '📖', '🧹', '🎨', '🍭', '👑', '🥦', '🥕', '🛹', '🦷', '😴', '✨'];

  // Handle task submission
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const fullTitle = `${taskEmoji} ${taskTitle.trim()}`;
    const durationSlots = Math.max(1, Math.floor(taskDuration / 5));

    const newTask: MagicTask = {
      id: `task_${Date.now()}`,
      date: selectedDate,
      title: fullTitle,
      startTime: taskAssignDirectly ? taskDirectStartTime : null,
      durationSlots,
      isCompleted: 0,
      isRecurring: taskIsRecurring,
      crystalReward: taskReward
    };

    await db.magic_tasks.add(newTask);
    setTaskTitle('');
    setShowAddTask(false);
    loadTasks();
  };

  // Delete task
  const handleDeleteTask = async (id: string) => {
    await db.magic_tasks.delete(id);
    loadTasks();
  };

  // Toggle complete state & award/retract crystals
  const handleToggleComplete = async (task: MagicTask) => {
    const nextCompleted = task.isCompleted === 1 ? 0 : 1;
    await db.magic_tasks.update(task.id, { isCompleted: nextCompleted });

    // Calculate Reward Adjustments
    let bonus = 0;
    if (nextCompleted === 1) {
      bonus = task.crystalReward;
      playMagicSound();
      onFireSparkles();

      // Check if all tasks for the day are now completed (for perfect day +50 bonus)
      const currentDayTasks = await db.magic_tasks.where('date').equals(selectedDate).toArray();
      const updatedDayTasks = currentDayTasks.map(t => t.id === task.id ? { ...t, isCompleted: 1 } : t);
      const allDone = updatedDayTasks.length > 0 && updatedDayTasks.every(t => t.isCompleted === 1);
      
      const perfectDayClaimKey = `royal_perfect_day_${selectedDate}`;
      const alreadyClaimed = localStorage.getItem(perfectDayClaimKey);

      if (allDone && !alreadyClaimed) {
        bonus += 50; // Add standard perfect day reward
        localStorage.setItem(perfectDayClaimKey, 'true');
        setTimeout(() => {
          alert('👑 璀璨极光！今天所有魔法修炼都通关了！额外荣获皇室大礼盒 +50 水晶！💖');
        }, 600);
      }
    } else {
      bonus = -task.crystalReward;
      // Withdraw perfect day bonus if toggled back
      const perfectDayClaimKey = `royal_perfect_day_${selectedDate}`;
      if (localStorage.getItem(perfectDayClaimKey)) {
        localStorage.removeItem(perfectDayClaimKey);
        bonus -= 50;
      }
    }

    onUpdateCrystals(Math.max(0, crystals + bonus));
    loadTasks();
  };

  // Collision detection logic
  // Returns slot count map for the entire day (192 slots)
  const getCollisionMap = () => {
    const map = new Array(192).fill(0);
    tasks.forEach((t) => {
      if (t.startTime !== null) {
        const start = timeToSlot(t.startTime);
        for (let i = start; i < start + t.durationSlots; i++) {
          if (i >= 0 && i < 192) {
            map[i]++;
          }
        }
      }
    });
    return map;
  };

  const collisionMap = getCollisionMap();

  // Helper to check if a task conflicts with other tasks
  const isTaskConflicted = (task: MagicTask) => {
    if (task.startTime === null) return false;
    const start = timeToSlot(task.startTime);
    for (let i = start; i < start + task.durationSlots; i++) {
      if (i >= 0 && i < 192 && collisionMap[i] > 1) {
        return true;
      }
    }
    return false;
  };

  // Convert client coordinate into 5-minute ticks (slot 0 to 191)
  const getSlotFromClientY = (clientY: number): number | null => {
    if (!timelineTrackRef.current) return null;
    const rect = timelineTrackRef.current.getBoundingClientRect();
    const relY = clientY - rect.top;
    const pct = relY / rect.height;
    return Math.max(0, Math.min(191, Math.floor(pct * 192)));
  };

  // -------------------------------------------------------------
  // Pointer Event-driven Drag System
  // -------------------------------------------------------------
  const handlePointerDown = (
    e: React.PointerEvent,
    taskId: string,
    type: 'pocket-drag' | 'timeline-move' | 'resize-top' | 'resize-bottom'
  ) => {
    e.preventDefault();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Grab initial values
    const startY = e.clientY;
    let startSlotOffset = 0;

    if (type === 'timeline-move' && task.startTime) {
      const touchSlot = getSlotFromClientY(e.clientY);
      if (touchSlot !== null) {
        startSlotOffset = touchSlot - timeToSlot(task.startTime);
      }
    }

    setDragState({
      type,
      taskId,
      initialStartTime: task.startTime,
      initialDurationSlots: task.durationSlots,
      startY,
      startSlotOffset
    });

    if (type === 'pocket-drag' || type === 'timeline-move') {
      setDragPreview({
        slot: task.startTime ? timeToSlot(task.startTime) : 72, // default 12:00
        duration: task.durationSlots,
        visible: true
      });
    }

    // Capture pointer
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;

    const task = tasks.find((t) => t.id === dragState.taskId);
    if (!task) return;

    const currentSlot = getSlotFromClientY(e.clientY);
    if (currentSlot === null) return;

    if (dragState.type === 'timeline-move' || dragState.type === 'pocket-drag') {
      let targetStartSlot = currentSlot - (dragState.startSlotOffset || 0);
      targetStartSlot = Math.max(0, Math.min(192 - task.durationSlots, targetStartSlot));

      setDragPreview({
        slot: targetStartSlot,
        duration: task.durationSlots,
        visible: true
      });
    } else if (dragState.type === 'resize-bottom') {
      // Bottom pull
      const taskStartSlot = timeToSlot(task.startTime);
      const newDuration = Math.max(1, Math.min(192 - taskStartSlot, currentSlot - taskStartSlot + 1));
      
      // Update state live for feedback
      const updatedTasks = tasks.map((t) =>
        t.id === task.id ? { ...t, durationSlots: newDuration } : t
      );
      setTasks(updatedTasks);
    } else if (dragState.type === 'resize-top' && task.startTime) {
      const originalStartSlot = timeToSlot(dragState.initialStartTime || '06:00');
      const originalDuration = dragState.initialDurationSlots || 6;
      const originalEndSlot = originalStartSlot + originalDuration;

      const deltaY = e.clientY - dragState.startY;
      if (!timelineTrackRef.current) return;
      const trackHeight = timelineTrackRef.current.getBoundingClientRect().height;
      const slotDelta = Math.round((deltaY / trackHeight) * 192);

      const computedNewStart = Math.max(0, Math.min(originalEndSlot - 1, originalStartSlot + slotDelta));
      const computedNewDuration = originalEndSlot - computedNewStart;

      const updatedTasks = tasks.map((t) =>
        t.id === task.id
          ? { ...t, startTime: slotToTime(computedNewStart), durationSlots: computedNewDuration }
          : t
      );
      setTasks(updatedTasks);
    }
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!dragState) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    const task = tasks.find((t) => t.id === dragState.taskId);
    if (!task) {
      setDragState(null);
      setDragPreview((prev) => ({ ...prev, visible: false }));
      return;
    }

    if (dragState.type === 'timeline-move' || dragState.type === 'pocket-drag') {
      // Finalize drop mapping
      // If user dropped it way outside or if preview slot calculations say we should assign
      if (dragPreview.visible) {
        const timeStr = slotToTime(dragPreview.slot);
        await db.magic_tasks.update(task.id, {
          startTime: timeStr
        });
      }
    } else if (dragState.type === 'resize-bottom') {
      await db.magic_tasks.update(task.id, {
        durationSlots: task.durationSlots
      });
    } else if (dragState.type === 'resize-top') {
      await db.magic_tasks.update(task.id, {
        startTime: task.startTime,
        durationSlots: task.durationSlots
      });
    }

    setDragState(null);
    setDragPreview({ slot: 0, duration: 6, visible: false });
    loadTasks();
  };

  const handleReturnToPocket = async (taskId: string) => {
    await db.magic_tasks.update(taskId, {
      startTime: null
    });
    loadTasks();
  };

  // Navigating days
  const handleMoveDay = (offset: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + offset);
    onSelectDate(current.toISOString().split('T')[0]);
  };

  // Date nice display (e.g., "6月12日 星期五")
  const formatDateFriendly = (dStr: string) => {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const dateObj = new Date(dStr);
    const m = dateObj.getMonth() + 1;
    const d = dateObj.getDate();
    const dayName = days[dateObj.getDay()];
    return `${m}月${d}日 ${dayName}`;
  };

  // Quick setup helper is completed for manual modifications
  const handleManualTimeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    const slotStart = timeToSlot(editingTask.startTime);
    await db.magic_tasks.update(editingTask.id, {
      startTime: editingTask.startTime,
      durationSlots: editingTask.durationSlots,
      crystalReward: editingTask.crystalReward
    });

    setEditingTask(null);
    loadTasks();
  };

  // Render variables for Timeline Tracks
  const activeTimelineTasks = tasks.filter((t) => t.startTime !== null);
  const pocketTasks = tasks.filter((t) => t.startTime === null);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-b from-[#FFF0F5]/55 to-[#FFFBFB]/40 font-sans p-1 md:p-3">
      
      {/* Sub-Header / Day Controller Navigation */}
      <div className="flex justify-between items-center bg-white/70 backdrop-blur-sm p-3 px-6 border border-brand-pink/60 rounded-2xl mb-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleMoveDay(-1)}
            className="p-1.5 rounded-full bg-white hover:bg-pink-100 text-[#BA55D3] border border-[#FFB6C1] shadow-xs transition-all"
            title="前一天"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1.5 min-w-[140px] text-center justify-center">
            <Calendar className="w-4 h-4 text-[#BA55D3]" />
            <span className="font-bold text-[#BA55D3] text-sm md:text-base font-serif">
              {formatDateFriendly(selectedDate)}
            </span>
          </div>

          <button
            onClick={() => handleMoveDay(1)}
            className="p-1.5 rounded-full bg-white hover:bg-pink-100 text-[#BA55D3] border border-[#FFB6C1] shadow-xs transition-all"
            title="后一天"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Manual date-picker */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectDate(e.target.value)}
            className="text-xs px-2 py-1 bg-white border border-[#FFB6C1] rounded-lg text-pink-800"
          />
          <button
            onClick={() => setShowAddTask(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-[#FFB6C1] to-[#BA55D3] hover:brightness-105 text-white text-xs font-black rounded-xl shadow-md border border-[#FFD700]"
          >
            <Plus className="w-3.5 h-3.5" />
            新建特训计划
          </button>
        </div>
      </div>

      {/* Main Split Window */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden gap-3 px-1">
        
        {/* LEFT COLUMN: THE TIMELINE AXIS VIEW (Grid with 16 rows) */}
        <div className="col-span-8 md:col-span-9 flex relative h-full bg-white/80 lace-border rounded-2xl shadow-inner overflow-hidden select-none">
          
          {/* Numbers Guide Column */}
          <div className="w-14 border-r border-[#FFB6C1] select-none flex flex-col justify-between py-2 text-[10px] text-[#BA55D3] font-bold bg-[#FFF0F5]/50">
            {Array.from({ length: 17 }).map((_, i) => {
              const hourNum = 6 + i;
              const hourStr = hourNum.toString().padStart(2, '0');
              return (
                <div key={i} className="h-0 flex items-center justify-end pr-2 font-mono">
                  {hourStr}:00
                </div>
              );
            })}
          </div>

          {/* Core Interactive Track stage */}
          <div
            ref={timelineTrackRef}
            className="flex-1 h-full relative overflow-hidden"
            onPointerMove={handlePointerMove}
          >
            {/* Background 16 hour-blocks layout with dashed mid-lines */}
            <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none">
              {Array.from({ length: 16 }).map((_, i) => {
                const hourNum = 6 + i;
                const isConflictHour = collisionMap.slice(i * 12, (i + 1) * 12).some(v => v > 1);

                return (
                  <div
                    key={i}
                    className={`flex-1 border-b border-dashed border-[#FFB6C1] relative flex flex-col justify-center ${
                      isConflictHour ? 'bg-red-50/25' : ''
                    }`}
                  >
                    {/* Semi-hour delicate marker */}
                    <div className="w-full border-t border-dashed border-[#FFB6C1]/20 h-0 absolute top-1/2" />
                    
                    {/* Half hour tiny text indicator */}
                    <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[9px] text-[#BA55D3]/50 font-bold">
                      {hourNum.toString().padStart(2, '0')}:30
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Micro 5-min dotted line guide (High-precision display inside track) */}
            {dragState && (
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-45 py-2">
                {Array.from({ length: 192 }).map((_, i) => (
                  <div key={i} className="flex-1 border-b border-dotted border-pink-300/10" />
                ))}
              </div>
            )}

            {/* Glowing drag snapping indicator line */}
            {dragPreview.visible && (
              <div
                className="absolute left-0 right-0 bg-yellow-400 border-2 border-amber-300 rounded-lg opacity-60 z-10 shadow-lg pointer-events-none flex items-center px-4"
                style={{
                  top: `calc(${((dragPreview.slot) / 192) * 100}% + 4px)`,
                  height: `calc(${(dragPreview.duration / 192) * 100}% - 8px)`
                }}
              >
                <span className="text-[10px] text-amber-900 font-extrabold filter drop-shadow font-mono bg-white/70 px-1.5 py-0.5 rounded">
                  ✨ 释放时吸附于: {slotToTime(dragPreview.slot)} ({formatSlotsDuration(dragPreview.duration)})
                </span>
              </div>
            )}

            {/* RENDER TASKS CARDS ON THE GRID */}
            {activeTimelineTasks.map((t) => {
              const startSlot = timeToSlot(t.startTime);
              const isConflicted = isTaskConflicted(t);

              const cardTop = `${(startSlot / 192) * 100}%`;
              const cardHeight = `${(t.durationSlots / 192) * 100}%`;

              return (
                <div
                  key={t.id}
                  className={`absolute left-4 right-4 rounded-xl border-2 transition-all shadow-sm flex flex-col justify-between overflow-hidden cursor-move select-none p-1.5 md:p-3 group ${
                    t.isCompleted === 1
                      ? 'bg-gradient-to-r from-emerald-100/90 to-teal-50/90 border-[#A7F3D0] hover:border-emerald-400'
                      : isConflicted
                      ? 'conflict-zone text-red-950 animate-shake-magic border-red-500 hover:border-red-600'
                      : 'bg-gradient-to-r from-[#FFF0F5]/80 via-white/95 to-[#FFF0F5]/50 border-brand-gold hover:border-brand-purple'
                  }`}
                  style={{
                    top: `calc(${cardTop} + 4px)`,
                    height: `calc(${cardHeight} - 8px)`
                  }}
                  onPointerDown={(e) => {
                    // Check if clicked the handles
                    const targetEl = e.target as HTMLElement;
                    if (targetEl.closest('.resize-handle-bottom')) {
                      handlePointerDown(e, t.id, 'resize-bottom');
                    } else if (targetEl.closest('.resize-handle-top')) {
                      handlePointerDown(e, t.id, 'resize-top');
                    } else if (targetEl.closest('.task-no-drag')) {
                      // bypass drag
                    } else {
                      handlePointerDown(e, t.id, 'timeline-move');
                    }
                  }}
                  onPointerUp={handlePointerUp}
                >
                  {/* Top Resize Handle (Little cute golden stars bar) */}
                  <div className="resize-handle-top absolute top-0 left-0 right-0 h-2 bg-yellow-300/0 hover:bg-yellow-300 cursor-ns-resize flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-1 bg-yellow-400 rounded-full" />
                  </div>

                  {/* Task Card Header Area */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {/* Completion check box */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleComplete(t);
                        }}
                        className={`task-no-drag w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          t.isCompleted === 1
                            ? 'bg-emerald-500 border-emerald-600 text-white'
                            : 'bg-white border-pink-300 hover:scale-110'
                        }`}
                      >
                        {t.isCompleted === 1 && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <h4 className={`text-xs md:text-sm font-bold truncate text-neutral-800 ${t.isCompleted === 1 ? 'line-through text-neutral-400' : ''}`}>
                        {t.title}
                      </h4>
                    </div>

                    {/* Right little tools */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity task-no-drag">
                      <button
                        onClick={() => setEditingTask(t)}
                        className="text-[10px] text-pink-500 hover:underline bg-white px-1.5 py-0.5 rounded border border-pink-100"
                        title="精密微调"
                      >
                        微调
                      </button>
                      <button
                        onClick={() => handleReturnToPocket(t.id)}
                        className="text-neutral-400 hover:text-amber-500 p-0.5"
                        title="收回暂存袋"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                      </button>
                      {(isGuardianMode || t.isCompleted === 0) && (
                        <button
                          onClick={() => handleDeleteTask(t.id)}
                          className="text-neutral-300 hover:text-red-500 p-0.5"
                          title="删除特训"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bottom details (Timestamps, rewards, collisions warnings) */}
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                      <Clock className="w-3.5 h-3.5 text-pink-400" />
                      <span className="font-mono font-bold">{t.startTime} - {slotToTime(startSlot + t.durationSlots)}</span>
                      <span className="bg-pink-100/60 text-pink-700 px-1 py-0.2 rounded scale-90">
                        {formatSlotsDuration(t.durationSlots)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isConflicted && (
                        <span className="flex items-center text-red-500 text-[10px] font-bold bg-white px-1 py-0.5 rounded animate-pulse" title="时间重叠冲突啦！">
                          <AlertTriangle className="w-3 h-3 mr-0.5" />
                          魔法重合
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        💎 +{t.crystalReward}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Resize Handle */}
                  <div className="resize-handle-bottom absolute bottom-0 left-0 right-0 h-2 bg-yellow-300/0 hover:bg-yellow-300 cursor-ns-resize flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-1 bg-yellow-400 rounded-full" />
                  </div>
                </div>
              );
            })}

            {/* Empty view suggestion */}
            {activeTimelineTasks.length === 0 && (
              <div className="absolute inset-x-8 top-1/4 text-center text-neutral-400 select-none pointer-events-none">
                <Smile className="w-12 h-12 text-pink-200 mx-auto mb-3 animate-float-magic" />
                <h4 className="text-sm font-semibold text-neutral-500">空荡荡的魔法画布</h4>
                <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto leading-normal">
                  拖拽右侧“暂存口袋”里的计划卡片，吸附在今天的时间轴上。<br/>
                  或者点击右上角快速“新建特训计划”。
                </p>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: THE PERMANENT "MAGIC POCKET" SANDBOX POCKET */}
        <div className="col-span-4 md:col-span-3 border-l-2 border-[#FFB6C1] bg-[#FFB6C1]/10 flex flex-col h-full overflow-hidden select-none">
          <div className="p-3.5 bg-gradient-to-r from-[#FFB6C1]/40 to-[#BA55D3]/20 border-b border-[#FFB6C1] flex flex-col gap-1">
            <h3 className="text-xs md:text-sm font-black text-[#BA55D3] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#BA55D3]" />
              🍬 魔法暂存口袋
            </h3>
            <p className="text-[10px] text-neutral-500 font-bold">
              放学、家务、特训任务在此排队，随时丢回时间轴开始修炼！
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#FFF0F5]/10 select-none">
            {pocketTasks.map((t) => (
              <div
                key={t.id}
                className="bg-white p-3 rounded-xl border border-[#FFB6C1] shadow-sm cursor-grab active:cursor-grabbing hover:border-brand-purple flex flex-col justify-between hover:scale-[1.02] hover:shadow transition-all group"
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('.task-no-drag')) return;
                  handlePointerDown(e, t.id, 'pocket-drag');
                }}
                onPointerUp={handlePointerUp}
              >
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-bold text-neutral-800 leading-tight">
                    {t.title}
                  </h4>
                  <button
                    onClick={() => handleDeleteTask(t.id)}
                    className="task-no-drag opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-neutral-300 hover:text-red-500 ml-1.5"
                    title="丢弃"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-3 flex justify-between items-center text-[10px]">
                  <span className="text-neutral-400 font-semibold">
                     ⏳ {formatSlotsDuration(t.durationSlots)}
                  </span>
                  <span className="font-extrabold text-amber-600 bg-amber-50 px-1 py-0.1 rounded border border-amber-100">
                    💎 +{t.crystalReward}
                  </span>
                </div>
              </div>
            ))}

            {pocketTasks.length === 0 && (
              <div className="text-center py-12 text-neutral-400">
                <Smile className="w-8 h-8 text-pink-300 mx-auto opacity-70 mb-2" />
                <p className="text-[11px] leading-relaxed px-4">
                  暂存口袋已掏空，所有计划任务都在时间轴上运行着！
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL 1: ADD NEW TASK DIALOG */}
      {showAddTask && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleCreateTask}
            className="bg-white p-6 rounded-2xl lace-border shadow-2xl max-w-sm w-full relative"
          >
            <h3 className="text-lg font-black text-[#BA55D3] mb-4 flex items-center gap-1.5 font-serif">
              <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse-magic" />
              定制魔法今日特训
            </h3>

            <div className="space-y-3.5 text-xs text-neutral-600">
              
              {/* Emojis selection */}
              <div>
                <label className="block font-bold text-neutral-700 mb-1">选择徽章标志 Emoji</label>
                <div className="flex gap-2 flex-wrap bg-white p-2 rounded-xl border border-pink-100">
                  {PresetEmojis.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setTaskEmoji(em)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg border transition-all ${
                        taskEmoji === em
                          ? 'bg-pink-150 border-pink-400 scale-110 shadow-sm bg-pink-100'
                          : 'border-transparent hover:bg-neutral-50'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title text */}
              <div>
                <label className="block font-bold text-neutral-700 mb-1">计划内容名称</label>
                <input
                  type="text"
                  placeholder="如：绘制蝴蝶城堡、整理睡裙..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl border-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white"
                  maxLength={30}
                  required
                />
              </div>

              {/* Duration and crystal reward */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">持续多长时间</label>
                  <select
                    value={taskDuration}
                    onChange={(e) => setTaskDuration(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 bg-white border rounded-xl border-pink-200 focus:outline-none"
                  >
                    <option value="5">5分钟 (瞬时)</option>
                    <option value="15">15分钟</option>
                    <option value="20">20分钟</option>
                    <option value="30">30分钟</option>
                    <option value="45">45分钟</option>
                    <option value="60">1小时</option>
                    <option value="90">1.5小时</option>
                    <option value="120">2小时</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">过关奖励水晶</label>
                  <select
                    value={taskReward}
                    onChange={(e) => setTaskReward(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 bg-white border rounded-xl border-pink-200 focus:outline-none"
                  >
                    <option value="10">💎 +10</option>
                    <option value="15">💎 +15 (高阶)</option>
                    <option value="25">💎 +25 (挑战)</option>
                    <option value="50">💎 +50 (完美大契约)</option>
                  </select>
                </div>
              </div>

              {/* Directly start vs pocket */}
              <div className="p-3 bg-pink-100/30 rounded-xl border border-pink-200/50">
                <label className="flex items-center gap-2 font-bold text-neutral-700 mb-1.5">
                  <input
                    type="checkbox"
                    checked={taskAssignDirectly}
                    onChange={(e) => setTaskAssignDirectly(e.target.checked)}
                    className="accent-pink-500 scale-110"
                  />
                  <span>直接放入今天的时间轴上运行</span>
                </label>

                {taskAssignDirectly && (
                  <div className="flex items-center gap-2 mt-2 animate-fade-in">
                    <span className="text-[11px] font-semibold">设定开始时间点:</span>
                    <input
                      type="time"
                      value={taskDirectStartTime}
                      onChange={(e) => {
                        // constrain between 06:00 and 22:00
                        const [hrs, mins] = e.target.value.split(':').map(Number);
                        if (hrs < 6) {
                          setTaskDirectStartTime('06:00');
                        } else if (hrs >= 22) {
                          setTaskDirectStartTime('21:45');
                        } else {
                          setTaskDirectStartTime(e.target.value);
                        }
                      }}
                      className="px-2 py-0.5 rounded border border-pink-300 text-sm font-bold bg-white"
                    />
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={taskIsRecurring === 1}
                  onChange={(e) => setTaskIsRecurring(e.target.checked ? 1 : 0)}
                  className="accent-pink-500"
                />
                <span>每天零点自动刷新生成 (重复法则)</span>
              </label>

            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowAddTask(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold"
              >
                收回卷轴
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-pink-400 to-purple-500 hover:brightness-105 text-white text-xs font-bold shadow rounded-xl"
              >
                刻印契约
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: HIGH-PRECISION RE-ADJUSTMENT FINE TUNING SLIDERS */}
      {editingTask && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleManualTimeEdit}
            className="bg-white p-6 rounded-3xl border-4 border-amber-200 shadow-2xl max-w-sm w-full relative"
          >
            <h3 className="text-md font-bold text-amber-900 mb-4 flex items-center gap-1.5 font-serif">
              <Smile className="w-5 h-5 text-amber-500" />
              精密刻度调节：{editingTask.title}
            </h3>

            <div className="space-y-4 text-xs">
              
              <div>
                <label className="block font-bold text-neutral-600 mb-1 flex justify-between">
                  <span>选择开始时间点：</span>
                  <span className="text-amber-700 font-bold font-mono">{editingTask.startTime}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="191"
                  step="1"
                  value={timeToSlot(editingTask.startTime)}
                  onChange={(e) => {
                    const slotVal = parseInt(e.target.value, 10);
                    setEditingTask({ ...editingTask, startTime: slotToTime(slotVal) });
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 font-mono mt-1">
                  <span>06:00</span>
                  <span>14:00</span>
                  <span>22:00</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-600 mb-1 flex justify-between">
                  <span>调节持续时间 (5分钟倍数)：</span>
                  <span className="text-amber-700 font-bold font-mono">{formatSlotsDuration(editingTask.durationSlots)}</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="24"
                  step="1"
                  value={editingTask.durationSlots}
                  onChange={(e) => {
                    const slotCount = parseInt(e.target.value, 10);
                    setEditingTask({ ...editingTask, durationSlots: slotCount });
                  }}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 font-mono mt-1">
                  <span>5分钟</span>
                  <span>1小时</span>
                  <span>2小时</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-600 mb-1">过关奖励水晶点：</label>
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={editingTask.crystalReward}
                  onChange={(e) => {
                    const p = parseInt(e.target.value, 10) || 10;
                    setEditingTask({ ...editingTask, crystalReward: p });
                  }}
                  className="w-24 px-2.5 py-1 rounded border border-amber-200 font-bold text-sm"
                />
              </div>

            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-bold"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow rounded-xl"
              >
                刻印调节
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
