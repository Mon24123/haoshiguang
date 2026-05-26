const STORAGE_KEY = "focus-widget:v1";
const DEFAULT_TASKS = ["阅读/学习", "项目推进", "运动", "整理记录", "每日复盘"];
const DEFAULT_CATEGORIES = ["工作", "学习", "项目", "生活", "健康", "其他"];
const DEFAULT_THEME_COLOR = "#7fcdb5";
const APP_VERSION = "0.2.2";
const CATEGORY_HUE_OFFSETS = [0, 42, 318, 198, 82, 142, 274, 24, 226, 302, 118, 176, 16, 250];

const $ = (selector) => document.querySelector(selector);

const elements = {
  datePicker: $("#datePicker"),
  openFullButton: $("#openFullButton"),
  versionLabel: $("#versionLabel"),
  exportDataButton: $("#exportDataButton"),
  importDataButton: $("#importDataButton"),
  importDataInput: $("#importDataInput"),
  themeColorInput: $("#themeColorInput"),
  liveClock: $("#liveClock"),
  prevDayButton: $("#prevDayButton"),
  todayButton: $("#todayButton"),
  nextDayButton: $("#nextDayButton"),
  timerForm: $("#timerForm"),
  activityInput: $("#activityInput"),
  activityCategory: $("#activityCategory"),
  activityCategorySuggestions: $("#activityCategorySuggestions"),
  startButton: $("#startButton"),
  pauseButton: $("#pauseButton"),
  finishButton: $("#finishButton"),
  finishNote: $("#finishNote"),
  currentTitle: $("#currentTitle"),
  timerDisplay: $("#timerDisplay"),
  totalTime: $("#totalTime"),
  doneCount: $("#doneCount"),
  entryCount: $("#entryCount"),
  taskPanelTitle: $("#taskPanelTitle"),
  taskForm: $("#taskForm"),
  taskInput: $("#taskInput"),
  taskCategory: $("#taskCategory"),
  taskCategorySuggestions: $("#taskCategorySuggestions"),
  dailyTemplateForm: $("#dailyTemplateForm"),
  toggleDailyTasksButton: $("#toggleDailyTasksButton"),
  dailyTasksPanel: $("#dailyTasksPanel"),
  dailyTaskName: $("#dailyTaskName"),
  dailyTaskCategory: $("#dailyTaskCategory"),
  dailyTaskTime: $("#dailyTaskTime"),
  dailyTaskMinutes: $("#dailyTaskMinutes"),
  dailyTasksList: $("#dailyTasksList"),
  seedTasksButton: $("#seedTasksButton"),
  taskList: $("#taskList"),
  todoPoolForm: $("#todoPoolForm"),
  todoTitle: $("#todoTitle"),
  todoCategory: $("#todoCategory"),
  todoDueDate: $("#todoDueDate"),
  todoCategorySuggestions: $("#todoCategorySuggestions"),
  todoPoolList: $("#todoPoolList"),
  categoryStats: $("#categoryStats"),
  workspace: $(".workspace"),
  manualRecordForm: $("#manualRecordForm"),
  manualTitle: $("#manualTitle"),
  manualCategory: $("#manualCategory"),
  manualCategorySuggestions: $("#manualCategorySuggestions"),
  manualMinutes: $("#manualMinutes"),
  recordList: $("#recordList"),
  copyReportButton: $("#copyReportButton"),
  toast: $("#toast")
};

const todayKey = () => {
  return keyFromDate(new Date());
};

const keyFromDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createDay = () => ({
  tasks: [],
  records: [],
  active: null,
  dailyTemplateApplied: false
});

const createInitialState = () => ({
  version: 1,
  categories: DEFAULT_CATEGORIES,
  dailyTasks: [],
  todos: [],
  themeColor: DEFAULT_THEME_COLOR,
  days: {
    [todayKey()]: createDay()
  }
});

let state = loadState();
let tickTimer = null;
let toastTimer = null;
let lastPublishedStatus = "";
let selectedDateKey = todayKey();
let selectedCategoryDetailPeriod = null;
let editingCategoryTarget = null;
let editingTaskId = null;
let editingRecordGroupKey = null;
let editingTodoDateId = null;
let isDailyTasksPanelOpen = false;
let lastCategoryOptionsMarkup = "";
let lastDailyTasksMarkup = "";
let draggedCategory = null;
let lastCategoryInsightKey = "";

if (new URLSearchParams(window.location.search).get("mode") === "compact") {
  document.body.classList.add("compact-mode");
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.version === 1 && saved.days) {
      if (!Array.isArray(saved.categories) || !saved.categories.length) {
        saved.categories = DEFAULT_CATEGORIES;
      }
      if (!Array.isArray(saved.dailyTasks)) {
        saved.dailyTasks = [];
      }
      if (!Array.isArray(saved.todos)) {
        saved.todos = [];
      }
      if (!saved.themeColor) {
        saved.themeColor = DEFAULT_THEME_COLOR;
      }
      return saved;
    }
  } catch (error) {
    console.warn("Failed to load saved data", error);
  }

  return createInitialState();
}

function getCategories() {
  if (!Array.isArray(state.categories) || !state.categories.length) {
    state.categories = DEFAULT_CATEGORIES;
  }

  return state.categories;
}

function getDailyTasks() {
  if (!Array.isArray(state.dailyTasks)) {
    state.dailyTasks = [];
  }

  state.dailyTasks = state.dailyTasks
    .map(normalizeDailyTask)
    .filter(Boolean);
  return state.dailyTasks;
}

function getTodos() {
  if (!Array.isArray(state.todos)) {
    state.todos = [];
  }

  return state.todos;
}

function normalizeDailyTask(task) {
  if (typeof task === "string") {
    const title = task.trim();
    return title ? { id: uid(), title, category: "其他", time: "", estimateMinutes: "" } : null;
  }
  if (!task || typeof task !== "object") {
    return null;
  }
  const title = String(task.title || "").trim();
  if (!title) {
    return null;
  }
  return {
    id: task.id || uid(),
    title,
    category: String(task.category || "其他").trim() || "其他",
    time: String(task.time || "").trim(),
    estimateMinutes: task.estimateMinutes ? String(task.estimateMinutes).trim() : ""
  };
}

function normalizeCategory(value) {
  const category = value.trim() || "其他";
  rememberCategory(category);
  return category;
}

function rememberCategory(category) {
  const categories = getCategories();
  if (!categories.includes(category)) {
    categories.push(category);
  }
}

function moveCategoryBefore(sourceCategory, targetCategory) {
  if (!sourceCategory || !targetCategory || sourceCategory === targetCategory) {
    return;
  }

  const categories = getCategories();
  const sourceIndex = categories.indexOf(sourceCategory);
  const targetIndex = categories.indexOf(targetCategory);
  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }

  const [source] = categories.splice(sourceIndex, 1);
  const nextTargetIndex = categories.indexOf(targetCategory);
  categories.splice(nextTargetIndex, 0, source);
  lastCategoryOptionsMarkup = "";
  saveState();
  render();
}

function renameCategory(oldCategory, nextCategory) {
  const newCategory = nextCategory.trim();
  if (!oldCategory || !newCategory || oldCategory === newCategory) {
    return;
  }

  rememberCategory(newCategory);
  Object.values(state.days).forEach((day) => {
    day.tasks.forEach((task) => {
      if ((task.category || "其他") === oldCategory) {
        task.category = newCategory;
      }
    });
    day.records.forEach((record) => {
      if ((record.category || "其他") === oldCategory) {
        record.category = newCategory;
      }
    });
    if ((day.active?.category || "其他") === oldCategory) {
      day.active.category = newCategory;
    }
  });
  getDailyTasks().forEach((task) => {
    if ((task.category || "其他") === oldCategory) {
      task.category = newCategory;
    }
  });
  state.categories = getCategories().filter((category) => category !== oldCategory);
  lastCategoryOptionsMarkup = "";
  saveState();
  render();
}

function deleteCategory(category) {
  if (!category || category === "其他") {
    showToast("其他分类不能删除");
    return;
  }

  renameCategory(category, "其他");
  showToast(`已把 ${category} 合并到其他`);
}

function closeCategoryActionMenu() {
  document.querySelector(".category-action-menu")?.remove();
}

function closeInlinePopover() {
  document.querySelector(".inline-popover")?.remove();
}

function openCategoryActionMenu(category, x, y) {
  closeCategoryActionMenu();
  const menu = document.createElement("div");
  menu.className = "category-action-menu";
  menu.style.left = `${Math.min(x, window.innerWidth - 150)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 96)}px`;
  menu.innerHTML = `
    <button type="button" data-category-menu-rename="${escapeHtml(category)}">修改名称</button>
    <button type="button" data-category-menu-delete="${escapeHtml(category)}">删除分类</button>
  `;
  document.body.appendChild(menu);
}

function promptRenameCategory(category) {
  openInlinePopover({
    title: "修改分类名称",
    value: category,
    confirmText: "保存",
    onConfirm: (nextName) => {
      if (!nextName.trim()) {
        promptDeleteCategory(category);
        return;
      }
      renameCategory(category, nextName);
    }
  });
}

function promptDeleteCategory(category) {
  if (window.confirm(`删除“${category}”并把相关任务合并到“其他”？`)) {
    deleteCategory(category);
  }
}

function openInlinePopover({ title, value, confirmText, onConfirm, fields = null }) {
  closeInlinePopover();
  const popover = document.createElement("form");
  popover.className = "inline-popover";
  const inputsMarkup = fields
    ? fields.map((field) => `
      <label>
        <span>${escapeHtml(field.label)}</span>
        ${field.type === "textarea"
    ? `<textarea rows="${escapeHtml(String(field.rows || 4))}" data-inline-field="${escapeHtml(field.name)}">${escapeHtml(field.value || "")}</textarea>`
    : `<input type="${escapeHtml(field.type || "text")}" ${field.step ? `step="${escapeHtml(field.step)}"` : ""} value="${escapeHtml(field.value || "")}" data-inline-field="${escapeHtml(field.name)}" />`}
      </label>
    `).join("")
    : `
      <label>
        <span>${escapeHtml(title)}</span>
        <input type="text" value="${escapeHtml(value)}" data-inline-field="value" />
      </label>
    `;
  popover.innerHTML = `
    ${fields ? `<strong>${escapeHtml(title)}</strong>` : ""}
    ${inputsMarkup}
    <div class="inline-popover-actions">
      <button type="button" data-inline-cancel>取消</button>
      <button type="submit" data-inline-confirm>${escapeHtml(confirmText)}</button>
    </div>
  `;
  document.body.appendChild(popover);
  const input = popover.querySelector("input, textarea");
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  popover.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  popover.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  let didCommit = false;
  const confirmInlinePopover = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (didCommit) {
      return;
    }
    didCommit = true;
    const values = {};
    popover.querySelectorAll("[data-inline-field]").forEach((field) => {
      values[field.dataset.inlineField] = field.value;
    });
    closeInlinePopover();
    onConfirm(fields ? values : values.value);
  };
  const cancelInlinePopover = (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeInlinePopover();
  };
  popover.querySelector("[data-inline-cancel]").addEventListener("pointerdown", cancelInlinePopover);
  popover.querySelector("[data-inline-cancel]").addEventListener("click", cancelInlinePopover);
  popover.querySelector("[data-inline-confirm]").addEventListener("click", confirmInlinePopover);
  popover.addEventListener("submit", confirmInlinePopover);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && input.tagName !== "TEXTAREA") {
      event.preventDefault();
      popover.requestSubmit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeInlinePopover();
    }
  });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getBackupFileName() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  return `good-time-backup-${stamp}.json`;
}

