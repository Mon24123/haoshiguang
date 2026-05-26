const miniWidget = document.querySelector("#miniWidget");
const timerButton = document.querySelector("#timerButton");
const hideBubbleButton = document.querySelector("#hideBubbleButton");
const controlButton = document.querySelector("#controlButton");
const collapseButton = document.querySelector("#collapseButton");
const expandedPanel = document.querySelector("#expandedPanel");
const controlPanel = document.querySelector("#controlPanel");
const openFullFromBubble = document.querySelector("#openFullFromBubble");
const quitFromBubble = document.querySelector("#quitFromBubble");
const categoryDrawerList = document.querySelector("#categoryDrawerList");
const taskDrawerList = document.querySelector("#taskDrawerList");
const quickStartForm = document.querySelector("#quickStartForm");
const quickTaskInput = document.querySelector("#quickTaskInput");
const pauseFromBubble = document.querySelector("#pauseFromBubble");
const finishFromBubble = document.querySelector("#finishFromBubble");
const quickNoteForm = document.querySelector("#quickNoteForm");
const quickNoteInput = document.querySelector("#quickNoteInput");
const quickNoteStatus = document.querySelector("#quickNoteStatus");
const miniTitle = document.querySelector("#miniTitle");
const miniTime = document.querySelector("#miniTime");

let dragPoint = null;
let didDrag = false;
let controlsExpanded = false;
let tasksExpanded = false;
let bubbleDocked = false;
let selectedCategory = "全部";
let latestStatus = { tasks: [], categories: [] };
let localTimer = {
  active: false,
  paused: false,
  elapsedMs: 0,
  receivedAt: Date.now()
};

function openPanel() {
  if (didDrag) {
    return;
  }

  if (bubbleDocked) {
    setDocked(false);
    if (window.focusWidget?.setBubbleDocked) {
      window.focusWidget.setBubbleDocked(false);
    }
    return;
  }

  if (window.focusWidget) {
    window.focusWidget.toggleQuickWindow();
    return;
  }

  window.location.href = "./index.html";
}

function renderStatus(status) {
  latestStatus = status || { tasks: [], categories: [] };
  const active = Boolean(status?.active);
  localTimer = {
    active,
    paused: Boolean(status?.paused),
    elapsedMs: Number(status?.elapsedMs) || parseClock(status?.elapsed || "00:00:00"),
    receivedAt: Number(status?.statusSentAt) || Date.now()
  };

  applyTheme(status?.themeColor || "#7fcdb5");
  miniWidget.classList.toggle("active", active);
  miniWidget.classList.toggle("paused", Boolean(status?.paused));
  miniTitle.textContent = active ? status.title : "准备记录";
  miniTime.textContent = formatClock(getLocalElapsed());
  pauseFromBubble.disabled = !active;
  pauseFromBubble.textContent = status?.paused ? "继续" : "暂停";
  finishFromBubble.disabled = !active;
  renderCategories(status?.categories || [], status?.tasks || []);
  renderTasks(status?.tasks || [], status?.taskId || "");
}

function getLocalElapsed() {
  if (!localTimer.active || localTimer.paused) {
    return localTimer.elapsedMs;
  }

  return localTimer.elapsedMs + Math.max(0, Date.now() - localTimer.receivedAt);
}

function parseClock(value) {
  const parts = String(value).split(":").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return 0;
  }

  const [hours, minutes, seconds] = parts;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function applyTheme(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    return;
  }

  document.documentElement.style.setProperty("--accent", color);
  document.documentElement.style.setProperty("--accent-dark", mixHex(color, "#000000", 0.28));
}

function renderCategories(categories, tasks) {
  const mergedCategories = ["全部", ...categories];
  if (selectedCategory !== "全部" && !mergedCategories.includes(selectedCategory)) {
    selectedCategory = "全部";
  }

  categoryDrawerList.innerHTML = mergedCategories
    .map((category) => `
      <button class="drawer-category ${category === selectedCategory ? "selected" : ""}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>
    `)
    .join("");
}