function exportDataBackup() {
  saveState();
  const payload = {
    app: "Good Time（好时光）",
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getBackupFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("已备份本地数据");
}

function importDataBackup(file) {
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(String(reader.result || ""));
      const nextState = payload?.state || payload;
      if (!nextState || nextState.version !== 1 || !nextState.days) {
        showToast("这个备份文件不太对");
        return;
      }
      if (!window.confirm("导入后会覆盖当前本地数据，确定继续吗？")) {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      reloadState();
      showToast("已导入数据备份");
    } catch (error) {
      console.warn("Failed to import backup", error);
      showToast("导入失败，文件可能已损坏");
    } finally {
      elements.importDataInput.value = "";
    }
  });
  reader.readAsText(file);
}

function getThemeColor() {
  return state.themeColor || DEFAULT_THEME_COLOR;
}

function setThemeColor(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    return;
  }

  state.themeColor = color;
  applyTheme();
  saveState();
  render();
}

function applyTheme() {
  const color = getThemeColor();
  const root = document.documentElement;
  const dark = mixHex(color, "#000000", 0.28);
  const tint = mixHex(color, "#ffffff", 0.88);
  const bg = mixHex(color, "#f4f5f7", 0.08);

  root.style.setProperty("--accent", color);
  root.style.setProperty("--accent-dark", dark);
  root.style.setProperty("--tint", tint);
  root.style.setProperty("--bg", bg);
  if (elements.themeColorInput && elements.themeColorInput.value !== color) {
    elements.themeColorInput.value = color;
  }
}

function reloadState() {
  state = loadState();
  render();
}

function getToday() {
  return getDay(selectedDateKey);
}

function getDay(key) {
  let changed = false;
  if (!state.days[key]) {
    state.days[key] = createDay();
    changed = true;
  }
  changed = applyDailyTasks(state.days[key]) || changed;
  changed = mergeDuplicateTasks(state.days[key]) || changed;
  if (changed) {
    saveState();
  }
  return state.days[key];
}

function applyDailyTasks(day) {
  if (day.dailyTemplateApplied) {
    return false;
  }

  let changed = false;
  const existing = new Map(day.tasks.map((task) => [normalizeTaskTitle(task.title), task]));
  getDailyTasks().forEach((dailyTask) => {
    const normalizedTitle = normalizeTaskTitle(dailyTask.title);
    const existingTask = existing.get(normalizedTitle);
    if (existingTask) {
      if (existingTask.fromTemplate) {
        existingTask.category = dailyTask.category || "其他";
        existingTask.scheduledTime = dailyTask.time || "";
        existingTask.estimateMinutes = dailyTask.estimateMinutes || "";
        changed = true;
      }
    } else {
      day.tasks.push({
        id: uid(),
        title: dailyTask.title,
        category: dailyTask.category || "其他",
        scheduledTime: dailyTask.time || "",
        estimateMinutes: dailyTask.estimateMinutes || "",
        done: false,
        createdAt: Date.now(),
        fromTemplate: true
      });
      existing.set(normalizedTitle, dailyTask);
      changed = true;
    }
  });
  day.dailyTemplateApplied = true;
  return true || changed;
}

function mergeDuplicateTasks(day) {
  const taskByTitle = new Map();
  const taskIdReplacements = new Map();
  const mergedTasks = [];
  let changed = false;

  day.tasks.forEach((task) => {
    const key = normalizeTaskTitle(task.title);
    const existing = taskByTitle.get(key);
    if (!existing) {
      taskByTitle.set(key, task);
      mergedTasks.push(task);
      return;
    }

    existing.done = existing.done || task.done;
    existing.category = existing.category || task.category;
    taskIdReplacements.set(task.id, existing.id);
    changed = true;
  });

  if (changed) {
    day.tasks = mergedTasks;
    day.records.forEach((record) => {
      if (record.taskId && taskIdReplacements.has(record.taskId)) {
        record.taskId = taskIdReplacements.get(record.taskId);
      }
    });
  }

  return changed;
}

function dateFromKey(key) {
  return new Date(`${key}T00:00:00`);
}

function shiftDate(days) {
  const date = dateFromKey(selectedDateKey);
  date.setDate(date.getDate() + days);
  selectedDateKey = keyFromDate(date);
  render();
}

function jumpToday() {
  selectedDateKey = todayKey();
  render();
}

function jumpToDate(key) {
  selectedDateKey = key;
  render();
}

function getRelativeDateKey(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return keyFromDate(date);
}

function formatNavDate(key) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short"
  }).format(dateFromKey(key));
}

function getSelectedDateRelation() {
  const currentTodayKey = todayKey();
  if (selectedDateKey === currentTodayKey) {
    return "today";
  }
  return selectedDateKey > currentTodayKey ? "future" : "past";
}

function getTaskPanelTitle() {
  const currentTodayKey = todayKey();
  if (selectedDateKey === currentTodayKey) {
    return "今日任务";
  }
  if (selectedDateKey === getRelativeDateKey(-1)) {
    return "昨日任务";
  }
  if (selectedDateKey === getRelativeDateKey(1)) {
    return "明日任务";
  }
  return `${formatNavDate(selectedDateKey)}任务`;
}

function getTaskInputPlaceholder() {
  const relation = getSelectedDateRelation();
  if (relation === "today") {
    return "添加今天的任务";
  }
  if (relation === "future") {
    return "添加这一天的日程";
  }
  return "补记这一天的任务";
}

function getUnavailableTaskLabel() {
  return getSelectedDateRelation() === "future" ? "暂未开始" : "不可开始";
}

function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatDuration(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) {
    return `${minutes} 分钟`;
  }

  if (rest === 0) {
    return `${hours} 小时`;
  }

  return `${hours} 小时 ${rest} 分钟`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatRecordSegmentLabel(record) {
  const durationLabel = formatDuration(record.durationMs);
  const wallClockMs = record.endedAt - record.startedAt;
  const isPausedLegacyRecord = Math.abs(wallClockMs - record.durationMs) > 60000;
  const timeLabel = isPausedLegacyRecord
    ? `${formatTime(record.startedAt)} 起`
    : `${formatTime(record.startedAt)}-${formatTime(record.endedAt)}`;
  const manualLabel = record.manual ? " · 补记" : "";
  return `${timeLabel} · ${durationLabel}${manualLabel}`;
}

function getActiveElapsed(active) {
  if (!active) {
    return 0;
  }

  if (Array.isArray(active.segments)) {
    return active.segments.reduce((total, segment) => {
      const start = Number(segment.startedAt);
      const end = segment.endedAt ? Number(segment.endedAt) : active.status === "running" ? Date.now() : start;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return total;
      }
      return total + end - start;
    }, 0);
  }

  const runningMs = active.status === "running" ? Date.now() - active.lastStartedAt : 0;
  return active.elapsedMs + runningMs;
}

function getActiveSegments(active, endedAt = Date.now()) {
  if (!active) {
    return [];
  }

  if (Array.isArray(active.segments) && active.segments.length) {
    return active.segments
      .map((segment) => {
        const startedAt = Number(segment.startedAt);
        const segmentEndedAt = segment.endedAt ? Number(segment.endedAt) : endedAt;
        return {
          startedAt,
          endedAt: segmentEndedAt
        };
      })
      .filter((segment) => Number.isFinite(segment.startedAt) && Number.isFinite(segment.endedAt) && segment.endedAt > segment.startedAt);
  }

  const durationMs = getActiveElapsed(active);
  return durationMs >= 1000
    ? [{ startedAt: endedAt - durationMs, endedAt }]
    : [];
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 1800);
}

function moveLiveActionsToToday() {
  const currentKey = todayKey();
  if (selectedDateKey === currentKey) {
    return;
  }

  const oldDay = getToday();
  if (oldDay.active) {
    recordActiveActivity({ completeTask: false });
  }
  selectedDateKey = currentKey;
}

function startActivity(title, category, taskId = null, sourceTodoId = null) {
  moveLiveActionsToToday();
  const day = getToday();
  const name = title.trim();
  const normalizedCategory = normalizeCategory(category);

  if (!name) {
    elements.activityInput.focus();
    return;
  }

  if (day.active) {
    recordActiveActivity({ completeTask: false });
  }

  const linkedTaskId = ensureTaskForActivity(day, name, normalizedCategory, taskId);
  const startedAt = Date.now();
  day.active = {
    id: uid(),
    taskId: linkedTaskId,
    title: name,
    category: normalizedCategory,
    startedAt,
    lastStartedAt: startedAt,
    elapsedMs: 0,
    status: "running",
    segments: [{ startedAt, endedAt: null }],
    sourceTodoId
  };

  elements.activityInput.value = "";
  saveState();
  render({ forceActiveSync: true });
}

function ensureTaskForActivity(day, title, category, taskId = null) {
  if (taskId) {
    const existing = day.tasks.find((task) => task.id === taskId);
    if (existing) {
      existing.done = false;
      return taskId;
    }
  }

  const match = day.tasks.find((task) => {
    if (task.done || normalizeTaskTitle(task.title) !== normalizeTaskTitle(title)) {
      return false;
    }

    return (task.category || "其他") === category || !task.category || category === "其他";
  });

  if (match) {
    match.done = false;
    return match.id;
  }

  const newTask = {
    id: uid(),
    title,
    category,
    done: false,
    createdAt: Date.now(),
    fromTimer: true
  };
  day.tasks.push(newTask);
  return newTask.id;
}

function togglePause() {
  moveLiveActionsToToday();
  const active = getToday().active;
  if (!active) {
    return;
  }

  if (active.status === "running") {
    const pausedAt = Date.now();
    const currentSegment = Array.isArray(active.segments)
      ? [...active.segments].reverse().find((segment) => !segment.endedAt)
      : null;
    if (currentSegment) {
      currentSegment.endedAt = pausedAt;
    }
    active.elapsedMs = getActiveElapsed(active);
    active.status = "paused";
  } else {
    const resumedAt = Date.now();
    active.status = "running";
    active.lastStartedAt = resumedAt;
    if (Array.isArray(active.segments)) {
      active.segments.push({ startedAt: resumedAt, endedAt: null });
    }
  }

  saveState();
  render({ forceActiveSync: true });
}

function finishActivity() {
  moveLiveActionsToToday();
  recordActiveActivity({ completeTask: true });
}

function recordActiveActivity({ completeTask }) {
  const day = getToday();
  const active = day.active;
  if (!active) {
    return;
  }

  const endedAt = Date.now();
  const note = elements.finishNote.value.trim();
  const segments = getActiveSegments(active, endedAt);
  const records = segments
    .map((segment, index) => ({
      id: index === 0 ? active.id : uid(),
      taskId: active.taskId || null,
      title: active.title,
      category: active.category || "其他",
      startedAt: segment.startedAt,
      endedAt: segment.endedAt,
      durationMs: segment.endedAt - segment.startedAt,
      note: index === segments.length - 1 ? note : ""
    }))
    .filter((record) => record.durationMs >= 1000);

  if (records.length) {
    day.records.unshift(...records.reverse());
  }

  if (completeTask) {
    const task = findTaskForActive(day, active);
    if (task) {
      task.done = true;
    }
  }

  day.active = null;
  elements.finishNote.value = "";
  saveState();
  render({ forceActiveSync: true });
}

function findTaskForActive(day, active) {
  if (active.taskId) {
    return day.tasks.find((task) => task.id === active.taskId);
  }

  return day.tasks.find((task) => normalizeTaskTitle(task.title) === normalizeTaskTitle(active.title) && (task.category || "其他") === (active.category || "其他"));
}

function addTask(title, category) {
  const name = title.trim();
  const normalizedCategory = normalizeCategory(category);
  if (!name) {
    elements.taskInput.focus();
    return;
  }

  const day = getToday();
  const existing = day.tasks.find((task) => normalizeTaskTitle(task.title) === normalizeTaskTitle(name));
  if (existing) {
    existing.category = existing.category || normalizedCategory;
    existing.done = false;
    elements.taskInput.value = "";
    saveState();
    render();
    showToast("同名任务已合并");
    return;
  }

  day.tasks.push({
    id: uid(),
    title: name,
    category: normalizedCategory,
    done: false,
    createdAt: Date.now()
  });
  elements.taskInput.value = "";
  saveState();
  render();
}

function normalizeTaskTitle(title) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

function addDailyTask() {
  const title = elements.dailyTaskName.value.trim();
  if (!title) {
    elements.dailyTaskName.focus();
    return;
  }

  const category = normalizeCategory(elements.dailyTaskCategory.value);
  const estimateMinutes = elements.dailyTaskMinutes.value ? String(Math.max(1, Math.round(Number(elements.dailyTaskMinutes.value)))) : "";
  const existing = getDailyTasks().find((task) => normalizeTaskTitle(task.title) === normalizeTaskTitle(title));
  if (existing) {
    existing.category = category;
    existing.time = elements.dailyTaskTime.value || "";
    existing.estimateMinutes = estimateMinutes;
  } else {
    getDailyTasks().push({
      id: uid(),
      title,
      category,
      time: elements.dailyTaskTime.value || "",
      estimateMinutes
    });
  }
  lastDailyTasksMarkup = "";
  refreshFutureDailyTasks();
  elements.dailyTaskName.value = "";
  elements.dailyTaskTime.value = "";
  elements.dailyTaskMinutes.value = "";
  saveState();
  render({ forceDailyTasksSync: true });
  showToast(existing ? "已更新固定任务" : "已添加固定任务");
}

function removeDailyTask(id) {
  const task = getDailyTasks().find((item) => item.id === id);
  if (!task) {
    return;
  }

  state.dailyTasks = getDailyTasks().filter((item) => item.id !== id);
  lastDailyTasksMarkup = "";
  refreshFutureDailyTasks();
  saveState();
  render({ forceDailyTasksSync: true });
  showToast(`已删除每日任务：${task.title}`);
}

function changeDailyTaskCategory(id, category) {
  const task = getDailyTasks().find((item) => item.id === id);
  if (!task) {
    return;
  }

  task.category = normalizeCategory(category);
  lastDailyTasksMarkup = "";
  refreshFutureDailyTasks();
  saveState();
  editingCategoryTarget = null;
  renderDailyTasksPanel();
  renderCategoryOptions();
}

function refreshFutureDailyTasks() {
  const currentTemplateTitles = new Set(getDailyTasks().map((task) => normalizeTaskTitle(task.title)));
  Object.entries(state.days).forEach(([key, day]) => {
    if (key >= todayKey()) {
      day.tasks = day.tasks.filter((task) => {
        if (!task.fromTemplate || currentTemplateTitles.has(normalizeTaskTitle(task.title))) {
          return true;
        }
        const hasRecords = day.records.some((record) => record.taskId === task.id);
        return task.done || hasRecords || day.active?.taskId === task.id;
      });
      day.dailyTemplateApplied = false;
    }
  });
  if (selectedDateKey >= todayKey()) {
    applyDailyTasks(getToday());
  }
}

function addManualRecord(title, category, minutes) {
  const name = title.trim();
  const durationMinutes = Number(minutes);

  if (!name) {
    elements.manualTitle.focus();
    return;
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    elements.manualMinutes.focus();
    return;
  }

  const durationMs = Math.round(durationMinutes) * 60000;
  const selectedDate = selectedDateKey === todayKey() ? new Date() : new Date(`${selectedDateKey}T18:00:00`);
  const endedAt = selectedDate.getTime();
  const normalizedCategory = normalizeCategory(category);
  getToday().records.unshift({
    id: uid(),
    title: name,
    category: normalizedCategory,
    startedAt: endedAt - durationMs,
    endedAt,
    durationMs,
    manual: true
  });

  elements.manualTitle.value = "";
  elements.manualMinutes.value = "";
  saveState();
  render();
}

function toggleTask(id) {
  const day = getToday();
  const task = day.tasks.find((item) => item.id === id);
  if (!task) {
    return;
  }

  if (!task.done && day.active?.taskId === id) {
    recordActiveActivity({ completeTask: true });
    return;
  }

  task.done = !task.done;
  saveState();
  renderTasks(day);
  elements.doneCount.textContent = `${day.tasks.filter((item) => item.done).length}/${day.tasks.length}`;
}

function updateTaskTitle(id, title) {
  const day = getToday();
  const task = day.tasks.find((item) => item.id === id);
  const name = title.trim();
  if (!task || !name) {
    renderTasks(day);
    return;
  }

  task.title = name;
  if (day.active?.taskId === id) {
    day.active.title = name;
  }
  day.records.forEach((record) => {
    if (record.taskId === id) {
      record.title = name;
    }
  });
  saveState();
  render();
}

function removeTask(id) {
  const day = getToday();
  day.tasks = day.tasks.filter((task) => task.id !== id);
  saveState();
  renderTasks(day);
  renderCategoryStats(day);
  elements.doneCount.textContent = `${day.tasks.filter((task) => task.done).length}/${day.tasks.length}`;
}

function addTodo(title, category, dueDate) {
  const name = title.trim();
  if (!name) {
    showToast("先写一下待办名称");
    return;
  }

  getTodos().push({
    id: uid(),
    title: name,
    category: normalizeCategory(category),
    dueDate: dueDate || "",
    done: false,
    createdAt: Date.now()
  });
  elements.todoTitle.value = "";
  elements.todoDueDate.value = "";
  saveState();
  if (!editingTodoDateId && !elements.todoPoolList.matches(":hover")) {
    renderTodoPool();
  }
  renderCategoryOptions();
}

function toggleTodo(id) {
  const todo = getTodos().find((item) => item.id === id);
  if (!todo) {
    return;
  }

  todo.done = !todo.done;
  saveState();
  renderTodoPool();
}

function removeTodo(id) {
  state.todos = getTodos().filter((item) => item.id !== id);
  saveState();
  renderTodoPool();
}

function changeTodoCategory(todoId, category) {
  const todo = getTodos().find((item) => item.id === todoId);
  if (!todo) {
    return;
  }

  todo.category = normalizeCategory(category);
  editingCategoryTarget = null;
  saveState();
  renderTodoPool();
  renderCategoryOptions();
}

function updateTodoDueDate(todoId) {
  const todo = getTodos().find((item) => item.id === todoId);
  if (!todo) {
    return;
  }

  const input = elements.todoPoolList.querySelector(`[data-todo-date-input="${CSS.escape(todoId)}"]`);
  const nextDate = (input?.value || "").trim();
  if (nextDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
    showToast("启动日期格式要像 2026-05-22");
    return;
  }

  todo.dueDate = nextDate;
  editingTodoDateId = null;
  saveState();
  renderTodoPool();
  showToast(todo.dueDate ? "已设置启动日期" : "已清除启动日期");
}

function convertTodoToTask(todoId, dateKey) {
  const todo = getTodos().find((item) => item.id === todoId);
  if (!todo) {
    return;
  }

  const day = getDay(dateKey);
  const exists = day.tasks.some((task) => normalizeTaskTitle(task.title) === normalizeTaskTitle(todo.title));
  if (!exists) {
    day.tasks.push({
      id: uid(),
      title: todo.title,
      category: todo.category || "其他",
      scheduledTime: "",
      estimateMinutes: "",
      done: false,
      createdAt: Date.now()
    });
  }
  saveState();
  if (dateKey === selectedDateKey) {
    renderTasks(day);
  }
  showToast(dateKey === todayKey() ? "已转为今日任务" : "已转为明日任务");
}

function changeTaskCategory(taskId, category) {
  const day = getToday();
  const task = day.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  const normalizedCategory = normalizeCategory(category);
  task.category = normalizedCategory;
  day.records.forEach((record) => {
    if (record.taskId === taskId) {
      record.category = normalizedCategory;
    }
  });
  if (day.active?.taskId === taskId) {
    day.active.category = normalizedCategory;
  }
  saveState();
  editingCategoryTarget = null;
  renderTasks(day);
  renderRecords(day);
  renderCategoryStats(day);
  publishTimerStatus(day.active, getActiveElapsed(day.active));
}

function changeRecordGroupCategory(groupKey, category) {
  const day = getToday();
  const normalizedCategory = normalizeCategory(category);
  const groups = getRecordGroups(day);
  const group = groups.find((item) => item.key === groupKey);
  if (!group) {
    return;
  }

  group.records.forEach((record) => {
    record.category = normalizedCategory;
  });

  const linkedTask = group.records.find((record) => record.taskId);
  if (linkedTask) {
    const task = day.tasks.find((item) => item.id === linkedTask.taskId);
    if (task) {
      task.category = normalizedCategory;
    }
  }

  saveState();
  editingCategoryTarget = null;
  renderRecords(day);
  renderTasks(day);
  renderCategoryStats(day);
}

function deleteRecord(recordId) {
  if (!window.confirm("确认删除这段记录吗？删除后暂时不能恢复。")) {
    return;
  }

  const day = getToday();
  const originalLength = day.records.length;
  day.records = day.records.filter((record) => record.id !== recordId);
  if (day.records.length === originalLength) {
    return;
  }

  saveState();
  refreshRecordsView(day);
  showToast("已删除这段记录");
}