function renderTasks(tasks, activeTaskId) {
  const filteredTasks = selectedCategory === "全部"
    ? tasks
    : tasks.filter((task) => (task.category || "其他") === selectedCategory);

  if (!filteredTasks.length) {
    taskDrawerList.innerHTML = `<p class="drawer-empty">还没有可切换的任务</p>`;
    return;
  }

  taskDrawerList.innerHTML = filteredTasks
    .slice(0, 5)
    .map((task) => `
      <button class="drawer-task ${task.id === activeTaskId ? "current" : ""}" type="button" data-task-id="${escapeHtml(task.id)}">
        <span>${escapeHtml(task.title)}</span>
        <small>${escapeHtml(task.category || "其他")}</small>
      </button>
    `)
    .join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
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

function setExpanded(nextExpanded) {
  tasksExpanded = Boolean(nextExpanded);
  if (tasksExpanded) {
    controlsExpanded = false;
  }
  syncExpandedState();
}

function setControlsExpanded(nextExpanded) {
  controlsExpanded = Boolean(nextExpanded);
  if (controlsExpanded) {
    tasksExpanded = false;
  }
  syncExpandedState();
}

function syncExpandedState() {
  if (bubbleDocked) {
    controlsExpanded = false;
    tasksExpanded = false;
  }
  const expanded = controlsExpanded || tasksExpanded;
  miniWidget.classList.toggle("expanded", expanded);
  miniWidget.classList.toggle("controls-open", controlsExpanded);
  miniWidget.classList.toggle("tasks-open", tasksExpanded);
  collapseButton.setAttribute("aria-label", tasksExpanded ? "收起任务切换" : "展开任务切换");
  controlButton.setAttribute("aria-label", controlsExpanded ? "收起计时控制" : "展开计时控制");
  if (window.focusWidget?.setBubbleExpanded) {
    window.focusWidget.setBubbleExpanded(expanded);
  }
}

function setDocked(nextDocked) {
  bubbleDocked = Boolean(nextDocked);
  if (bubbleDocked) {
    controlsExpanded = false;
    tasksExpanded = false;
  }
  miniWidget.classList.toggle("docked", bubbleDocked);
  syncExpandedState();
}

miniWidget.addEventListener("pointerdown", (event) => {
  if (bubbleDocked) {
    dragPoint = null;
    didDrag = false;
    return;
  }

  const blockedButton = event.target.closest("button") && !event.target.closest("#timerButton");
  if (blockedButton || event.target.closest("input, form, .expanded-panel")) {
    return;
  }

  dragPoint = {
    x: event.screenX,
    y: event.screenY
  };
  didDrag = false;
  miniWidget.setPointerCapture(event.pointerId);
});

miniWidget.addEventListener("pointermove", (event) => {
  if (!dragPoint || !window.focusWidget) {
    return;
  }

  const delta = {
    x: event.screenX - dragPoint.x,
    y: event.screenY - dragPoint.y
  };

  if (Math.abs(delta.x) + Math.abs(delta.y) < 2) {
    return;
  }

  didDrag = true;
  window.focusWidget.moveBubbleBy(delta);
  dragPoint = {
    x: event.screenX,
    y: event.screenY
  };
});

miniWidget.addEventListener("pointerup", () => {
  dragPoint = null;
  setTimeout(() => {
    didDrag = false;
  }, 0);
});

miniWidget.addEventListener("pointercancel", () => {
  dragPoint = null;
  didDrag = false;
});

timerButton.addEventListener("click", openPanel);

hideBubbleButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setDocked(true);
  if (window.focusWidget?.setBubbleDocked) {
    window.focusWidget.setBubbleDocked(true);
  } else if (window.focusWidget?.hideBubble) {
    window.focusWidget.hideBubble();
  }
});

collapseButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setExpanded(!tasksExpanded);
});

collapseButton.addEventListener("dblclick", (event) => {
  event.stopPropagation();
  setExpanded(false);
  if (window.focusWidget) {
    window.focusWidget.hidePanels();
  }
});

controlButton.addEventListener("click", (event) => {
  event.stopPropagation();
  setControlsExpanded(!controlsExpanded);
});

expandedPanel.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
});

openFullFromBubble.addEventListener("click", (event) => {
  event.stopPropagation();
  if (window.focusWidget) {
    window.focusWidget.openMainWindow();
  } else {
    window.location.href = "./index.html";
  }
});

quitFromBubble.addEventListener("click", (event) => {
  event.stopPropagation();
  const shouldQuit = window.confirm("确定要退出 Good Time 吗？退出后需要重新打开应用才能继续记录。");
  if (shouldQuit && window.focusWidget?.quitApp) {
    window.focusWidget.quitApp();
  }
});

taskDrawerList.addEventListener("click", (event) => {
  const taskButton = event.target.closest(".drawer-task");
  if (!taskButton) {
    return;
  }

  event.stopPropagation();
  if (window.focusWidget?.startTask) {
    window.focusWidget.startTask(taskButton.dataset.taskId);
  }
});

categoryDrawerList.addEventListener("click", (event) => {
  const categoryButton = event.target.closest(".drawer-category");
  if (!categoryButton) {
    return;
  }

  event.stopPropagation();
  selectedCategory = categoryButton.dataset.category;
  renderCategories(latestStatus.categories || [], latestStatus.tasks || []);
  renderTasks(latestStatus.tasks || [], latestStatus.taskId || "");
});

quickStartForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = quickTaskInput.value.trim();
  if (!title) {
    quickTaskInput.focus();
    return;
  }

  const category = selectedCategory === "全部" ? "其他" : selectedCategory;
  if (window.focusWidget?.startActivity) {
    window.focusWidget.startActivity({ title, category });
  }
  quickTaskInput.value = "";
});

pauseFromBubble.addEventListener("click", (event) => {
  event.stopPropagation();
  if (window.focusWidget?.pauseActive) {
    window.focusWidget.pauseActive();
  }
});

finishFromBubble.addEventListener("click", (event) => {
  event.stopPropagation();
  if (window.focusWidget?.finishActive) {
    window.focusWidget.finishActive();
  }
});

quickNoteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (window.focusWidget?.setActiveNote) {
    window.focusWidget.setActiveNote(quickNoteInput.value);
    quickNoteStatus.textContent = "已记下";
    setTimeout(() => {
      quickNoteStatus.textContent = "";
    }, 1300);
  }
});

if (window.focusWidget) {
  window.focusWidget.onTimerStatus(renderStatus);
  if (window.focusWidget.onBubbleDocked) {
    window.focusWidget.onBubbleDocked(setDocked);
  }
}

setInterval(() => {
  if (localTimer.active) {
    miniTime.textContent = formatClock(getLocalElapsed());
  }
}, 1000);

renderStatus({ active: false, title: "", elapsed: "00:00:00", paused: false });