function editRecordDuration(recordId) {
  const day = getToday();
  const dateKey = selectedDateKey;
  const record = day.records.find((item) => item.id === recordId);
  if (!record) {
    return;
  }

  const startDate = new Date(record.startedAt);
  const endDate = new Date(record.endedAt);
  openInlinePopover({
    title: "修改时间段",
    confirmText: "保存",
    fields: [
      { name: "start", label: "开始时间", type: "time", value: timeInputValue(startDate) },
      { name: "end", label: "结束时间", type: "time", value: timeInputValue(endDate) }
    ],
    onConfirm: ({ start, end }) => {
      const nextStartedAt = timeOnDateKey(start, dateKey);
      const nextEndedAt = timeOnDateKey(end, dateKey);
      if (!nextStartedAt || !nextEndedAt || nextEndedAt <= nextStartedAt) {
        showToast("结束时间要晚于开始时间");
        return;
      }

      record.startedAt = nextStartedAt;
      record.endedAt = nextEndedAt;
      record.durationMs = nextEndedAt - nextStartedAt;
      saveState();
      refreshRecordsView(day);
      showToast("已修改这段记录");
    }
  });
}

function updateRecordTimeRange(recordId, start, end) {
  const day = getToday();
  const dateKey = selectedDateKey;
  const record = day.records.find((item) => item.id === recordId);
  if (!record) {
    return;
  }

  const nextStartedAt = timeOnDateKey(start, dateKey);
  const nextEndedAt = timeOnDateKey(end, dateKey);
  if (!nextStartedAt || !nextEndedAt || nextEndedAt <= nextStartedAt) {
    showToast("结束时间要晚于开始时间");
    return;
  }

  record.startedAt = nextStartedAt;
  record.endedAt = nextEndedAt;
  record.durationMs = nextEndedAt - nextStartedAt;
  saveState();
  refreshRecordsView(day);
  showToast("已修改这段记录");
}

function editRecordNote(recordId) {
  const day = getToday();
  const record = day.records.find((item) => item.id === recordId);
  if (!record) {
    return;
  }

  openInlinePopover({
    title: "修改这段感受",
    confirmText: "保存",
    fields: [
      { name: "note", label: "备注或感受", type: "textarea", rows: 4, value: record.note || "" }
    ],
    onConfirm: ({ note }) => {
      record.note = note.trim();
      saveState();
      refreshRecordsView(day);
      showToast(record.note ? "已保存这段感受" : "已清空这段感受");
    }
  });
}

function updateRecordNote(recordId, note) {
  const record = getToday().records.find((item) => item.id === recordId);
  if (!record) {
    return;
  }

  record.note = note.trim();
  saveState();
}

function updateRecordGroupTitle(groupKey, title) {
  const day = getToday();
  const name = title.trim();
  const group = getRecordGroups(day).find((item) => item.key === groupKey);
  if (!group || !name) {
    editingRecordGroupKey = null;
    refreshRecordsView(day);
    return;
  }

  group.records.forEach((record) => {
    record.title = name;
  });

  const linkedRecord = group.records.find((record) => record.taskId);
  if (linkedRecord) {
    const task = day.tasks.find((item) => item.id === linkedRecord.taskId);
    if (task) {
      task.title = name;
    }
    if (day.active?.taskId === linkedRecord.taskId) {
      day.active.title = name;
    }
  }

  editingRecordGroupKey = null;
  saveState();
  refreshRecordsView(day);
  renderTasks(day);
  publishTimerStatus(day.active, getActiveElapsed(day.active));
}

function refreshRecordsView(day = getToday()) {
  const scrollTop = elements.workspace?.scrollTop || 0;
  renderRecords(day);
  renderCategoryStats(day);
  const active = day.active;
  const elapsed = getActiveElapsed(active);
  const totalMs = day.records.reduce((sum, record) => sum + record.durationMs, 0) + elapsed;
  elements.currentTitle.textContent = active ? active.title : "还没有开始";
  elements.timerDisplay.textContent = formatClock(elapsed);
  elements.totalTime.textContent = totalMs ? formatDuration(totalMs) : "0 分钟";
  elements.entryCount.textContent = String(day.records.length);
  publishTimerStatus(active, elapsed);
  if (elements.workspace) {
    elements.workspace.scrollTop = scrollTop;
  }
}

function timeInputValue(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function timeOnSelectedDay(value) {
  return timeOnDateKey(value, selectedDateKey);
}

function timeOnDateKey(value, dateKey) {
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
    return null;
  }

  const [hours, minutes, seconds = 0] = value.split(":").map(Number);
  const date = dateFromKey(dateKey);
  date.setHours(hours, minutes, seconds, 0);
  return date.getTime();
}

function buildReport() {
  const date = selectedDateKey;
  const day = getToday();
  const elapsed = getActiveElapsed(day.active);
  const totalMs = day.records.reduce((sum, record) => sum + record.durationMs, 0) + elapsed;
  const doneTasks = day.tasks.filter((task) => task.done).length;
  const tasks = day.tasks.length
    ? day.tasks.map((task) => `${task.done ? "✓" : "□"} ${task.title}（${task.category || "其他"}）`).join("\n")
    : "今天还没有任务";
  const categories = getCategoryTotals(day);
  const categoryLines = categories.length
    ? categories.map((item) => `${item.name}：${formatDuration(item.ms)}`).join("\n")
    : "今天还没有分类统计";
  const records = day.records.length
    ? day.records
        .map((record) => {
          const note = record.note ? `\n  感受：${record.note}` : "";
          return `${formatTime(record.startedAt)}-${formatTime(record.endedAt)} ${record.title}（${record.category || "其他"}，${formatDuration(record.durationMs)}）${note}`;
        })
        .join("\n")
    : "今天还没有时间记录";

  return `Good Time 日报｜${date}

今日已记录：${formatDuration(totalMs)}
完成任务：${doneTasks}/${day.tasks.length}

【今日任务】
${tasks}

【分类时间】
${categoryLines}

【时间记录】
${records}
`;
}

async function copyReport() {
  const report = buildReport();

  try {
    await navigator.clipboard.writeText(report);
    showToast("复制成功");
  } catch (error) {
    console.warn("Clipboard failed", error);
    window.prompt("复制下面的日报", report);
  }
}

function renderTasks(day) {
  if (!day.tasks.length) {
    elements.taskList.innerHTML = `<li class="empty-state">${getSelectedDateRelation() === "today" ? "今天还没有任务" : "这一天还没有任务"}</li>`;
    return;
  }

  const canStartTasks = getSelectedDateRelation() === "today";
  const unavailableLabel = getUnavailableTaskLabel();
  elements.taskList.innerHTML = day.tasks
    .map(
      (task) => {
        const isActiveTask = day.active?.taskId === task.id;
        const isEditingTask = editingTaskId === task.id;
        const canStartTask = canStartTasks && !isActiveTask;
        const actionLabel = canStartTasks
          ? isActiveTask ? "进行中" : task.done ? "继续" : taskHasRecords(day, task.id) ? "继续" : "开始"
          : unavailableLabel;
        const meta = renderTaskMeta(task);
        const titleControl = isEditingTask
          ? `<input class="task-title-input" type="text" value="${escapeHtml(task.title)}" data-task-title-input="${task.id}" aria-label="修改任务名称" />`
          : `<button class="task-title" type="button" data-task-edit="${task.id}">${escapeHtml(task.title)}${isActiveTask ? `<span class="active-task-badge">进行中</span>` : ""}${meta}</button>`;
        return `
        <li class="task-item ${task.done ? "done" : ""} ${isActiveTask ? "active-task" : ""} ${canStartTasks ? "" : "date-locked-task"}">
          <input class="task-check" type="checkbox" ${task.done ? "checked" : ""} data-task-check="${task.id}" aria-label="切换任务状态" />
          ${titleControl}
          ${renderCategoryEditor(task.category || "其他", "task", task.id)}
          <button class="mini-action" type="button" ${canStartTask ? `data-task-start="${task.id}"` : ""} aria-label="开始计时" ${canStartTask ? "" : "disabled"}>${actionLabel}</button>
          <button class="icon-button" type="button" data-task-remove="${task.id}" aria-label="删除任务">×</button>
        </li>
      `;
      }
    )
    .join("");
}

function renderTaskMeta(task) {
  const parts = [];
  if (task.scheduledTime) {
    parts.push(task.scheduledTime);
  }
  if (task.estimateMinutes) {
    parts.push(`预计 ${task.estimateMinutes} 分钟`);
  }
  if (!parts.length) {
    return "";
  }
  return `<span class="task-meta">${parts.map(escapeHtml).join(" · ")}</span>`;
}

function isTodoActive(todo, day = getToday()) {
  const active = day.active;
  if (!active || todo.done) {
    return false;
  }

  if (active.sourceTodoId) {
    return active.sourceTodoId === todo.id;
  }

  return normalizeTaskTitle(active.title) === normalizeTaskTitle(todo.title)
    && (active.category || "其他") === (todo.category || "其他");
}

function renderTodoPool() {
  const todos = getTodos().slice().sort((a, b) => {
    if (a.done !== b.done) {
      return a.done ? 1 : -1;
    }
    if (a.dueDate && b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.dueDate) {
      return -1;
    }
    if (b.dueDate) {
      return 1;
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  if (!todos.length) {
    elements.todoPoolList.innerHTML = `<li class="empty-state">这里可以放不限定哪天完成的事</li>`;
    return;
  }

  elements.todoPoolList.innerHTML = todos.map((todo) => {
    const activeTodo = isTodoActive(todo);
    return `
    <li class="todo-pool-item ${todo.done ? "done" : ""} ${activeTodo ? "active-todo" : ""}">
      <input type="checkbox" ${todo.done ? "checked" : ""} data-todo-check="${escapeHtml(todo.id)}" aria-label="切换待办状态" />
      <span class="todo-pool-title">${escapeHtml(todo.title)}${activeTodo ? `<span class="active-task-badge">进行中</span>` : ""}</span>
      ${renderCategoryEditor(todo.category || "其他", "todo", todo.id)}
      ${editingTodoDateId === todo.id
    ? `<span class="todo-date-editor"><input type="text" value="${escapeHtml(todo.dueDate || "")}" data-todo-date-input="${escapeHtml(todo.id)}" placeholder="2026-05-22" /><button type="button" data-todo-date-save="${escapeHtml(todo.id)}">保存</button></span>`
    : `<button class="todo-start-date" type="button" data-todo-due="${escapeHtml(todo.id)}">${todo.dueDate ? `启动 ${escapeHtml(todo.dueDate.slice(5).replace("-", "/"))}` : "设置启动日期"}</button>`}
      <button class="mini-action" type="button" ${activeTodo ? "disabled" : `data-todo-start="${escapeHtml(todo.id)}"`}>${activeTodo ? "进行中" : "现在开始"}</button>
      <button class="icon-button" type="button" data-todo-remove="${escapeHtml(todo.id)}" aria-label="删除待办">×</button>
    </li>
  `;
  }).join("");
}

function taskHasRecords(day, taskId) {
  return day.records.some((record) => record.taskId === taskId);
}

function renderRecords(day) {
  if (!day.records.length) {
    elements.recordList.innerHTML = `<div class="empty-state">结束一个事项后，这里会出现时间记录</div>`;
    return;
  }

  elements.recordList.innerHTML = getRecordGroups(day)
    .map(
      (group) => {
        const isActiveGroup = isCurrentRecordGroup(day, group);
        const isEditingRecordTitle = editingRecordGroupKey === group.key;
        const titleControl = isEditingRecordTitle
          ? `<input class="record-title-input" type="text" value="${escapeHtml(group.title)}" data-record-title-input="${escapeHtml(group.key)}" aria-label="修改记录名称" />`
          : `<button class="record-title" type="button" data-record-title-edit="${escapeHtml(group.key)}">${escapeHtml(group.title)}</button>`;
        return `
        <article class="record-item">
          <div>
            <div class="record-head">
              ${titleControl}
              ${renderCategoryEditor(group.category || "其他", "record", group.key)}
            </div>
            <div class="record-segments">
              ${group.records
    .map((record) => `
                <span class="record-segment">
                  <button class="record-segment-time" type="button" data-record-edit="${escapeHtml(record.id)}">${escapeHtml(formatRecordSegmentLabel(record))}</button>
                  <span class="record-hover-card">
                    <span class="record-time-editor">
                      <input type="text" value="${escapeHtml(timeInputValue(new Date(record.startedAt)))}" data-record-start="${escapeHtml(record.id)}" aria-label="开始时间" inputmode="numeric" placeholder="20:34" />
                      <input type="text" value="${escapeHtml(timeInputValue(new Date(record.endedAt)))}" data-record-end="${escapeHtml(record.id)}" aria-label="结束时间" inputmode="numeric" placeholder="20:59" />
                      <button type="button" data-record-time-save="${escapeHtml(record.id)}">保存时间</button>
                    </span>
                    <textarea class="record-hover-note ${record.note ? "" : "is-empty"}" rows="3" data-record-note-input="${escapeHtml(record.id)}" placeholder="记录你的感受吧">${escapeHtml(record.note || "")}</textarea>
                    <span class="record-hover-actions">
                      <button type="button" data-record-note-save="${escapeHtml(record.id)}">存备注</button>
                      <button type="button" data-record-delete="${escapeHtml(record.id)}">删除</button>
                    </span>
                  </span>
                </span>
              `)
    .join("")}
            </div>
          </div>
          <div class="record-side">
            <strong class="record-duration">${formatDuration(group.durationMs)}</strong>
            <button class="mini-action" type="button" data-record-continue="${group.latestRecordId}" ${isActiveGroup ? "disabled" : ""}>${isActiveGroup ? "进行中" : "继续"}</button>
          </div>
        </article>
      `;
      }
    )
    .join("");
}

function isCurrentRecordGroup(day, group) {
  if (!day.active) {
    return false;
  }
  const activeKey = day.active.taskId || `${normalizeTaskTitle(day.active.title)}::${day.active.category || "其他"}`;
  return group.key === activeKey;
}

function renderCategoryEditor(currentCategory, kind, id) {
  const attr = kind === "task"
    ? "data-task-category"
    : kind === "daily"
      ? "data-daily-category"
    : kind === "todo"
      ? "data-todo-category"
      : "data-record-category";
  const isOpen = editingCategoryTarget && editingCategoryTarget.kind === kind && editingCategoryTarget.id === id;
  return `
    <span class="category-editor${isOpen ? " open" : ""}" style="${categoryStyle(currentCategory)}">
      <button class="category-editor-current" type="button" data-category-toggle data-category-kind="${escapeHtml(kind)}" data-category-id="${escapeHtml(id)}">${escapeHtml(currentCategory)}</button>
      <span class="category-editor-menu">
        ${getCategories()
    .map((category) => `<button type="button" ${attr}="${escapeHtml(id)}" data-category-value="${escapeHtml(category)}" data-category-action="${escapeHtml(category)}" style="${categoryStyle(category)}">${escapeHtml(category)}</button>`)
    .join("")}
      </span>
    </span>
  `;
}

function renderCategoryTarget(target = editingCategoryTarget) {
  if (!target) {
    return;
  }

  if (target.kind === "task") {
    renderTasks(getToday());
  } else if (target.kind === "daily") {
    renderDailyTasksPanel();
  } else if (target.kind === "todo") {
    renderTodoPool();
  } else {
    renderRecords(getToday());
  }
}

function closeCategoryEditorsIn(container) {
  container.querySelectorAll(".category-editor.open").forEach((editor) => {
    editor.classList.remove("open");
  });
}

function closeEditingCategoryTarget() {
  if (!editingCategoryTarget) {
    return;
  }

  const previousTarget = editingCategoryTarget;
  editingCategoryTarget = null;
  if (previousTarget.kind === "todo") {
    closeCategoryEditorsIn(elements.todoPoolList);
    return;
  }
  if (previousTarget.kind === "daily") {
    closeCategoryEditorsIn(elements.dailyTasksList);
    return;
  }
  renderCategoryTarget(previousTarget);
}

function getRecordGroups(day) {
  const groups = new Map();

  day.records.forEach((record) => {
    const key = record.taskId || `${normalizeTaskTitle(record.title)}::${record.category || "其他"}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        title: record.title,
        category: record.category || "其他",
        durationMs: 0,
        latestEndedAt: 0,
        latestRecordId: record.id,
        records: [],
        notes: []
      });
    }

    const group = groups.get(key);
    group.durationMs += record.durationMs;
    group.records.push(record);
    if (record.note) {
      group.notes.push(record.note);
    }
    if (record.endedAt > group.latestEndedAt) {
      group.latestEndedAt = record.endedAt;
      group.latestRecordId = record.id;
    }
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      records: group.records.sort((a, b) => a.startedAt - b.startedAt)
    }))
    .sort((a, b) => b.latestEndedAt - a.latestEndedAt);
}

function renderCategoryOptions() {
  const categories = getCategories();
  const selectedDailyCategory = elements.dailyTaskCategory.value || "其他";
  const chips = categories
    .map((category) => `<button type="button" class="suggestion-chip" draggable="true" style="${categoryStyle(category)}" data-category="${escapeHtml(category)}" data-category-drag="${escapeHtml(category)}" data-category-action="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
    .join("");
  const options = categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");

  if (chips !== lastCategoryOptionsMarkup) {
    elements.activityCategorySuggestions.innerHTML = chips;
    elements.taskCategorySuggestions.innerHTML = chips;
    elements.todoCategorySuggestions.innerHTML = chips;
    elements.manualCategorySuggestions.innerHTML = chips;
    lastCategoryOptionsMarkup = chips;
  }
  if (elements.dailyTaskCategory.innerHTML !== options && document.activeElement !== elements.dailyTaskCategory) {
    elements.dailyTaskCategory.innerHTML = options;
  }
  elements.dailyTaskCategory.value = categories.includes(selectedDailyCategory) ? selectedDailyCategory : "其他";
}

function renderDailyTasksPanel() {
  elements.dailyTasksPanel.hidden = !isDailyTasksPanelOpen;
  elements.toggleDailyTasksButton.textContent = isDailyTasksPanelOpen ? "收起每日任务" : "查看/修改每日任务";
  if (!isDailyTasksPanelOpen) {
    return;
  }

  const tasks = getDailyTasks();
  if (!tasks.length) {
    const emptyMarkup = `<li class="empty-state">还没有固定任务</li>`;
    if (emptyMarkup !== lastDailyTasksMarkup) {
      elements.dailyTasksList.innerHTML = emptyMarkup;
      lastDailyTasksMarkup = emptyMarkup;
    }
    return;
  }

  const markup = tasks
    .map((task) => {
      const meta = [
        task.time || "",
        task.estimateMinutes ? `预计 ${task.estimateMinutes} 分钟` : ""
      ].filter(Boolean).join(" · ");
      return `
        <li class="daily-task-item">
          <span class="daily-task-title">${escapeHtml(task.title)}</span>
          ${renderCategoryEditor(task.category || "其他", "daily", task.id)}
          <span class="daily-task-meta">${meta ? escapeHtml(meta) : "无固定时间"}</span>
          <button class="icon-button" type="button" data-daily-task-remove="${escapeHtml(task.id)}" aria-label="删除固定任务">×</button>
        </li>
      `;
    })
    .join("");
  if (markup !== lastDailyTasksMarkup) {
    elements.dailyTasksList.innerHTML = markup;
    lastDailyTasksMarkup = markup;
  }
}

function getCategoryTotals(day) {
  const totals = new Map();
  day.records.forEach((record) => {
    const category = record.category || "其他";
    totals.set(category, (totals.get(category) || 0) + record.durationMs);
  });

  if (day.active) {
    const category = day.active.category || "其他";
    totals.set(category, (totals.get(category) || 0) + getActiveElapsed(day.active));
  }

  return [...totals.entries()]
    .map(([name, ms]) => ({ name, ms }))
    .sort((a, b) => b.ms - a.ms);
}

function getCategoryTotalsForRange(startKey, endKey) {
  const totals = new Map();

  Object.entries(state.days).forEach(([key, day]) => {
    if (key < startKey || key > endKey) {
      return;
    }

    day.records.forEach((record) => {
      const category = record.category || "其他";
      totals.set(category, (totals.get(category) || 0) + record.durationMs);
    });

    if (day.active) {
      const category = day.active.category || "其他";
      totals.set(category, (totals.get(category) || 0) + getActiveElapsed(day.active));
    }
  });

  return [...totals.entries()]
    .map(([name, ms]) => ({ name, ms }))
    .sort((a, b) => b.ms - a.ms);
}

function getPeriodRanges() {
  const selected = dateFromKey(selectedDateKey);
  const weekStart = new Date(selected);
  const day = weekStart.getDay() || 7;
  weekStart.setDate(weekStart.getDate() - day + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);

  return {
    day: [selectedDateKey, selectedDateKey],
    week: [keyFromDate(weekStart), keyFromDate(weekEnd)],
    month: [keyFromDate(monthStart), keyFromDate(monthEnd)]
  };
}

function renderCategoryStats(day) {
  const totals = getCategoryTotals(day);

  if (!totals.length) {
    elements.categoryStats.innerHTML = `<div class="empty-state">开始记录后，这里会按分类汇总时间</div>`;
    return;
  }

  const ranges = getPeriodRanges();
  const periods = [
    { label: "日", totals },
    { label: "周", totals: getCategoryTotalsForRange(...ranges.week) },
    { label: "月", totals: getCategoryTotalsForRange(...ranges.month) }
  ];
  elements.categoryStats.innerHTML = `
    <div class="category-bubble-layout">
      <div class="category-bubble-board">
        ${periods.map((period) => renderCategoryBubblePeriod(period)).join("")}
      </div>
      <div id="categoryInsight" class="category-insight">${renderCategoryIdleInsight()}</div>
    </div>
    <div class="category-export-row" aria-label="复制分类表格">
      <button type="button" data-category-export="日">复制日表</button>
      <button type="button" data-category-export="周">复制周表</button>
      <button type="button" data-category-export="月">复制月表</button>
    </div>
    <div id="categoryDetail" class="category-detail" aria-live="polite"></div>
  `;
  if (selectedCategoryDetailPeriod) {
    renderCategoryDetail(selectedCategoryDetailPeriod);
  }
}

function renderCategoryBubblePeriod({ label, totals }) {
  const max = Math.max(1, ...totals.map((item) => item.ms));
  return `
    <section class="category-bubble-period" aria-label="${escapeHtml(label)}分类">
      <span class="category-bubble-period-label">${escapeHtml(label)}</span>
      <div class="category-bubble-list">
        ${totals.slice(0, 6).map((item) => {
    const scale = 0.72 + (item.ms / max) * 0.48;
    const percent = Math.round((item.ms / totals.reduce((sum, total) => sum + total.ms, 0)) * 100);
    return `
          <button class="category-bubble" type="button" data-period="${escapeHtml(label)}" data-category="${escapeHtml(item.name)}" data-duration="${formatDuration(item.ms)}" data-percent="${percent}" style="${categoryStyle(item.name)} --bubble-scale: ${scale};">
            <span>${escapeHtml(item.name)}</span>
            <small>${formatDuration(item.ms)}</small>
          </button>
        `;
  }).join("")}
      </div>
    </section>
  `;
}

function renderDonutChart(rings) {
  const content = rings.map((ring) => renderRing(ring)).join("");
  return `
    <div class="donut-wrap">
      <svg class="donut-chart" viewBox="0 0 180 180" role="img" aria-label="分类环形统计">
        <circle cx="90" cy="90" r="72" class="donut-track" />
        <circle cx="90" cy="90" r="54" class="donut-track" />
        <circle cx="90" cy="90" r="36" class="donut-track" />
        ${content}
        <circle cx="90" cy="90" r="22" class="donut-core" />
        <text x="90" y="88" text-anchor="middle" class="donut-title">分类</text>
        <text x="90" y="101" text-anchor="middle" class="donut-subtitle">D W M</text>
      </svg>
    </div>
  `;
}

function renderRing({ label, radius, totals }) {
  const total = totals.reduce((sum, item) => sum + item.ms, 0);
  const width = 8;
  let start = -90;

  if (!total) {
    return `<circle cx="90" cy="90" r="${radius}" fill="none" stroke="#e2e8e1" stroke-width="${width}" />`;
  }

  return totals
    .map((item) => {
      const angle = (item.ms / total) * 360;
      const gap = totals.length > 1 ? Math.min(2.6, angle * 0.22) : 0;
      const end = start + angle - gap;
      const percent = Math.round((item.ms / total) * 100);
      const attrs = `class="donut-segment" data-period="${label}" data-category="${escapeHtml(item.name)}" data-duration="${formatDuration(item.ms)}" data-percent="${percent}"`;
      const color = categoryColor(item.name);
      let segment;
      if (angle >= 359.9) {
        segment = `<circle ${attrs} cx="90" cy="90" r="${radius}" fill="none" stroke="${color}" stroke-width="${width}" opacity="0.9" />`;
      } else {
        segment = `<path ${attrs} d="${describeArc(90, 90, radius, start + gap / 2, end)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="0.9" />`;
      }
      start += angle;
      return segment;
    })
    .join("");
}

function updateCategoryInsight(segment) {
  const insight = elements.categoryStats.querySelector("#categoryInsight");
  if (!insight) {
    return;
  }

  const nextKey = `${segment.dataset.period}:${segment.dataset.category}`;
  if (nextKey === lastCategoryInsightKey) {
    return;
  }

  lastCategoryInsightKey = nextKey;
  insight.innerHTML = renderPeriodCategoryTasks(
    segment.dataset.period,
    segment.dataset.category,
    segment.dataset.duration,
    segment.dataset.percent
  );
}

function renderCategoryIdleInsight() {
  return `
    <span class="insight-eyebrow">查看明细</span>
    <strong>选择分类查看任务</strong>
    <span>日 / 周 / 月都会显示该分类下的任务累计时间，也可以导出给表格继续整理</span>
    <div class="insight-actions" aria-label="导出分类 CSV">
      <button type="button" data-category-csv="日">导出日 CSV</button>
      <button type="button" data-category-csv="周">导出周 CSV</button>
      <button type="button" data-category-csv="月">导出月 CSV</button>
    </div>
  `;
}

function resetCategoryInsight() {
  const insight = elements.categoryStats.querySelector("#categoryInsight");
  if (insight) {
    lastCategoryInsightKey = "";
    insight.innerHTML = renderCategoryIdleInsight();
  }
}

function getPeriodRangeText(periodLabel) {
  const ranges = getPeriodRanges();
  const range = periodLabel === "日" ? ranges.day : periodLabel === "周" ? ranges.week : ranges.month;
  return range[0] === range[1] ? range[0] : `${range[0]} 至 ${range[1]}`;
}

function buildCategoryDetailTable(periodLabel) {
  return buildCategoryDetailRows(periodLabel)
    .map((row) => row.map((cell) => String(cell).replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t"))
    .join("\n");
}

function buildCategoryDetailRows(periodLabel) {
  const totals = getCategoryTotalsByPeriodLabel(periodLabel);
  const rangeText = getPeriodRangeText(periodLabel);
  const rows = [["周期", "日期范围", "日期", "分类", "事件", "备注", "分钟", "时长"]];

  totals.forEach((categoryTotal) => {
    const tasks = getTaskTotalsForCategoryPeriod(periodLabel, categoryTotal.name);
    if (!tasks.length) {
      rows.push([periodLabel, rangeText, "", categoryTotal.name, "", "", String(Math.round(categoryTotal.ms / 60000)), formatDuration(categoryTotal.ms)]);
      return;
    }

    tasks.forEach((task) => {
      rows.push([periodLabel, rangeText, task.date || "", categoryTotal.name, task.title, task.note || "", String(Math.round(task.ms / 60000)), formatDuration(task.ms)]);
    });
  });

  return rows;
}

async function copyCategoryDetailTable(periodLabel = selectedCategoryDetailPeriod || "日") {
  const text = buildCategoryDetailTable(periodLabel);
  await navigator.clipboard.writeText(text);
  showToast(`已复制${periodLabel}分类表格`);
}

function csvCell(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function getCategoryCsvFileName(periodLabel) {
  const range = getPeriodRangeText(periodLabel).replace(/\s+至\s+/g, "_to_").replace(/[^\d_to-]/g, "");
  const periodName = periodLabel === "日" ? "day" : periodLabel === "周" ? "week" : "month";
  return `good-time-${periodName}-${range || selectedDateKey}.csv`;
}

function downloadCategoryDetailCsv(periodLabel = selectedCategoryDetailPeriod || "日") {
  const rows = buildCategoryDetailRows(periodLabel);
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getCategoryCsvFileName(periodLabel);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`已导出${periodLabel}CSV`);
}

function renderPeriodCategoryTasks(periodLabel, category, duration, percent) {
  const relatedTasks = getTaskTotalsForCategoryPeriod(periodLabel, category);
  const rows = relatedTasks.length
    ? relatedTasks
        .slice(0, 4)
        .map((task) => `<li><span class="insight-task-title">${escapeHtml(task.title)}</span><span class="insight-task-duration">${formatDuration(task.ms)}</span></li>`)
        .join("")
    : `<li><span class="insight-task-title">暂无任务记录</span><span class="insight-task-duration">0 分钟</span></li>`;

  return `
    <span class="insight-eyebrow">${escapeHtml(periodLabel)} · ${escapeHtml(percent)}%</span>
    <div class="insight-head">
      <strong>${escapeHtml(category)}</strong>
      <span>${escapeHtml(duration)}</span>
    </div>
    <ul class="insight-task-list">${rows}</ul>
  `;
}

function getTaskTotalsForCategoryPeriod(periodLabel, category) {
  const ranges = getPeriodRanges();
  const range = periodLabel === "日" ? ranges.day : periodLabel === "周" ? ranges.week : ranges.month;
  const totals = new Map();

  Object.entries(state.days).forEach(([key, day]) => {
    if (key < range[0] || key > range[1]) {
      return;
    }

    day.records.forEach((record) => {
      if ((record.category || "其他") !== category) {
        return;
      }
      const taskKey = `${key}::${record.taskId || normalizeTaskTitle(record.title)}`;
      const existing = totals.get(taskKey) || { date: key, title: record.title, ms: 0, notes: [] };
      existing.ms += record.durationMs;
      if (record.note) {
        existing.notes.push(record.note);
      }
      totals.set(taskKey, existing);
    });

    if (day.active && (day.active.category || "其他") === category) {
      const taskKey = `${key}::${day.active.taskId || normalizeTaskTitle(day.active.title)}`;
      const existing = totals.get(taskKey) || { date: key, title: day.active.title, ms: 0, notes: [] };
      existing.ms += getActiveElapsed(day.active);
      totals.set(taskKey, existing);
    }
  });

  return [...totals.values()]
    .map((item) => ({ ...item, note: [...new Set(item.notes || [])].join("；") }))
    .sort((a, b) => b.ms - a.ms);
}

function formatPeriodTaskDate(key, periodLabel) {
  if (key === todayKey()) {
    return "今天";
  }
  if (key === getRelativeDateKey(-1)) {
    return "昨天";
  }
  if (periodLabel === "周") {
    return new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(dateFromKey(key));
  }
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(dateFromKey(key));
}

function renderCategoryDetail(periodLabel) {
  const detail = elements.categoryStats.querySelector("#categoryDetail");
  if (!detail) {
    return;
  }
  selectedCategoryDetailPeriod = periodLabel;

  const totals = getCategoryTotalsByPeriodLabel(periodLabel);
  if (!totals.length) {
    detail.innerHTML = "";
    return;
  }

  const max = Math.max(...totals.map((item) => item.ms));
  detail.innerHTML = `
    <div class="category-detail-head">
      <span>${escapeHtml(periodLabel)}分类明细</span>
      <span class="category-detail-actions">
        <button class="category-export-button" type="button" data-category-export="${escapeHtml(periodLabel)}">复制表格</button>
        <button class="category-export-button" type="button" data-category-csv="${escapeHtml(periodLabel)}">导出 CSV</button>
      </span>
    </div>
    <div class="category-list">
      ${totals
    .map((item) => {
      const value = `${Math.max(4, Math.round((item.ms / max) * 100))}%`;
      return `
        <div class="category-row">
          <span class="category-name"><span class="category-chip" style="${categoryStyle(item.name)}">${escapeHtml(item.name)}</span></span>
          <span class="category-bar"><span class="category-fill" style="--value: ${value}; ${categoryStyle(item.name)}"></span></span>
          <span class="category-time">${formatDuration(item.ms)}</span>
        </div>
      `;
    })
    .join("")}
    </div>
  `;
}

function getCategoryTotalsByPeriodLabel(label) {
  const ranges = getPeriodRanges();
  if (label === "日") {
    return getCategoryTotals(getToday());
  }
  if (label === "周") {
    return getCategoryTotalsForRange(...ranges.week);
  }
  return getCategoryTotalsForRange(...ranges.month);
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function polarToCartesian(cx, cy, r, angle) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(radians),
    y: cy + r * Math.sin(radians)
  };
}

function categoryStyle(category) {
  const [fg, bg] = getCategoryPalette(category);
  return `--cat: ${fg}; --cat-bg: ${bg};`;
}

function categoryColor(category) {
  return getCategoryPalette(category)[0];
}

function getCategoryPalette(category) {
  const categories = getCategories();
  const categoryName = category || "其他";
  let index = categories.indexOf(categoryName);
  if (index < 0) {
    index = [...categoryName].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  }

  const hue = (hexToHsl(getThemeColor()).h + CATEGORY_HUE_OFFSETS[index % CATEGORY_HUE_OFFSETS.length]) % 360;
  return [
    `hsl(${hue} 70% 52%)`,
    `hsl(${hue} 86% 96%)`
  ];
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(a, b, amount) {
  const first = hexToRgb(a);
  const second = hexToRgb(b);
  return rgbToHex({
    r: first.r * (1 - amount) + second.r * amount,
    g: first.g * (1 - amount) + second.g * amount,
    b: first.b * (1 - amount) + second.b * amount
  });
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
    hue *= 60;
  }

  return { h: Math.round((hue + 360) % 360) };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}

function render(options = {}) {
  const forceActiveSync = Boolean(options.forceActiveSync);
  const forceDailyTasksSync = Boolean(options.forceDailyTasksSync || forceActiveSync);
  applyTheme();
  const day = getToday();
  const active = day.active;
  const elapsed = getActiveElapsed(active);
  const totalMs = day.records.reduce((sum, record) => sum + record.durationMs, 0) + elapsed;
  const doneTasks = day.tasks.filter((task) => task.done).length;

  elements.datePicker.value = selectedDateKey;
  elements.liveClock.textContent = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date());
  const yesterdayKey = getRelativeDateKey(-1);
  const currentTodayKey = todayKey();
  const tomorrowKey = getRelativeDateKey(1);
  elements.prevDayButton.textContent = `昨天 ${formatNavDate(yesterdayKey)}`;
  elements.todayButton.textContent = `今天 ${formatNavDate(currentTodayKey)}`;
  elements.nextDayButton.textContent = `明天 ${formatNavDate(tomorrowKey)}`;
  elements.prevDayButton.classList.toggle("active-date", selectedDateKey === yesterdayKey);
  elements.todayButton.classList.toggle("active-date", selectedDateKey === currentTodayKey);
  elements.nextDayButton.classList.toggle("active-date", selectedDateKey === tomorrowKey);
  if (elements.versionLabel) {
    elements.versionLabel.textContent = `v${APP_VERSION}`;
  }
  elements.taskPanelTitle.textContent = getTaskPanelTitle();
  elements.taskInput.placeholder = getTaskInputPlaceholder();
  elements.currentTitle.textContent = active ? active.title : "还没有开始";
  elements.timerDisplay.textContent = formatClock(elapsed);
  elements.totalTime.textContent = totalMs ? formatDuration(totalMs) : "0 分钟";
  elements.doneCount.textContent = `${doneTasks}/${day.tasks.length}`;
  elements.entryCount.textContent = String(day.records.length);
  elements.startButton.textContent = active ? "切换" : "开始";
  elements.pauseButton.textContent = active?.status === "paused" ? "继续" : "暂停";
  elements.pauseButton.disabled = !active;
  elements.finishButton.disabled = !active;

  renderCategoryOptions();
  const activeElement = document.activeElement;
  const isDailyPanelBusy = elements.dailyTasksPanel.matches(":hover") || elements.dailyTasksPanel.contains(activeElement);
  const isTodoPoolBusy = elements.todoPoolList.matches(":hover") || elements.todoPoolList.contains(activeElement);
  const isTaskListBusy = elements.taskList.contains(activeElement);
  const isRecordListBusy = elements.recordList.matches(":hover") || elements.recordList.contains(activeElement);

  if (editingCategoryTarget?.kind !== "daily" && (forceDailyTasksSync || !isDailyPanelBusy)) {
    renderDailyTasksPanel();
  }
  if (!editingTodoDateId && editingCategoryTarget?.kind !== "todo" && (forceActiveSync || !isTodoPoolBusy)) {
    renderTodoPool();
  }
  if (!editingTaskId && editingCategoryTarget?.kind !== "task" && (forceActiveSync || !isTaskListBusy)) {
    renderTasks(day);
  }
  if ((forceActiveSync || !elements.categoryStats.matches(":hover")) && !editingCategoryTarget) {
    renderCategoryStats(day);
  }
  if (editingCategoryTarget?.kind !== "record" && (forceActiveSync || !isRecordListBusy)) {
    renderRecords(day);
  }
  publishTimerStatus(active, elapsed);
  document.body.classList.toggle("has-active-task", Boolean(active));
}

function publishTimerStatus(active, elapsed) {
  if (!window.focusWidget) {
    return;
  }

  const day = getToday();
  const status = {
    active: Boolean(active),
    taskId: active?.taskId || "",
    title: active?.title || "",
    elapsed: formatClock(elapsed),
    elapsedMs: elapsed,
    statusSentAt: Date.now(),
    paused: active?.status === "paused",
    themeColor: getThemeColor(),
    categories: getCategories(),
    tasks: getSwitchableTasks(day, active?.taskId || "")
  };
  const serialized = JSON.stringify(status);

  if (serialized === lastPublishedStatus) {
    return;
  }

  lastPublishedStatus = serialized;
  window.focusWidget.updateTimerStatus(status);
}

function getSwitchableTasks(day, activeTaskId) {
  const tasks = day.tasks
    .slice()
    .sort((a, b) => {
      if (a.id === activeTaskId) {
        return -1;
      }
      if (b.id === activeTaskId) {
        return 1;
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    })
    .map((task) => ({
      id: task.id,
      title: task.title,
      category: task.category || "其他"
    }));

  return tasks.slice(0, 8);
}

elements.timerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  startActivity(elements.activityInput.value, elements.activityCategory.value);
});

elements.pauseButton.addEventListener("click", togglePause);
elements.finishButton.addEventListener("click", finishActivity);

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addTask(elements.taskInput.value, elements.taskCategory.value);
});

elements.todoPoolForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addTodo(elements.todoTitle.value, elements.todoCategory.value, elements.todoDueDate.value);
});

elements.todoPoolList.addEventListener("click", (event) => {
  const checkId = event.target.dataset.todoCheck;
  if (checkId) {
    toggleTodo(checkId);
    return;
  }

  const startButton = event.target.closest("[data-todo-start]");
  const startId = startButton?.dataset.todoStart;
  if (startId) {
    event.preventDefault();
    event.stopPropagation();
    const todo = getTodos().find((item) => item.id === startId);
    if (todo) {
      if (startButton) {
        startButton.textContent = "进行中";
        startButton.disabled = true;
      }
      startActivity(todo.title, todo.category || "其他", null, startId);
      renderTodoPool();
    }
    return;
  }

  const dueId = event.target.dataset.todoDue;
  if (dueId) {
    editingTodoDateId = dueId;
    renderTodoPool();
    requestAnimationFrame(() => {
      const input = elements.todoPoolList.querySelector(`[data-todo-date-input="${CSS.escape(dueId)}"]`);
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
    return;
  }

  const dateSaveId = event.target.dataset.todoDateSave;
  if (dateSaveId) {
    updateTodoDueDate(dateSaveId);
    return;
  }

  const removeId = event.target.dataset.todoRemove;
  if (removeId) {
    removeTodo(removeId);
  }
});

elements.todoPoolList.addEventListener("keydown", (event) => {
  const input = event.target.closest("[data-todo-date-input]");
  if (!input) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    updateTodoDueDate(input.dataset.todoDateInput);
  }
  if (event.key === "Escape") {
    event.preventDefault();
    editingTodoDateId = null;
    renderTodoPool();
  }
});

elements.manualRecordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addManualRecord(elements.manualTitle.value, elements.manualCategory.value, elements.manualMinutes.value);
});

elements.dailyTemplateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addDailyTask();
});
elements.toggleDailyTasksButton.addEventListener("click", () => {
  isDailyTasksPanelOpen = !isDailyTasksPanelOpen;
  render();
});
elements.dailyTasksList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-daily-task-remove]");
  if (!removeButton) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const removeId = removeButton.dataset.dailyTaskRemove;
  const task = getDailyTasks().find((item) => item.id === removeId);
  const title = task?.title || "这个每日任务";
  if (!window.confirm(`确定删除“${title}”这个每日任务吗？今天和之后未记录的自动任务也会一起移除。`)) {
    return;
  }

  removeButton.closest(".daily-task-item")?.remove();
  removeDailyTask(removeId);
});
elements.themeColorInput.addEventListener("input", (event) => {
  setThemeColor(event.target.value);
});
elements.exportDataButton.addEventListener("click", exportDataBackup);
elements.importDataButton.addEventListener("click", () => elements.importDataInput.click());
elements.importDataInput.addEventListener("change", (event) => {
  importDataBackup(event.target.files?.[0]);
});
elements.copyReportButton.addEventListener("click", copyReport);

elements.prevDayButton.addEventListener("click", () => jumpToDate(getRelativeDateKey(-1)));
elements.todayButton.addEventListener("click", jumpToday);
elements.nextDayButton.addEventListener("click", () => jumpToDate(getRelativeDateKey(1)));
elements.datePicker.addEventListener("change", (event) => {
  if (event.target.value) {
    jumpToDate(event.target.value);
  }
});

document.addEventListener("click", (event) => {
  const renameCategoryName = event.target.dataset.categoryMenuRename;
  if (renameCategoryName) {
    closeCategoryActionMenu();
    promptRenameCategory(renameCategoryName);
    return;
  }

  const deleteCategoryName = event.target.dataset.categoryMenuDelete;
  if (deleteCategoryName) {
    closeCategoryActionMenu();
    promptDeleteCategory(deleteCategoryName);
    return;
  }

  if (!event.target.closest(".category-action-menu")) {
    closeCategoryActionMenu();
  }
  if (!event.target.closest(".inline-popover")) {
    closeInlinePopover();
  }

  const toggle = event.target.closest("[data-category-toggle]");
  if (toggle) {
    event.stopPropagation();
    const nextTarget = {
      kind: toggle.dataset.categoryKind,
      id: toggle.dataset.categoryId
    };
    const isSameTarget = editingCategoryTarget
      && editingCategoryTarget.kind === nextTarget.kind
      && editingCategoryTarget.id === nextTarget.id;
    editingCategoryTarget = isSameTarget ? null : nextTarget;
    document.querySelectorAll(".category-editor.open").forEach((editor) => {
      if (editor !== toggle.closest(".category-editor")) {
        editor.classList.remove("open");
      }
    });
    if (!isSameTarget) {
      toggle.closest(".category-editor")?.classList.add("open");
    }
    return;
  }

  if (!event.target.closest(".category-editor")) {
    closeEditingCategoryTarget();
  }

  const category = event.target.dataset.category;
  if (!category) {
    return;
  }

  const row = event.target.closest(".suggestion-row");
  if (row === elements.activityCategorySuggestions) {
    elements.activityCategory.value = category;
  } else if (row === elements.taskCategorySuggestions) {
    elements.taskCategory.value = category;
  } else if (row === elements.todoCategorySuggestions) {
    elements.todoCategory.value = category;
  } else if (row === elements.manualCategorySuggestions) {
    elements.manualCategory.value = category;
  }
});

elements.openFullButton.addEventListener("click", () => {
  if (window.focusWidget) {
    window.focusWidget.openMainWindow();
    return;
  }

  window.open("./index.html", "_blank");
});

elements.taskList.addEventListener("focusout", (event) => {
  const input = event.target.closest("[data-task-title-input]");
  if (!input) {
    return;
  }

  updateTaskTitle(input.dataset.taskTitleInput, input.value);
  editingTaskId = null;
});

elements.taskList.addEventListener("keydown", (event) => {
  const input = event.target.closest("[data-task-title-input]");
  if (!input) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    input.blur();
  }
  if (event.key === "Escape") {
    event.preventDefault();
    editingTaskId = null;
    render();
  }
});

elements.taskList.addEventListener("click", (event) => {
  const checkId = event.target.dataset.taskCheck;
  if (checkId) {
    event.preventDefault();
    event.stopPropagation();
    editingTaskId = null;
    toggleTask(checkId);
    return;
  }

  const removeId = event.target.dataset.taskRemove;
  if (removeId) {
    removeTask(removeId);
    return;
  }

  const editId = event.target.closest("[data-task-edit]")?.dataset.taskEdit;
  if (editId) {
    editingTaskId = editId;
    renderTasks(getToday());
    const input = elements.taskList.querySelector(`[data-task-title-input="${CSS.escape(editId)}"]`);
    if (input) {
      input.focus();
      const cursor = input.value.length;
      input.setSelectionRange(cursor, cursor);
    }
    return;
  }

  const startId = event.target.dataset.taskStart;
  if (startId) {
    if (getSelectedDateRelation() !== "today") {
      showToast("只能从今天的任务开始计时");
      return;
    }
    const task = getToday().tasks.find((item) => item.id === startId);
    if (task) {
      task.done = false;
      startActivity(task.title, task.category || "其他", task.id);
    }
    return;
  }

  const taskCategoryId = event.target.dataset.taskCategory;
  if (taskCategoryId) {
    changeTaskCategory(taskCategoryId, event.target.dataset.categoryValue);
    editingCategoryTarget = null;
  }
});

elements.recordList.addEventListener("click", (event) => {
  const titleEditButton = event.target.closest("[data-record-title-edit]");
  if (titleEditButton) {
    editingRecordGroupKey = titleEditButton.dataset.recordTitleEdit;
    renderRecords(getToday());
    requestAnimationFrame(() => {
      const input = elements.recordList.querySelector(`[data-record-title-input="${CSS.escape(editingRecordGroupKey)}"]`);
      if (input) {
        input.focus();
        const cursor = input.value.length;
        input.setSelectionRange(cursor, cursor);
      }
    });
    return;
  }

  const deleteId = event.target.dataset.recordDelete;
  if (deleteId) {
    deleteRecord(deleteId);
    return;
  }

  const editId = event.target.dataset.recordEdit;
  if (editId) {
    const input = elements.recordList.querySelector(`[data-record-start="${CSS.escape(editId)}"]`);
    if (input) {
      input.focus();
    } else {
      editRecordDuration(editId);
    }
    return;
  }

  const recordId = event.target.dataset.recordContinue;
  if (!recordId) {
    return;
  }

  const record = getToday().records.find((item) => item.id === recordId);
  if (!record) {
    return;
  }

  startActivity(record.title, record.category || "其他", record.taskId || null);
});

elements.recordList.addEventListener("focusout", (event) => {
  const input = event.target.closest("[data-record-title-input]");
  if (input) {
    updateRecordGroupTitle(input.dataset.recordTitleInput, input.value);
  }
});

elements.recordList.addEventListener("keydown", (event) => {
  const titleInput = event.target.closest("[data-record-title-input]");
  if (!titleInput) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    titleInput.blur();
  }
  if (event.key === "Escape") {
    event.preventDefault();
    editingRecordGroupKey = null;
    renderRecords(getToday());
  }
});

elements.recordList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-record-delete]");
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    deleteRecord(deleteButton.dataset.recordDelete);
    return;
  }

  const editButton = event.target.closest("[data-record-edit]");
  if (editButton) {
    event.preventDefault();
    event.stopPropagation();
    const input = editButton.closest(".record-segment")?.querySelector("[data-record-start]");
    if (input) {
      input.focus();
    } else {
      editRecordDuration(editButton.dataset.recordEdit);
    }
    return;
  }

  const timeSaveButton = event.target.closest("[data-record-time-save]");
  if (timeSaveButton) {
    event.preventDefault();
    event.stopPropagation();
    const card = timeSaveButton.closest(".record-hover-card");
    const start = card?.querySelector("[data-record-start]")?.value || "";
    const end = card?.querySelector("[data-record-end]")?.value || "";
    updateRecordTimeRange(timeSaveButton.dataset.recordTimeSave, start, end);
    return;
  }

  const noteButton = event.target.closest("[data-record-note]");
  if (noteButton) {
    event.preventDefault();
    event.stopPropagation();
    editRecordNote(noteButton.dataset.recordNote);
    return;
  }

  const noteSaveButton = event.target.closest("[data-record-note-save]");
  if (noteSaveButton) {
    event.preventDefault();
    event.stopPropagation();
    const input = noteSaveButton.closest(".record-hover-card")?.querySelector("[data-record-note-input]");
    if (input) {
      updateRecordNote(noteSaveButton.dataset.recordNoteSave, input.value);
      input.classList.toggle("is-empty", !input.value.trim());
      showToast(input.value.trim() ? "已保存这段感受" : "已清空这段感受");
    }
  }
}, true);

elements.recordList.addEventListener("input", (event) => {
  const input = event.target.closest("[data-record-note-input]");
  if (!input) {
    return;
  }

  input.classList.toggle("is-empty", !input.value.trim());
  updateRecordNote(input.dataset.recordNoteInput, input.value);
});

elements.recordList.addEventListener("focusout", (event) => {
  const input = event.target.closest("[data-record-note-input]");
  if (input) {
    updateRecordNote(input.dataset.recordNoteInput, input.value);
  }
});

document.addEventListener("click", (event) => {
  const renameButton = event.target.closest("[data-category-menu-rename]");
  if (renameButton) {
    event.preventDefault();
    event.stopPropagation();
    closeCategoryActionMenu();
    promptRenameCategory(renameButton.dataset.categoryMenuRename);
    return;
  }

  const deleteButton = event.target.closest("[data-category-menu-delete]");
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    closeCategoryActionMenu();
    promptDeleteCategory(deleteButton.dataset.categoryMenuDelete);
  }
}, true);

document.addEventListener("dragstart", (event) => {
  const chip = event.target.closest("[data-category-drag]");
  if (!chip) {
    return;
  }

  draggedCategory = chip.dataset.categoryDrag;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedCategory);
});

document.addEventListener("dragover", (event) => {
  const chip = event.target.closest("[data-category-drag]");
  if (!chip || !draggedCategory) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});

document.addEventListener("drop", (event) => {
  const chip = event.target.closest("[data-category-drag]");
  if (!chip || !draggedCategory) {
    return;
  }

  event.preventDefault();
  moveCategoryBefore(draggedCategory, chip.dataset.categoryDrag);
  draggedCategory = null;
});

document.addEventListener("dragend", () => {
  draggedCategory = null;
});

document.addEventListener("contextmenu", (event) => {
  const chip = event.target.closest("[data-category-drag], [data-category-action]");
  if (!chip) {
    closeCategoryActionMenu();
    return;
  }

  event.preventDefault();
  const category = chip.dataset.categoryDrag || chip.dataset.categoryAction;
  openCategoryActionMenu(category, event.clientX, event.clientY);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCategoryActionMenu();
    closeInlinePopover();
  }
});

function handleInlineCategoryChoice(event) {
  const taskCategoryButton = event.target.closest("[data-task-category]");
  if (taskCategoryButton) {
    event.preventDefault();
    event.stopPropagation();
    changeTaskCategory(taskCategoryButton.dataset.taskCategory, taskCategoryButton.dataset.categoryValue);
    editingCategoryTarget = null;
    return;
  }

  const todoCategoryButton = event.target.closest("[data-todo-category]");
  if (todoCategoryButton) {
    event.preventDefault();
    event.stopPropagation();
    changeTodoCategory(todoCategoryButton.dataset.todoCategory, todoCategoryButton.dataset.categoryValue);
    editingCategoryTarget = null;
    return;
  }

  const dailyCategoryButton = event.target.closest("[data-daily-category]");
  if (dailyCategoryButton) {
    event.preventDefault();
    event.stopPropagation();
    changeDailyTaskCategory(dailyCategoryButton.dataset.dailyCategory, dailyCategoryButton.dataset.categoryValue);
    editingCategoryTarget = null;
    return;
  }

  const recordCategoryButton = event.target.closest("[data-record-category]");
  if (recordCategoryButton) {
    event.preventDefault();
    event.stopPropagation();
    changeRecordGroupCategory(recordCategoryButton.dataset.recordCategory, recordCategoryButton.dataset.categoryValue);
    editingCategoryTarget = null;
  }
}

document.addEventListener("pointerdown", handleInlineCategoryChoice, true);

elements.recordList.addEventListener("click", (event) => {
  const groupKey = event.target.dataset.recordCategory;
  if (groupKey) {
    changeRecordGroupCategory(groupKey, event.target.dataset.categoryValue);
    editingCategoryTarget = null;
  }
});

elements.categoryStats.addEventListener("click", (event) => {
  const exportButton = event.target.closest("[data-category-export]");
  const csvButton = event.target.closest("[data-category-csv]");
  if (!exportButton && !csvButton) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  if (csvButton) {
    downloadCategoryDetailCsv(csvButton.dataset.categoryCsv);
    return;
  }

  copyCategoryDetailTable(exportButton.dataset.categoryExport);
});
elements.categoryStats.addEventListener("pointerover", (event) => {
  const segment = event.target.closest(".donut-segment, .category-bubble");
  if (segment) {
    updateCategoryInsight(segment);
  }
});

elements.categoryStats.addEventListener("pointerleave", () => {
  resetCategoryInsight();
});

elements.categoryStats.addEventListener("pointerup", (event) => {
  if (event.target.closest(".category-insight")) {
    return;
  }
  resetCategoryInsight();
});

elements.categoryStats.addEventListener("click", (event) => {
  const segment = event.target.closest(".donut-segment, .category-bubble");
  if (segment) {
    renderCategoryDetail(segment.dataset.period);
  }
});

if (window.focusWidget?.onStartTask) {
  window.focusWidget.onStartTask((taskId) => {
    const task = getToday().tasks.find((item) => item.id === taskId);
    if (task) {
      startActivity(task.title, task.category || "其他", task.id);
    }
  });
}

if (window.focusWidget?.onStartActivity) {
  window.focusWidget.onStartActivity((activity) => {
    startActivity(activity?.title || "", activity?.category || "其他");
  });
}

if (window.focusWidget?.onPauseActive) {
  window.focusWidget.onPauseActive(() => {
    togglePause();
  });
}

if (window.focusWidget?.onFinishActive) {
  window.focusWidget.onFinishActive(() => {
    finishActivity();
  });
}

if (window.focusWidget?.onSetActiveNote) {
  window.focusWidget.onSetActiveNote((note) => {
    elements.finishNote.value = note || "";
    showToast("已记下当前感受");
  });
}

tickTimer = setInterval(render, 1000);
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    reloadState();
  }
});
render();
