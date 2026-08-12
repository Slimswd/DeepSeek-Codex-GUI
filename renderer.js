const projectButton = document.querySelector(".project-button");
const projectName = document.querySelector(".project-name");
const modelPill = document.querySelector(".model-pill");
const sidebarModel = document.querySelector(".sidebar-bottom");
const sidebarOrbStatus = document.querySelector(".sidebar-orb-status");
const chat = document.querySelector(".chat");
// 页面同时存在主聊天输入框和侧边任务追问输入框，必须明确绑定主输入框。
const textarea = document.querySelector(".composer textarea");
const sendButton = document.querySelector(".send");
const composer = document.querySelector(".composer");
const topbar = document.querySelector(".topbar");
const sideChatPanel = document.querySelector(".side-chat-panel");
const sideChatMessages = document.querySelector(".side-chat-messages");
const sideChatForm = document.querySelector(".side-chat-form");
const sideChatInput = document.querySelector(".side-chat-input");
const sideChatToggle = document.querySelector(".side-chat-toggle");
const checkUpdateButton = document.querySelector(".check-update-button");
const topbarActions = topbar?.querySelector(".topbar-actions");
const networkStatusPill = document.createElement("div");
networkStatusPill.className = "network-status-pill";
networkStatusPill.textContent = "网络检测中";
networkStatusPill.title = "当前网络连接状态";
if (topbarActions) topbarActions.prepend(networkStatusPill);
const updateProgressToast = document.querySelector(".update-progress-toast");
const updateProgressBar = document.querySelector(".update-progress-bar");
const updateDialog = document.querySelector(".update-dialog-overlay");
const updateDialogVersion = document.querySelector(".update-dialog-version");
const updateDialogPrimary = document.querySelector(".update-dialog-primary");
const updateDialogLater = document.querySelector(".update-dialog-later");
const updateProgressPercent = updateProgressToast?.querySelector("strong");
const sideTaskOverview = document.querySelector(".side-task-overview");
const sideTaskStatus = document.querySelector(".side-task-status");
const sideTaskSteps = document.querySelector(".side-task-steps");
const sideTaskFiles = document.querySelector(".side-task-files");
const sideTaskApprovals = document.querySelector(".side-task-approvals");
const sideTaskUsage = document.querySelector(".side-task-usage");
const workspaceButton = document.querySelector(".workspace-button");
const workspacePanel = document.querySelector(".workspace-panel");
const workspaceClose = document.querySelector(".workspace-close");
const workspaceSearch = document.querySelector(".workspace-search");
const workspaceList = document.querySelector(".workspace-list");
let permissionMode = "ask";

function renderWorkspace(data) {
  if (!workspaceList) return;
  if (!data?.projectPath) { workspaceList.innerHTML = '<div class="side-chat-empty">请先选择一个项目。</div>'; return; }
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const recentPaths = new Set((data.recent || []).map(item => item.path));
  const recent = entries.filter(item => recentPaths.has(item.path));
  const renderItems = items => items.map(item => `<button class="workspace-item" data-workspace-path="${escapeHtml(item.path)}"><i class="ph ${item.type === "directory" ? "ph-folder" : "ph-file"}"></i><span>${escapeHtml(item.path)}</span>${item.type === "file" ? `<small>${formatWorkspaceSize(item.size)}</small>` : ""}</button>`).join("");
  workspaceList.innerHTML = `${recent.length ? `<div class="workspace-section">最近修改</div>${renderItems(recent)}` : ""}<div class="workspace-section">项目文件</div>${renderItems(entries) || '<div class="side-chat-empty">没有找到项目文件。</div>'}`;
  workspaceList.querySelectorAll("[data-workspace-path]").forEach(button => button.addEventListener("click", async () => {
    const item = entries.find(entry => entry.path === button.dataset.workspacePath);
    if (item?.type === "file") await window.deepseekCodex.openProjectFile(item.path);
  }));
}
function formatWorkspaceSize(size) { if (!Number.isFinite(size)) return ""; return size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : size > 1024 ? `${Math.round(size / 1024)} KB` : `${size} B`; }
async function refreshWorkspace(query = "") { try { renderWorkspace(query ? await window.deepseekCodex.searchProjectWorkspace(query) : await window.deepseekCodex.getProjectWorkspace()); } catch (error) { if (workspaceList) workspaceList.innerHTML = `<div class="side-chat-empty">${escapeHtml(error.message)}</div>`; } }
workspaceButton?.addEventListener("click", async () => { workspacePanel.hidden = false; await refreshWorkspace(); workspaceSearch?.focus(); });
workspaceClose?.addEventListener("click", () => { workspacePanel.hidden = true; });
let workspaceSearchTimer;
workspaceSearch?.addEventListener("input", () => { clearTimeout(workspaceSearchTimer); workspaceSearchTimer = setTimeout(() => refreshWorkspace(workspaceSearch.value), 180); });
const permissionButton = document.createElement("button");
permissionButton.type = "button";
permissionButton.className = "permission-button";
permissionButton.innerHTML = '<i class="ph ph-shield-check"></i><span>询问</span>';
permissionButton.title = "选择电脑访问权限";

const permissionMenu = document.createElement("div");
permissionMenu.className = "permission-menu";
permissionMenu.innerHTML = `
  <button type="button" data-permission="ask"><strong>每次询问</strong><span>执行命令或修改文件前请求许可</span></button>
  <button type="button" data-permission="workspace"><strong>允许工作区修改</strong><span>允许访问当前项目，不主动询问</span></button>
  <button type="button" data-permission="full"><strong>完全访问</strong><span>允许访问电脑上的全部文件和命令</span></button>`;

function updatePermissionButton() {
  const labels = { ask: "询问", workspace: "工作区", full: "完全访问" };
  permissionButton.querySelector("span").textContent = labels[permissionMode] || labels.ask;
  permissionMenu.querySelectorAll("button").forEach(button => button.classList.toggle("active", button.dataset.permission === permissionMode));
}

permissionMenu.querySelectorAll("button").forEach(button => button.addEventListener("click", async () => {
  permissionMode = button.dataset.permission;
  updatePermissionButton();
  permissionMenu.classList.remove("open");
  await window.deepseekCodex.setPermissionSettings(permissionMode);
}));
permissionButton.addEventListener("click", event => { event.stopPropagation(); permissionMenu.classList.toggle("open"); });
document.addEventListener("click", () => permissionMenu.classList.remove("open"));
document.body.appendChild(permissionMenu);
window.deepseekCodex.getPermissionSettings().then(settings => { permissionMode = settings?.mode || "ask"; updatePermissionButton(); }).catch(() => updatePermissionButton());

const COMPOSER_TEXTAREA_HEIGHT_KEY = "deepseek-codex-composer-textarea-height";
const COMPOSER_TEXTAREA_MIN_HEIGHT = 54;
const COMPOSER_TEXTAREA_DEFAULT_HEIGHT = 82;
const COMPOSER_TEXTAREA_MAX_HEIGHT = 260;

function updateSidebarOrbStatus(status) {
  if (!sidebarOrbStatus) return;
  const normalized = status === "running" || status === "starting" || status === "waitingApproval" || status === "stopping"
    ? "running"
    : status === "completed" || status === "interrupted"
      ? "completed"
      : status === "error"
        ? "error"
        : "idle";
  sidebarOrbStatus.className = `sidebar-orb-status ${normalized}`;
  sidebarOrbStatus.dataset.status = normalized;
  sidebarOrbStatus.title = normalized === "running" ? "任务执行中" : normalized === "completed" ? "任务已完成" : normalized === "error" ? "任务执行失败" : "等待任务";
}

function addSideChatNote(text, role = "assistant") {
  if (!sideChatMessages || !text) return;
  const empty = sideChatMessages.querySelector(".side-chat-empty");
  if (empty) empty.remove();
  const note = document.createElement("div");
  note.className = `side-chat-note ${role === "user" ? "user" : ""}`;
  note.textContent = text;
  sideChatMessages.appendChild(note);
  sideChatMessages.scrollTop = sideChatMessages.scrollHeight;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

async function updateTopbarThreadTitle(fallbackProjectPath = "") {
  if (!projectName) return;
  if (!selectedThreadId) {
    projectName.textContent = fallbackProjectPath ? shortPath(fallbackProjectPath) : "DeepSeek Codex";
    return;
  }
  try {
    const history = await window.deepseekCodex.getThreadHistory();
    const record = history.find(item => item.threadId === selectedThreadId);
    projectName.textContent = record?.title || "新任务";
    projectName.title = record?.title || "新任务";
  } catch {
    projectName.textContent = "当前任务";
  }
}

function renderSideTaskPanel(task) {
  if (!sideTaskOverview) return;
  if (!task) {
    sideTaskOverview.innerHTML = '<div class="side-chat-empty">选择或新建任务后，这里会显示当前任务上下文。</div>';
    [sideTaskStatus, sideTaskSteps, sideTaskFiles, sideTaskApprovals, sideTaskUsage].forEach(node => { if (node) node.innerHTML = ""; });
    return;
  }
  const statusLabels = { idle: "空闲", starting: "启动中", running: "执行中", waitingApproval: "等待审批", queued: "排队中", stopping: "停止中", completed: "已完成", interrupted: "已停止", error: "错误" };
  const status = statusLabels[task.status] || task.status || "未知";
  sideTaskOverview.innerHTML = `<div class="side-task-kicker">CURRENT THREAD</div><strong>${escapeHtml(task.threadId || "当前任务")}</strong><div class="side-task-meta">${escapeHtml(task.projectPath || "未选择项目")}</div>`;
  sideTaskStatus.innerHTML = `<div class="side-section-title">状态</div><div class="side-status-row"><span class="side-status-dot" data-status="${escapeHtml(task.status || "idle")}"></span><strong>${status}</strong><span class="side-task-meta">${escapeHtml(task.model || "默认模型")}</span></div>`;
  const events = Array.isArray(task.events) ? task.events : [];
  const steps = events.filter(item => item?.kind === "plan" || item?.kind === "command" || item?.kind === "file").slice(-6);
  sideTaskSteps.innerHTML = steps.length ? `<div class="side-section-title">最近执行</div>${steps.map(item => `<div class="side-step"><i class="ph ph-check-circle"></i><span>${escapeHtml(item.title || item.command || item.path || item.kind || "执行步骤")}</span></div>`).join("")}` : "";
  const files = (task.diffs || []).slice(-6);
  sideTaskFiles.innerHTML = files.length ? `<div class="side-section-title">文件变更</div>${files.map(item => `<div class="side-step"><i class="ph ph-file-code"></i><span>${escapeHtml(item.path || item.filePath || "文件修改")}</span></div>`).join("")}` : "";
  const approvals = (task.approvals || []).filter(item => item.status === "pending");
  sideTaskApprovals.innerHTML = approvals.length ? `<div class="side-section-title">需要审批</div>${approvals.map(item => `<div class="side-approval"><strong>${escapeHtml(item.title || "待审批操作")}</strong><span>${escapeHtml(item.command || item.reason || "Agent 等待你的允许")}</span></div>`).join("")}` : "";
  const usage = task.tokenUsage;
  sideTaskUsage.innerHTML = usage ? `<div class="side-section-title">上下文使用</div><div class="side-usage"><strong>${escapeHtml(String(usage.contextWindow || usage.totalTokens || usage.inputTokens || "--"))}</strong><span>Token / Context</span></div>` : "";
}

if (sideChatPanel && sideChatForm && sideChatInput) {
sideChatToggle?.addEventListener("click", () => {
    sideChatPanel.classList.add("open");
    sideChatInput.focus();
  });
  sideChatPanel.querySelector(".side-chat-close")?.addEventListener("click", () => {
    sideChatPanel.classList.remove("open");
  });
  sideChatForm.addEventListener("submit", async event => {
    event.preventDefault();
    const text = sideChatInput.value.trim();
    if (!text) return;
    addSideChatNote(text, "user");
    sideChatInput.value = "";
    sideChatInput.disabled = true;
    try {
      await sendMessage(text, { source: "side-chat" });
      addSideChatNote("已发送到当前 Thread，Agent 的完整回复会显示在主聊天区。", "assistant");
    } catch (error) {
      addSideChatNote(`发送失败：${error.message}`, "assistant");
    } finally {
      sideChatInput.disabled = false;
      sideChatInput.focus();
    }
  });
}

function getComposerTextareaMaxHeight() {
  const viewportHeight = window.innerHeight || 900;
  const compactMax = Math.max(
    COMPOSER_TEXTAREA_MIN_HEIGHT,
    Math.round(viewportHeight * 0.28)
  );

  return Math.min(COMPOSER_TEXTAREA_MAX_HEIGHT, compactMax);
}

function clampComposerTextareaHeight(height) {
  const numericHeight = Number(height);
  const fallback = COMPOSER_TEXTAREA_DEFAULT_HEIGHT;
  const value = Number.isFinite(numericHeight) ? numericHeight : fallback;

  return Math.max(
    COMPOSER_TEXTAREA_MIN_HEIGHT,
    Math.min(getComposerTextareaMaxHeight(), Math.round(value))
  );
}

function applySavedComposerTextareaHeight() {
  if (!textarea) return;

  let savedHeight = COMPOSER_TEXTAREA_DEFAULT_HEIGHT;
  try {
    savedHeight = Number(
      window.localStorage.getItem(COMPOSER_TEXTAREA_HEIGHT_KEY)
    );
  } catch {
    savedHeight = COMPOSER_TEXTAREA_DEFAULT_HEIGHT;
  }

  textarea.style.height = `${clampComposerTextareaHeight(savedHeight)}px`;
}

function saveComposerTextareaHeight() {
  if (!textarea) return;

  const height = clampComposerTextareaHeight(textarea.getBoundingClientRect().height);
  if (Math.abs(textarea.getBoundingClientRect().height - height) > 1) {
    textarea.style.height = `${height}px`;
  }

  try {
    window.localStorage.setItem(
      COMPOSER_TEXTAREA_HEIGHT_KEY,
      String(height)
    );
  } catch {
    // Local storage may be unavailable in restricted or test contexts.
  }
}

applySavedComposerTextareaHeight();

if (textarea && typeof ResizeObserver !== "undefined") {
  const composerTextareaObserver = new ResizeObserver(() => {
    saveComposerTextareaHeight();
  });
  composerTextareaObserver.observe(textarea);
}

window.addEventListener("resize", () => {
  if (!textarea) return;

  const nextHeight = clampComposerTextareaHeight(
    textarea.getBoundingClientRect().height
  );
  if (Math.abs(textarea.getBoundingClientRect().height - nextHeight) > 1) {
    textarea.style.height = `${nextHeight}px`;
  }
  saveComposerTextareaHeight();
});

checkUpdateButton?.addEventListener("click", async () => {
  checkUpdateButton.disabled = true;
  try {
    await window.deepseekCodex.checkForUpdates();
  } finally {
    setTimeout(() => {
      checkUpdateButton.disabled = false;
    }, 1500);
  }
});

function closeUpdateDialog() {
  if (updateDialog) updateDialog.hidden = true;
}

window.deepseekCodex.onUpdateAvailable?.((data) => {
  if (!updateDialog) return;
  updateDialog.dataset.state = "available";
  updateDialog.querySelector(".update-dialog-icon").innerHTML = '<i class="ph ph-arrow-circle-down"></i>';
  updateDialog.querySelector(".update-dialog-kicker").textContent = "DEEPSEEK CODEX · UPDATE";
  updateDialog.querySelector("#update-dialog-title").textContent = "发现新版本";
  updateDialogVersion.innerHTML = `<span class="update-version-old">v${data?.currentVersion || "--"}</span><i class="ph ph-arrow-right update-version-arrow"></i><span class="update-version-new">v${data?.version || "--"}</span>`;
  updateDialog.querySelector(".update-dialog-copy").textContent = "点击下载后将返回主界面，完成后应用会自动重启并安装更新。";
  updateDialogPrimary.disabled = false;
  updateDialogPrimary.innerHTML = '<i class="ph ph-download-simple"></i> 下载更新';
  updateDialog.hidden = false;
});

updateDialogLater?.addEventListener("click", closeUpdateDialog);
updateDialogPrimary?.addEventListener("click", async () => {
  if (!updateDialogPrimary) return;
  updateDialogPrimary.disabled = true;
  updateDialogPrimary.innerHTML = '<i class="ph ph-spinner-gap"></i> 正在准备下载';
  closeUpdateDialog();
  if (updateProgressToast) {
    updateProgressToast.hidden = false;
    updateProgressToast.querySelector("span").textContent = "正在准备下载";
  }
  if (updateProgressBar) updateProgressBar.style.width = "0%";
  if (updateProgressPercent) updateProgressPercent.textContent = "0%";
  const result = await window.deepseekCodex.downloadUpdate?.();
  if (!result?.ok) {
    updateDialogPrimary.disabled = false;
    updateDialogPrimary.innerHTML = '<i class="ph ph-download-simple"></i> 重新下载';
    if (updateProgressToast) {
      updateProgressToast.querySelector("span").textContent = "更新下载失败，请稍后重试";
      setTimeout(() => { updateProgressToast.hidden = true; }, 5000);
    }
    return;
  }
});

window.deepseekCodex.onUpdateDownloadError?.(() => {
  if (!updateProgressToast) return;
  updateProgressToast.hidden = false;
  updateProgressToast.querySelector("span").textContent = "更新下载失败，请稍后重试";
  if (updateProgressPercent) updateProgressPercent.textContent = "!";
  setTimeout(() => { updateProgressToast.hidden = true; }, 5000);
});

window.deepseekCodex.onUpdateDownloadProgress?.((data) => {
  if (!updateProgressToast) return;
  updateProgressToast.hidden = false;
  const percent = Number(data?.percent || 0);
  if (updateProgressBar) updateProgressBar.style.width = `${percent}%`;
  if (updateProgressPercent) updateProgressPercent.textContent = `${percent}%`;
  if (data?.completed) {
    updateProgressToast.querySelector("span").textContent = "更新下载完成，正在自动重启";
  }
});

const turnStatusPill =
  document.createElement("div");

turnStatusPill.className =
  "turn-status-pill";

turnStatusPill.setAttribute(
  "aria-live",
  "polite"
);

turnStatusPill.textContent = "空闲";

if (topbar && modelPill) {
  const statusGroup =
    document.createElement("div");

  statusGroup.className =
    "topbar-status-group";

  topbar.insertBefore(
    statusGroup,
    modelPill
  );

  statusGroup.appendChild(modelPill);
  statusGroup.appendChild(turnStatusPill);
}

const turnStatusStyle =
  document.createElement("style");

turnStatusStyle.textContent = `
.network-status-pill { border: 1px solid #344452; border-radius: 999px; background: #151c25; color: #c7d2de; font-size: 12px; padding: 7px 11px; white-space: nowrap; }
.network-status-pill.checking { border-color: #8a6b3f !important; color: #e2bd7e !important; }
.network-status-pill.normal { border-color: #2f9b65 !important; color: #8ed6a5 !important; }
.network-status-pill.error { border-color: #b86145 !important; color: #f0b0a0 !important; }
.topbar-status-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.turn-status-pill {
  min-width: 82px;
  padding: 7px 11px;
  border: 1px solid #2c3744;
  border-radius: 999px;
  color: #aebdce;
  background: #151c25;
  font-size: 12px;
  text-align: center;
  transition: color .16s ease, border-color .16s ease, background .16s ease;
}

.turn-status-pill[data-state="thinking"] {
  color: #9fc4ff;
  border-color: #35598d;
  background: #152238;
}

.turn-status-pill[data-state="running"] {
  color: #f2cf8c;
  border-color: #765c2c;
  background: #282116;
}

.turn-status-pill[data-state="approval"] {
  color: #f2b8ff;
  border-color: #754b86;
  background: #281b2e;
}

.turn-status-pill[data-state="completed"] {
  color: #9de2b7;
  border-color: #315c43;
  background: #15241b;
}

.turn-status-pill[data-state="stopped"] {
  color: #f0c092;
  border-color: #765234;
  background: #281d16;
}

.turn-status-pill[data-state="error"],
.turn-status-pill[data-state="offline"] {
  color: #ffaaa8;
  border-color: #713d45;
  background: #2a191d;
}

.turn-status-pill[data-state="reconnecting"] {
  color: #f2cf8c;
  border-color: #765c2c;
  background: #282116;
}

.warning-dot {
  background: #f2cf8c !important;
}
`;

document.head.appendChild(turnStatusStyle);

function setTurnStatus(state, label) {
  turnStatusPill.dataset.state = state;
  turnStatusPill.textContent =
    label ||
    ({
      idle: "空闲",
      thinking: "Thinking",
      running: "Running",
      approval: "等待审批",
      completed: "已完成",
      stopped: "已停止",
      error: "错误",
      offline: "连接断开",
      reconnecting: "自动重连中"
    }[state] || state);
  turnStatusPill.title = turnStatusPill.textContent;
}

const fallbackModelCatalog = [
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash"
  }
];

let currentModelSettings = {
  model: "deepseek-v4-flash",
  reasoning: "high"
};

let modelCatalog = fallbackModelCatalog.slice();

function modelDisplayLabel(model) {
  if (model === "deepseek-v4-flash") {
    return "V4 Flash";
  }

  return String(model || "DeepSeek").replace(/[<>]/g, "");
}

function reasoningDisplayLabel(reasoning) {
  return String(reasoning || "high").toUpperCase();
}

const modelSettingsPanel =
  document.createElement("div");

modelSettingsPanel.className =
  "model-settings-panel";

modelSettingsPanel.innerHTML = `
  <div class="model-settings-title">模型与推理强度</div>
  <label class="model-settings-label">
    <span>应用范围</span>
    <select class="model-settings-scope">
      <option value="project">当前项目</option>
      <option value="global">全局默认</option>
      <option value="inherit">跟随全局默认</option>
    </select>
  </label>
  <label class="model-settings-label">
    <span>模型</span>
    <select class="model-settings-model"></select>
  </label>
  <label class="model-settings-label">
    <span>推理强度</span>
    <select class="model-settings-reasoning">
      <option value="low">Low · 快速</option>
      <option value="medium">Medium · 平衡</option>
      <option value="high">High · 深度</option>
    </select>
  </label>
  <div class="model-settings-note">当前项目配置优先于全局默认；设置将在下一条消息生效</div>
  <div class="model-settings-actions">
    <button type="button" class="model-settings-cancel">取消</button>
    <button type="button" class="model-settings-save">保存</button>
  </div>
`;

const modelSettingsModel =
  modelSettingsPanel.querySelector(
    ".model-settings-model"
  );

const modelSettingsReasoning =
  modelSettingsPanel.querySelector(
    ".model-settings-reasoning"
  );

const modelSettingsScope =
  modelSettingsPanel.querySelector(
    ".model-settings-scope"
  );

function fillModelCatalog(models = []) {
  const merged = [];
  const seen = new Set();

  for (const model of [
    ...models,
    ...modelCatalog,
    {
      id: currentModelSettings.model,
      label: currentModelSettings.model
    }
  ]) {
    if (!model?.id || seen.has(model.id)) {
      continue;
    }

    seen.add(model.id);
    merged.push(model);
  }

  modelCatalog = merged;
  modelSettingsModel.innerHTML = "";

  modelCatalog.forEach(model => {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label || model.id;
    modelSettingsModel.appendChild(option);
  });

  modelSettingsModel.value = currentModelSettings.model;
}

function openModelSettings() {
  window.deepseekCodex
    .getModelSettings()
    .then(settings => {
      currentModelSettings = {
        model: settings.model,
        reasoning: settings.reasoning,
        scope: settings.scope,
        hasProjectOverride: settings.hasProjectOverride
      };

      fillModelCatalog(settings.models || []);
      const projectOption =
        modelSettingsScope.querySelector(
          'option[value="project"]'
        );

      projectOption.disabled = !settings.projectPath;
      projectOption.textContent = settings.projectPath
        ? "当前项目"
        : "当前项目（请先选择项目）";
      modelSettingsScope.value =
        settings.hasProjectOverride
          ? "project"
          : "global";
      modelSettingsReasoning.value =
        currentModelSettings.reasoning;
      modelSettingsPanel.style.display = "block";

      window.deepseekCodex
        .listModels()
        .then(fillModelCatalog)
        .catch(() => {});
    })
    .catch(error => {
      alert("读取模型设置失败：" + error.message);
    });
}

modelSettingsPanel
  .querySelector(".model-settings-cancel")
  .addEventListener("click", () => {
    modelSettingsPanel.style.display = "none";
  });

modelSettingsPanel
  .querySelector(".model-settings-save")
  .addEventListener("click", async () => {
    if (busy) {
      alert("当前任务执行中，请完成或停止后再切换设置");
      return;
    }

    try {
      const result =
        await window.deepseekCodex
          .setModelSettings({
            model: modelSettingsModel.value,
            reasoning: modelSettingsReasoning.value,
            scope: modelSettingsScope.value
          });

      currentModelSettings = {
        model: result.model,
        reasoning: result.reasoning,
        scope: result.savedScope,
        hasProjectOverride: result.hasProjectOverride
      };

      modelSettingsPanel.style.display = "none";
      setTurnStatus(
        "idle",
        result.savedScope === "project"
          ? "项目设置已保存"
          : result.savedScope === "inherit"
            ? "已跟随全局默认"
            : "全局设置已保存"
      );
    } catch (error) {
      alert("保存模型设置失败：" + error.message);
    }
  });

document.body.appendChild(modelSettingsPanel);

modelPill.classList.add("model-settings-trigger");
modelPill.title = "模型与推理强度设置";
modelPill.addEventListener("click", event => {
  event.stopPropagation();
  const isVisible =
    modelSettingsPanel.style.display === "block";

  modelSettingsPanel.style.display =
    isVisible ? "none" : "block";

  if (!isVisible) {
    openModelSettings();
  }
});

document.addEventListener("click", event => {
  if (
    !modelSettingsPanel.contains(event.target) &&
    !modelPill.contains(event.target)
  ) {
    modelSettingsPanel.style.display = "none";
  }
});

fillModelCatalog();

const modelSettingsStyle =
  document.createElement("style");

modelSettingsStyle.textContent = `
.model-settings-trigger {
  cursor: pointer;
}

.model-settings-trigger:hover {
  border-color: #6f87a4;
  background: #1b2633;
}

.model-settings-panel {
  display: none;
  position: fixed;
  top: 72px;
  right: 24px;
  z-index: 100000;
  width: 290px;
  padding: 15px;
  background: #151d27;
  border: 1px solid #344456;
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0,0,0,.42);
}

.model-settings-title {
  margin-bottom: 13px;
  color: #e4edf7;
  font-size: 14px;
  font-weight: 700;
}

.model-settings-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 10px 0;
  color: #8fa0b4;
  font-size: 12px;
}

.model-settings-label select {
  width: 100%;
  padding: 8px 9px;
  border: 1px solid #344456;
  border-radius: 8px;
  outline: none;
  background: #0f161e;
  color: #dce6f1;
  font: inherit;
}

.model-settings-note {
  margin-top: 10px;
  color: #718298;
  font-size: 11px;
}

.model-settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

.model-settings-actions button {
  padding: 7px 10px;
  border-radius: 7px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.model-settings-cancel {
  border: 1px solid #3b4b5d;
  background: transparent;
  color: #9eadbf;
}

.model-settings-save {
  border: 1px solid #6d8fc0;
  background: #345681;
  color: white;
}
`;

document.head.appendChild(modelSettingsStyle);

const diagnosticsButton =
  document.createElement("button");

diagnosticsButton.type = "button";
diagnosticsButton.className =
  "diagnostics-trigger";
diagnosticsButton.textContent = "诊断";
diagnosticsButton.title =
  "查看最近错误和运行环境";

const apiKeyButton = document.createElement("button");
apiKeyButton.type = "button";
apiKeyButton.className = "api-key-trigger";
apiKeyButton.textContent = "更换 API";
apiKeyButton.title = "更换 DeepSeek API Key";

const apiKeyDialog = document.createElement("div");
apiKeyDialog.className = "api-key-dialog";
apiKeyDialog.hidden = true;
apiKeyDialog.innerHTML = `
  <section class="api-key-dialog-card" role="dialog" aria-modal="true" aria-labelledby="api-key-dialog-title">
    <div class="api-key-dialog-header">
      <div>
        <div class="api-key-dialog-eyebrow">CONNECTION · API</div>
        <h2 id="api-key-dialog-title">更换 DeepSeek API</h2>
      </div>
      <button type="button" class="api-key-dialog-close" aria-label="关闭">×</button>
    </div>
    <p class="api-key-dialog-description">仅保存到本机的 Codex 配置，不会显示完整密钥，也不会上传 API Key。</p>
    <div class="api-key-current-card">
      <div class="api-key-current-heading"><span>当前连接</span><span class="api-key-current-state">本机配置</span></div>
      <div class="api-key-current-name">未配置</div>
      <code class="api-key-current-value">未配置</code>
    </div>
    <div class="api-key-dialog-section-title">更换连接</div>
    <label class="api-key-dialog-label">
      名称
      <input class="api-key-dialog-name" type="text" maxlength="40" autocomplete="off" spellcheck="false" placeholder="例如：家里台式电脑 Codex" />
    </label>
    <label class="api-key-dialog-label">
      DeepSeek API Key
      <input class="api-key-dialog-input" type="password" autocomplete="off" spellcheck="false" placeholder="sk-..." />
    </label>
    <div class="api-key-dialog-status" role="status" aria-live="polite">保存后会自动重新连接。</div>
    <div class="api-key-dialog-actions">
      <button type="button" class="api-key-dialog-cancel">取消</button>
      <button type="button" class="api-key-dialog-save">保存并重连</button>
    </div>
  </section>
`;

const apiKeyInput = apiKeyDialog.querySelector(".api-key-dialog-input");
const apiKeyNameInput = apiKeyDialog.querySelector(".api-key-dialog-name");
const apiKeyStatus = apiKeyDialog.querySelector(".api-key-dialog-status");
const apiKeySaveButton = apiKeyDialog.querySelector(".api-key-dialog-save");
const apiKeyCurrentName = apiKeyDialog.querySelector(".api-key-current-name");
const apiKeyCurrentValue = apiKeyDialog.querySelector(".api-key-current-value");
const apiKeyCurrentState = apiKeyDialog.querySelector(".api-key-current-state");

function renderApiKeyProfile(profile) {
  if (!apiKeyCurrentName || !apiKeyCurrentValue) return;
  const configured = Boolean(profile?.configured);
  apiKeyCurrentName.textContent = configured ? (profile.name || "未命名 API") : "未配置";
  apiKeyCurrentValue.textContent = configured ? (profile.maskedKey || "已配置") : "未配置";
  if (apiKeyCurrentState) {
    apiKeyCurrentState.textContent = configured ? "已配置" : "未配置";
    apiKeyCurrentState.dataset.configured = String(configured);
  }
  apiKeyCurrentValue.title = configured ? "仅显示脱敏信息，完整 Key 不会显示在界面" : "尚未配置 DeepSeek API Key";
}

async function refreshApiKeyProfile() {
  try {
    const profile = await window.deepseekCodex.getDeepSeekApiProfile?.();
    renderApiKeyProfile(profile);
    if (profile?.configured && apiKeyNameInput && !apiKeyNameInput.value) {
      apiKeyNameInput.value = profile.name === "未命名 API" ? "" : profile.name;
    }
  } catch {
    renderApiKeyProfile({ configured: false });
  }
}

function closeApiKeyDialog() {
  apiKeyDialog.hidden = true;
  apiKeyInput.value = "";
  apiKeyNameInput.value = "";
  apiKeyStatus.textContent = "保存后会自动重新连接。";
  apiKeyStatus.classList.remove("is-error", "is-success");
  apiKeySaveButton.disabled = false;
  apiKeySaveButton.textContent = "保存并重连";
}

function openApiKeyDialog() {
  apiKeyDialog.hidden = false;
  apiKeyInput.value = "";
  apiKeyNameInput.value = "";
  apiKeyStatus.textContent = "保存后会自动重新连接。";
  apiKeyStatus.classList.remove("is-error", "is-success");
  apiKeySaveButton.disabled = false;
  apiKeySaveButton.textContent = "保存并重连";
  void refreshApiKeyProfile();
  requestAnimationFrame(() => apiKeyInput.focus());
}

apiKeyButton.addEventListener("click", event => {
  event.stopPropagation();
  openApiKeyDialog();
});

apiKeyDialog.querySelector(".api-key-dialog-close").addEventListener("click", closeApiKeyDialog);
apiKeyDialog.querySelector(".api-key-dialog-cancel").addEventListener("click", closeApiKeyDialog);
apiKeyDialog.addEventListener("click", event => {
  if (event.target === apiKeyDialog) closeApiKeyDialog();
});
apiKeyInput.addEventListener("keydown", event => {
  if (event.key === "Enter") apiKeySaveButton.click();
  if (event.key === "Escape") closeApiKeyDialog();
});
apiKeySaveButton.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  const name = apiKeyNameInput.value.trim();
  if (!key) {
    apiKeyStatus.textContent = "请先粘贴 API Key。";
    apiKeyStatus.classList.add("is-error");
    apiKeyInput.focus();
    return;
  }

  apiKeySaveButton.disabled = true;
  apiKeySaveButton.textContent = "正在保存…";
  apiKeyStatus.textContent = "正在保存并重新连接…";
  apiKeyStatus.classList.remove("is-error", "is-success");
  try {
    const result = await window.deepseekCodex.configureDeepSeekApi({ apiKey: key, name });
    renderApiKeyProfile(result?.profile);
    apiKeyInput.value = "";
    apiKeyNameInput.value = "";
    apiKeyStatus.textContent = "API Key 已保存，正在重新连接。";
    apiKeyStatus.classList.add("is-success");
    window.setTimeout(closeApiKeyDialog, 900);
  } catch (error) {
    apiKeyStatus.textContent = error?.message || "保存失败，请检查 API Key。";
    apiKeyStatus.classList.add("is-error");
    apiKeySaveButton.disabled = false;
    apiKeySaveButton.textContent = "保存并重连";
  }
});

if (topbar?.querySelector(".topbar-actions")) {
  topbar.querySelector(".topbar-actions").appendChild(apiKeyButton);
  topbar.querySelector(".topbar-actions").appendChild(diagnosticsButton);
}

const diagnosticsPanel =
  document.createElement("div");

diagnosticsPanel.className =
  "diagnostics-panel";

diagnosticsPanel.innerHTML = `
  <div class="diagnostics-header">
    <div class="diagnostics-title">错误日志与诊断</div>
    <button type="button" class="diagnostics-close">×</button>
  </div>
  <pre class="diagnostics-summary"></pre>
  <div class="diagnostics-errors"></div>
  <div class="diagnostics-actions">
    <button type="button" class="diagnostics-refresh">刷新</button>
    <button type="button" class="diagnostics-copy">复制诊断</button>
    <button type="button" class="diagnostics-clear">清空日志</button>
  </div>
`;

const diagnosticsSummary =
  diagnosticsPanel.querySelector(
    ".diagnostics-summary"
  );

const diagnosticsErrors =
  diagnosticsPanel.querySelector(
    ".diagnostics-errors"
  );

let latestDiagnostics = null;

function diagnosticsSummaryText(snapshot) {
  return [
    `状态：${snapshot.status || "未知"}`,
    `模型：${modelDisplayLabel(snapshot.model)} · ${reasoningDisplayLabel(snapshot.reasoning)}`,
    `项目：${snapshot.projectPath || "未选择"}`,
    `平台：${snapshot.platform || "未知"}`,
    `Electron：${snapshot.electron || "未知"} · Node：${snapshot.node || "未知"}`,
    `Codex：${snapshot.codexExecutable || "未知"}`,
    `Thread：${snapshot.hasThread ? "活动" : "无"} · Turn：${snapshot.hasTurn ? "活动" : "无"}`
  ].join("\n");
}

function renderDiagnostics(snapshot) {
  latestDiagnostics = snapshot || {
    status: "unknown",
    errors: []
  };

  diagnosticsSummary.textContent =
    diagnosticsSummaryText(latestDiagnostics);
  diagnosticsErrors.innerHTML = "";

  const errors = Array.isArray(latestDiagnostics.errors)
    ? latestDiagnostics.errors.slice(-30).reverse()
    : [];

  if (!errors.length) {
    const empty = document.createElement("div");
    empty.className = "diagnostics-empty";
    empty.textContent = "暂无记录的错误";
    diagnosticsErrors.appendChild(empty);
    return;
  }

  errors.forEach(item => {
    const entry = document.createElement("div");
    entry.className = "diagnostics-entry";

    const header = document.createElement("div");
    header.className = "diagnostics-entry-header";
    header.textContent = `${new Date(item.timestamp).toLocaleString("zh-CN")} · ${item.scope}`;

    const message = document.createElement("div");
    message.className = "diagnostics-entry-message";
    message.textContent = item.message || "未知错误";

    entry.appendChild(header);
    entry.appendChild(message);

    if (item.details && Object.keys(item.details).length) {
      const details = document.createElement("div");
      details.className = "diagnostics-entry-details";
      details.textContent = JSON.stringify(item.details);
      entry.appendChild(details);
    }

    diagnosticsErrors.appendChild(entry);
  });
}

async function refreshDiagnostics() {
  try {
    renderDiagnostics(
      await window.deepseekCodex.getDiagnostics()
    );
  } catch (error) {
    diagnosticsSummary.textContent =
      "读取诊断信息失败：" + error.message;
    diagnosticsErrors.innerHTML = "";
  }
}

async function copyDiagnostics() {
  if (!latestDiagnostics) {
    await refreshDiagnostics();
  }

  const snapshot = latestDiagnostics || {};
  const errorText = (snapshot.errors || [])
    .map(item =>
      `${item.timestamp} [${item.scope}] ${item.message}`
    )
    .join("\n");
  const text = `${diagnosticsSummaryText(snapshot)}\n\n错误记录：\n${errorText || "暂无"}`;

  try {
    await navigator.clipboard.writeText(text);
    setTurnStatus("idle", "诊断已复制");
  } catch (error) {
    alert("复制诊断信息失败：" + error.message);
  }
}

diagnosticsButton.addEventListener("click", event => {
  event.stopPropagation();
  diagnosticsPanel.style.display = "block";
  refreshDiagnostics();
});

diagnosticsPanel
  .querySelector(".diagnostics-close")
  .addEventListener("click", () => {
    diagnosticsPanel.style.display = "none";
  });

diagnosticsPanel
  .querySelector(".diagnostics-refresh")
  .addEventListener("click", refreshDiagnostics);

diagnosticsPanel
  .querySelector(".diagnostics-copy")
  .addEventListener("click", copyDiagnostics);

diagnosticsPanel
  .querySelector(".diagnostics-clear")
  .addEventListener("click", async () => {
    if (!confirm("确定清空最近错误日志吗？")) return;

    await window.deepseekCodex.clearDiagnostics();
    await refreshDiagnostics();
  });

document.body.appendChild(diagnosticsPanel);
document.body.appendChild(apiKeyDialog);

document.addEventListener("click", event => {
  if (
    !diagnosticsPanel.contains(event.target) &&
    !diagnosticsButton.contains(event.target)
  ) {
    diagnosticsPanel.style.display = "none";
  }
});

const diagnosticsStyle =
  document.createElement("style");

diagnosticsStyle.textContent = `
.diagnostics-trigger {
  border: 1px solid #2c3744;
  border-radius: 999px;
  padding: 7px 10px;
  background: #151c25;
  color: #aebdce;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.diagnostics-trigger:hover {
  border-color: #6f87a4;
  background: #1b2633;
  color: #e4edf7;
}

.api-key-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 7px 11px;
  border: 1px solid #2c3744;
  border-radius: 999px;
  background: #151c25;
  color: #aebdce;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.api-key-trigger:hover {
  border-color: #6f87a4;
  background: #1b2633;
  color: #e4edf7;
}

.api-key-dialog {
  position: fixed;
  inset: 0;
  z-index: 100001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(3, 8, 14, .62);
  backdrop-filter: blur(12px);
}

.api-key-dialog[hidden] {
  display: none;
}

.api-key-dialog-card {
  width: min(460px, calc(100vw - 40px));
  padding: 22px;
  border: 1px solid #3d4d60;
  border-radius: 16px;
  background: #101923;
  box-shadow: 0 24px 70px rgba(0, 0, 0, .48);
}

.api-key-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.api-key-dialog-eyebrow {
  margin-bottom: 6px;
  color: #d27b2c;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .14em;
}

.api-key-dialog-header h2 {
  margin: 0;
  color: #e9f0f7;
  font-size: 19px;
}

.api-key-dialog-close {
  width: 30px;
  height: 30px;
  border: 1px solid #344454;
  border-radius: 8px;
  background: transparent;
  color: #9eadbf;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}

.api-key-dialog-close:hover {
  border-color: #6d8fc0;
  color: #fff;
}

.api-key-dialog-description {
  margin: 16px 0;
  color: #9eadbf;
  font-size: 12px;
  line-height: 1.7;
}

.api-key-current-card {
  margin: 0 0 17px;
  padding: 12px 13px;
  border: 1px solid #2f4052;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(26, 39, 53, .9), rgba(12, 20, 29, .92));
}

.api-key-current-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #93a6ba;
  font-size: 11px;
}

.api-key-current-state {
  color: #8ed6a5;
  font-size: 10px;
}

.api-key-current-state[data-configured="false"] {
  color: #93a6ba;
}

.api-key-current-name {
  margin-top: 8px;
  color: #e8f0f7;
  font-size: 13px;
  font-weight: 650;
}

.api-key-current-value {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: #d0a067;
  font-family: Consolas, "Cascadia Mono", monospace;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-key-dialog-section-title {
  margin: 0 0 9px;
  color: #d6e1eb;
  font-size: 12px;
  font-weight: 650;
}

.api-key-dialog-label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  color: #c9d6e4;
  font-size: 12px;
}

.api-key-dialog-input {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border: 1px solid #3b4d61;
  border-radius: 9px;
  outline: none;
  background: #0b121a;
  color: #e6eef6;
  font: inherit;
  font-size: 13px;
}

.api-key-dialog-name {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border: 1px solid #3b4d61;
  border-radius: 9px;
  outline: none;
  background: #0b121a;
  color: #e6eef6;
  font: inherit;
  font-size: 13px;
}

.api-key-dialog-name:focus {
  border-color: #d27b2c;
  box-shadow: 0 0 0 3px rgba(210, 123, 44, .14);
}

.api-key-dialog-input:focus {
  border-color: #d27b2c;
  box-shadow: 0 0 0 3px rgba(210, 123, 44, .14);
}

.api-key-dialog-status {
  min-height: 18px;
  margin-top: 9px;
  color: #8191a5;
  font-size: 11px;
}

.api-key-dialog-status.is-error { color: #f0a0a0; }
.api-key-dialog-status.is-success { color: #8ed6a5; }

.api-key-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 14px;
}

.api-key-dialog-actions button {
  min-height: 34px;
  padding: 7px 12px;
  border: 1px solid #3b4b5d;
  border-radius: 8px;
  background: transparent;
  color: #b9c7d6;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.api-key-dialog-actions .api-key-dialog-save {
  border-color: #d27b2c;
  background: #c66d23;
  color: #fff;
}

.api-key-dialog-actions button:hover {
  border-color: #e19a58;
}

.api-key-dialog-actions button:disabled {
  cursor: wait;
  opacity: .62;
}

.diagnostics-panel {
  display: none;
  position: fixed;
  top: 72px;
  right: 24px;
  z-index: 100000;
  width: min(520px, calc(100vw - 32px));
  padding: 15px;
  background: #151d27;
  border: 1px solid #344456;
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0,0,0,.42);
}

.diagnostics-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.diagnostics-title {
  color: #e4edf7;
  font-size: 14px;
  font-weight: 700;
}

.diagnostics-close {
  border: 0;
  background: transparent;
  color: #9eadbf;
  font-size: 20px;
  cursor: pointer;
}

.diagnostics-summary {
  max-height: 150px;
  margin: 0 0 10px;
  padding: 10px;
  overflow: auto;
  border: 1px solid #2b3948;
  border-radius: 8px;
  background: #0f161e;
  color: #aebdce;
  font: 11px/1.6 Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.diagnostics-errors {
  max-height: 220px;
  overflow: auto;
}

.diagnostics-empty {
  padding: 16px 8px;
  color: #8191a5;
  font-size: 12px;
  text-align: center;
}

.diagnostics-entry {
  margin-bottom: 8px;
  padding: 9px;
  border: 1px solid #47343b;
  border-radius: 8px;
  background: #241a1f;
}

.diagnostics-entry-header,
.diagnostics-entry-details {
  color: #a78f98;
  font-size: 10px;
}

.diagnostics-entry-message {
  margin-top: 4px;
  color: #f0c6c7;
  font-size: 12px;
  word-break: break-word;
}

.diagnostics-entry-details {
  margin-top: 5px;
  word-break: break-word;
}

.diagnostics-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.diagnostics-actions button {
  padding: 7px 9px;
  border: 1px solid #3b4b5d;
  border-radius: 7px;
  background: transparent;
  color: #b9c7d6;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}

.diagnostics-actions button:hover {
  border-color: #6d8fc0;
  background: #203149;
}
`;

document.head.appendChild(diagnosticsStyle);

let currentTokenUsage = null;

const tokenUsagePill =
  document.createElement("button");

tokenUsagePill.type = "button";
tokenUsagePill.className =
  "token-usage-trigger";
tokenUsagePill.textContent = "上下文 --";
tokenUsagePill.title =
  "查看 Context / Token 使用情况";

if (topbarActions) {
  topbarActions.insertBefore(
    tokenUsagePill,
    diagnosticsButton
  );
}

const tokenUsagePanel =
  document.createElement("div");

tokenUsagePanel.className =
  "token-usage-panel";

tokenUsagePanel.innerHTML = `
  <div class="token-usage-title">Context / Token 使用情况</div>
  <div class="token-usage-summary"></div>
  <div class="token-usage-details"></div>
  <div class="token-usage-note">仅显示 app-server 返回的真实数据，不做估算。</div>
`;

const tokenUsageSummary =
  tokenUsagePanel.querySelector(
    ".token-usage-summary"
  );

const tokenUsageDetails =
  tokenUsagePanel.querySelector(
    ".token-usage-details"
  );

function formatTokenCount(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("zh-CN")
    : "--";
}

function renderTokenUsage(tokenUsage) {
  currentTokenUsage = tokenUsage || null;

  const last = currentTokenUsage?.last || {};
  const total = currentTokenUsage?.total || {};
  const contextWindow = Number(
    currentTokenUsage?.modelContextWindow
  );
  const inputTokens = Number(last.inputTokens);

  if (
    Number.isFinite(contextWindow) &&
    contextWindow > 0 &&
    Number.isFinite(inputTokens)
  ) {
    const percent = Math.min(
      100,
      Math.max(0, (inputTokens / contextWindow) * 100)
    );

    tokenUsagePill.textContent =
      `上下文 ${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
    tokenUsagePill.title =
      `本轮输入 ${formatTokenCount(inputTokens)} / 上下文窗口 ${formatTokenCount(contextWindow)}`;
    tokenUsageSummary.textContent =
      `本轮上下文：${formatTokenCount(inputTokens)} / ${formatTokenCount(contextWindow)}（${percent.toFixed(1)}%）`;
  } else {
    tokenUsagePill.textContent = "上下文 --";
    tokenUsagePill.title =
      "等待 app-server 返回 Token 使用数据";
    tokenUsageSummary.textContent =
      "等待当前 Thread 返回 Context / Token 数据";
  }

  tokenUsageDetails.innerHTML = "";

  const rows = [
    ["本轮输入", formatTokenCount(last.inputTokens)],
    ["本轮缓存输入", formatTokenCount(last.cachedInputTokens)],
    ["本轮输出", formatTokenCount(last.outputTokens)],
    ["本轮推理输出", formatTokenCount(last.reasoningOutputTokens)],
    ["Thread 累计", formatTokenCount(total.totalTokens)],
    ["模型上下文窗口", formatTokenCount(contextWindow)]
  ];

  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "token-usage-row";

    const name = document.createElement("span");
    name.textContent = label;

    const amount = document.createElement("strong");
    amount.textContent = value;

    row.appendChild(name);
    row.appendChild(amount);
    tokenUsageDetails.appendChild(row);
  });
}

tokenUsagePill.addEventListener("click", event => {
  event.stopPropagation();
  tokenUsagePanel.style.display =
    tokenUsagePanel.style.display === "block"
      ? "none"
      : "block";
});

document.body.appendChild(tokenUsagePanel);

document.addEventListener("click", event => {
  if (
    !tokenUsagePanel.contains(event.target) &&
    !tokenUsagePill.contains(event.target)
  ) {
    tokenUsagePanel.style.display = "none";
  }
});

const tokenUsageStyle =
  document.createElement("style");

tokenUsageStyle.textContent = `
.token-usage-trigger {
  border: 1px solid #2c3744;
  border-radius: 999px;
  padding: 7px 10px;
  background: #151c25;
  color: #aebdce;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.token-usage-trigger:hover {
  border-color: #6f87a4;
  background: #1b2633;
  color: #e4edf7;
}

.token-usage-panel {
  display: none;
  position: fixed;
  top: 72px;
  right: 170px;
  z-index: 100000;
  width: min(330px, calc(100vw - 32px));
  padding: 15px;
  background: #151d27;
  border: 1px solid #344456;
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0,0,0,.42);
}

.token-usage-title {
  margin-bottom: 12px;
  color: #e4edf7;
  font-size: 14px;
  font-weight: 700;
}

.token-usage-summary {
  margin-bottom: 10px;
  padding: 9px;
  border: 1px solid #2b3948;
  border-radius: 8px;
  background: #0f161e;
  color: #bcd0e3;
  font-size: 12px;
  line-height: 1.5;
}

.token-usage-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 2px;
  border-bottom: 1px solid #26323f;
  color: #8fa0b4;
  font-size: 11px;
}

.token-usage-row strong {
  color: #dce6f1;
  font-weight: 600;
}

.token-usage-note {
  margin-top: 11px;
  color: #718298;
  font-size: 10px;
}
`;

document.head.appendChild(tokenUsageStyle);

const gitReviewCenter =
  window.DeepSeekGitReview?.create({
    toolbarParent:
      topbarActions || modelPill?.parentElement || null,
    beforeElement: diagnosticsButton || null
  }) || null;

let currentTheme = "dark";
let themeOptions = [
  { id: "dark", label: "深色", group: "基础主题", description: "沉稳专注的默认工作界面" },
  { id: "light", label: "浅色", group: "基础主题", description: "清爽明亮的日间工作界面" },
  { id: "ocean", label: "海洋蓝", group: "基础主题", description: "冷静通透的深海蓝调" },
  { id: "purple", label: "紫夜", group: "基础主题", description: "柔和神秘的紫色夜幕" },
  {
    id: "goku", label: "悟空", group: "七龙珠角色主题", character: "孙悟空",
    roman: "SON GOKU", tagline: "龟仙流 · 永不止步", signature: "热血觉醒",
    art: "assets/dragonball-premium/goku.jpg", hero: "assets/dragonball-hero/goku.png", rank: "01 / 12", artPosition: "center center"
  },
  {
    id: "krillin", label: "克林", group: "七龙珠角色主题", character: "克林",
    roman: "KRILLIN", tagline: "地球战士 · 坚韧与机敏", signature: "坚定向前",
    art: "assets/dragonball-premium/krillin.jpg", hero: "assets/dragonball-hero/krillin.png", rank: "02 / 12", artPosition: "center center"
  },
  {
    id: "roshi", label: "龟仙人", group: "七龙珠角色主题", character: "龟仙人",
    roman: "MASTER ROSHI", tagline: "武道宗师 · 松弛而强大", signature: "极意武道",
    art: "assets/dragonball-premium/roshi.jpg", hero: "assets/dragonball-hero/roshi.png", rank: "03 / 12", artPosition: "center center"
  },
  {
    id: "taopaipai", label: "桃白白", group: "七龙珠角色主题", character: "桃白白",
    roman: "TAO PAIPAI", tagline: "冷峻杀手 · 精准果断", signature: "一击制胜",
    art: "assets/dragonball-premium/taopaipai.jpg", hero: "assets/dragonball-hero/taopaipai.png", rank: "04 / 12", artPosition: "center center"
  },
  {
    id: "cell", label: "沙鲁", group: "七龙珠角色主题", character: "沙鲁",
    roman: "PERFECT CELL", tagline: "完美形态 · 秩序压迫", signature: "完美进化",
    art: "assets/dragonball-premium/cell.jpg", hero: "assets/dragonball-hero/cell.png", rank: "05 / 12", artPosition: "center center"
  },
  {
    id: "launch", label: "兰琪", group: "七龙珠角色主题", character: "兰琪",
    roman: "LAUNCH", tagline: "双面性格 · 明亮爆发", signature: "瞬间切换",
    art: "assets/dragonball-premium/launch.jpg", hero: "assets/dragonball-hero/launch.png", rank: "06 / 12", artPosition: "center center"
  },
  {
    id: "chichi", label: "琪琪", group: "七龙珠角色主题", character: "琪琪",
    roman: "CHI-CHI", tagline: "东方气韵 · 坚定守护", signature: "刚柔并济",
    art: "assets/dragonball-premium/chichi.jpg", hero: "assets/dragonball-hero/chichi.png", rank: "07 / 12", artPosition: "center center"
  },
  {
    id: "vegeta", label: "贝吉塔", group: "七龙珠角色主题", character: "贝吉塔",
    roman: "VEGETA", tagline: "赛亚王子 · 自尊与锋芒", signature: "王者意志",
    art: "assets/dragonball-premium/vegeta.jpg", hero: "assets/dragonball-hero/vegeta.png", rank: "08 / 12", artPosition: "center center"
  },
  {
    id: "android18", label: "人造人 18 号", group: "七龙珠角色主题", character: "人造人 18 号",
    roman: "ANDROID NO.18", tagline: "冷静锋利 · 极简力量", signature: "冰冷锋芒",
    art: "assets/dragonball-premium/android18.jpg", hero: "assets/dragonball-hero/android18.png", rank: "09 / 12", artPosition: "center center"
  },
  {
    id: "bulma", label: "布尔玛", group: "七龙珠角色主题", character: "布尔玛",
    roman: "BULMA", tagline: "天才发明 · 未来浪漫", signature: "灵感驱动",
    art: "assets/dragonball-premium/bulma.jpg", hero: "assets/dragonball-hero/bulma.png", rank: "10 / 12", artPosition: "center center"
  },
  {
    id: "buu", label: "魔人布欧", group: "七龙珠角色主题", character: "魔人布欧",
    roman: "MAJIN BUU", tagline: "魔性柔光 · 不受定义", signature: "自在魔力",
    art: "assets/dragonball-premium/buu.jpg", hero: "assets/dragonball-hero/buu.png", rank: "11 / 12", artPosition: "center center"
  },
  {
    id: "kingkai", label: "界王", group: "七龙珠角色主题", character: "界王",
    roman: "KING KAI", tagline: "宇宙幽默 · 从容洞察", signature: "界王智慧",
    art: "assets/dragonball-premium/kingkai.jpg", hero: "assets/dragonball-hero/kingkai.png", rank: "12 / 12", artPosition: "center center"
  }
];

const themeButton =
  document.createElement("button");

themeButton.type = "button";
themeButton.className = "theme-trigger";
themeButton.textContent = "主题";
themeButton.title = "切换界面主题皮肤";

if (topbar?.querySelector(".topbar-actions")) {
  topbar.querySelector(".topbar-actions").insertBefore(
    themeButton,
    diagnosticsButton
  );
}

const themePanel =
  document.createElement("div");

themePanel.className = "theme-panel";
themePanel.innerHTML = `
  <div class="theme-header">
    <div>
      <div class="theme-eyebrow">APPEARANCE · PREMIUM COLLECTION</div>
      <div class="theme-title">界面主题</div>
      <div class="theme-subtitle">16 套完整皮肤，切换后自动保存</div>
    </div>
    <button type="button" class="theme-close" aria-label="关闭主题面板"><i class="ph ph-x"></i></button>
  </div>
  <div class="theme-active-preview">
    <img class="theme-active-preview-art" alt="">
    <div class="theme-active-preview-copy">
      <span class="theme-active-preview-kicker">CURRENT THEME</span>
      <strong class="theme-active-preview-title">深色</strong>
      <span class="theme-active-preview-subtitle">沉稳专注的默认工作界面</span>
    </div>
    <span class="theme-active-preview-rank">BASE</span>
  </div>
  <div class="theme-options"></div>
`;

const themeOptionsContainer =
  themePanel.querySelector(".theme-options");

const themePreviewArt =
  themePanel.querySelector(".theme-active-preview-art");

const themePreviewTitle =
  themePanel.querySelector(".theme-active-preview-title");

const themePreviewSubtitle =
  themePanel.querySelector(".theme-active-preview-subtitle");

const themePreviewRank =
  themePanel.querySelector(".theme-active-preview-rank");

const themeHost = document.querySelector(".main");
const themeStage = document.createElement("div");

themeStage.className = "theme-character-stage";
themeStage.setAttribute("aria-hidden", "true");
themeStage.innerHTML = `
  <div class="theme-character-aura"></div>
  <div class="theme-character-portrait">
    <img class="theme-character-art" alt="">
  </div>
  <div class="theme-character-watermark">
    <span class="theme-character-rank"></span>
    <strong class="theme-character-roman"></strong>
    <small class="theme-character-tagline"></small>
  </div>
`;

if (themeHost) {
  themeHost.insertBefore(themeStage, themeHost.firstChild);
}

const themeStageArt =
  themeStage.querySelector(".theme-character-art");

const themeStageRank =
  themeStage.querySelector(".theme-character-rank");

const themeStageRoman =
  themeStage.querySelector(".theme-character-roman");

const themeStageTagline =
  themeStage.querySelector(".theme-character-tagline");

const themeDock = document.createElement("section");
themeDock.className = "theme-dock";
themeDock.hidden = true;
themeDock.setAttribute("aria-label", "角色主题快速选择");
themeDock.innerHTML = `
  <div class="theme-dock-heading">
    <i class="ph ph-caret-right"></i>
    <span>主题选择</span>
  </div>
  <div class="theme-dock-options"></div>
`;

const composerWrap = document.querySelector(".composer-wrap");
const themeDockOptions =
  themeDock.querySelector(".theme-dock-options");

function updateComposerLayoutMode() {
  if (!composerWrap) return;

  const height = composerWrap.getBoundingClientRect().height;
  document.documentElement.classList.toggle("composer-tall", height > 340);
}

updateComposerLayoutMode();

if (composerWrap && typeof ResizeObserver !== "undefined") {
  const composerLayoutObserver = new ResizeObserver(() => {
    updateComposerLayoutMode();
  });
  composerLayoutObserver.observe(composerWrap);
}

if (composerWrap) {
  composerWrap.appendChild(themeDock);
}

function updateThemeDockState() {
  const hasWelcome = Boolean(document.querySelector(".welcome"));

  themeDock.hidden = !hasWelcome;
  document.documentElement.classList.toggle(
    "welcome-mode",
    hasWelcome
  );

  themeDock
    .querySelectorAll(".theme-dock-option")
    .forEach(option => {
      const active = option.dataset.theme === currentTheme;
      option.classList.toggle("active", active);
      option.setAttribute("aria-pressed", String(active));
    });
}

async function selectThemeFromDock(themeId) {
  const selectedTheme =
    themeOptions.find(item => item.id === themeId);

  if (!selectedTheme) return;

  const previousTheme = currentTheme;
  applyTheme(themeId);

  try {
    await window.deepseekCodex.setThemeSettings(themeId);
    setTurnStatus(
      "idle",
      `已切换：${selectedTheme.character || selectedTheme.label}`
    );
  } catch (error) {
    applyTheme(previousTheme);
    alert("保存主题失败：" + error.message);
  }
}

function renderThemeDock() {
  if (!themeDockOptions) return;

  themeDockOptions.innerHTML = "";

  ["goku", "vegeta", "roshi", "cell"].forEach(themeId => {
    const item = themeOptions.find(theme => theme.id === themeId);

    if (!item) return;

    const option = document.createElement("button");
    option.type = "button";
    option.className = "theme-dock-option";
    option.dataset.theme = item.id;
    option.setAttribute("aria-pressed", "false");
    option.innerHTML = `
      <span class="theme-dock-art-wrap">
        <img class="theme-dock-art" src="${item.art}" alt="">
      </span>
      <span class="theme-dock-copy">
        <strong>${item.character || item.label}</strong>
        <small>${item.roman || "DRAGON BALL"}</small>
      </span>
      <span class="theme-dock-check"><i class="ph ph-check"></i></span>
    `;

    option.addEventListener("click", event => {
      event.stopPropagation();
      selectThemeFromDock(item.id);
    });

    themeDockOptions.appendChild(option);
  });

  const moreButton = document.createElement("button");
  moreButton.type = "button";
  moreButton.className = "theme-dock-more";
  moreButton.innerHTML = `
    <i class="ph ph-squares-four"></i>
    <span>更多主题</span>
  `;
  moreButton.addEventListener("click", event => {
    event.stopPropagation();
    themePanel.style.display = "block";
  });
  themeDockOptions.appendChild(moreButton);

  updateThemeDockState();
}

function updateWelcomeThemeIdentity(theme) {
  const welcome = document.querySelector(".welcome");

  updateThemeDockState();

  if (!welcome) return;

  welcome.querySelector(".theme-welcome-identity")?.remove();
}

function updateThemePresentation(theme) {
  const isCharacterTheme = Boolean(theme?.art);

  document.documentElement.classList.toggle(
    "character-theme",
    isCharacterTheme
  );

  document.documentElement.style.setProperty(
    "--theme-art-url",
    isCharacterTheme ? `url("${theme.art}")` : "none"
  );

  document.documentElement.style.setProperty(
    "--theme-art-position",
    theme?.artPosition || "center center"
  );

  if (themeStageArt) {
    if (isCharacterTheme) {
      themeStageArt.src = theme.hero || theme.art;
      themeStageArt.style.objectPosition =
        theme.artPosition || "center center";

      themeStage.classList.remove(
        "theme-character-stage-enter"
      );

      requestAnimationFrame(() => {
        themeStage.classList.add(
          "theme-character-stage-enter"
        );
      });
    } else {
      themeStageArt.removeAttribute("src");
      themeStage.classList.remove(
        "theme-character-stage-enter"
      );
    }
  }

  if (themeStageRank) {
    themeStageRank.textContent = theme?.rank || "";
  }

  if (themeStageRoman) {
    themeStageRoman.textContent = theme?.roman || "";
  }

  if (themeStageTagline) {
    themeStageTagline.textContent = theme?.tagline || "";
  }

  if (themePreviewArt) {
    if (isCharacterTheme) {
      themePreviewArt.src = theme.art;
      themePreviewArt.alt = `${theme.character || theme.label}主题预览`;
      themePreviewArt.hidden = false;
    } else {
      themePreviewArt.removeAttribute("src");
      themePreviewArt.alt = "";
      themePreviewArt.hidden = true;
    }
  }

  if (themePreviewTitle) {
    themePreviewTitle.textContent = theme?.character || theme?.label || "深色";
  }

  if (themePreviewSubtitle) {
    themePreviewSubtitle.textContent =
      theme?.tagline ||
      theme?.description ||
      "沉稳专注的默认工作界面";
  }

  if (themePreviewRank) {
    themePreviewRank.textContent = theme?.rank || "BASE";
  }

  updateWelcomeThemeIdentity(theme);
}

const heroTitleTintCache = new Map();

function recolorHeroTitleAccent(themeId, accent) {
  const image = document.querySelector(".hero-title-image");
  if (!image || !accent) return;

  const baseSrc = "assets/hero-title-reference-transparent.png";
  const cached = heroTitleTintCache.get(themeId);
  if (cached) {
    image.src = cached;
    return;
  }

  const source = new Image();
  source.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const match = /^#?([0-9a-f]{6})$/i.exec(accent.trim());
    if (!match) return;

    const red = parseInt(match[1].slice(0, 2), 16);
    const green = parseInt(match[1].slice(2, 4), 16);
    const blue = parseInt(match[1].slice(4, 6), 16);

    for (let index = 0; index < pixels.data.length; index += 4) {
      const r = pixels.data[index];
      const g = pixels.data[index + 1];
      const b = pixels.data[index + 2];
      const isWarmAccent = r > 105 && r > g * 1.28 && g > b * 1.18;

      if (!isWarmAccent) continue;

      const brightness = (r * 0.48 + g * 0.38 + b * 0.14) / 255;
      pixels.data[index] = Math.min(255, red * brightness + 255 * (1 - brightness) * 0.08);
      pixels.data[index + 1] = Math.min(255, green * brightness + 255 * (1 - brightness) * 0.08);
      pixels.data[index + 2] = Math.min(255, blue * brightness + 255 * (1 - brightness) * 0.08);
    }

    context.putImageData(pixels, 0, 0);
    const tintedSrc = canvas.toDataURL("image/png");
    heroTitleTintCache.set(themeId, tintedSrc);
    image.src = tintedSrc;
  };
  source.src = baseSrc;
}

function applyTheme(theme) {
  const selectedTheme =
    themeOptions.find(item => item.id === theme) ||
    themeOptions.find(item => item.id === "dark") ||
    themeOptions[0];

  const nextTheme = selectedTheme?.id || "dark";

  currentTheme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  themeButton.dataset.theme = nextTheme;
  themeButton.title = selectedTheme?.art
    ? `当前主题：${selectedTheme.character || selectedTheme.label}`
    : `当前主题：${selectedTheme?.label || "深色"}`;

  updateThemePresentation(selectedTheme);
  recolorHeroTitleAccent(
    nextTheme,
    selectedTheme?.art
      ? getComputedStyle(document.documentElement)
          .getPropertyValue("--theme-accent")
      : "#f36a21"
  );

  themeOptionsContainer
    .querySelectorAll(".theme-option")
    .forEach(option => {
      const active = option.dataset.theme === nextTheme;
      option.classList.toggle("active", active);
      option.setAttribute("aria-pressed", String(active));
    });

  updateThemeDockState();
}

function renderThemeOptions() {
  themeOptionsContainer.innerHTML = "";

  const groups = new Map();

  themeOptions.forEach(item => {
    const groupName = item.group || "其他主题";

    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }

    groups.get(groupName).push(item);
  });

  groups.forEach((items, groupName) => {
    const section = document.createElement("section");
    section.className = "theme-group";

    const groupHeader = document.createElement("div");
    groupHeader.className = "theme-group-header";

    const groupTitle = document.createElement("strong");
    groupTitle.className = "theme-group-title";
    groupTitle.textContent = groupName;

    const groupCount = document.createElement("span");
    groupCount.className = "theme-group-count";
    groupCount.textContent = `${items.length} 套`;

    groupHeader.appendChild(groupTitle);
    groupHeader.appendChild(groupCount);

    const groupGrid = document.createElement("div");
    groupGrid.className = "theme-group-grid";
    groupGrid.classList.toggle(
      "theme-group-grid-character",
      items.some(item => item.art)
    );

    items.forEach(item => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "theme-option";
      option.classList.toggle(
        "theme-option-character",
        Boolean(item.art)
      );
      option.dataset.theme = item.id;
      option.setAttribute("aria-pressed", "false");

      const media = document.createElement("span");
      media.className = "theme-option-media";

      if (item.art) {
        const art = document.createElement("img");
        art.className = "theme-option-art";
        art.src = item.art;
        art.alt = "";
        media.appendChild(art);
      } else {
        const swatch = document.createElement("span");
        swatch.className = "theme-swatch";
        media.appendChild(swatch);
      }

      const copy = document.createElement("span");
      copy.className = "theme-option-copy";

      const label = document.createElement("strong");
      label.className = "theme-option-label";
      label.textContent = item.character || item.label;

      const subtitle = document.createElement("span");
      subtitle.className = "theme-option-subtitle";
      subtitle.textContent =
        item.roman || item.description || "界面主题";

      copy.appendChild(label);
      copy.appendChild(subtitle);

      const check = document.createElement("span");
      check.className = "theme-option-check";
      check.innerHTML = '<i class="ph ph-check"></i>';

      option.appendChild(media);
      option.appendChild(copy);
      option.appendChild(check);

      option.addEventListener("click", async () => {
        const previousTheme = currentTheme;
        applyTheme(item.id);

        try {
          await window.deepseekCodex.setThemeSettings(item.id);
          setTurnStatus(
            "idle",
            `已切换：${item.character || item.label}`
          );
        } catch (error) {
          applyTheme(previousTheme);
          alert("保存主题失败：" + error.message);
        }
      });

      groupGrid.appendChild(option);
    });

    section.appendChild(groupHeader);
    section.appendChild(groupGrid);
    themeOptionsContainer.appendChild(section);
  });

  renderThemeDock();
  applyTheme(currentTheme);
}

async function loadThemeSettings() {
  try {
    const settings =
      await window.deepseekCodex.getThemeSettings();

    if (Array.isArray(settings?.themes) && settings.themes.length) {
      themeOptions = settings.themes;
    }

    renderThemeOptions();
    applyTheme(settings?.theme || "dark");
  } catch (error) {
    console.error("读取主题设置失败", error);
    renderThemeOptions();
    applyTheme("dark");
  }
}

themeButton.addEventListener("click", event => {
  event.stopPropagation();
  themePanel.style.display =
    themePanel.style.display === "block"
      ? "none"
      : "block";
});

themePanel
  .querySelector(".theme-close")
  .addEventListener("click", () => {
    themePanel.style.display = "none";
  });

document.body.appendChild(themePanel);

document.addEventListener("click", event => {
  if (
    !themePanel.contains(event.target) &&
    !themeButton.contains(event.target)
  ) {
    themePanel.style.display = "none";
  }
});

const themeStyle =
  document.createElement("style");

themeStyle.textContent = `
:root,
html[data-theme="dark"] {
  color-scheme: dark;
  --theme-bg: #0b0f14;
  --theme-sidebar: #0f141b;
  --theme-topbar: #0d1218;
  --theme-panel: #151c25;
  --theme-surface: #111820;
  --theme-surface-alt: #131a23;
  --theme-input: #0f161e;
  --theme-code: #080d12;
  --theme-border: #202833;
  --theme-border-strong: #344456;
  --theme-text: #e8edf3;
  --theme-text-strong: #f5f8fc;
  --theme-muted: #8c98a8;
  --theme-subtle: #778394;
  --theme-accent: #6d5dfc;
  --theme-accent-alt: #29b6f6;
  --theme-accent-surface: #1a2b45;
  --theme-success: #39d98a;
  --theme-warning: #f2cf8c;
  --theme-danger: #ffaaa8;
  --theme-shadow: rgba(0, 0, 0, .42);
  --theme-overlay: rgba(0, 0, 0, .58);
}

html[data-theme="light"] {
  color-scheme: light;
  --theme-bg: #f4f7fb;
  --theme-sidebar: #eaf0f7;
  --theme-topbar: #ffffff;
  --theme-panel: #ffffff;
  --theme-surface: #f7f9fc;
  --theme-surface-alt: #eef3f8;
  --theme-input: #ffffff;
  --theme-code: #edf2f7;
  --theme-border: #d3dce7;
  --theme-border-strong: #b5c4d5;
  --theme-text: #1c2633;
  --theme-text-strong: #142033;
  --theme-muted: #5d6d80;
  --theme-subtle: #738398;
  --theme-accent: #4767d6;
  --theme-accent-alt: #1d9bd1;
  --theme-accent-surface: #dce8ff;
  --theme-success: #188a58;
  --theme-warning: #a26411;
  --theme-danger: #b6313b;
  --theme-shadow: rgba(41, 61, 87, .22);
  --theme-overlay: rgba(27, 42, 62, .35);
}

html[data-theme="ocean"] {
  color-scheme: dark;
  --theme-bg: #07141c;
  --theme-sidebar: #0a202b;
  --theme-topbar: #0a1a24;
  --theme-panel: #0f2835;
  --theme-surface: #0d202b;
  --theme-surface-alt: #12313d;
  --theme-input: #0a1b24;
  --theme-code: #061017;
  --theme-border: #1a4554;
  --theme-border-strong: #296278;
  --theme-text: #e4f6fb;
  --theme-text-strong: #f7ffff;
  --theme-muted: #8bb9c5;
  --theme-subtle: #6d9baa;
  --theme-accent: #1aa6b7;
  --theme-accent-alt: #4ac4ef;
  --theme-accent-surface: #123f50;
  --theme-success: #45d6a0;
  --theme-warning: #f3c969;
  --theme-danger: #ff8e91;
  --theme-shadow: rgba(0, 18, 28, .54);
  --theme-overlay: rgba(0, 19, 29, .62);
}

html[data-theme="purple"] {
  color-scheme: dark;
  --theme-bg: #110d1b;
  --theme-sidebar: #191128;
  --theme-topbar: #140f22;
  --theme-panel: #221633;
  --theme-surface: #1a1228;
  --theme-surface-alt: #251a3a;
  --theme-input: #160e22;
  --theme-code: #0b0812;
  --theme-border: #3b2a59;
  --theme-border-strong: #5c4383;
  --theme-text: #f2eaff;
  --theme-text-strong: #fff8ff;
  --theme-muted: #b5a7cc;
  --theme-subtle: #9788b1;
  --theme-accent: #a66cff;
  --theme-accent-alt: #6ca8ff;
  --theme-accent-surface: #36225c;
  --theme-success: #5cdda4;
  --theme-warning: #f0c570;
  --theme-danger: #ff9cae;
  --theme-shadow: rgba(18, 8, 32, .56);
  --theme-overlay: rgba(15, 6, 27, .66);
}

html[data-theme="goku"] {
  color-scheme: dark;
  --theme-bg: #17100c;
  --theme-sidebar: #27170e;
  --theme-topbar: #20130d;
  --theme-panel: #332015;
  --theme-surface: #24170f;
  --theme-surface-alt: #432617;
  --theme-input: #160e0a;
  --theme-code: #0b0907;
  --theme-border: #63391f;
  --theme-border-strong: #8e5a31;
  --theme-text: #fff0d5;
  --theme-text-strong: #fff8eb;
  --theme-muted: #d0a477;
  --theme-subtle: #b08058;
  --theme-accent: #f07f20;
  --theme-accent-alt: #3c75b5;
  --theme-accent-surface: #51301b;
  --theme-success: #71d998;
  --theme-warning: #f4c15d;
  --theme-danger: #ff8b73;
  --theme-shadow: rgba(35, 12, 3, .58);
  --theme-overlay: rgba(35, 12, 3, .68);
}

html[data-theme="krillin"] {
  color-scheme: dark;
  --theme-bg: #10151c;
  --theme-sidebar: #172435;
  --theme-topbar: #111c2a;
  --theme-panel: #1c3044;
  --theme-surface: #162738;
  --theme-surface-alt: #244258;
  --theme-input: #0d1723;
  --theme-code: #080e16;
  --theme-border: #2b526f;
  --theme-border-strong: #4d7d9e;
  --theme-text: #eaf5ff;
  --theme-text-strong: #ffffff;
  --theme-muted: #9dbdd6;
  --theme-subtle: #7899b3;
  --theme-accent: #e87524;
  --theme-accent-alt: #6ab5e8;
  --theme-accent-surface: #29475d;
  --theme-success: #71dba7;
  --theme-warning: #f4c771;
  --theme-danger: #ff9d8f;
  --theme-shadow: rgba(3, 17, 30, .62);
  --theme-overlay: rgba(3, 17, 30, .72);
}

html[data-theme="roshi"] {
  color-scheme: dark;
  --theme-bg: #141711;
  --theme-sidebar: #202719;
  --theme-topbar: #1a2116;
  --theme-panel: #2b321f;
  --theme-surface: #222a1a;
  --theme-surface-alt: #3b4427;
  --theme-input: #11170f;
  --theme-code: #090d08;
  --theme-border: #596133;
  --theme-border-strong: #7c8146;
  --theme-text: #f5f1dc;
  --theme-text-strong: #fffdf1;
  --theme-muted: #c4bd91;
  --theme-subtle: #9f986c;
  --theme-accent: #e87522;
  --theme-accent-alt: #80a94d;
  --theme-accent-surface: #4b3b22;
  --theme-success: #8dd28a;
  --theme-warning: #f1c66b;
  --theme-danger: #ef8b76;
  --theme-shadow: rgba(15, 20, 5, .6);
  --theme-overlay: rgba(15, 20, 5, .7);
}

html[data-theme="taopaipai"] {
  color-scheme: dark;
  --theme-bg: #160f14;
  --theme-sidebar: #26151e;
  --theme-topbar: #1f121a;
  --theme-panel: #351d2a;
  --theme-surface: #281722;
  --theme-surface-alt: #492536;
  --theme-input: #110b10;
  --theme-code: #0b070a;
  --theme-border: #69394b;
  --theme-border-strong: #9a5267;
  --theme-text: #ffe8ed;
  --theme-text-strong: #fff8fa;
  --theme-muted: #d4a2b0;
  --theme-subtle: #ad7487;
  --theme-accent: #d64b5f;
  --theme-accent-alt: #8a9cbd;
  --theme-accent-surface: #552b3d;
  --theme-success: #7bd89e;
  --theme-warning: #f2c36d;
  --theme-danger: #ff8797;
  --theme-shadow: rgba(35, 6, 17, .62);
  --theme-overlay: rgba(35, 6, 17, .72);
}

html[data-theme="cell"] {
  color-scheme: dark;
  --theme-bg: #0d1712;
  --theme-sidebar: #14251a;
  --theme-topbar: #102019;
  --theme-panel: #1f3522;
  --theme-surface: #17291b;
  --theme-surface-alt: #2c4a2c;
  --theme-input: #09100c;
  --theme-code: #060b08;
  --theme-border: #3e7042;
  --theme-border-strong: #6a9d59;
  --theme-text: #e9f5dd;
  --theme-text-strong: #fafff2;
  --theme-muted: #abc58f;
  --theme-subtle: #7e9f71;
  --theme-accent: #8eaf42;
  --theme-accent-alt: #8a5bc1;
  --theme-accent-surface: #3a4c2a;
  --theme-success: #7ee19e;
  --theme-warning: #e5c66b;
  --theme-danger: #ff8e91;
  --theme-shadow: rgba(2, 18, 6, .64);
  --theme-overlay: rgba(2, 18, 6, .74);
}

html[data-theme="launch"] {
  color-scheme: dark;
  --theme-bg: #19140d;
  --theme-sidebar: #2b2113;
  --theme-topbar: #241b10;
  --theme-panel: #3a2b18;
  --theme-surface: #2b2115;
  --theme-surface-alt: #4b3920;
  --theme-input: #130f09;
  --theme-code: #0b0905;
  --theme-border: #72552b;
  --theme-border-strong: #aa7e39;
  --theme-text: #fff3d5;
  --theme-text-strong: #fffdf2;
  --theme-muted: #d3b67d;
  --theme-subtle: #aa8d55;
  --theme-accent: #e8b334;
  --theme-accent-alt: #c75645;
  --theme-accent-surface: #5a3c1b;
  --theme-success: #85d69a;
  --theme-warning: #f3cb61;
  --theme-danger: #ff8c82;
  --theme-shadow: rgba(35, 20, 4, .6);
  --theme-overlay: rgba(35, 20, 4, .7);
}

html[data-theme="chichi"] {
  color-scheme: dark;
  --theme-bg: #120f1a;
  --theme-sidebar: #21182e;
  --theme-topbar: #1a1425;
  --theme-panel: #302142;
  --theme-surface: #241a34;
  --theme-surface-alt: #47305a;
  --theme-input: #0d0a12;
  --theme-code: #08060b;
  --theme-border: #61427a;
  --theme-border-strong: #8a5b9d;
  --theme-text: #f8ebff;
  --theme-text-strong: #fff8ff;
  --theme-muted: #c4a9d2;
  --theme-subtle: #a281b6;
  --theme-accent: #8f5fbd;
  --theme-accent-alt: #d34e67;
  --theme-accent-surface: #54325e;
  --theme-success: #7fdaa5;
  --theme-warning: #f1c875;
  --theme-danger: #ff8da1;
  --theme-shadow: rgba(21, 7, 30, .62);
  --theme-overlay: rgba(21, 7, 30, .72);
}

html[data-theme="vegeta"] {
  color-scheme: dark;
  --theme-bg: #0d141a;
  --theme-sidebar: #12222b;
  --theme-topbar: #101c25;
  --theme-panel: #1d3540;
  --theme-surface: #152a33;
  --theme-surface-alt: #2a4a53;
  --theme-input: #091017;
  --theme-code: #060b0f;
  --theme-border: #376373;
  --theme-border-strong: #5c8794;
  --theme-text: #edf8f8;
  --theme-text-strong: #ffffff;
  --theme-muted: #a3c0c4;
  --theme-subtle: #7799a0;
  --theme-accent: #3e9fbd;
  --theme-accent-alt: #d8b44f;
  --theme-accent-surface: #315260;
  --theme-success: #7cdca3;
  --theme-warning: #f0c967;
  --theme-danger: #ff9092;
  --theme-shadow: rgba(2, 17, 25, .64);
  --theme-overlay: rgba(2, 17, 25, .74);
}

html[data-theme="android18"] {
  color-scheme: dark;
  --theme-bg: #11161b;
  --theme-sidebar: #1b252d;
  --theme-topbar: #151f27;
  --theme-panel: #273741;
  --theme-surface: #1e2c35;
  --theme-surface-alt: #38505a;
  --theme-input: #0c1115;
  --theme-code: #070b0f;
  --theme-border: #476473;
  --theme-border-strong: #71909a;
  --theme-text: #eaf4f5;
  --theme-text-strong: #ffffff;
  --theme-muted: #a7bdc2;
  --theme-subtle: #7d989f;
  --theme-accent: #5d9cbb;
  --theme-accent-alt: #d8b44f;
  --theme-accent-surface: #385665;
  --theme-success: #7bdca2;
  --theme-warning: #f1ca70;
  --theme-danger: #ff8c9a;
  --theme-shadow: rgba(4, 13, 19, .62);
  --theme-overlay: rgba(4, 13, 19, .72);
}

html[data-theme="bulma"] {
  color-scheme: dark;
  --theme-bg: #0e171d;
  --theme-sidebar: #12252e;
  --theme-topbar: #102029;
  --theme-panel: #1e3c45;
  --theme-surface: #173039;
  --theme-surface-alt: #2b5158;
  --theme-input: #091217;
  --theme-code: #060b0e;
  --theme-border: #3a7075;
  --theme-border-strong: #60a0a0;
  --theme-text: #e9fbfa;
  --theme-text-strong: #ffffff;
  --theme-muted: #a2c9c8;
  --theme-subtle: #79a4a5;
  --theme-accent: #35b5bd;
  --theme-accent-alt: #e46d91;
  --theme-accent-surface: #315864;
  --theme-success: #7bdca6;
  --theme-warning: #f2ca6c;
  --theme-danger: #ff8da1;
  --theme-shadow: rgba(1, 18, 23, .62);
  --theme-overlay: rgba(1, 18, 23, .72);
}

html[data-theme="buu"] {
  color-scheme: dark;
  --theme-bg: #1a0f1a;
  --theme-sidebar: #2d172a;
  --theme-topbar: #241322;
  --theme-panel: #47223f;
  --theme-surface: #351a31;
  --theme-surface-alt: #633052;
  --theme-input: #120a12;
  --theme-code: #0b060b;
  --theme-border: #81446b;
  --theme-border-strong: #b66a90;
  --theme-text: #ffe8f4;
  --theme-text-strong: #fff8fc;
  --theme-muted: #d4a3c0;
  --theme-subtle: #ad789a;
  --theme-accent: #e88a9d;
  --theme-accent-alt: #a67b39;
  --theme-accent-surface: #69334f;
  --theme-success: #7bdd9e;
  --theme-warning: #f2c76a;
  --theme-danger: #ff8da2;
  --theme-shadow: rgba(34, 5, 27, .64);
  --theme-overlay: rgba(34, 5, 27, .74);
}

html[data-theme="kingkai"] {
  color-scheme: dark;
  --theme-bg: #0d1820;
  --theme-sidebar: #122b35;
  --theme-topbar: #10232c;
  --theme-panel: #1e414a;
  --theme-surface: #17333d;
  --theme-surface-alt: #2d5a60;
  --theme-input: #091116;
  --theme-code: #060b0f;
  --theme-border: #3e7980;
  --theme-border-strong: #66a8a6;
  --theme-text: #e8fbff;
  --theme-text-strong: #ffffff;
  --theme-muted: #a4cbd0;
  --theme-subtle: #79a4ab;
  --theme-accent: #62b9d2;
  --theme-accent-alt: #c94d5c;
  --theme-accent-surface: #315e69;
  --theme-success: #7bdca0;
  --theme-warning: #f2c96e;
  --theme-danger: #ff8f96;
  --theme-shadow: rgba(1, 17, 25, .64);
  --theme-overlay: rgba(1, 17, 25, .74);
}

html,
body,
.app,
.main {
  background: var(--theme-bg) !important;
  color: var(--theme-text) !important;
}

.sidebar {
  background: var(--theme-sidebar) !important;
  border-color: var(--theme-border) !important;
}

.topbar {
  background: var(--theme-topbar) !important;
  border-color: var(--theme-border) !important;
}

.brand,
.project-name,
.quick strong {
  color: var(--theme-text-strong) !important;
}

.logo {
  background: linear-gradient(135deg, var(--theme-accent), var(--theme-accent-alt)) !important;
}

html[data-theme="goku"] .logo,
html[data-theme="krillin"] .logo,
html[data-theme="roshi"] .logo,
html[data-theme="taopaipai"] .logo,
html[data-theme="cell"] .logo,
html[data-theme="launch"] .logo,
html[data-theme="chichi"] .logo,
html[data-theme="vegeta"] .logo,
html[data-theme="android18"] .logo,
html[data-theme="bulma"] .logo,
html[data-theme="buu"] .logo,
html[data-theme="kingkai"] .logo {
  background-image: url("assets/dragon-ball-chibi-characters.jpg") !important;
  background-size: 300% 400% !important;
  background-repeat: no-repeat !important;
}

html[data-theme="goku"] .logo { background-position: 0% 0% !important; }
html[data-theme="krillin"] .logo { background-position: 50% 0% !important; }
html[data-theme="roshi"] .logo { background-position: 100% 0% !important; }
html[data-theme="taopaipai"] .logo { background-position: 0% 33.333% !important; }
html[data-theme="cell"] .logo { background-position: 50% 33.333% !important; }
html[data-theme="launch"] .logo { background-position: 100% 33.333% !important; }
html[data-theme="chichi"] .logo { background-position: 0% 66.667% !important; }
html[data-theme="vegeta"] .logo { background-position: 50% 66.667% !important; }
html[data-theme="android18"] .logo { background-position: 100% 66.667% !important; }
html[data-theme="bulma"] .logo { background-position: 0% 100% !important; }
html[data-theme="buu"] .logo { background-position: 50% 100% !important; }
html[data-theme="kingkai"] .logo { background-position: 100% 100% !important; }

.new-task,
.model-pill,
.turn-status-pill,
.diagnostics-trigger,
.api-key-trigger,
.token-usage-trigger,
.git-status-trigger,
.theme-trigger,
.embedded-proxy-pill,
.network-status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 13px;
  border: 1px solid var(--theme-border-strong) !important;
  border-radius: 999px !important;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  background: var(--theme-panel) !important;
  color: var(--theme-text) !important;
}

.new-task:hover,
.diagnostics-trigger:hover,
.api-key-trigger:hover,
.token-usage-trigger:hover,
.git-status-trigger:hover,
.theme-trigger:hover,
.embedded-proxy-pill:hover,
.network-status-pill:hover {
  background: var(--theme-accent-surface) !important;
  border-color: var(--theme-accent-alt) !important;
}

.section-title,
.model-small,
.quick span,
.welcome p,
.project-button {
  color: var(--theme-muted) !important;
}

.project {
  color: var(--theme-text) !important;
}

.project.active,
.recent-projects-container .project.active,
.thread-history-item.active {
  background: var(--theme-accent-surface) !important;
  color: var(--theme-text-strong) !important;
}

.project:hover,
.recent-projects-container .project:hover,
.thread-history-item:hover {
  background: var(--theme-surface-alt) !important;
}

.sidebar-bottom {
  border-color: var(--theme-border) !important;
}

.quick,
.composer,
.message-row.assistant .message-bubble,
.agent-activity-card,
.agent-progress-card,
.agent-diff,
.approval-card,
.history-restored-card,
.history-resume-banner {
  background: var(--theme-surface) !important;
  border-color: var(--theme-border-strong) !important;
  color: var(--theme-text) !important;
}

.composer textarea,
.thread-history-search-input,
.thread-rename-input,
.model-settings-label select {
  background: var(--theme-input) !important;
  border-color: var(--theme-border) !important;
  color: var(--theme-text-strong) !important;
}

.composer textarea::placeholder,
.thread-history-search-input::placeholder,
.thread-rename-input::placeholder {
  color: var(--theme-subtle) !important;
}

.message-row.user .message-bubble {
  background: var(--theme-accent-surface) !important;
  color: var(--theme-text-strong) !important;
}

.send {
  background: var(--theme-text-strong) !important;
  color: var(--theme-bg) !important;
}

.model-settings-panel,
.diagnostics-panel,
.token-usage-panel,
.git-status-panel,
.thread-history-popup,
.recent-project-popup,
.thread-rename-dialog {
  background: var(--theme-panel) !important;
  border-color: var(--theme-border-strong) !important;
  box-shadow: 0 16px 40px var(--theme-shadow) !important;
  color: var(--theme-text) !important;
}

.model-settings-title,
.diagnostics-title,
.token-usage-title,
.git-status-title,
.thread-history-title,
.theme-title {
  color: var(--theme-text-strong) !important;
}

.model-settings-note,
.token-usage-note,
.token-usage-summary,
.git-status-summary,
.diagnostics-summary,
.diagnostics-entry-header,
.diagnostics-entry-details,
.git-status-empty,
.git-status-more,
.history-restored-tip,
.history-empty-content,
.thread-history-meta {
  color: var(--theme-muted) !important;
}

.model-settings-label,
.token-usage-row,
.git-file-row,
.thread-history-name,
.thread-history-group-title,
.git-file-path {
  color: var(--theme-text) !important;
}

.model-settings-label select,
.thread-rename-input {
  background: var(--theme-input) !important;
  color: var(--theme-text-strong) !important;
}

.model-settings-actions button,
.diagnostics-actions button,
.git-status-actions button,
.thread-rename-button.secondary,
.thread-history-popup-item,
.recent-project-popup-item {
  background: var(--theme-surface-alt) !important;
  border-color: var(--theme-border-strong) !important;
  color: var(--theme-text) !important;
}

.model-settings-save,
.thread-rename-button.primary {
  background: var(--theme-accent) !important;
  border-color: var(--theme-accent-alt) !important;
  color: var(--theme-text-strong) !important;
}

.model-settings-actions button:hover,
.diagnostics-actions button:hover,
.git-status-actions button:hover,
.thread-history-popup-item:hover,
.recent-project-popup-item:hover,
.thread-rename-button:hover {
  background: var(--theme-accent-surface) !important;
  border-color: var(--theme-accent-alt) !important;
}

.thread-history-popup-item.danger,
.recent-project-popup-item.danger,
.approval-btn.decline,
.git-file-conflict .git-file-code,
.diagnostics-entry-message,
.agent-activity-card.error,
.agent-progress-card.error {
  color: var(--theme-danger) !important;
}

.thread-history-search,
.recent-projects-container,
.thread-history-container,
.attachment-chips,
.attachment-toolbar {
  color: var(--theme-text) !important;
}

.approval-command,
.agent-command-output,
.agent-diff pre,
.diff-code {
  background: var(--theme-code) !important;
  border-color: var(--theme-border) !important;
  color: var(--theme-text) !important;
}

.diff-file-header {
  background: var(--theme-surface-alt) !important;
  border-color: var(--theme-border) !important;
  color: var(--theme-text) !important;
}

.thread-history-search {
  background: var(--theme-input) !important;
  border-color: var(--theme-border) !important;
  color: var(--theme-text) !important;
}

.agent-activity-header,
.agent-progress-header,
.agent-diff-title,
.approval-header,
.thread-history-search-icon,
.thread-history-search-clear,
.recent-project-menu-button,
.thread-history-menu-button {
  color: var(--theme-text) !important;
}

.agent-activity-icon,
.agent-progress-step-icon {
  background: var(--theme-accent-surface) !important;
  border-color: var(--theme-border-strong) !important;
  color: var(--theme-accent-alt) !important;
}

.approval-reason,
.approval-result,
.agent-activity-detail,
.agent-progress-explanation,
.agent-progress-status,
.diff-file-name,
.diff-stats,
.attachment-chip-meta {
  color: var(--theme-muted) !important;
}

.approval-btn.allow,
.agent-progress-step.completed .agent-progress-step-icon,
.diff-added,
.git-file-untracked .git-file-code,
.attachment-notice.success {
  color: var(--theme-success) !important;
}

.agent-progress-step.active .agent-progress-step-icon,
.diff-line.addition {
  color: var(--theme-success) !important;
  background: color-mix(in srgb, var(--theme-success) 18%, transparent) !important;
}

.diff-line.deletion {
  color: var(--theme-danger) !important;
  background: color-mix(in srgb, var(--theme-danger) 18%, transparent) !important;
}

.diff-line.hunk,
.agent-progress-step.error .agent-progress-step-icon {
  color: var(--theme-warning) !important;
}

.attachment-button,
.attachment-chip,
.attachment-clear-all,
.attachment-chip-remove,
.message-copy-button,
.retry-turn-button {
  background: var(--theme-surface-alt) !important;
  border-color: var(--theme-border-strong) !important;
  color: var(--theme-text) !important;
}

.attachment-button:hover,
.attachment-clear-all:hover,
.attachment-chip-remove:hover,
.message-copy-button:hover,
.retry-turn-button:hover {
  background: var(--theme-accent-surface) !important;
  border-color: var(--theme-accent-alt) !important;
}

.attachment-notice,
.attachment-drop-indicator {
  background: var(--theme-accent-surface) !important;
  border-color: var(--theme-accent-alt) !important;
  color: var(--theme-text) !important;
}

.thread-rename-overlay {
  background: var(--theme-overlay) !important;
}

.theme-panel {
  display: none;
  position: fixed;
  top: 72px;
  right: 24px;
  z-index: 100001;
  width: min(360px, calc(100vw - 32px));
  padding: 15px;
  background: var(--theme-panel);
  border: 1px solid var(--theme-border-strong);
  border-radius: 12px;
  box-shadow: 0 16px 40px var(--theme-shadow);
  color: var(--theme-text);
}

.theme-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 13px;
}

.theme-subtitle {
  margin-top: 4px;
  color: var(--theme-muted);
  font-size: 11px;
}

.theme-close {
  border: 0;
  background: transparent;
  color: var(--theme-muted);
  font-size: 20px;
  cursor: pointer;
}

.theme-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.theme-group-title {
  grid-column: 1 / -1;
  margin-top: 5px;
  padding: 3px 2px 1px;
  color: var(--theme-muted);
  font-size: 11px;
  font-weight: 700;
}

.theme-character-swatch {
  background-color: var(--theme-surface-alt);
  background-clip: padding-box;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--theme-border);
  border-radius: 9px;
  background: var(--theme-surface-alt);
  color: var(--theme-text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: left;
}

.theme-option:hover,
.theme-option.active {
  border-color: var(--theme-accent-alt);
  background: var(--theme-accent-surface);
}

.theme-swatch {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  border: 1px solid rgba(255,255,255,.3);
  border-radius: 7px;
  background: var(--theme-accent);
}

.theme-option[data-theme="dark"] .theme-swatch {
  background: linear-gradient(135deg, #0b0f14, #6d5dfc);
}

.theme-option[data-theme="light"] .theme-swatch {
  background: linear-gradient(135deg, #ffffff, #4767d6);
}

.theme-option[data-theme="ocean"] .theme-swatch {
  background: linear-gradient(135deg, #07141c, #1aa6b7);
}

.theme-option[data-theme="purple"] .theme-swatch {
  background: linear-gradient(135deg, #110d1b, #a66cff);
}

.theme-option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-option-check {
  margin-left: auto;
  color: var(--theme-success);
  opacity: 0;
}

.theme-option.active .theme-option-check {
  opacity: 1;
}
`;

document.head.appendChild(themeStyle);

const premiumThemeStyle = document.createElement("style");

premiumThemeStyle.textContent = `
:root {
  --theme-art-url: none;
  --theme-art-position: center center;
}

.main {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

.main > .topbar,
.main > .chat,
.main > .composer-wrap {
  position: relative;
  z-index: 2;
}

.theme-character-stage {
  position: absolute;
  inset: 64px 0 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity .42s ease, visibility .42s ease;
}

html.character-theme .theme-character-stage {
  opacity: 1;
  visibility: visible;
}

.theme-character-stage::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 78% 14%, color-mix(in srgb, var(--theme-accent) 28%, transparent), transparent 36%),
    radial-gradient(circle at 92% 48%, color-mix(in srgb, var(--theme-accent-alt) 20%, transparent), transparent 34%),
    linear-gradient(108deg, var(--theme-bg) 4%, color-mix(in srgb, var(--theme-bg) 92%, transparent) 42%, color-mix(in srgb, var(--theme-bg) 52%, transparent) 72%, var(--theme-bg) 100%);
}

.theme-character-stage::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, transparent 0 48%, color-mix(in srgb, var(--theme-accent) 7%, transparent) 48% 49%, transparent 49% 100%),
    linear-gradient(0deg, var(--theme-bg), transparent 22% 74%, color-mix(in srgb, var(--theme-bg) 88%, transparent));
  opacity: .86;
}

.theme-character-aura {
  position: absolute;
  width: min(58vw, 820px);
  height: min(58vw, 820px);
  top: -26%;
  right: -8%;
  border-radius: 50%;
  background:
    radial-gradient(circle, color-mix(in srgb, var(--theme-accent) 28%, transparent), transparent 43%),
    conic-gradient(from 210deg, transparent, color-mix(in srgb, var(--theme-accent-alt) 20%, transparent), transparent 36%, color-mix(in srgb, var(--theme-accent) 16%, transparent), transparent 76%);
  filter: blur(18px);
  opacity: .88;
}

.theme-character-portrait {
  position: absolute;
  top: -5%;
  right: -3%;
  width: clamp(380px, 46vw, 690px);
  height: clamp(430px, 68vh, 720px);
  overflow: hidden;
  background: color-mix(in srgb, var(--theme-accent-surface) 78%, var(--theme-bg));
  border-left: 1px solid color-mix(in srgb, var(--theme-accent) 45%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--theme-accent-alt) 30%, transparent);
  border-radius: 0 0 0 110px;
  box-shadow:
    -28px 28px 90px color-mix(in srgb, var(--theme-shadow) 86%, transparent),
    inset 48px 0 80px var(--theme-bg);
  clip-path: polygon(8% 0, 100% 0, 100% 100%, 0 100%, 0 18%);
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 16%, #000 88%, transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0%, #000 16%, #000 88%, transparent 100%);
}

.theme-character-portrait::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, var(--theme-bg) 0%, transparent 40%, color-mix(in srgb, var(--theme-accent) 14%, transparent) 100%),
    linear-gradient(0deg, var(--theme-bg) 0%, transparent 30% 72%, color-mix(in srgb, var(--theme-bg) 72%, transparent) 100%);
}

.theme-character-art {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: var(--theme-art-position);
  opacity: .68;
  filter: saturate(.88) contrast(1.16) brightness(.68);
  transform: scale(1.12);
  transform-origin: 60% 34%;
}

.theme-character-stage-enter .theme-character-art {
  animation: premium-theme-art-in .62s cubic-bezier(.22,.8,.2,1) both;
}

.theme-character-watermark {
  position: absolute;
  top: 36px;
  right: 32px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  max-width: 280px;
  color: var(--theme-text-strong);
  text-align: right;
  text-shadow: 0 2px 24px var(--theme-bg);
}

.theme-character-rank {
  color: var(--theme-accent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .16em;
}

.theme-character-roman {
  font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
  font-size: clamp(20px, 2vw, 30px);
  font-weight: 800;
  letter-spacing: .06em;
}

.theme-character-tagline {
  color: color-mix(in srgb, var(--theme-text) 78%, transparent);
  font-size: 11px;
  letter-spacing: .08em;
}

@keyframes premium-theme-art-in {
  from {
    opacity: 0;
    transform: scale(1.18) translate3d(24px, -8px, 0);
  }
  to {
    opacity: .68;
    transform: scale(1.12) translate3d(0, 0, 0);
  }
}

html.character-theme .sidebar {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--theme-sidebar) 96%, transparent), color-mix(in srgb, var(--theme-bg) 96%, transparent)) !important;
  border-right-color: color-mix(in srgb, var(--theme-accent) 22%, var(--theme-border)) !important;
  box-shadow: 18px 0 64px color-mix(in srgb, var(--theme-shadow) 74%, transparent);
}

html.character-theme .topbar {
  background: color-mix(in srgb, var(--theme-topbar) 82%, transparent) !important;
  border-bottom-color: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-border)) !important;
  backdrop-filter: blur(18px) saturate(1.12);
}

html.character-theme .logo {
  background-image: var(--theme-art-url) !important;
  background-size: cover !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  color: transparent !important;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 64%, white 12%);
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--theme-accent) 12%, transparent),
    0 10px 24px color-mix(in srgb, var(--theme-accent) 26%, transparent);
}

html.character-theme .brand {
  letter-spacing: -.01em;
}

html.character-theme .new-task {
  position: relative;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--theme-accent) 58%, var(--theme-border)) !important;
  background: linear-gradient(110deg, color-mix(in srgb, var(--theme-panel) 88%, transparent), color-mix(in srgb, var(--theme-accent-surface) 62%, transparent)) !important;
  box-shadow: inset 3px 0 0 var(--theme-accent);
}

html.character-theme .project,
html.character-theme .thread-history-item {
  position: relative;
}

html.character-theme .project.active::before,
html.character-theme .thread-history-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 20%;
  width: 3px;
  height: 60%;
  border-radius: 99px;
  background: var(--theme-accent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--theme-accent) 70%, transparent);
}

html.character-theme .sidebar-bottom {
  margin: 10px 0 0;
  padding: 13px 12px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 28%, var(--theme-border)) !important;
  border-radius: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--theme-panel) 84%, transparent), color-mix(in srgb, var(--theme-accent-surface) 44%, transparent));
  box-shadow: 0 12px 36px color-mix(in srgb, var(--theme-shadow) 54%, transparent);
}

html.character-theme .model-pill,
html.character-theme .turn-status-pill,
html.character-theme .diagnostics-trigger,
html.character-theme .api-key-trigger,
html.character-theme .token-usage-trigger,
html.character-theme .git-status-trigger,
html.character-theme .theme-trigger,
html.character-theme .embedded-proxy-pill,
html.character-theme .network-status-pill {
  background: color-mix(in srgb, var(--theme-panel) 74%, transparent) !important;
  border-color: color-mix(in srgb, var(--theme-accent) 24%, var(--theme-border-strong)) !important;
  backdrop-filter: blur(14px);
}

html.character-theme .topbar-actions .network-status-pill.normal {
  color: #8ed6a5 !important;
  border-color: #2f9b65 !important;
}

html.character-theme .topbar-actions .network-status-pill.error {
  color: #f0b0a0 !important;
  border-color: #b86145 !important;
}

html.character-theme .topbar-actions .network-status-pill.checking {
  color: #e2bd7e !important;
  border-color: #8a6b3f !important;
}

html.character-theme .chat {
  background: transparent !important;
}

html.character-theme .welcome {
  position: relative;
  max-width: 760px;
  margin-top: clamp(42px, 7vh, 80px);
}

.theme-welcome-identity {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 22px;
  margin-bottom: 18px;
  color: var(--theme-muted);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.theme-welcome-line {
  width: 36px;
  height: 2px;
  border-radius: 99px;
  background: var(--theme-accent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--theme-accent) 72%, transparent);
}

.theme-welcome-rank {
  color: var(--theme-accent);
}

.theme-welcome-identity strong {
  color: var(--theme-text-strong);
  font-size: 11px;
  letter-spacing: .12em;
}

html.character-theme .welcome p {
  max-width: 560px;
  color: color-mix(in srgb, var(--theme-text) 70%, transparent) !important;
  font-size: 15px;
  line-height: 1.82;
}

html.character-theme .quick-grid {
  position: relative;
  z-index: 3;
  gap: 12px;
  max-width: 760px;
}

html.character-theme .quick {
  position: relative;
  min-height: 94px;
  overflow: hidden;
  padding: 18px 18px 17px 22px;
  border-color: color-mix(in srgb, var(--theme-accent) 24%, var(--theme-border-strong)) !important;
  background: linear-gradient(135deg, color-mix(in srgb, var(--theme-surface) 86%, transparent), color-mix(in srgb, var(--theme-accent-surface) 50%, transparent)) !important;
  box-shadow:
    0 18px 48px color-mix(in srgb, var(--theme-shadow) 58%, transparent),
    inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
  backdrop-filter: blur(18px) saturate(1.12);
  transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}

html.character-theme .quick::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: linear-gradient(180deg, transparent, var(--theme-accent), transparent);
  opacity: .72;
}

html.character-theme .quick::after {
  position: absolute;
  top: 13px;
  right: 14px;
  color: color-mix(in srgb, var(--theme-accent) 48%, transparent);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .12em;
}

html.character-theme .quick:nth-child(1)::after { content: "01"; }
html.character-theme .quick:nth-child(2)::after { content: "02"; }
html.character-theme .quick:nth-child(3)::after { content: "03"; }
html.character-theme .quick:nth-child(4)::after { content: "04"; }

html.character-theme .quick:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--theme-accent) 58%, var(--theme-border-strong)) !important;
  box-shadow:
    0 22px 58px color-mix(in srgb, var(--theme-shadow) 68%, transparent),
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 12%, transparent);
}

html.character-theme .quick strong {
  padding-right: 36px;
  font-size: 15px;
  letter-spacing: .01em;
}

html.character-theme .composer-wrap {
  background: linear-gradient(0deg, var(--theme-bg) 26%, color-mix(in srgb, var(--theme-bg) 84%, transparent) 70%, transparent);
}

html.character-theme .composer {
  border-color: color-mix(in srgb, var(--theme-accent) 46%, var(--theme-border-strong)) !important;
  background: linear-gradient(135deg, color-mix(in srgb, var(--theme-surface) 91%, transparent), color-mix(in srgb, var(--theme-accent-surface) 48%, transparent)) !important;
  box-shadow:
    0 24px 70px color-mix(in srgb, var(--theme-shadow) 76%, transparent),
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 8%, transparent),
    inset 0 1px 0 color-mix(in srgb, white 6%, transparent);
  backdrop-filter: blur(22px) saturate(1.12);
  transition: border-color .2s ease, box-shadow .2s ease;
}

html.character-theme .composer:focus-within {
  border-color: var(--theme-accent) !important;
  box-shadow:
    0 26px 76px color-mix(in srgb, var(--theme-shadow) 78%, transparent),
    0 0 0 3px color-mix(in srgb, var(--theme-accent) 13%, transparent),
    inset 0 1px 0 color-mix(in srgb, white 8%, transparent);
}

html.character-theme .composer textarea {
  background: transparent !important;
}

html.character-theme .send {
  background: linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 82%, white 18%), var(--theme-accent)) !important;
  color: var(--theme-text-strong) !important;
  box-shadow: 0 8px 22px color-mix(in srgb, var(--theme-accent) 42%, transparent);
}

html.character-theme .message-row.assistant .message-bubble,
html.character-theme .agent-activity-card,
html.character-theme .agent-progress-card,
html.character-theme .agent-diff,
html.character-theme .approval-card {
  background: color-mix(in srgb, var(--theme-surface) 90%, transparent) !important;
  backdrop-filter: blur(14px);
}

html.character-theme:not(.welcome-mode) .chat {
  padding-left: 42px;
  padding-right: 42px;
}

html.character-theme:not(.welcome-mode) .message-row,
html.character-theme:not(.welcome-mode) .agent-activity-card,
html.character-theme:not(.welcome-mode) .agent-progress-card,
html.character-theme:not(.welcome-mode) .agent-diff,
html.character-theme:not(.welcome-mode) .approval-card,
html.character-theme:not(.welcome-mode) .history-restored-card,
html.character-theme:not(.welcome-mode) .history-resume-banner {
  width: min(100%, 820px);
  max-width: 820px;
  margin-left: 0;
  margin-right: auto;
}

html.character-theme:not(.welcome-mode) .message-row {
  align-items: flex-end;
  gap: 10px;
  margin-top: 16px;
  margin-bottom: 16px;
}

html.character-theme:not(.welcome-mode) .message-bubble {
  max-width: min(88%, 720px);
  padding: 13px 16px;
  border-radius: 13px;
  line-height: 1.72;
  font-size: 14px;
}

html.character-theme:not(.welcome-mode) .message-row.user .message-bubble {
  border-bottom-right-radius: 5px;
}

html.character-theme:not(.welcome-mode) .message-row.assistant .message-bubble {
  border-bottom-left-radius: 5px;
}

html.character-theme:not(.welcome-mode) .agent-activity-card,
html.character-theme:not(.welcome-mode) .agent-progress-card,
html.character-theme:not(.welcome-mode) .agent-diff,
html.character-theme:not(.welcome-mode) .approval-card {
  margin-top: 16px;
  margin-bottom: 16px;
}

html.character-theme:not(.welcome-mode) .message-copy-button {
  margin-bottom: 2px;
}

.theme-panel {
  top: 70px;
  right: 18px;
  width: min(680px, calc(100vw - 36px));
  max-height: calc(100vh - 88px);
  padding: 0;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--theme-accent) 30%, var(--theme-border-strong));
  border-radius: 18px;
  background: color-mix(in srgb, var(--theme-panel) 94%, transparent);
  box-shadow:
    0 30px 90px color-mix(in srgb, var(--theme-shadow) 90%, transparent),
    0 0 0 1px color-mix(in srgb, white 5%, transparent);
  backdrop-filter: blur(28px) saturate(1.18);
}

.theme-header {
  margin: 0;
  padding: 21px 22px 17px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border) 82%, transparent);
}

.theme-eyebrow {
  margin-bottom: 6px;
  color: var(--theme-accent);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .16em;
}

.theme-title {
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -.02em;
}

.theme-subtitle {
  margin-top: 5px;
  font-size: 11px;
}

.theme-close {
  display: grid;
  width: 30px;
  height: 30px;
  padding: 0;
  place-items: center;
  border: 1px solid var(--theme-border);
  border-radius: 9px;
  background: color-mix(in srgb, var(--theme-surface-alt) 82%, transparent);
  line-height: 1;
}

.theme-close:hover {
  border-color: var(--theme-accent);
  color: var(--theme-text-strong);
}

.theme-active-preview {
  position: relative;
  display: grid;
  grid-template-columns: 116px 1fr auto;
  min-height: 104px;
  margin: 16px 18px 8px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 32%, var(--theme-border));
  border-radius: 14px;
  background:
    radial-gradient(circle at 18% 20%, color-mix(in srgb, var(--theme-accent) 22%, transparent), transparent 46%),
    linear-gradient(120deg, var(--theme-surface-alt), color-mix(in srgb, var(--theme-accent-surface) 60%, var(--theme-surface)));
}

.theme-active-preview::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 3px 0 0 var(--theme-accent);
}

.theme-active-preview-art {
  width: 116px;
  height: 104px;
  display: block;
  object-fit: cover;
  object-position: center 40%;
  filter: saturate(.9) contrast(1.06) brightness(.8);
  -webkit-mask-image: linear-gradient(90deg, #000 70%, transparent);
  mask-image: linear-gradient(90deg, #000 70%, transparent);
}

.theme-active-preview-art[hidden] {
  display: block;
  visibility: hidden;
}

.theme-active-preview-copy {
  align-self: center;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px 14px 12px 4px;
}

.theme-active-preview-kicker {
  margin-bottom: 5px;
  color: var(--theme-accent);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .14em;
}

.theme-active-preview-title {
  color: var(--theme-text-strong);
  font-size: 16px;
}

.theme-active-preview-subtitle {
  margin-top: 5px;
  overflow: hidden;
  color: var(--theme-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-active-preview-rank {
  align-self: start;
  margin: 14px 14px 0 0;
  color: color-mix(in srgb, var(--theme-accent) 74%, var(--theme-text));
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .1em;
}

.theme-options {
  display: block;
  max-height: min(490px, calc(100vh - 265px));
  padding: 4px 18px 20px;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--theme-accent) 48%, transparent) transparent;
}

.theme-group + .theme-group {
  margin-top: 18px;
}

.theme-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 2px 9px;
}

.theme-group-title {
  margin: 0;
  padding: 0;
  color: var(--theme-text);
  font-size: 11px;
  letter-spacing: .04em;
}

.theme-group-count {
  color: var(--theme-subtle);
  font-size: 10px;
}

.theme-group-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.theme-group-grid-character {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.theme-option {
  position: relative;
  display: flex;
  min-height: 66px;
  gap: 10px;
  padding: 9px 10px;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--theme-border) 86%, transparent);
  border-radius: 11px;
  background: color-mix(in srgb, var(--theme-surface-alt) 80%, transparent);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
}

.theme-option:hover {
  transform: translateY(-1px);
}

.theme-option:hover,
.theme-option.active {
  border-color: color-mix(in srgb, var(--theme-accent) 72%, var(--theme-border-strong));
  background: linear-gradient(130deg, color-mix(in srgb, var(--theme-surface-alt) 88%, transparent), color-mix(in srgb, var(--theme-accent-surface) 72%, transparent));
  box-shadow:
    0 12px 30px color-mix(in srgb, var(--theme-shadow) 58%, transparent),
    inset 3px 0 0 var(--theme-accent);
}

.theme-option-media {
  position: relative;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  align-self: center;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, white 18%, var(--theme-border));
  border-radius: 9px;
  background: var(--theme-surface);
}

.theme-option-art {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center 38%;
  filter: saturate(.92) contrast(1.04);
  transition: transform .24s ease, filter .24s ease;
}

.theme-option:hover .theme-option-art,
.theme-option.active .theme-option-art {
  filter: saturate(1.05) contrast(1.06);
  transform: scale(1.08);
}

.theme-swatch {
  width: 100%;
  height: 100%;
  display: block;
  border: 0;
  border-radius: 0;
}

.theme-option-copy {
  align-self: center;
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.theme-option-label,
.theme-option-subtitle {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-option-label {
  color: var(--theme-text-strong);
  font-size: 11px;
  font-weight: 700;
}

.theme-option-subtitle {
  color: var(--theme-subtle);
  font-size: 8px;
  font-weight: 650;
  letter-spacing: .06em;
}

.theme-option-check {
  position: absolute;
  top: 7px;
  right: 7px;
  display: grid;
  width: 17px;
  height: 17px;
  margin: 0;
  place-items: center;
  border-radius: 50%;
  background: var(--theme-accent);
  color: var(--theme-text-strong);
  font-size: 10px;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--theme-accent) 54%, transparent);
}

.theme-option-character {
  min-height: 78px;
}

.theme-option-character .theme-option-media {
  width: 54px;
  height: 58px;
  border-radius: 10px;
}

@media (max-width: 900px) {
  .theme-character-portrait {
    right: -12%;
    width: 54vw;
    opacity: .72;
  }

  .theme-character-watermark {
    display: none;
  }

  .theme-group-grid-character {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-height: 820px) {
  html.character-theme .welcome {
    margin-top: 18px;
  }

  html.character-theme .theme-welcome-identity {
    margin-bottom: 10px;
  }

  html.character-theme .welcome p {
    margin: 0;
    line-height: 1.58;
  }

  html.character-theme .quick-grid {
    margin-top: 17px;
  }

  html.character-theme .quick {
    min-height: 76px;
    padding: 14px 16px 13px 20px;
  }

  html.character-theme .quick strong {
    margin-bottom: 4px;
  }

  html.character-theme .composer-wrap {
    padding-top: 10px;
    padding-bottom: 14px;
  }

  html.character-theme .composer textarea {
    height: 58px;
  }
}

@media (max-width: 620px) {
  .theme-panel {
    right: 10px;
    width: calc(100vw - 20px);
  }

  .theme-active-preview {
    grid-template-columns: 86px 1fr;
  }

  .theme-active-preview-art {
    width: 86px;
  }

  .theme-active-preview-rank {
    display: none;
  }

  .theme-group-grid,
  .theme-group-grid-character {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .theme-character-art,
  .quick,
  .theme-option,
  .theme-option-art {
    animation: none !important;
    transition: none !important;
  }
}
`;

document.head.appendChild(premiumThemeStyle);
renderThemeOptions();
loadThemeSettings();

async function maybeShowOnboarding() {
  const state = await window.deepseekCodex.getOnboardingState();
  if (state?.completed || document.querySelector(".onboarding-overlay")) return;

  const style = document.createElement("style");
  style.textContent = `
    .onboarding-overlay { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 24px; background: rgba(2, 7, 13, .76); backdrop-filter: blur(8px); }
    .onboarding-card { width: min(620px, 100%); padding: 30px; border: 1px solid #d77b2b; border-radius: 22px; background: linear-gradient(145deg, #111c28, #0a111a); box-shadow: 0 24px 80px rgba(0,0,0,.5); color: #e7edf5; }
    .onboarding-card h2 { margin: 0 0 8px; font-size: 24px; }
    .onboarding-lead { margin: 0 0 22px; color: #9eacbb; line-height: 1.6; }
    .onboarding-step { display: grid; grid-template-columns: 32px 1fr; gap: 12px; padding: 14px 0; border-top: 1px solid #263444; }
    .onboarding-number { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; color: #ff9a3d; background: #2b2018; font-weight: 700; }
    .onboarding-step strong { display: block; margin-bottom: 4px; }
    .onboarding-step span { color: #9eacbb; font-size: 13px; line-height: 1.5; }
    .onboarding-action { margin-top: 8px; padding: 7px 11px; border: 1px solid #42566d; border-radius: 9px; background: #162230; color: #dce7f2; cursor: pointer; }
    .onboarding-api-input { width: min(330px, 75%); margin-top: 8px; margin-right: 8px; padding: 8px 10px; border: 1px solid #42566d; border-radius: 8px; background: #0b141e; color: #e7edf5; }
    .onboarding-api-status { display: inline-block; margin-left: 8px; color: #9eacbb; font-size: 12px; }
    .onboarding-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
    .onboarding-footer button { padding: 10px 16px; border-radius: 10px; border: 1px solid #42566d; background: #172333; color: #dce7f2; cursor: pointer; }
    .onboarding-footer .primary { border-color: #e1842f; background: #d87525; color: white; }
    .onboarding-check { color: #8ed6a5 !important; }
    .onboarding-warning { color: #f0b36a !important; }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.className = "onboarding-overlay";
  overlay.innerHTML = `
    <section class="onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <h2 id="onboarding-title">欢迎使用 DeepSeek Codex</h2>
      <p class="onboarding-lead">首次使用只需完成下面几项检查。安装和使用均无需另行安装或开启代理软件，应用会自动完成 DeepSeek 网络连接。API 密钥不会被本软件读取、上传或自动复制。</p>
      <div class="onboarding-step"><b class="onboarding-number">1</b><div><strong>自动检查 Codex CLI</strong><span data-codex-status>正在检查…</span><br><button class="onboarding-action" data-install-codex>一键安装 Codex CLI</button><button class="onboarding-action" data-check-codex>重新检查</button></div></div>
      <div class="onboarding-step"><b class="onboarding-number">2</b><div><strong>粘贴 DeepSeek API Key</strong><span>只需粘贴以 sk- 开头的 Key，软件会自动写入专用配置并重启连接。不会显示完整 Key。</span><br><input class="onboarding-api-input" type="password" placeholder="粘贴 API Key（sk-...）" autocomplete="off"><button class="onboarding-action" data-save-api>保存并测试</button><span class="onboarding-api-status"></span></div></div>
      <div class="onboarding-step"><b class="onboarding-number">3</b><div><strong>自动测试连接</strong><span data-connection-status>正在读取当前连接状态…</span><br><button class="onboarding-action" data-test-connection>重新检测基础接口</button><button class="onboarding-action" data-test-task>发送实际测试任务</button></div></div>
      <div class="onboarding-step"><b class="onboarding-number">4</b><div><strong>默认设置</strong><span>进入软件后，可在输入框左侧选择电脑访问权限，选择会被记住。</span></div></div>
      <div class="onboarding-footer"><button data-skip>稍后设置</button><button class="primary" data-finish>完成并进入</button></div>
    </section>`;
  document.body.appendChild(overlay);

  const status = overlay.querySelector("[data-connection-status]");
  const check = async () => {
    status.textContent = "正在检测…";
    try {
      const current = await window.deepseekCodex.getAgentState();
      const result = await window.deepseekCodex.testDeepSeekConnection();
      status.innerHTML = `网络：${result.network}（未验证实际 Codex 任务）<br>API Key：${result.auth}<br>Agent：${current?.status === "ready" ? "服务已连接，任务待验证" : current?.status || "未连接"}`;
      status.classList.remove("onboarding-check");
      status.classList.toggle("onboarding-warning", Boolean(result.ok && current?.status === "ready"));
      return result;
    } catch (error) { status.textContent = `检测失败：${error.message || "无法读取状态"}`; }
  };
  const codexStatus = overlay.querySelector("[data-codex-status]");
  const apiInput = overlay.querySelector(".onboarding-api-input");
  const apiStatus = overlay.querySelector(".onboarding-api-status");
  const checkCodex = async () => {
    codexStatus.textContent = "正在检查…";
    try {
      const setup = await window.deepseekCodex.getCodexSetupStatus();
      codexStatus.textContent = setup.codexInstalled ? "已找到 Codex CLI，可以继续。" : "未找到 Codex CLI，请先安装 Codex 后再重试。";
      codexStatus.classList.toggle("onboarding-check", setup.codexInstalled);
      if (setup.apiConfigured) apiStatus.textContent = "已检测到现有 API 配置，可直接测试连接。";
    } catch (error) { codexStatus.textContent = `检查失败：${error.message || "无法读取状态"}`; }
  };
  overlay.querySelector("[data-install-codex]").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    codexStatus.textContent = "正在从安装包内置资源安装，请稍候…";
    try {
      await window.deepseekCodex.installCodexCli();
      codexStatus.textContent = "Codex CLI 已安装，可以继续。";
      codexStatus.classList.add("onboarding-check");
    } catch (error) {
      codexStatus.textContent = error.message || "安装失败，请重试或联系管理员。";
    } finally { button.disabled = false; }
  });
  overlay.querySelector("[data-check-codex]").addEventListener("click", checkCodex);
  overlay.querySelector("[data-save-api]").addEventListener("click", async () => {
    apiStatus.textContent = "正在保存并重连…";
    try {
      await window.deepseekCodex.configureDeepSeekApi(apiInput.value);
      apiInput.value = "";
      apiStatus.textContent = "已保存，正在测试连接…";
      const result = await check();
      apiStatus.textContent = result?.ok ? "测试完成，基础接口和 API Key 正常；实际 Codex 任务请进入主界面验证。" : "测试完成，但基础接口或 API Key 未通过。";
    } catch (error) { apiStatus.textContent = error.message || "保存失败，请检查 API Key"; }
  });
  overlay.querySelector("[data-test-connection]").addEventListener("click", check);
  overlay.querySelector("[data-test-task]").addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    status.classList.remove("onboarding-check");
    status.classList.add("onboarding-warning");
    status.innerHTML = "正在发送实际 Codex 测试任务，请稍候…";
    try {
      const result = await window.deepseekCodex.runOnboardingTaskTest();
      const seconds = Math.max(0.1, (Number(result.durationMs || 0) / 1000)).toFixed(1);
      status.textContent = `${result.message} · 耗时 ${seconds} 秒`;
      status.classList.remove("onboarding-warning");
      status.classList.add("onboarding-check");
    } catch (error) {
      status.innerHTML = `实际 Codex 任务失败：${error.message || "流式连接中断"}<br>请检查网络后重试；应用会自动完成连接，无需另行开启代理软件。`;
    } finally { button.disabled = false; }
  });
  const close = async () => { await window.deepseekCodex.completeOnboarding(); overlay.remove(); style.remove(); };
  overlay.querySelector("[data-skip]").addEventListener("click", close);
  overlay.querySelector("[data-finish]").addEventListener("click", close);
  checkCodex();
  check();
}

setTimeout(maybeShowOnboarding, 900);

let busy = false;
let currentAssistantBubble = null;
let lastTurnRequest = null;
let selectedThreadId = null;
let pendingThreadSelection = false;
const runtimeTasks = new Map();

const RUNTIME_ACTIVE_STATUSES = new Set([
  "starting",
  "running",
  "waitingApproval",
  "stopping"
]);

function isRuntimeTaskActive(status) {
  return RUNTIME_ACTIVE_STATUSES.has(status);
}

function isRuntimeTaskInputLocked(task) {
  return Boolean(
    task &&
    (isRuntimeTaskActive(task.status) ||
      task.status === "queued")
  );
}

function taskEventBelongsToSelectedTask(data) {
  if (!data?.threadId) return true;

  if (!selectedThreadId) {
    return pendingThreadSelection;
  }

  return data.threadId === selectedThreadId;
}

function updateRuntimeTaskDecorations() {
  document
    .querySelectorAll(".thread-history-item")
    .forEach(item => {
      const task = runtimeTasks.get(item.dataset.threadId);
      let status = item.querySelector(
        ".thread-history-runtime-status"
      );

      if (!task || !task.status || task.status === "idle") {
        status?.remove();
        delete item.dataset.runtimeStatus;
        return;
      }

      if (!status) {
        status = document.createElement("span");
        status.className = "thread-history-runtime-status";
        const name = item.querySelector(".thread-history-name");
        name?.prepend(status);
      }

      item.dataset.runtimeStatus = task.status;
      status.dataset.status = task.status;
      status.title =
        task.status === "queued"
          ? "排队等待执行"
          : task.status === "waitingApproval"
            ? "等待审批"
            : task.status === "error"
              ? "执行失败"
              : task.status === "completed"
                ? "已完成"
                : "执行中";
    });
}

function updateSelectedTaskUi() {
  const task = selectedThreadId
    ? runtimeTasks.get(selectedThreadId)
    : null;

  busy = Boolean(task && isRuntimeTaskActive(task.status));

  if (busy) {
    setSendButtonRunning(true);
    setTurnStatus(
      task.status === "waitingApproval"
        ? "approval"
        : task.status === "stopping"
          ? "stopped"
          : "running",
      task.status === "waitingApproval"
        ? "等待审批"
        : task.status === "stopping"
          ? "正在停止"
      : "Running · 执行中"
    );
  } else if (task?.status === "queued") {
    setSendButtonRunning(false);
    sendButton.disabled = true;
    setTurnStatus("thinking", "已排队等待执行");
  } else if (task?.status === "error") {
    setSendButtonRunning(false);
    setTurnStatus("error", "任务失败");
  } else if (task?.status === "interrupted") {
    setSendButtonRunning(false);
    setTurnStatus("stopped", "已停止");
  } else if (sendButton.dataset.mode === "stop") {
    setSendButtonRunning(false);
  } else {
    sendButton.disabled = false;
  }
}

function applyTaskListState(state) {
  for (const task of state?.tasks || []) {
    if (!task?.threadId) continue;
    runtimeTasks.set(task.threadId, task);
  }

  if (state?.focusedThreadId) {
    selectedThreadId = state.focusedThreadId;
  }

  updateRuntimeTaskDecorations();
  updateSelectedTaskUi();
}

function cloneAttachmentRecords(files = []) {
  return (Array.isArray(files) ? files : [])
    .filter(file => file && file.path)
    .map(file => ({
      path: file.path,
      name: file.name,
      ext: file.ext,
      size: file.size
    }));
}

function shortPath(fullPath) {
  if (!fullPath) return "未选择项目";

  const parts = fullPath.split(/[\\/]/);
  return parts[parts.length - 1] || fullPath;
}

function setProjectButtonPath(fullPath) {
  if (!projectButton) return;

  projectButton.dataset.projectPath = fullPath || "";

  const icon = document.createElement("i");
  icon.className = "ph ph-folder-simple";

  const label = document.createElement("span");
  label.textContent = fullPath
    ? shortPath(fullPath)
    : "选择项目";

  projectButton.replaceChildren(icon, label);
  projectButton.title = fullPath
    ? `打开项目文件夹：${fullPath}`
    : "选择本地项目";
}

function removeWelcome() {
  const welcome = document.querySelector(".welcome");
  if (welcome) {
    welcome.remove();
  }

  updateThemeDockState();
}

async function writeClipboardText(text) {
  const value = String(text || "");

  if (!value.trim()) {
    throw new Error("没有可复制的内容");
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "true");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();

  const copied = document.execCommand("copy");
  helper.remove();

  if (!copied) {
    throw new Error("系统剪贴板不可用");
  }
}

function addBubble(role, text = "") {
  removeWelcome();

  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "message-copy-button";
  copyButton.textContent = "复制";
  copyButton.title = "复制这条消息";
  copyButton.setAttribute("aria-label", "复制这条消息");

  copyButton.addEventListener("click", async event => {
    event.stopPropagation();

    try {
      await writeClipboardText(bubble.textContent);
      copyButton.textContent = "已复制";
      copyButton.dataset.copied = "true";

      setTimeout(() => {
        if (!copyButton.isConnected) return;
        copyButton.textContent = "复制";
        delete copyButton.dataset.copied;
      }, 1600);
    } catch (error) {
      alert("复制消息失败：" + error.message);
    }
  });

  row.appendChild(bubble);
  row.appendChild(copyButton);
  chat.appendChild(row);

  bubble._row = row;

  chat.scrollTop = chat.scrollHeight;

  return bubble;
}

function showRetryAction(bubble, request) {
  if (!bubble?._row || !request?.text) {
    return;
  }

  const row = bubble._row;
  const oldButton = row.querySelector(
    ".retry-turn-button"
  );

  if (oldButton) {
    oldButton.remove();
  }

  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.className = "retry-turn-button";
  retryButton.textContent = "重试";
  retryButton.title = "在当前 Thread 中重新发送上一条任务";

  retryButton.addEventListener("click", async event => {
    event.stopPropagation();

    if (busy) {
      return;
    }

    retryButton.disabled = true;
    retryButton.textContent = "重试中…";

    await sendMessage(
      {
        text: request.text,
        attachments: cloneAttachmentRecords(
          request.attachments
        )
      },
      {
        retry: true,
        retryButton
      }
    );
  });

  row.appendChild(retryButton);
}

const retryTurnStyle =
  document.createElement("style");

retryTurnStyle.textContent = `
.retry-turn-button {
  flex: 0 0 auto;
  padding: 5px 8px;
  border: 1px solid #6d8fc0;
  border-radius: 7px;
  background: #203149;
  color: #dbe9f8;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
}

.retry-turn-button:hover {
  background: #2b4c70;
}

.retry-turn-button:disabled {
  cursor: default;
  opacity: .65;
}
`;

document.head.appendChild(retryTurnStyle);

const messageClipboardStyle =
  document.createElement("style");

messageClipboardStyle.textContent = `
.message-row {
  align-items: flex-end;
  gap: 8px;
}

.message-copy-button {
  opacity: 0;
  flex: 0 0 auto;
  padding: 5px 8px;
  border: 1px solid #334150;
  border-radius: 7px;
  background: #151d27;
  color: #91a1b4;
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  transition: opacity .15s ease, color .15s ease, border-color .15s ease;
}

.message-row:hover .message-copy-button,
.message-copy-button:focus,
.message-copy-button[data-copied="true"] {
  opacity: 1;
}

.message-copy-button:hover,
.message-copy-button[data-copied="true"] {
  border-color: #6d8fc0;
  color: #e4edf7;
}
`;

document.head.appendChild(messageClipboardStyle);

function renderState(state) {
  if (!state) return;

  if (Array.isArray(state.tasks)) {
    applyTaskListState(state);
  }

  if (Object.prototype.hasOwnProperty.call(state, "focusedThreadId")) {
    selectedThreadId = state.focusedThreadId || null;
    if (selectedThreadId) {
      pendingThreadSelection = false;
    }
  }

  if (state.theme && state.theme !== currentTheme) {
    applyTheme(state.theme);
  }

  renderTokenUsage(state.tokenUsage);

  const modelName =
    state.model === "deepseek-v4-flash"
      ? "DeepSeek V4 Flash"
      : modelDisplayLabel(state.model);

  const modelShortName =
    modelDisplayLabel(state.model);

  const reasoning =
    reasoningDisplayLabel(state.reasoning);

  const network = state.embeddedProxy;
  if (networkStatusPill) {
    const networkState = network?.networkStatus || (network?.running ? "checking" : "error");
    networkStatusPill.classList.toggle("checking", networkState === "checking");
    networkStatusPill.classList.toggle("normal", networkState === "ok");
    networkStatusPill.classList.toggle("error", networkState === "error");
    networkStatusPill.textContent = networkState === "ok" ? "网络正常" : networkState === "error" ? "联网失败" : "网络检测中";
  }

  gitReviewCenter?.setProjectPath(
    state.projectPath || null
  );

  updateTopbarThreadTitle(state.projectPath);

  if (state.status === "ready") {
    modelPill.innerHTML =
      `<span class="dot"></span> ${modelShortName} · ${reasoning} · 已连接`;
  } else if (state.status === "starting") {
    modelPill.innerHTML =
      `<span class="dot"></span> ${modelShortName} · 正在连接`;
  } else if (state.status === "reconnecting") {
    modelPill.innerHTML =
      `<span class="dot warning-dot"></span> ${modelShortName} · 自动重连中`;
  } else {
    modelPill.textContent =
      `${modelShortName} · ` + (state.message || "未连接");
  }

  sidebarModel.innerHTML = `
    <div class="sidebar-model-title">
      <i class="ph ph-lightning"></i>
      <span>${modelName}</span>
    </div>
    <div class="model-small">
      ${
        state.status === "ready"
          ? `${reasoning} reasoning · 已连接`
          : state.message
      }
    </div>
  `;

  if (sidebarOrbStatus) {
    sidebarModel.appendChild(sidebarOrbStatus);
  }

  if (state.projectPath) {
    setProjectButtonPath(state.projectPath);
  }
}

async function sendMessage(request = null, options = {}) {
  const isRetry = Boolean(options.retry);
  const text = request?.text
    ? String(request.text).trim()
    : textarea.value.trim();
  const attachments = request
    ? cloneAttachmentRecords(request.attachments)
    : cloneAttachmentRecords(selectedAttachments);

  const selectedTask = selectedThreadId
    ? runtimeTasks.get(selectedThreadId)
    : null;

  const taskIsBusy = Boolean(selectedTask && isRuntimeTaskActive(selectedTask.status));
  if (!text || taskIsBusy || isRuntimeTaskInputLocked(selectedTask)) {
    return false;
  }

  lastTurnRequest = {
    text,
    attachments,
    threadId: selectedThreadId
  };

  busy = true;
  pendingThreadSelection = !selectedThreadId;
  sendButton.disabled = true;
  setTurnStatus("thinking", "Thinking · 准备任务");
  currentProgressPanel = null;
  currentProgressSteps = [];

  addBubble(
    "user",
    isRetry ? `↻ 重试：${text}` : text
  );

  if (!isRetry) {
    textarea.value = "";
  }

  currentAssistantBubble =
    addBubble("assistant", "正在思考…");

  try {
    const result = await window.deepseekCodex.sendMessage(
      text,
      attachments,
      {
        retry: isRetry,
        threadId: selectedThreadId,
        permissionMode
      }
    );

    if (result?.threadId) {
      selectedThreadId = result.threadId;
      updateTopbarThreadTitle();
      pendingThreadSelection = false;
      lastTurnRequest.threadId = result.threadId;
    }

    if (result?.queued) {
      setTurnStatus("thinking", "已排队等待执行");
    }

    if (options.retryButton) {
      options.retryButton.textContent =
        "已发起";
    }

    return true;
  } catch (error) {
    currentAssistantBubble.textContent =
      "发送失败：" + error.message;

    try {
      const retryAttachments =
        await window.deepseekCodex
          .getRetryAttachments();

      if (retryAttachments.length) {
        lastTurnRequest.attachments =
          retryAttachments;
      }
    } catch {
      // 保留原始附件记录，等待用户重新选择。
    }

    showRetryAction(
      currentAssistantBubble,
      lastTurnRequest
    );

    if (options.retryButton) {
      options.retryButton.disabled = false;
      options.retryButton.textContent = "重试";
    }

    busy = false;
    sendButton.disabled = false;
    setTurnStatus("error", "发送失败");
    currentAssistantBubble = null;

    return false;
  }
}

projectButton.addEventListener("click", async () => {
  const projectPath = projectButton.dataset.projectPath;

  if (projectPath) {
    try {
      await window.deepseekCodex.openProjectFolder(projectPath);
    } catch (error) {
      alert("打开项目文件夹失败：" + error.message);
    }
    return;
  }

  const selectedPath =
    await window.deepseekCodex.selectProject();

  if (!selectedPath) return;

  setProjectButtonPath(selectedPath);

  projectName.textContent =
    shortPath(selectedPath);
});

chat.addEventListener("click", event => {
  const quickAction = event.target.closest(".quick[data-prompt]");

  if (!quickAction || !chat.contains(quickAction)) return;

  textarea.value = quickAction.dataset.prompt || "";
  textarea.dispatchEvent(
    new Event("input", { bubbles: true })
  );
  textarea.focus();
});

sendButton.addEventListener("click", sendMessage);

textarea.addEventListener("input", () => {
  const task = selectedThreadId ? runtimeTasks.get(selectedThreadId) : null;
  if (!task || (!isRuntimeTaskActive(task.status) && task.status !== "queued")) {
    if (sendButton.dataset.mode !== "stop") sendButton.disabled = false;
  }
});

if (textarea && !textarea.dataset.enterSendBound) {
  textarea.dataset.enterSendBound = "true";
  textarea.addEventListener("keydown", (event) => {
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!textarea.value.trim() || busy) return;
      sendButton.click();
    }
  });
}

window.deepseekCodex.onAgentDelta((data) => {
  if (data?.threadId && !selectedThreadId && pendingThreadSelection) {
    selectedThreadId = data.threadId;
    pendingThreadSelection = false;
  }

  if (!taskEventBelongsToSelectedTask(data)) return;

  setTurnStatus("thinking", "Thinking · 生成回复");

  if (!currentAssistantBubble) {
    currentAssistantBubble =
      addBubble("assistant", "");
  }

  if (
    currentAssistantBubble.textContent ===
    "正在思考…"
  ) {
    currentAssistantBubble.textContent = "";
  }

  currentAssistantBubble.textContent +=
    data.delta || "";

  chat.scrollTop = chat.scrollHeight;
});

window.deepseekCodex.onTurnState((state) => {
  if (state?.threadId && !selectedThreadId && pendingThreadSelection) {
    selectedThreadId = state.threadId;
    pendingThreadSelection = false;
  }

  if (!taskEventBelongsToSelectedTask(state)) return;

  if (state.status === "started") {
    setTurnStatus("running", "Running · 执行中");
    return;
  }

  if (
    state.status === "completed" ||
    state.status === "failed" ||
    state.status === "interrupted" ||
    state.status === "error"
  ) {
    if (state.status === "completed") {
      finishProgressPanel("completed", "执行完成");
    } else if (state.status === "interrupted") {
      finishProgressPanel("stopped", "已停止");
    } else {
      finishProgressPanel("error", "执行失败");
    }

    if (state.status === "completed") {
      setTurnStatus("completed", "已完成");
    } else if (state.status === "interrupted") {
      setTurnStatus("stopped", "已停止");
    } else {
      setTurnStatus("error", "任务失败");
    }

    busy = false;
    sendButton.disabled = false;

    if (
      state.status === "failed" &&
      currentAssistantBubble
    ) {
      currentAssistantBubble.textContent +=
        "\n\n任务失败：" +
        (state.error?.message || "未知错误");

      showRetryAction(
        currentAssistantBubble,
        lastTurnRequest
      );
    }

    if (state.status === "completed") {
      lastTurnRequest = null;
    }

    currentAssistantBubble = null;
  }
});

window.deepseekCodex.onAgentState((state) => {
  renderState(state);

  if (state?.status === "ready" && !busy) {
    setTurnStatus("idle", "空闲");
  } else if (state?.status === "offline") {
    setTurnStatus("offline", "连接断开");
  } else if (state?.status === "reconnecting") {
    setTurnStatus(
      "reconnecting",
      state.message || "自动重连中"
    );
  } else if (state?.status === "error") {
    setTurnStatus("error", "连接错误");
  }

  if (
    state?.status === "ready" &&
    state.projectPath
  ) {
    setTimeout(
      restoreHistoricalUi,
      50
    );
  }
});

window.deepseekCodex
  .getAgentState()
  .then(renderState);

window.deepseekCodex.onTaskList((state) => {
  applyTaskListState(state);
});

window.deepseekCodex.onTaskState((task) => {
  if (!task?.threadId) return;

  if (!selectedThreadId || selectedThreadId === task.threadId) {
    updateSidebarOrbStatus(task.status);
  }

  runtimeTasks.set(task.threadId, task);

  if (!selectedThreadId || selectedThreadId === task.threadId) {
    renderSideTaskPanel(task);
  }

  if (!selectedThreadId && pendingThreadSelection) {
    selectedThreadId = task.threadId;
    pendingThreadSelection = false;
  }

  if (selectedThreadId === task.threadId) {
    updateTopbarThreadTitle(task.projectPath || "");
  }

  updateRuntimeTaskDecorations();
  updateSelectedTaskUi();

  if (selectedThreadId === task.threadId) {
    renderTokenUsage(task.tokenUsage || null);
  }

  if (
    selectedThreadId === task.threadId &&
    task.status === "queued"
  ) {
    setTurnStatus("thinking", "已排队等待执行");
  }
});

const taskNoticeStyle = document.createElement("style");
taskNoticeStyle.textContent = `
.task-runtime-notice {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 30;
  max-width: min(460px, calc(100vw - 44px));
  padding: 11px 14px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 62%, var(--theme-border-strong));
  border-radius: 10px;
  background: color-mix(in srgb, var(--theme-surface-alt) 94%, transparent);
  color: var(--theme-text);
  box-shadow: 0 16px 40px rgba(0, 0, 0, .28);
  font-size: 12px;
  line-height: 1.55;
}
`;
document.head.appendChild(taskNoticeStyle);

function showTaskRuntimeNotice(message) {
  if (!message) return;

  const notice = document.createElement("div");
  notice.className = "task-runtime-notice";
  notice.textContent = message;
  document.body.appendChild(notice);

  setTimeout(() => {
    notice.remove();
  }, 5200);
}

window.deepseekCodex.onTaskConflictWarning((data) => {
  showTaskRuntimeNotice(
    data.message ||
      "当前项目已有其他任务执行中，同时修改同一项目可能产生冲突。"
  );
});

// ===== Codex 审批卡片 =====

const approvalStyle = document.createElement("style");

approvalStyle.textContent = `
.approval-card {
  max-width: 720px;
  margin: 18px 0;
  padding: 18px;
  background: #151c25;
  border: 1px solid #344253;
  border-radius: 14px;
}

.approval-header {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
}

.approval-icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #29374a;
}

.approval-reason {
  color: #9ba8b9;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 12px;
}

.approval-command {
  padding: 12px 14px;
  background: #0b1016;
  border: 1px solid #26313d;
  border-radius: 10px;
  font-family: Consolas, monospace;
  font-size: 13px;
  color: #dbe6f3;
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 14px;
}

.approval-actions {
  display: flex;
  gap: 10px;
}

.approval-btn {
  border-radius: 9px;
  padding: 8px 15px;
  cursor: pointer;
  font-size: 13px;
  border: 1px solid #354252;
}

.approval-btn.allow {
  background: #eef3f8;
  color: #111820;
}

.approval-btn.decline {
  background: transparent;
  color: #d6deea;
}

.approval-btn:disabled {
  opacity: .45;
  cursor: default;
}

.approval-result {
  margin-top: 10px;
  font-size: 12px;
  color: #8d9aac;
}
`;

document.head.appendChild(approvalStyle);

function approvalDetail(data) {
  if (data.type === "command") {
    if (typeof data.command === "string") {
      return data.command || "Codex 请求执行命令";
    }

    if (data.command) {
      return JSON.stringify(data.command, null, 2);
    }

    return "Codex 请求执行命令";
  }

  if (data.type === "file") {
    return data.grantRoot
      ? `允许修改：${data.grantRoot}`
      : "Codex 请求修改当前项目文件";
  }

  return "Codex 请求执行操作";
}

function showApprovalCard(data) {
  removeWelcome();

  const card = document.createElement("div");
  card.className = "approval-card";

  const header = document.createElement("div");
  header.className = "approval-header";
  header.innerHTML = `
    <span class="approval-icon">!</span>
    <span>${data.title || "需要你的批准"}</span>
  `;

  const reason = document.createElement("div");
  reason.className = "approval-reason";
  reason.textContent =
    data.reason ||
    "Codex 需要你的允许才能继续执行这个操作。";

  const detail = document.createElement("div");
  detail.className = "approval-command";
  detail.textContent = approvalDetail(data);

  const actions = document.createElement("div");
  actions.className = "approval-actions";

  const allowButton = document.createElement("button");
  allowButton.className = "approval-btn allow";
  allowButton.textContent = "允许一次";

  const declineButton = document.createElement("button");
  declineButton.className = "approval-btn decline";
  declineButton.textContent = "拒绝";

  const result = document.createElement("div");
  result.className = "approval-result";

  async function respond(decision) {
    allowButton.disabled = true;
    declineButton.disabled = true;

    result.textContent =
      decision === "accept"
        ? "正在允许此操作…"
        : "正在拒绝此操作…";

    try {
      await window.deepseekCodex.respondApproval(
        data.requestId,
        decision,
        {
          threadId: data.threadId,
          turnId: data.turnId,
          itemId: data.itemId
        }
      );

      result.textContent =
        decision === "accept"
          ? "✓ 已允许，Codex 正在继续执行"
          : "× 已拒绝此操作";

      setTurnStatus(
        decision === "accept" ? "running" : "stopped",
        decision === "accept"
          ? "Running · 继续执行"
          : "已拒绝"
      );
    } catch (error) {
      result.textContent =
        "审批失败：" + error.message;

      allowButton.disabled = false;
      declineButton.disabled = false;
    }
  }

  allowButton.addEventListener("click", () => {
    respond("accept");
  });

  declineButton.addEventListener("click", () => {
    respond("decline");
  });

  actions.appendChild(allowButton);
  actions.appendChild(declineButton);

  card.appendChild(header);
  card.appendChild(reason);
  card.appendChild(detail);
  card.appendChild(actions);
  card.appendChild(result);

  chat.appendChild(card);
  chat.scrollTop = chat.scrollHeight;
}

window.deepseekCodex.onApprovalRequest((data) => {
  if (data?.threadId && !selectedThreadId && pendingThreadSelection) {
    selectedThreadId = data.threadId;
    pendingThreadSelection = false;
  }

  if (!taskEventBelongsToSelectedTask(data)) return;

  setTurnStatus("approval", "等待审批");
  showApprovalCard(data);
});


// ===== Agent 活动过程显示 =====

const activityCards = new Map();
let currentProgressPanel = null;
let currentProgressSteps = [];
let activityStartedAt = null;
let activityFinishedAt = null;

function formatActivityDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `耗时 ${minutes} 分 ${seconds} 秒` : `耗时 ${seconds} 秒`;
}

function updateActivitySummary() {
  const summary = chat.querySelector(".agent-activity-summary");
  if (!summary || !activityStartedAt) return;
  const end = activityFinishedAt || Date.now();
  summary.querySelector("span").textContent = formatActivityDuration(end - activityStartedAt);
}

function getActivityStack() {
  let stack = chat.querySelector(".agent-activity-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "agent-activity-stack";
    chat.insertBefore(stack, chat.firstChild);
    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "agent-activity-summary";
    summary.innerHTML = `<span>耗时 0 秒</span><i class="ph ph-caret-right"></i>`;
    summary.addEventListener("click", () => {
      const expanded = stack.classList.toggle("details-open");
      summary.querySelector("i").className = expanded ? "ph ph-caret-down" : "ph ph-caret-right";
      stack.querySelectorAll(".agent-activity-card").forEach(card => {
        card.classList.toggle("collapsed", !expanded);
        card._expanded = expanded;
      });
    });
    stack.appendChild(summary);
  }
  return stack;
}

function normalizeProgressStep(item, index) {
  if (typeof item === "string") {
    return {
      step: item,
      status: "pending",
      index
    };
  }

  const rawStatus =
    String(item?.status || "pending").toLowerCase();

  let status = "pending";

  if (
    rawStatus.includes("complete") ||
    rawStatus.includes("done")
  ) {
    status = "completed";
  } else if (
    rawStatus.includes("progress") ||
    rawStatus.includes("active") ||
    rawStatus.includes("running")
  ) {
    status = "active";
  } else if (
    rawStatus.includes("fail") ||
    rawStatus.includes("error")
  ) {
    status = "error";
  }

  return {
    step:
      item?.step ||
      item?.title ||
      item?.description ||
      `执行步骤 ${index + 1}`,
    status,
    index
  };
}

function ensureProgressPanel() {
  if (currentProgressPanel?.isConnected) {
    return currentProgressPanel;
  }

  removeWelcome();

  const card = document.createElement("div");
  card.className = "agent-progress-card";

  const header = document.createElement("div");
  header.className = "agent-progress-header";

  const title = document.createElement("strong");
  title.textContent = "当前执行步骤";

  const status = document.createElement("span");
  status.className = "agent-progress-status";
  status.textContent = "准备中";

  header.appendChild(title);
  header.appendChild(status);

  const explanation = document.createElement("div");
  explanation.className = "agent-progress-explanation";

  const list = document.createElement("div");
  list.className = "agent-progress-list";

  const live = document.createElement("div");
  live.className = "agent-progress-live";

  card.appendChild(header);
  card.appendChild(explanation);
  card.appendChild(list);
  card.appendChild(live);

  card._status = status;
  card._explanation = explanation;
  card._list = list;
  card._live = live;

  getActivityStack().appendChild(card);
  currentProgressPanel = card;

  return card;
}

function renderProgressPlan(data) {
  const panel = ensureProgressPanel();

  currentProgressSteps =
    (Array.isArray(data.plan) ? data.plan : [])
      .map(normalizeProgressStep);

  panel._explanation.textContent =
    data.explanation || "Agent 正在整理执行计划";

  panel._list.innerHTML = "";

  let completed = 0;

  currentProgressSteps.forEach((item) => {
    if (item.status === "completed") {
      completed += 1;
    }

    const row = document.createElement("div");
    row.className =
      `agent-progress-step ${item.status}`;

    const icon = document.createElement("span");
    icon.className = "agent-progress-step-icon";
    icon.textContent =
      item.status === "completed"
        ? "✓"
        : item.status === "active"
          ? "•"
          : item.status === "error"
            ? "!"
            : String(item.index + 1);

    const text = document.createElement("span");
    text.textContent = item.step;

    row.appendChild(icon);
    row.appendChild(text);
    panel._list.appendChild(row);
  });

  panel._status.textContent = currentProgressSteps.length
    ? `${completed}/${currentProgressSteps.length} 已完成`
    : "计划中";

  chat.scrollTop = chat.scrollHeight;
}

function updateProgressLive(message, state = "active") {
  const panel = ensureProgressPanel();

  panel._live.textContent = message || "正在执行…";
  panel._live.dataset.state = state;

  if (!currentProgressSteps.length) {
    panel._status.textContent =
      state === "error" ? "执行错误" : "执行中";
  }

  chat.scrollTop = chat.scrollHeight;
}

function finishProgressPanel(state, label) {
  if (!currentProgressPanel?.isConnected) {
    return;
  }

  currentProgressPanel.classList.remove(
    "completed",
    "stopped",
    "error"
  );
  currentProgressPanel.classList.add(state);
  currentProgressPanel._status.textContent = label;
  currentProgressPanel._live.textContent = label;
  currentProgressPanel._live.dataset.state = state;
}

const activityStyle = document.createElement("style");

activityStyle.textContent = `
.agent-activity-card {
  max-width: 760px;
  margin: 12px 0;
  padding: 13px 15px;
  background: #0f161e;
  border: 1px solid #25313e;
  border-radius: 12px;
  font-size: 13px;
}

.agent-activity-stack {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: min(100%, 820px);
  margin: 0 auto 18px 0;
}

.agent-activity-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid #273442;
  color: #9daaba;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: left;
}
.agent-activity-summary:hover { color: #f0f4f8; }

.agent-activity-stack .agent-activity-card,
.agent-activity-stack .agent-progress-card,
.agent-activity-stack .agent-diff {
  width: 100%;
  margin-left: 0;
  margin-right: 0;
}

.agent-activity-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #dce5ef;
  cursor: pointer;
}

.agent-activity-icon {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: #1e2a38;
  color: #9db6d1;
}

.agent-activity-detail {
  margin-top: 8px;
  padding-left: 30px;
  color: #8f9cac;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.agent-command-output {
  margin-top: 10px;
  background: #080d12;
  border: 1px solid #202b36;
  border-radius: 8px;
  padding: 10px 12px;
  font-family: Consolas, monospace;
  font-size: 12px;
  color: #b8c6d5;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
}

.agent-activity-card.collapsed .agent-activity-detail,
.agent-activity-card.collapsed .agent-command-output {
  display: none !important;
}

.agent-activity-card:not(.collapsed) .agent-activity-header::after {
  content: "⌃";
  margin-left: 8px;
  color: #8494a7;
  font-size: 12px;
}

.agent-activity-card.collapsed .agent-activity-header::after {
  content: "⌄";
  margin-left: 8px;
  color: #8494a7;
  font-size: 12px;
}

.agent-activity-card.completed {
  border-color: #294236;
}

.agent-activity-card.error {
  border-color: #61353b;
}

.agent-progress-card {
  max-width: 760px;
  margin: 12px 0;
  padding: 14px 16px;
  background: #121a24;
  border: 1px solid #30445b;
  border-radius: 12px;
}

.agent-progress-card.completed {
  border-color: #315b43;
}

.agent-progress-card.stopped {
  border-color: #765234;
}

.agent-progress-card.error {
  border-color: #713d45;
}

.agent-progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #dce7f2;
  font-size: 13px;
}

.agent-progress-status {
  color: #8fa5bc;
  font-size: 11px;
}

.agent-progress-explanation {
  margin-top: 7px;
  color: #8f9fb1;
  font-size: 12px;
}

.agent-progress-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 11px;
}

.agent-progress-step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #a9b8c8;
  font-size: 12px;
  line-height: 1.45;
}

.agent-progress-step-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #233143;
  color: #91a6bd;
  font-size: 10px;
}

.agent-progress-step.completed {
  color: #a8dbb8;
}

.agent-progress-step.completed .agent-progress-step-icon {
  background: #234a32;
  color: #9de2b7;
}

.agent-progress-step.active {
  color: #d9c18c;
}

.agent-progress-step.active .agent-progress-step-icon {
  background: #594721;
  color: #f2cf8c;
}

.agent-progress-step.error {
  color: #ffaaa8;
}

.agent-progress-step.error .agent-progress-step-icon {
  background: #5e2931;
  color: #ffaaa8;
}

.agent-progress-live {
  margin-top: 11px;
  padding-top: 9px;
  border-top: 1px solid #273648;
  color: #8fafd0;
  font-size: 11px;
}

.agent-progress-live[data-state="completed"] {
  color: #9de2b7;
}

.agent-progress-live[data-state="stopped"],
.agent-progress-live[data-state="error"] {
  color: #ffaaa8;
}

.agent-activity-status {
  margin-left: auto;
  color: #798798;
  font-size: 12px;
}

.agent-diff {
  max-width: 760px;
  margin: 12px 0;
  background: #0b1118;
  border: 1px solid #273442;
  border-radius: 12px;
  overflow: hidden;
}

.agent-diff-title {
  padding: 10px 14px;
  border-bottom: 1px solid #273442;
  color: #b6c5d5;
  font-size: 13px;
  font-weight: 600;
}

.agent-diff pre {
  margin: 0;
  padding: 13px 15px;
  max-height: 300px;
  overflow: auto;
  color: #aebdcc;
  font-size: 12px;
  font-family: Consolas, monospace;
  white-space: pre-wrap;
}
`;

document.head.appendChild(activityStyle);

function activityTitle(data) {
  if (data.kind === "command") {
    return data.phase === "completed"
      ? "命令执行完成"
      : "正在执行命令";
  }

  if (data.kind === "file") {
    return data.phase === "completed"
      ? "文件修改完成"
      : "正在修改文件";
  }

  return "Codex 正在工作";
}

function createActivityCard(data) {
  removeWelcome();
  if (!activityStartedAt) activityStartedAt = Date.now();
  activityFinishedAt = null;
  updateActivitySummary();

  const card = document.createElement("div");
  card.className = "agent-activity-card collapsed";

  const header = document.createElement("div");
  header.className = "agent-activity-header";

  const icon = document.createElement("span");
  icon.className = "agent-activity-icon";
  icon.textContent =
    data.kind === "command"
      ? ">"
      : data.kind === "file"
      ? "✎"
      : "•";

  const title = document.createElement("span");
  title.textContent = activityTitle(data);

  const status = document.createElement("span");
  status.className = "agent-activity-status";
  status.textContent = "进行中";

  header.appendChild(icon);
  header.appendChild(title);
  header.appendChild(status);

  header.addEventListener("click", () => {
    card.classList.toggle("collapsed");
    card._expanded = !card.classList.contains("collapsed");
  });

  const detail = document.createElement("div");
  detail.className = "agent-activity-detail";

  if (data.kind === "command") {
    detail.textContent =
      typeof data.command === "string"
        ? data.command
        : JSON.stringify(data.command || "", null, 2);
  }

  if (data.kind === "file") {
    if (Array.isArray(data.changes) && data.changes.length) {
      detail.textContent = data.changes
        .map((change) => {
          if (typeof change === "string") return change;

          return (
            change.path ||
            change.filePath ||
            change.file ||
            JSON.stringify(change)
          );
        })
        .join("\n");
    } else {
      detail.textContent = "正在处理项目文件…";
    }
  }

  card.appendChild(header);
  card.appendChild(detail);

  if (data.kind === "command") {
    const output = document.createElement("div");
    output.className = "agent-command-output";
    output.style.display = "none";

    card.appendChild(output);

    card._output = output;
  }

  card._status = status;
  card._title = title;
  card._expanded = false;

  getActivityStack().appendChild(card);
  chat.scrollTop = chat.scrollHeight;

  if (data.itemId) {
    activityCards.set(data.itemId, card);
  }

  return card;
}

function updateCompletedActivity(data) {
  let card =
    data.itemId
      ? activityCards.get(data.itemId)
      : null;

  if (!card) {
    card = createActivityCard(data);
  }

  card.classList.add("completed");

  if (card._title) {
    card._title.textContent =
      activityTitle({
        ...data,
        phase: "completed"
      });
  }

  if (card._status) {
    if (
      data.kind === "command" &&
      data.exitCode !== undefined &&
      data.exitCode !== null
    ) {
      card._status.textContent =
        `完成 · Exit ${data.exitCode}`;
    } else {
      card._status.textContent = "完成";
    }
  }

  if (
    data.output &&
    card._output
  ) {
    card._output.style.display = card._expanded ? "block" : "none";
    card._output.textContent = data.output;
  }

  chat.scrollTop = chat.scrollHeight;
  updateActivitySummary();
}

function appendCommandOutput(data) {
  const card =
    data.itemId
      ? activityCards.get(data.itemId)
      : null;

  if (!card || !card._output) return;

  card._output.style.display = card._expanded ? "block" : "none";
  card._output.textContent += data.delta || "";

  card._output.scrollTop =
    card._output.scrollHeight;

  chat.scrollTop = chat.scrollHeight;
}

function showDiff(data) {
  if (!data.diff) return;

  removeWelcome();

  let diffBox =
    document.querySelector(".agent-diff.current");

  if (!diffBox) {
    diffBox = document.createElement("div");
    diffBox.className = "agent-diff current";

    getActivityStack().appendChild(diffBox);
  }

  const lines = data.diff.split(/\r?\n/);

  let fileName = "文件改动";
  let added = 0;
  let removed = 0;

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      fileName = line.substring(6);
    }

    if (
      line.startsWith("+") &&
      !line.startsWith("+++")
    ) {
      added++;
    }

    if (
      line.startsWith("-") &&
      !line.startsWith("---")
    ) {
      removed++;
    }
  }

  diffBox.innerHTML = "";

  const header =
    document.createElement("div");

  header.className =
    "diff-file-header";

  const file =
    document.createElement("span");

  file.className =
    "diff-file-name";

  file.textContent = fileName;

  const stats =
    document.createElement("span");

  stats.className =
    "diff-stats";

  stats.innerHTML = `
    <span class="diff-added">+${added}</span>
    <span class="diff-removed">-${removed}</span>
  `;

  header.appendChild(file);
  header.appendChild(stats);

  const body =
    document.createElement("div");

  body.className =
    "diff-code";

  lines.forEach((line) => {
    const row =
      document.createElement("div");

    row.className = "diff-line";

    if (
      line.startsWith("+") &&
      !line.startsWith("+++")
    ) {
      row.classList.add("addition");
    } else if (
      line.startsWith("-") &&
      !line.startsWith("---")
    ) {
      row.classList.add("deletion");
    } else if (
      line.startsWith("@@")
    ) {
      row.classList.add("hunk");
    } else if (
      line.startsWith("diff --git") ||
      line.startsWith("index ") ||
      line.startsWith("---") ||
      line.startsWith("+++")
    ) {
      row.classList.add("meta");
    }

    row.textContent = line;

    body.appendChild(row);
  });

  diffBox.appendChild(header);
  diffBox.appendChild(body);

  chat.scrollTop = chat.scrollHeight;
}

function showActivityError(data) {
  removeWelcome();

  const card =
    document.createElement("div");

  card.className =
    "agent-activity-card error";

  card.innerHTML = `
    <div class="agent-activity-header">
      <span class="agent-activity-icon">!</span>
      <span>执行过程中发生错误</span>
    </div>
    <div class="agent-activity-detail"></div>
  `;

  card.querySelector(
    ".agent-activity-detail"
  ).textContent =
    data.message || "未知错误";

  chat.appendChild(card);
  chat.scrollTop = chat.scrollHeight;
}

window.deepseekCodex.onActivity((data) => {
  if (!data) return;

  if (data.threadId && !selectedThreadId && pendingThreadSelection) {
    selectedThreadId = data.threadId;
    pendingThreadSelection = false;
  }

  if (!taskEventBelongsToSelectedTask(data)) return;

  if (
    data.kind === "command" &&
    data.phase === "started"
  ) {
    setTurnStatus("running", "Running · 执行命令");
    updateProgressLive(
      `正在执行命令：${data.command || "未命名命令"}`
    );
  } else if (
    data.kind === "file" &&
    data.phase === "started"
  ) {
    setTurnStatus("running", "Running · 修改文件");
    updateProgressLive("正在修改项目文件");
  } else if (data.kind === "plan") {
    setTurnStatus("thinking", "Thinking · 制定计划");
    renderProgressPlan(data);
    return;
  } else if (data.kind === "diff") {
    setTurnStatus("running", "Running · 整理改动");
    updateProgressLive("正在整理文件改动");
  } else if (data.kind === "error") {
    setTurnStatus("error", "执行错误");
    updateProgressLive(
      data.message || "执行过程中发生错误",
      "error"
    );
  }

  if (
    data.kind === "command" &&
    data.phase === "started"
  ) {
    createActivityCard(data);
    return;
  }

  if (
    data.kind === "command" &&
    data.phase === "completed"
  ) {
    updateCompletedActivity(data);
    updateProgressLive("命令执行完成，Agent 继续处理");
    return;
  }

  if (
    data.kind === "command-output"
  ) {
    appendCommandOutput(data);
    return;
  }

  if (
    data.kind === "file" &&
    data.phase === "started"
  ) {
    createActivityCard(data);
    return;
  }

  if (
    data.kind === "file" &&
    data.phase === "completed"
  ) {
    updateCompletedActivity(data);
    updateProgressLive("文件修改完成，Agent 继续处理");
    return;
  }

  if (data.kind === "diff") {
    showDiff(data);
    return;
  }

  if (data.kind === "error") {
    showActivityError(data);
  }
});



const enhancedDiffStyle =
  document.createElement("style");

enhancedDiffStyle.textContent = `
.diff-file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  border-bottom: 1px solid #273442;
  background: #101720;
}

.diff-file-name {
  font-size: 13px;
  font-weight: 650;
  color: #d9e3ed;
}

.diff-stats {
  display: flex;
  gap: 8px;
  font-family: Consolas, monospace;
  font-size: 12px;
}

.diff-added {
  color: #66d992;
}

.diff-removed {
  color: #f08080;
}

.diff-code {
  overflow: auto;
  max-height: 360px;
  padding: 7px 0;
  background: #0b1118;
  font-family: Consolas, monospace;
  font-size: 12px;
  line-height: 1.65;
}

.diff-line {
  min-height: 20px;
  padding: 0 14px;
  white-space: pre;
}

.diff-line.addition {
  color: #b9ebca;
  background: rgba(48, 160, 90, 0.14);
}

.diff-line.deletion {
  color: #ffc0c0;
  background: rgba(210, 65, 65, 0.14);
}

.diff-line.hunk {
  color: #87bbed;
  background: rgba(65, 115, 170, 0.10);
}

.diff-line.meta {
  color: #677789;
}
`;

document.head.appendChild(
  enhancedDiffStyle
);


// ===== 最近项目真实列表 =====

async function renderRecentProjects() {
  const projects =
    await window.deepseekCodex.getRecentProjects();

  const sectionTitle =
    Array.from(
      document.querySelectorAll(".section-title")
    ).find(
      (el) =>
        el.textContent.trim() === "最近项目"
    );

  if (!sectionTitle) return;

  let container =
    document.querySelector(
      ".recent-projects-container"
    );

  if (!container) {
    container =
      document.createElement("div");

    container.className =
      "recent-projects-container";

    sectionTitle.insertAdjacentElement(
      "afterend",
      container
    );
  }

  container.innerHTML = "";

  // 删除原来写死的项目
  document
    .querySelectorAll(
      ".sidebar > .project"
    )
    .forEach((el) => el.remove());

  if (!projects.length) {
    const empty =
      document.createElement("div");

    empty.className =
      "recent-project-empty";

    empty.textContent =
      "还没有最近项目";

    container.appendChild(empty);
    return;
  }

  projects.forEach((projectPath) => {
    const item =
      document.createElement("div");

    item.className = "project";

    item.dataset.projectPath =
      projectPath;

    // 鼠标悬停显示完整项目路径
    item.title =
      projectPath;

    const parts =
      projectPath.split(/[\\/]/);

    const projectName =
      parts[parts.length - 1] ||
      projectPath;

    item.textContent = projectName;
    item.title = projectPath;

    item.addEventListener(
      "click",
      async () => {
        try {
          const openedPath =
            await window.deepseekCodex
              .openRecentProject(
                projectPath
              );

          document
            .querySelectorAll(
              ".recent-projects-container .project"
            )
            .forEach(
              (el) =>
                el.classList.remove(
                  "active"
                )
            );

          item.classList.add("active");

          setProjectButtonPath(openedPath);

          projectNameElement =
            document.querySelector(
              ".project-name"
            );

          projectNameElement.textContent =
            shortPath(openedPath);

        } catch (error) {
          alert(
            "打开项目失败：" +
            error.message
          );
        }
      }
    );

    const menuButton =
      document.createElement("button");

    menuButton.className =
      "recent-project-menu-button";

    menuButton.type = "button";
    menuButton.textContent = "⋯";
    menuButton.title = "更多";

    menuButton.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        openRecentProjectMenu(
          menuButton,
          projectPath,
          projectName
        );
      }
    );

    item.appendChild(menuButton);

    container.appendChild(item);
  });
}

// 每次选新项目后刷新最近项目列表
projectButton.addEventListener(
  "click",
  () => {
    setTimeout(
      renderRecentProjects,
      500
    );
  }
);

// 软件启动时读取最近项目
renderRecentProjects();


const recentProjectStyle =
  document.createElement("style");

recentProjectStyle.textContent = `
.recent-projects-container {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.recent-projects-container .project {
  cursor: pointer;
  padding: 9px 10px;
  border-radius: 9px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.recent-projects-container .project:hover {
  background: #161f2b;
}

.recent-projects-container .project.active {
  background: #1a2636;
  color: #ffffff;
}

.recent-project-empty {
  color: #687789;
  font-size: 13px;
  padding: 8px 10px;
}
`;

document.head.appendChild(
  recentProjectStyle
);


// ===== 新建任务 =====

const newTaskButton =
  document.querySelector(".new-task");

const initialWelcomeHtml =
  document.querySelector(".welcome")
    ?.outerHTML || "";

newTaskButton.addEventListener(
  "click",
  async () => {
    try {
      await window.deepseekCodex.newTask();

      selectedThreadId = null;
      pendingThreadSelection = false;
      currentAssistantBubble = null;
      lastTurnRequest = null;
      busy = false;
      sendButton.disabled = false;
      textarea.value = "";

      activityCards.clear();
      activityStartedAt = null;
      activityFinishedAt = null;
      currentProgressPanel = null;
      currentProgressSteps = [];

      chat.innerHTML =
        initialWelcomeHtml ||
        `
        <div class="welcome">
          <img class="hero-title-image" src="assets/hero-title-reference-transparent.png" alt="今天想开发什么？">
          <p>
            已创建新的 DeepSeek Codex 任务。<br>
            当前项目保持不变，可以开始新的工作。
          </p>
        </div>
        `;

      applyTheme(currentTheme);
      chat.scrollTop = 0;

    } catch (error) {
      alert(
        "新建任务失败：" +
        error.message
      );
    }
  }
);


// ===== 历史任务列表 =====

function formatHistoryTime(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });
}

async function renderThreadHistory() {
  let history = [];

  try {
    history =
      await window.deepseekCodex.getThreadHistory();
  } catch (error) {
    console.error("读取历史任务失败", error);
    return;
  }

  const sidebar =
    document.querySelector(".sidebar");

  if (!sidebar) return;

  let title =
    document.querySelector(
      ".thread-history-title"
    );

  if (!title) {
    title =
      document.createElement("div");

    title.className =
      "section-title thread-history-title";

    title.textContent =
      "历史任务";

    const recentContainer =
      document.querySelector(
        ".recent-projects-container"
      );

    if (recentContainer) {
      recentContainer.insertAdjacentElement(
        "afterend",
        title
      );
    } else {
      sidebar.appendChild(title);
    }
  }

  let container =
    document.querySelector(
      ".thread-history-container"
    );

  if (!container) {
    container =
      document.createElement("div");

    container.className =
      "thread-history-container";

    title.insertAdjacentElement(
      "afterend",
      container
    );
  }

  container.innerHTML = "";

  if (!history.length) {
    const empty =
      document.createElement("div");

    empty.className =
      "thread-history-empty";

    empty.textContent =
      "还没有历史任务";

    container.appendChild(empty);
    return;
  }

  let currentHistoryGroup = "";

  history.slice(0, 20).forEach((record) => {

    const group =
      getThreadHistoryGroup(
        record.updatedAt
      );

    if (group !== currentHistoryGroup) {

      currentHistoryGroup = group;

      const groupTitle =
        document.createElement("div");

      groupTitle.className =
        "thread-history-group-title";

      groupTitle.dataset.historyGroup =
        group;

      groupTitle.textContent =
        group;

      container.appendChild(
        groupTitle
      );
    }

    const item =
      document.createElement("div");

    item.dataset.historyGroup =
      group;

    item.className =
      "thread-history-item";

    const runtimeTask = runtimeTasks.get(record.threadId);
    if (runtimeTask) {
      item.dataset.runtimeStatus = runtimeTask.status || "idle";
    }

    item.title =
      record.title || "新任务";

    const name =
      document.createElement("div");

    name.className =
      "thread-history-name";

    name.textContent =
      record.title || "新任务";

    const meta =
      document.createElement("div");

    meta.className =
      "thread-history-meta";

    meta.textContent =
      formatHistoryTime(
        record.updatedAt
      );

    item.dataset.threadId =
      record.threadId;

    item.dataset.threadTitle =
      record.title || "新任务";

    const menuButton =
      document.createElement("button");

    menuButton.className =
      "thread-history-menu-button";

    menuButton.type = "button";
    menuButton.textContent = "⋯";
    menuButton.title = "更多";

    menuButton.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();

        openThreadHistoryMenu(
          menuButton,
          record
        );
      }
    );

    item.appendChild(name);
    item.appendChild(meta);
    item.appendChild(menuButton);

    item.addEventListener(
      "click",
      async () => {
        try {
          const result =
            await window.deepseekCodex
              .resumeThread(
                record.threadId
              );

          document
            .querySelectorAll(
              ".thread-history-item"
            )
            .forEach((el) =>
              el.classList.remove(
                "active"
              )
            );

          item.classList.add("active");

          selectedThreadId =
            result.task?.threadId ||
            result.thread?.id ||
            record.threadId;
          projectName.textContent = record.title || "新任务";
          projectName.title = record.title || "新任务";
          pendingThreadSelection = false;

          if (result.task) {
            runtimeTasks.set(
              result.task.threadId,
              result.task
            );
          }

          if (result.task && !result.thread) {
            renderRuntimeTaskSnapshot(
              result.task,
              record
            );
          } else {
            renderRestoredThread(
              result.thread,
              record
            );
          }

          updateSelectedTaskUi();

          if (record.projectPath) {
            setProjectButtonPath(
              record.projectPath
            );

            updateTopbarThreadTitle(record.projectPath);
          }

          textarea.focus();

        } catch (error) {
          alert(
            "恢复历史任务失败：" +
            error.message
          );
        }
      }
    );

    container.appendChild(item);
  });

  updateRuntimeTaskDecorations();
}

renderThreadHistory();


const threadHistoryStyle =
  document.createElement("style");

threadHistoryStyle.textContent = `
.thread-history-title {
  margin-top: 18px;
}

.thread-history-container {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--theme-accent) transparent;
}

.thread-history-container::-webkit-scrollbar {
  width: 9px;
}

.thread-history-container::-webkit-scrollbar-track {
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--theme-accent-surface) 38%, transparent), transparent);
  border-radius: 999px;
}

.thread-history-container::-webkit-scrollbar-thumb {
  min-height: 54px;
  border: 2px solid transparent;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--theme-accent-alt), var(--theme-accent)) padding-box;
  box-shadow: 0 0 12px color-mix(in srgb, var(--theme-accent) 42%, transparent);
}

.thread-history-container::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, var(--theme-text-strong), var(--theme-accent)) padding-box;
  box-shadow: 0 0 18px color-mix(in srgb, var(--theme-accent) 64%, transparent);
}

.thread-history-item {
  padding: 9px 10px;
  border-radius: 9px;
  cursor: pointer;
}

.thread-history-item:hover {
  background: #161f2b;
}

.thread-history-item.active {
  background: #1a2636;
}

.thread-history-name {
  color: #d7e0eb;
  font-size: 13px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.thread-history-runtime-status {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin: 0 6px 1px 0;
  border-radius: 50%;
  background: #7b8a9a;
  box-shadow: 0 0 8px rgba(123, 138, 154, .42);
}

.thread-history-runtime-status[data-status="running"],
.thread-history-runtime-status[data-status="starting"] {
  background: #6ad99a;
  box-shadow: 0 0 9px rgba(106, 217, 154, .65);
}

.thread-history-runtime-status[data-status="waitingApproval"] {
  background: #d9b66e;
  box-shadow: 0 0 9px rgba(217, 182, 110, .62);
}

.thread-history-runtime-status[data-status="queued"] {
  background: #8ca6c0;
}

.thread-history-runtime-status[data-status="error"] {
  background: #e27f7f;
  box-shadow: 0 0 9px rgba(226, 127, 127, .56);
}

.thread-history-meta {
  margin-top: 3px;
  color: #687789;
  font-size: 11px;
}

.thread-history-empty {
  padding: 8px 10px;
  color: #687789;
  font-size: 12px;
}

.history-restored-card {
  max-width: 680px;
  margin: 70px auto;
  padding: 22px;
  background: #111820;
  border: 1px solid #293746;
  border-radius: 14px;
}

.history-restored-title {
  color: #8de0ae;
  font-weight: 700;
  margin-bottom: 10px;
}

.history-restored-name {
  font-size: 18px;
  font-weight: 650;
  margin-bottom: 8px;
}

.history-restored-tip {
  color: #8795a7;
  line-height: 1.6;
}
`;

document.head.appendChild(
  threadHistoryStyle
);


// ===== 历史任务自动刷新 =====

window.deepseekCodex.onTurnState((state) => {
  if (
    state.status === "completed" ||
    state.status === "failed" ||
    state.status === "interrupted" ||
    state.status === "error"
  ) {
    setTimeout(() => {
      renderThreadHistory();
    }, 200);
  }
});


// ===== 恢复并显示历史 Thread 内容 =====

function getHistoryUserText(item) {
  if (!Array.isArray(item?.content)) {
    return "";
  }

  return item.content
    .map((part) => {
      if (part?.type === "text") {
        return part.text || "";
      }

      if (
        part?.type === "image" ||
        part?.type === "localImage"
      ) {
        return "[图片]";
      }

      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function renderRestoredThread(thread, record) {
  activityCards.clear();
  activityStartedAt = null;
  activityFinishedAt = null;
  currentAssistantBubble = null;
  lastTurnRequest = null;

  chat.innerHTML = "";

  const banner =
    document.createElement("div");

  banner.className =
    "history-resume-banner";

  banner.innerHTML = `
    <span>✓</span>
    <span>已恢复历史任务</span>
  `;

  chat.appendChild(banner);

  const turns =
    Array.isArray(thread?.turns)
      ? thread.turns
      : [];

  if (!turns.length) {
    const empty =
      document.createElement("div");

    empty.className =
      "history-empty-content";

    empty.textContent =
      "这条历史任务没有可显示的聊天记录，但 Codex 上下文已经恢复。";

    chat.appendChild(empty);
    return;
  }

  for (const turn of turns) {
    const items =
      Array.isArray(turn?.items)
        ? turn.items
        : [];

    for (const item of items) {

      // 用户消息
      if (item?.type === "userMessage") {
        const text =
          getHistoryUserText(item);

        if (text) {
          addBubble("user", text);
        }

        continue;
      }

      // DeepSeek 最终回复
      if (item?.type === "agentMessage") {
        if (item.text) {
          addBubble(
            "assistant",
            item.text
          );
        }

        continue;
      }

      // 历史命令
      if (item?.type === "commandExecution") {
        const data = {
          kind: "command",
          phase: "completed",
          itemId: item.id,
          command: item.command || "",
          cwd: item.cwd || "",
          status:
            item.status ||
            "completed",
          exitCode: item.exitCode,
          output:
            item.aggregatedOutput ||
            ""
        };

        createActivityCard(data);
        updateCompletedActivity(data);

        continue;
      }

      // 历史文件修改
      if (item?.type === "fileChange") {
        const data = {
          kind: "file",
          phase: "completed",
          itemId: item.id,
          changes:
            item.changes || [],
          status:
            item.status ||
            "completed"
        };

        createActivityCard(data);
        updateCompletedActivity(data);

        continue;
      }

      // reasoning 不显示
      // 只显示正常聊天与操作结果
    }
  }

  chat.scrollTop =
    chat.scrollHeight;
}

function renderRuntimeTaskSnapshot(task, record) {
  activityCards.clear();
  currentAssistantBubble = null;
  currentProgressPanel = null;
  currentProgressSteps = [];
  lastTurnRequest = null;

  const hasHistoryThread = Boolean(
    task.historyThread &&
    Array.isArray(task.historyThread.turns)
  );

  if (hasHistoryThread) {
    // 先复用已有历史渲染逻辑，避免后台任务切换时丢失旧消息。
    renderRestoredThread(task.historyThread, record);
  } else {
    chat.innerHTML = "";

    const banner = document.createElement("div");
    banner.className = "history-resume-banner";
    banner.innerHTML = `
      <span>✓</span>
      <span>${task.status === "queued" ? "任务已排队" : "已切换到任务"}</span>
    `;
    chat.appendChild(banner);
  }

  for (const message of task.messages || []) {
    if (!message?.text) continue;
    addBubble(
      message.role === "user" ? "user" : "assistant",
      message.text
    );
  }

  for (const event of task.events || []) {
    if (!event || event.type !== "activity") continue;

    if (
      event.kind === "command" &&
      event.phase === "started"
    ) {
      createActivityCard(event);
    } else if (
      event.kind === "command" &&
      event.phase === "completed"
    ) {
      updateCompletedActivity(event);
    } else if (event.kind === "command-output") {
      appendCommandOutput(event);
    } else if (
      event.kind === "file" &&
      event.phase === "started"
    ) {
      createActivityCard(event);
    } else if (
      event.kind === "file" &&
      event.phase === "completed"
    ) {
      updateCompletedActivity(event);
    } else if (event.kind === "plan") {
      renderProgressPlan(event);
    } else if (event.kind === "diff") {
      showDiff(event);
    } else if (event.kind === "error") {
      showActivityError(event);
    }
  }

  if (task.streamedOutput) {
    currentAssistantBubble = addBubble(
      "assistant",
      task.streamedOutput
    );
  } else if (isRuntimeTaskActive(task.status)) {
    currentAssistantBubble = addBubble(
      "assistant",
      "正在思考…"
    );
  }

  for (const approval of task.approvals || []) {
    if (approval.status !== "pending") continue;

    showApprovalCard({
      requestId: approval.requestId,
      type: approval.type,
      threadId: task.threadId,
      turnId: approval.turnId,
      itemId: approval.itemId,
      title: approval.title || "需要你的批准",
      reason: approval.reason || "Codex 需要你的允许才能继续执行这个操作。",
      command: approval.command || "",
      cwd: approval.cwd || "",
      grantRoot: approval.grantRoot || ""
    });
  }

  busy = isRuntimeTaskActive(task.status);
  updateSelectedTaskUi();
  chat.scrollTop = chat.scrollHeight;
}



const historyRestoreStyle =
  document.createElement("style");

historyRestoreStyle.textContent = `
.history-resume-banner {
  width: fit-content;
  margin: 8px auto 28px;
  padding: 7px 12px;
  border-radius: 999px;
  background: #102019;
  border: 1px solid #254737;
  color: #79dca1;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.history-empty-content {
  max-width: 620px;
  margin: 50px auto;
  color: #8190a2;
  text-align: center;
  line-height: 1.7;
}
`;

document.head.appendChild(
  historyRestoreStyle
);



// ===== 历史任务更多菜单 =====

let activeThreadHistoryMenu = null;

function closeThreadHistoryMenu() {
  if (activeThreadHistoryMenu) {
    activeThreadHistoryMenu.remove();
    activeThreadHistoryMenu = null;
  }
}

function openThreadHistoryMenu(
  anchor,
  record
) {
  closeThreadHistoryMenu();

  const menu =
    document.createElement("div");

  menu.className =
    "thread-history-popup";

  const renameButton =
    document.createElement("button");

  renameButton.className =
    "thread-history-popup-item";

  renameButton.textContent =
    "重命名";

  renameButton.addEventListener(
    "click",
    async (event) => {
      event.stopPropagation();

      closeThreadHistoryMenu();

      const newTitle =
        await showThreadRenameDialog(
          record.title || "新任务"
        );

      if (newTitle === null) {
        return;
      }

      const title =
        newTitle.trim();

      if (!title) {
        alert("任务名称不能为空");
        return;
      }

      try {
        await window.deepseekCodex
          .renameThreadHistory(
            record.threadId,
            title
          );

        if (selectedThreadId === record.threadId) {
          projectName.textContent = title;
          projectName.title = title;
        }

        await renderThreadHistory();

      } catch (error) {
        alert(
          "重命名失败：" +
          error.message
        );
      }
    }
  );

  const deleteButton =
    document.createElement("button");

  deleteButton.className =
    "thread-history-popup-item danger";

  deleteButton.textContent =
    "删除";

  const exportButton = document.createElement("button");
  exportButton.className = "thread-history-popup-item";
  exportButton.textContent = "导出 Markdown";
  exportButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    closeThreadHistoryMenu();
    try {
      const result = await window.deepseekCodex.exportThreadMarkdown(record.threadId);
      if (!result?.canceled && result?.filePath) {
        showTaskRuntimeNotice(`已导出 Markdown：${result.filePath}`);
      }
    } catch (error) {
      alert("导出失败：" + error.message);
    }
  });

  deleteButton.addEventListener(
    "click",
    async (event) => {
      event.stopPropagation();

      const confirmed =
        confirm(
          `确定删除历史任务？\n\n${record.title || "新任务"}`
        );

      if (!confirmed) {
        closeThreadHistoryMenu();
        return;
      }

      try {
        await window.deepseekCodex
          .deleteThreadHistory(
            record.threadId
          );

        closeThreadHistoryMenu();

        await renderThreadHistory();

      } catch (error) {
        alert(
          "删除失败：" +
          error.message
        );
      }
    }
  );

  menu.appendChild(renameButton);
  menu.appendChild(exportButton);
  menu.appendChild(deleteButton);

  document.body.appendChild(menu);

  const rect =
    anchor.getBoundingClientRect();

  const menuRect =
    menu.getBoundingClientRect();

  let left =
    rect.right - menuRect.width;

  let top =
    rect.bottom + 6;

  if (left < 8) {
    left = 8;
  }

  if (
    top + menuRect.height >
    window.innerHeight - 8
  ) {
    top =
      rect.top -
      menuRect.height -
      6;
  }

  menu.style.left =
    `${left}px`;

  menu.style.top =
    `${top}px`;

  activeThreadHistoryMenu =
    menu;
}

document.addEventListener(
  "click",
  () => {
    closeThreadHistoryMenu();
  }
);

window.addEventListener(
  "resize",
  closeThreadHistoryMenu
);


// ===== 历史任务菜单样式 =====

const threadHistoryMenuStyle =
  document.createElement("style");

threadHistoryMenuStyle.textContent = `

.thread-history-item {
  position: relative;
  padding-right: 34px;
}

.thread-history-menu-button {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);

  width: 26px;
  height: 26px;

  border: none;
  border-radius: 7px;

  background: transparent;
  color: #7e8da0;

  font-size: 18px;
  line-height: 20px;

  cursor: pointer;

  opacity: 1;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}

.thread-history-item:hover
.thread-history-menu-button,
.thread-history-item.active
.thread-history-menu-button {
  opacity: 1;
}

.thread-history-menu-button:hover {
  background: #263345;
  color: #ffffff;
}

.thread-history-popup {
  position: fixed;
  z-index: 99999;

  width: 128px;
  padding: 5px;

  background: #151d27;

  border: 1px solid #2b3949;
  border-radius: 10px;

  box-shadow:
    0 12px 30px rgba(0,0,0,.45);
}

.thread-history-popup-item {
  display: block;
  width: 100%;

  padding: 9px 10px;

  border: none;
  border-radius: 7px;

  background: transparent;
  color: #dbe5f0;

  text-align: left;
  font-size: 13px;

  cursor: pointer;
}

.thread-history-popup-item:hover {
  background: #202b39;
}

.thread-history-popup-item.danger {
  color: #ff8c8c;
}

.thread-history-popup-item.danger:hover {
  background: rgba(255, 80, 80, .10);
  color: #ffaaaa;
}

`;

document.head.appendChild(
  threadHistoryMenuStyle
);



// ===== 自定义历史任务重命名窗口 =====

function showThreadRenameDialog(currentTitle) {
  return new Promise((resolve) => {

    const overlay =
      document.createElement("div");

    overlay.className =
      "thread-rename-overlay";

    const dialog =
      document.createElement("div");

    dialog.className =
      "thread-rename-dialog";

    const title =
      document.createElement("div");

    title.className =
      "thread-rename-title";

    title.textContent =
      "重命名任务";

    const input =
      document.createElement("input");

    input.className =
      "thread-rename-input";

    input.value =
      currentTitle || "";

    input.maxLength = 80;

    const buttons =
      document.createElement("div");

    buttons.className =
      "thread-rename-actions";

    const cancel =
      document.createElement("button");

    cancel.className =
      "thread-rename-button secondary";

    cancel.textContent =
      "取消";

    const confirm =
      document.createElement("button");

    confirm.className =
      "thread-rename-button primary";

    confirm.textContent =
      "保存";

    buttons.appendChild(cancel);
    buttons.appendChild(confirm);

    dialog.appendChild(title);
    dialog.appendChild(input);
    dialog.appendChild(buttons);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    function finish(value) {
      overlay.remove();
      resolve(value);
    }

    cancel.addEventListener(
      "click",
      () => finish(null)
    );

    confirm.addEventListener(
      "click",
      () => {
        finish(input.value);
      }
    );

    input.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter") {
          finish(input.value);
        }

        if (event.key === "Escape") {
          finish(null);
        }
      }
    );

    overlay.addEventListener(
      "click",
      (event) => {
        if (event.target === overlay) {
          finish(null);
        }
      }
    );

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}


const threadRenameStyle =
  document.createElement("style");

threadRenameStyle.textContent = `

.thread-rename-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000;

  display: flex;
  align-items: center;
  justify-content: center;

  background: rgba(3, 7, 12, .62);
  backdrop-filter: blur(5px);
}

.thread-rename-dialog {
  width: 420px;
  padding: 20px;

  background: #111923;
  border: 1px solid #2b3949;
  border-radius: 14px;

  box-shadow:
    0 20px 60px rgba(0,0,0,.50);
}

.thread-rename-title {
  margin-bottom: 14px;

  color: #f1f5f9;
  font-size: 16px;
  font-weight: 650;
}

.thread-rename-input {
  box-sizing: border-box;
  width: 100%;

  padding: 11px 12px;

  background: #0b1119;
  color: #f3f6fa;

  border: 1px solid #334356;
  border-radius: 9px;

  outline: none;
  font-size: 14px;
}

.thread-rename-input:focus {
  border-color: #4c8dff;
  box-shadow:
    0 0 0 3px rgba(76,141,255,.13);
}

.thread-rename-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;

  margin-top: 16px;
}

.thread-rename-button {
  padding: 8px 16px;

  border-radius: 8px;
  border: 1px solid transparent;

  cursor: pointer;
  font-size: 13px;
}

.thread-rename-button.secondary {
  background: #18212c;
  border-color: #2b3949;
  color: #c7d0dc;
}

.thread-rename-button.primary {
  background: #eaf2ff;
  color: #111820;
  font-weight: 600;
}

.thread-rename-button:hover {
  filter: brightness(1.08);
}

`;

document.head.appendChild(
  threadRenameStyle
);


// ===== 历史任务搜索 =====

let threadHistorySearchQuery = "";

function ensureThreadHistorySearch() {
  const title =
    document.querySelector(
      ".thread-history-title"
    );

  if (!title) return;

  let wrapper =
    document.querySelector(
      ".thread-history-search"
    );

  if (wrapper) return;

  wrapper =
    document.createElement("div");

  wrapper.className =
    "thread-history-search";

  const icon =
    document.createElement("span");

  icon.className =
    "thread-history-search-icon";

  icon.textContent = "⌕";

  const input =
    document.createElement("input");

  input.className =
    "thread-history-search-input";

  input.type = "text";

  input.placeholder =
    "搜索历史任务";

  input.autocomplete = "off";

  const clear =
    document.createElement("button");

  clear.className =
    "thread-history-search-clear";

  clear.type = "button";

  clear.textContent = "×";

  clear.title = "清空搜索";

  wrapper.appendChild(icon);
  wrapper.appendChild(input);
  wrapper.appendChild(clear);

  title.insertAdjacentElement(
    "afterend",
    wrapper
  );

  input.addEventListener(
    "input",
    () => {
      threadHistorySearchQuery =
        input.value
          .trim()
          .toLowerCase();

      clear.classList.toggle(
        "visible",
        input.value.length > 0
      );

      applyThreadHistorySearch();
    }
  );

  clear.addEventListener(
    "click",
    () => {
      input.value = "";
      threadHistorySearchQuery = "";

      clear.classList.remove(
        "visible"
      );

      applyThreadHistorySearch();

      input.focus();
    }
  );
}

function applyThreadHistorySearch() {
  const container =
    document.querySelector(
      ".thread-history-container"
    );

  if (!container) return;

  const items =
    Array.from(
      container.querySelectorAll(
        ".thread-history-item"
      )
    );

  let visibleCount = 0;

  for (const item of items) {
    const title =
      (
        item.dataset.threadTitle ||
        item.textContent ||
        ""
      ).toLowerCase();

    const matched =
      !threadHistorySearchQuery ||
      title.includes(
        threadHistorySearchQuery
      );

    item.style.display =
      matched ? "" : "none";

    if (matched) {
      visibleCount++;
    }
  }

  let empty =
    container.querySelector(
      ".thread-history-search-empty"
    );

  if (
    threadHistorySearchQuery &&
    visibleCount === 0
  ) {
    if (!empty) {
      empty =
        document.createElement("div");

      empty.className =
        "thread-history-search-empty";

      empty.textContent =
        "没有找到相关任务";

      container.appendChild(empty);
    }

    empty.style.display = "";
  }
  else if (empty) {
    empty.style.display = "none";
  }
}


// 监听历史列表重新渲染
function watchThreadHistoryChanges() {
  const container =
    document.querySelector(
      ".thread-history-container"
    );

  if (!container) {
    setTimeout(
      watchThreadHistoryChanges,
      300
    );

    return;
  }

  const observer =
    new MutationObserver(() => {
      applyThreadHistorySearch();
    });

  observer.observe(
    container,
    {
      childList: true
    }
  );
}


// 启动
ensureThreadHistorySearch();
applyThreadHistorySearch();
watchThreadHistoryChanges();


// ===== 历史搜索框样式 =====

const historySearchStyle =
  document.createElement("style");

historySearchStyle.textContent = `

.thread-history-search {
  height: 32px;

  margin:
    6px 14px 8px 14px;

  display: flex;
  align-items: center;

  padding: 0 8px;

  border: 1px solid transparent;
  border-radius: 8px;

  background: #121a24;

  transition:
    border-color .15s ease,
    background .15s ease;
}

.thread-history-search:focus-within {
  border-color: #34475d;
  background: #151f2b;
}

.thread-history-search-icon {
  margin-right: 6px;

  color: #64758a;
  font-size: 16px;

  pointer-events: none;
}

.thread-history-search-input {
  width: 100%;
  min-width: 0;

  border: none;
  outline: none;

  background: transparent;
  color: #dfe8f2;

  font-size: 12px;
}

.thread-history-search-input::placeholder {
  color: #627286;
}

.thread-history-search-clear {
  width: 22px;
  height: 22px;

  padding: 0;

  border: none;
  border-radius: 6px;

  background: transparent;
  color: #708094;

  cursor: pointer;

  font-size: 17px;

  opacity: 1;
  pointer-events: none;
}

.thread-history-search-clear.visible {
  opacity: 1;
  pointer-events: auto;
}

.thread-history-search-clear:hover {
  background: #263345;
  color: #ffffff;
}

.thread-history-search-empty {
  padding: 12px 10px;

  color: #64758a;
  font-size: 12px;
  text-align: center;
}

`;

document.head.appendChild(
  historySearchStyle
);


// ===== 修复历史搜索框启动时机 =====

function bootThreadHistorySearch() {
  const title =
    document.querySelector(
      ".thread-history-title"
    );

  const container =
    document.querySelector(
      ".thread-history-container"
    );

  if (!title || !container) {
    setTimeout(
      bootThreadHistorySearch,
      250
    );

    return;
  }

  ensureThreadHistorySearch();
  applyThreadHistorySearch();
}

setTimeout(
  bootThreadHistorySearch,
  100
);


// ===== 历史任务日期分组 =====

function getThreadHistoryGroup(timestamp) {
  if (!timestamp) {
    return "更早";
  }

  const date = new Date(timestamp);
  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const diffDays =
    Math.round(
      (today - target) /
      86400000
    );

  if (diffDays === 0) {
    return "今天";
  }

  if (diffDays === 1) {
    return "昨天";
  }

  return "更早";
}



// 搜索后同步处理日期分组标题
function updateThreadHistoryGroupVisibility() {

  const container =
    document.querySelector(
      ".thread-history-container"
    );

  if (!container) return;

  const groups =
    container.querySelectorAll(
      ".thread-history-group-title"
    );

  groups.forEach((groupTitle) => {

    const group =
      groupTitle.dataset.historyGroup;

    const items =
      Array.from(
        container.querySelectorAll(
          ".thread-history-item"
        )
      ).filter(
        item =>
          item.dataset.historyGroup ===
          group
      );

    const hasVisible =
      items.some(
        item =>
          item.style.display !== "none"
      );

    groupTitle.style.display =
      hasVisible ? "" : "none";
  });
}


// 搜索输入后自动刷新分组显示
document.addEventListener(
  "input",
  (event) => {

    if (
      event.target.classList.contains(
        "thread-history-search-input"
      )
    ) {
      setTimeout(
        updateThreadHistoryGroupVisibility,
        0
      );
    }
  }
);


const threadHistoryGroupStyle =
  document.createElement("style");

threadHistoryGroupStyle.textContent = `

.thread-history-group-title {
  padding:
    11px 10px 5px 10px;

  color: #64758a;

  font-size: 11px;
  font-weight: 600;

  user-select: none;
}

.thread-history-group-title:first-child {
  padding-top: 4px;
}

`;

document.head.appendChild(
  threadHistoryGroupStyle
);


// ===== 输入框快捷键 =====
// Enter        = 发送
// Shift+Enter  = 换行
// 中文输入法选字时不会误发送

if (
  textarea &&
  !textarea.dataset.enterSendBound
) {
  textarea.dataset.enterSendBound = "true";

  textarea.addEventListener(
    "keydown",
    (event) => {

      // 中文/日文等输入法组合输入期间不处理
      if (
        event.isComposing ||
        event.keyCode === 229
      ) {
        return;
      }

      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        const text =
          textarea.value.trim();

        if (
          !text ||
          busy ||
          sendButton.disabled
        ) {
          return;
        }

        sendButton.click();
      }

      // Shift + Enter 保留浏览器默认换行
    }
  );
}


// ===== 执行中停止按钮 =====

const normalSendButtonHTML =
  sendButton.innerHTML;

let stopRequested = false;

function setSendButtonRunning(
  running
) {
  if (running) {
    sendButton.dataset.mode =
      "stop";

    sendButton.disabled =
      false;

    sendButton.textContent =
      "■";

    sendButton.title =
      "停止当前任务";

    sendButton.classList.add(
      "stop-mode"
    );

    return;
  }

  stopRequested = false;

  sendButton.dataset.mode =
    "send";

  sendButton.disabled =
    false;

  sendButton.innerHTML =
    normalSendButtonHTML;

  sendButton.title =
    "发送";

  sendButton.classList.remove(
    "stop-mode"
  );
}


// 监听 Turn 生命周期
window.deepseekCodex.onTurnState(
  (state) => {

    if (!taskEventBelongsToSelectedTask(state)) return;

    if (
      state.status === "started"
    ) {
      stopRequested = false;

      setSendButtonRunning(true);

      return;
    }

    if (
      state.status === "completed" ||
      state.status === "failed" ||
      state.status === "interrupted" ||
      state.status === "error"
    ) {
      activityFinishedAt = Date.now();
      updateActivitySummary();
      setSendButtonRunning(false);
    }
  }
);


// 使用捕获阶段，优先于原来的发送事件
sendButton.addEventListener(
  "click",
  async (event) => {

    if (
      sendButton.dataset.mode !==
      "stop"
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (stopRequested) {
      return;
    }

    stopRequested = true;

    sendButton.textContent =
      "…";

    sendButton.title =
      "正在停止";

    try {

      const result =
        await window.deepseekCodex
          .interruptTurn({
            threadId: selectedThreadId,
            turnId: runtimeTasks.get(selectedThreadId)?.currentTurnId || null
          });

      if (!result?.ok) {

        stopRequested = false;

        sendButton.textContent =
          "■";

        sendButton.title =
          result?.message ||
          "停止当前任务";

      }

      // 成功时不要立即恢复箭头
      // 等 turn/completed(interrupted)
      // 再自动恢复

    }
    catch (error) {

      stopRequested = false;

      sendButton.textContent =
        "■";

      sendButton.title =
        "停止失败";

      console.error(
        "停止 Turn 失败：",
        error
      );
    }

  },
  true
);


const stopButtonStyle =
  document.createElement("style");

stopButtonStyle.textContent = `

.send.stop-mode,
.send-button.stop-mode,
button.stop-mode {
  cursor: pointer;
}

.send.stop-mode:hover,
.send-button.stop-mode:hover,
button.stop-mode:hover {
  background: #f0f3f6;
}

`;

document.head.appendChild(
  stopButtonStyle
);



// ===== 最近项目更多菜单 =====

let activeRecentProjectMenu = null;

function closeRecentProjectMenu() {
  if (activeRecentProjectMenu) {
    activeRecentProjectMenu.remove();
    activeRecentProjectMenu = null;
  }
}

function openRecentProjectMenu(
  anchor,
  projectPath,
  projectName
) {
  closeRecentProjectMenu();

  const menu =
    document.createElement("div");

  menu.className =
    "recent-project-popup";

  const removeButton =
    document.createElement("button");

  const openFolderButton =
    document.createElement("button");

  openFolderButton.className =
    "recent-project-popup-item open-folder";

  openFolderButton.textContent =
    "打开项目文件夹";

  openFolderButton.addEventListener(
    "click",
    async (event) => {
      event.stopPropagation();

      try {
        await window.deepseekCodex.openProjectFolder(projectPath);
        closeRecentProjectMenu();
      } catch (error) {
        alert("打开项目文件夹失败：" + error.message);
      }
    }
  );

  removeButton.className =
    "recent-project-popup-item";

  removeButton.textContent =
    "从最近项目移除";

  removeButton.addEventListener(
    "click",
    async (event) => {
      event.stopPropagation();

      const confirmed =
        confirm(
          `从最近项目中移除？\n\n${projectName}\n\n不会删除项目文件。`
        );

      if (!confirmed) {
        closeRecentProjectMenu();
        return;
      }

      try {
        await window.deepseekCodex
          .removeRecentProject(
            projectPath
          );

        closeRecentProjectMenu();

        await renderRecentProjects();

      } catch (error) {
        alert(
          "移除失败：" +
          error.message
        );
      }
    }
  );

  menu.appendChild(openFolderButton);
  menu.appendChild(removeButton);
  document.body.appendChild(menu);

  const rect =
    anchor.getBoundingClientRect();

  const menuRect =
    menu.getBoundingClientRect();

  menu.style.left =
    `${Math.max(
      8,
      rect.right - menuRect.width
    )}px`;

  menu.style.top =
    `${rect.bottom + 5}px`;

  activeRecentProjectMenu =
    menu;
}

document.addEventListener(
  "click",
  closeRecentProjectMenu
);


const recentProjectMenuStyle =
  document.createElement("style");

recentProjectMenuStyle.textContent = `

.recent-projects-container .project {
  position: relative;
  padding-right: 36px;
}

.recent-project-menu-button {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);

  width: 26px;
  height: 26px;

  border: none;
  border-radius: 7px;

  background: transparent;
  color: #718298;

  font-size: 18px;
  cursor: pointer;

  opacity: 1;
}

.recent-projects-container
.project:hover
.recent-project-menu-button,

.recent-projects-container
.project.active
.recent-project-menu-button {
  opacity: 1;
}

.recent-project-menu-button:hover {
  background: #263345;
  color: white;
}

.recent-project-popup {
  position: fixed;
  z-index: 100000;

  width: 165px;
  padding: 5px;

  background: #151d27;

  border: 1px solid #2b3949;
  border-radius: 10px;

  box-shadow:
    0 12px 30px rgba(0,0,0,.45);
}

.recent-project-popup-item {
  width: 100%;
  padding: 9px 10px;

  border: none;
  border-radius: 7px;

  background: transparent;
  color: #ff9b9b;

  text-align: left;
  font-size: 13px;

  cursor: pointer;
}

.recent-project-popup-item:hover {
  background: rgba(255,80,80,.10);
}

.recent-project-popup-item.open-folder {
  color: #b8d5ff;
}

.recent-project-popup-item.open-folder:hover {
  background: rgba(92, 145, 225, .14);
}

`;

document.head.appendChild(
  recentProjectMenuStyle
);




// ===== 附件选择 UI =====

let selectedAttachments = [];
const MAX_TOTAL_ATTACHMENT_SIZE = 50 * 1024 * 1024;

const attachmentButton =
  document.createElement("button");

attachmentButton.type =
  "button";

attachmentButton.className =
  "attachment-button";

attachmentButton.textContent =
  "＋";

attachmentButton.title =
  "添加附件";

const attachmentChips =
  document.createElement("div");

attachmentChips.className =
  "attachment-chips";

const attachmentNotice =
  document.createElement("div");

attachmentNotice.className =
  "attachment-notice";

let attachmentNoticeTimer = null;

function showAttachmentNotice(message) {
  attachmentNotice.textContent = message;
  attachmentNotice.style.display = "block";

  if (attachmentNoticeTimer) {
    clearTimeout(attachmentNoticeTimer);
  }

  attachmentNoticeTimer = setTimeout(() => {
    attachmentNotice.style.display = "none";
  }, 6000);
}

function formatAttachmentSize(size) {
  const bytes = Number(size || 0);

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewableImage(file) {
  return new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif"
  ]).has(
    String(file?.ext || "").toLowerCase()
  );
}

async function loadAttachmentPreview(
  file,
  preview,
  chip
) {
  if (!isPreviewableImage(file)) {
    preview.textContent =
      String(file?.ext || "文件")
        .replace(".", "")
        .toUpperCase();
    return;
  }

  try {
    const dataUrl =
      await window.deepseekCodex
        .getAttachmentPreview(file.path);

    if (!dataUrl || !chip.isConnected) {
      preview.textContent = "图片";
      return;
    }

    const image = document.createElement("img");
    image.src = dataUrl;
    image.alt = file.name || "附件预览";
    image.loading = "lazy";

    preview.textContent = "";
    preview.appendChild(image);
  } catch {
    preview.textContent = "图片";
  }
}


function renderAttachmentChips() {

  attachmentChips.innerHTML = "";

  if (!selectedAttachments.length) {
    attachmentChips.style.display = "none";
    return;
  }

  const totalSize =
    selectedAttachments.reduce(
      (sum, file) =>
        sum + Number(file.size || 0),
      0
    );

  const toolbar = document.createElement("div");
  toolbar.className = "attachment-toolbar";

  const summary = document.createElement("span");
  summary.className = "attachment-summary";
  summary.textContent =
    `${selectedAttachments.length} 个附件 · ${formatAttachmentSize(totalSize)}`;

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "attachment-clear-all";
  clearButton.textContent = "清空全部";
  clearButton.title = "移除当前所有附件";
  clearButton.addEventListener("click", () => {
    selectedAttachments = [];
    renderAttachmentChips();
  });

  toolbar.appendChild(summary);
  toolbar.appendChild(clearButton);

  const list = document.createElement("div");
  list.className = "attachment-chip-list";

  selectedAttachments.forEach(
    (file, index) => {

      const chip =
        document.createElement("div");

      chip.className =
        "attachment-chip";

      chip.title =
        file.path;

      const preview = document.createElement("div");
      preview.className = "attachment-chip-preview";

      const details = document.createElement("div");
      details.className = "attachment-chip-details";

      const name =
        document.createElement("span");

      name.className =
        "attachment-chip-name";

      name.textContent =
        file.name;

      const meta = document.createElement("span");
      meta.className = "attachment-chip-meta";
      meta.textContent =
        `${String(file.ext || "文件").toUpperCase()} · ${formatAttachmentSize(file.size)}`;

      details.appendChild(name);
      details.appendChild(meta);

      const remove =
        document.createElement("button");

      remove.type =
        "button";

      remove.className =
        "attachment-chip-remove";

      remove.textContent =
        "×";

      remove.title =
        "移除附件";

      remove.addEventListener(
        "click",
        (event) => {

          event.preventDefault();
          event.stopPropagation();

          selectedAttachments.splice(
            index,
            1
          );

          renderAttachmentChips();
        }
      );

      chip.appendChild(preview);
      chip.appendChild(details);
      chip.appendChild(remove);

      list.appendChild(
        chip
      );

      loadAttachmentPreview(
        file,
        preview,
        chip
      );
    }
  );

  attachmentChips.appendChild(toolbar);
  attachmentChips.appendChild(list);
  attachmentChips.style.display = "block";
}

function showAttachmentRejections(rejected = []) {
  if (rejected.length) {
    showAttachmentNotice(
      rejected
        .map(file => `${file.name}：${file.reason}`)
        .join("；")
    );
  }
}

function mergeAttachmentRecords(files = []) {
  let added = 0;

  for (const file of files) {
    const currentTotal =
      selectedAttachments.reduce(
        (sum, item) =>
          sum + Number(item.size || 0),
        0
      );

    if (
      currentTotal + Number(file.size || 0) >
      MAX_TOTAL_ATTACHMENT_SIZE
    ) {
      showAttachmentNotice(
        "本次附件总大小不能超过 50 MB"
      );
      continue;
    }

    const exists =
      selectedAttachments.some(
        item =>
          String(item.path).toLowerCase() ===
          String(file.path).toLowerCase()
      );

    if (!exists) {
      selectedAttachments.push(file);
      added += 1;
    }
  }

  if (added) {
    renderAttachmentChips();
  }

  return added;
}

async function addDroppedAttachments(fileList) {
  const files = Array.from(fileList || []);
  const records = files
    .filter(file => file && file.path)
    .map(file => ({
      path: file.path,
      name: file.name,
      size: file.size,
      ext: file.name
        ? file.name.slice(file.name.lastIndexOf("."))
        : ""
    }));

  const blobFiles = files.filter(
    file =>
      file &&
      !file.path
  );

  if (!records.length && !blobFiles.length) {
    showAttachmentNotice(
      "无法读取拖入内容，请拖入本地文件或图片"
    );
    return;
  }

  if (records.length) {
    const result =
      await window.deepseekCodex
        .validateDroppedAttachments(records);

    showAttachmentRejections(result?.rejected || []);
    mergeAttachmentRecords(result?.files || []);
  }

  for (const blobFile of blobFiles) {
    try {
      const dataUrl =
        await readBlobAsDataUrl(blobFile);

      const isImage =
        typeof blobFile.type === "string" &&
        blobFile.type.startsWith("image/");

      const record = isImage
        ? await window.deepseekCodex
            .savePastedImage({
              dataUrl,
              name: blobFile.name || "dropped-image.png"
            })
        : await window.deepseekCodex
            .saveDroppedFile({
              dataUrl,
              name: blobFile.name || "",
              mimeType: blobFile.type || ""
            });

      mergeAttachmentRecords([record]);
    } catch (error) {
      showAttachmentNotice(
        "拖入图片失败：" + error.message
      );
    }
  }
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("读取图片失败"));
    reader.readAsDataURL(blob);
  });
}

async function addPastedImages(items) {
  let added = 0;

  for (const item of items) {
    const file = item.getAsFile();

    if (!file) continue;

    try {
      const dataUrl =
        await readBlobAsDataUrl(file);

      const record =
        await window.deepseekCodex
          .savePastedImage({
            dataUrl,
            name: file.name || "pasted-image.png"
          });

      added += mergeAttachmentRecords([record]);
    } catch (error) {
      showAttachmentNotice(
        "粘贴图片失败：" + error.message
      );
    }
  }

  if (added) {
    showAttachmentNotice(`已添加 ${added} 张粘贴图片`);
  }
}


attachmentButton.addEventListener(
  "click",
  async () => {

    try {

      const selection =
        await window.deepseekCodex
          .selectAttachments();

      const files = Array.isArray(selection)
        ? selection
        : selection?.files || [];

      const rejected = Array.isArray(selection)
        ? []
        : selection?.rejected || [];

      if (rejected.length) {
        showAttachmentNotice(
          rejected
            .map(file => `${file.name}：${file.reason}`)
            .join("；")
        );
      }

      if (!files?.length) {
        return;
      }

      mergeAttachmentRecords(files);

    }
    catch (error) {

      alert(
        "选择附件失败：" +
        error.message
      );
    }
  }
);


// 放到项目按钮旁边
if (
  projectButton &&
  projectButton.parentElement
) {

  projectButton.parentElement
    .insertBefore(
      attachmentButton,
      projectButton
    );

  projectButton.parentElement
    .insertBefore(
      permissionButton,
      projectButton
    );

  const composerTools = document.createElement("div");
  composerTools.className = "composer-left-tools";
  projectButton.parentElement.insertBefore(composerTools, attachmentButton);
  composerTools.appendChild(attachmentButton);
  composerTools.appendChild(permissionButton);

  const row =
    projectButton.parentElement;

  if (row.parentElement) {
    row.parentElement.insertBefore(
      attachmentNotice,
      row
    );
    row.parentElement.insertBefore(
      attachmentChips,
      row
    );
  }
}

// ===== 拖拽上传与 Ctrl+V 粘贴图片 =====

const attachmentDropIndicator =
  document.createElement("div");

attachmentDropIndicator.className =
  "attachment-drop-indicator";

attachmentDropIndicator.textContent =
  "松开以添加附件";

if (composer) {
  composer.insertBefore(
    attachmentDropIndicator,
    composer.firstChild
  );

  let dragDepth = 0;

  composer.addEventListener(
    "dragenter",
    (event) => {
      if (!event.dataTransfer?.types?.includes("Files")) {
        return;
      }

      event.preventDefault();
      dragDepth += 1;
      composer.classList.add("attachment-drag-over");
    }
  );

  composer.addEventListener(
    "dragover",
    (event) => {
      if (!event.dataTransfer?.types?.includes("Files")) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      composer.classList.add("attachment-drag-over");
    }
  );

  composer.addEventListener(
    "dragleave",
    (event) => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);

      if (!dragDepth) {
        composer.classList.remove("attachment-drag-over");
      }
    }
  );

  composer.addEventListener(
    "drop",
    async (event) => {
      if (!event.dataTransfer?.files?.length) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      dragDepth = 0;
      composer.classList.remove("attachment-drag-over");

      try {
        await addDroppedAttachments(
          event.dataTransfer.files
        );
      } catch (error) {
        showAttachmentNotice(
          "拖拽附件失败：" + error.message
        );
      }
    }
  );
}

textarea.addEventListener(
  "paste",
  async (event) => {
    const imageItems = Array.from(
      event.clipboardData?.items || []
    ).filter(
      item =>
        item.kind === "file" &&
        item.type.startsWith("image/")
    );

    if (!imageItems.length) {
      return;
    }

    event.preventDefault();

    await addPastedImages(imageItems);
  }
);

renderAttachmentChips();


const attachmentStyle =
  document.createElement("style");

attachmentStyle.textContent = `

.attachment-button {
  width: 28px;
  height: 28px;

  margin-right: 5px;
  padding: 0;

  border: none;
  border-radius: 7px;

  background: transparent;
  color: #91a1b5;

  font-size: 20px;
  line-height: 28px;

  cursor: pointer;
}

.attachment-button:hover {
  background: #202b38;
  color: #ffffff;
}

.attachment-drop-indicator {
  display: none;
  padding: 7px 12px 2px;
  color: #8fc7ff;
  font-size: 12px;
}

.composer.attachment-drag-over {
  border-color: #6d9fff;
  box-shadow: 0 0 0 2px rgba(109, 159, 255, .16);
}

.composer.attachment-drag-over .attachment-drop-indicator {
  display: block;
}

.attachment-chips {
  display: none;
  padding:
    4px 12px 8px 12px;
}

.attachment-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.attachment-summary {
  color: #8393a7;
  font-size: 11px;
}

.attachment-clear-all {
  padding: 3px 7px;
  border: 1px solid #39495b;
  border-radius: 6px;
  background: transparent;
  color: #9eacbd;
  font-size: 11px;
  cursor: pointer;
}

.attachment-clear-all:hover {
  border-color: #6c7f96;
  color: #ffffff;
  background: #202b38;
}

.attachment-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.attachment-notice {
  display: none;
  padding: 6px 12px 8px 12px;
  color: #ffb4a8;
  font-size: 12px;
  line-height: 1.45;
}

.attachment-chip {
  min-width: 190px;
  max-width: 280px;

  display: flex;
  align-items: center;

  padding:
    6px 7px 6px 9px;

  background: #17212d;

  border:
    1px solid #29384a;

  border-radius: 8px;

  color: #cfd9e5;

  font-size: 12px;
}

.attachment-chip-preview {
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 6px;
  background: #243244;
  color: #b5c5d8;
  font-size: 9px;
  font-weight: 700;
}

.attachment-chip-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.attachment-chip-details {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 8px;
}

.attachment-chip-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.attachment-chip-meta {
  color: #718298;
  font-size: 10px;
}

.attachment-chip-remove {
  margin-left: 6px;

  width: 20px;
  height: 20px;

  padding: 0;

  border: none;
  border-radius: 5px;

  background: transparent;
  color: #738499;

  cursor: pointer;
}

.attachment-chip-remove:hover {
  background: #29384a;
  color: #ffffff;
}

`;

document.head.appendChild(
  attachmentStyle
);

const permissionStyle = document.createElement("style");
permissionStyle.textContent = `
.composer-left-tools { display:inline-flex; align-items:center; gap:5px; }
.permission-button { display:inline-flex; align-items:center; gap:6px; height:30px; margin-left:4px; padding:0 10px; border:1px solid #334150; border-radius:999px; color:#aebaca; background:#151d27; cursor:pointer; font:inherit; font-size:11px; }
.permission-button:hover { border-color:#f47721; color:#fff; }
.permission-button i { color:#f47721; font-size:14px; }
.permission-menu { display:none; position:fixed; z-index:100004; width:240px; padding:7px; border:1px solid #334150; border-radius:12px; background:#101923; box-shadow:0 16px 34px rgba(0,0,0,.35); }
.permission-menu.open { display:grid; gap:3px; }
.permission-menu button { display:grid; gap:3px; padding:9px 10px; border:0; border-radius:8px; color:#dce5ed; background:transparent; text-align:left; cursor:pointer; font:inherit; }
.permission-menu button:hover, .permission-menu button.active { background:#202d3a; }
.permission-menu button strong { font-size:12px; }
.permission-menu button span { color:#8997a8; font-size:10px; line-height:1.4; }
`;
document.head.appendChild(permissionStyle);

permissionButton.addEventListener("click", () => {
  const rect = permissionButton.getBoundingClientRect();
  permissionMenu.style.left = `${Math.max(8, rect.left)}px`;
  permissionMenu.style.top = `${Math.max(8, rect.top - 174)}px`;
});


// ===== 同步附件到主进程 =====

function syncPendingAttachments() {
  if (window.deepseekCodex?.setPendingAttachments) {
    window.deepseekCodex
      .setPendingAttachments(selectedAttachments)
      .catch(error => {
        console.error("同步附件失败：", error);
        showAttachmentNotice(
          "附件状态同步失败，请重新选择附件"
        );
      });
  }
}

const originalRenderAttachmentChips =
  renderAttachmentChips;

renderAttachmentChips = function () {
  originalRenderAttachmentChips();
  syncPendingAttachments();
};

syncPendingAttachments();

// Turn 真正开始后清除附件标签
window.deepseekCodex.onTurnState(state => {
  if (
    state.status === "started" &&
    (!state.threadId || state.threadId === selectedThreadId) &&
    selectedAttachments.length
  ) {
    selectedAttachments = [];
    renderAttachmentChips();
  }
});

// ===== 恢复历史项目与任务入口 =====
// 这些列表由 renderer 动态创建；应用启动时再执行一次，
// 确保主进程恢复最近项目状态后，入口仍然挂载到侧边栏。
function restoreHistoricalUi() {
  renderRecentProjects().catch(error => {
    console.error("恢复最近项目列表失败：", error);
  });

  renderThreadHistory().catch(error => {
    console.error("恢复历史任务列表失败：", error);
  });

  bootThreadHistorySearch();
}

setTimeout(
  restoreHistoricalUi,
  350
);

// ===== 参考图级角色主题视觉适配 =====
const referenceThemeStyle = document.createElement("style");

referenceThemeStyle.textContent = `
html.character-theme {
  --theme-bg: #050b12;
  --theme-sidebar: #07111a;
  --theme-topbar: #070d14;
  --theme-panel: #101821;
  --theme-surface: #101a24;
  --theme-surface-alt: #151f2a;
  --theme-input: #0b131d;
  --theme-code: #05090e;
  --theme-border: #26313d;
  --theme-border-strong: #44515e;
  --theme-text: #dfe6ed;
  --theme-text-strong: #f7f4ec;
  --theme-muted: #9da7b2;
  --theme-subtle: #707d8a;
  --theme-shadow: rgba(0, 0, 0, .76);
  --theme-overlay: rgba(3, 8, 13, .78);
}

html.character-theme,
html.character-theme body {
  background: #050b12 !important;
}

html.character-theme .app {
  grid-template-columns: clamp(260px, 20.2vw, 320px) minmax(0, 1fr);
}

html.character-theme .sidebar {
  padding: 22px 24px 28px;
  background:
    linear-gradient(180deg, rgba(7, 17, 26, .98), rgba(4, 11, 18, .98)) !important;
  border-right: 1px solid rgba(112, 128, 145, .24) !important;
  box-shadow: 20px 0 70px rgba(0, 0, 0, .34);
}

html.character-theme .brand {
  gap: 13px;
  padding: 6px 4px 28px;
  color: #f4f2ec;
  font-size: 18px;
  font-weight: 720;
}

html.character-theme .logo {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 50%;
  background-color: transparent !important;
  background-image: url("assets/brand/deepseek-codex-ink-mark.png") !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  background-size: contain !important;
  color: transparent !important;
  box-shadow: none;
  filter:
    drop-shadow(0 8px 10px rgba(0, 0, 0, .42))
    drop-shadow(0 0 8px rgba(255, 114, 39, .2));
}

html.character-theme .new-task {
  min-height: 55px;
  margin-bottom: 28px;
  padding: 0 20px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 74%, #34404b) !important;
  border-radius: 12px;
  background: rgba(12, 20, 29, .72) !important;
  color: #f4f1ea;
  font-size: 15px;
  font-weight: 650;
  box-shadow: none;
}

html.character-theme .new-task::before {
  display: none;
}

html.character-theme .new-task:hover {
  background: color-mix(in srgb, var(--theme-accent) 10%, #0c141d) !important;
  box-shadow: 0 0 24px color-mix(in srgb, var(--theme-accent) 12%, transparent);
}

html.character-theme .section-title {
  margin: 7px 6px 10px;
  color: #73808d;
  font-size: 13px;
}

html.character-theme .project,
html.character-theme .thread-history-item {
  border-radius: 0 9px 9px 0;
}

html.character-theme .project.active,
html.character-theme .thread-history-item.active {
  background: linear-gradient(90deg, color-mix(in srgb, var(--theme-accent) 9%, #101923), rgba(12, 20, 29, .34)) !important;
}

html.character-theme .project.active::before,
html.character-theme .thread-history-item.active::before {
  top: 0;
  left: -4px;
  width: 4px;
  height: 100%;
  border-radius: 3px;
}

html.character-theme .thread-history-search input {
  border-color: rgba(108, 123, 139, .34) !important;
  background: rgba(14, 23, 33, .78) !important;
}

html.character-theme .sidebar-bottom {
  margin: 14px 0 0;
  padding: 16px 18px;
  border: 1px solid rgba(111, 125, 140, .42) !important;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(12, 21, 30, .96), rgba(18, 28, 39, .78)) !important;
  box-shadow:
    inset 3px 0 0 color-mix(in srgb, var(--theme-accent) 74%, transparent),
    0 16px 40px rgba(0, 0, 0, .28);
}

html.character-theme .sidebar-model-title .ph {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 5px;
  background: color-mix(in srgb, var(--theme-accent) 16%, rgba(12, 21, 30, .9));
  border: 1px solid color-mix(in srgb, var(--theme-accent) 62%, transparent);
  color: var(--theme-accent);
  font-size: 12px;
  box-shadow: 0 0 14px color-mix(in srgb, var(--theme-accent) 18%, transparent);
}

html.character-theme .sidebar-model-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #f1eee7;
  font-size: 14px;
  font-weight: 650;
}

html.character-theme .sidebar-bottom .model-small {
  margin-top: 7px;
  color: #909ba8;
}

html.character-theme .main {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: #050b12 !important;
}

html.character-theme .topbar {
  height: 60px;
  padding: 0 34px 0 36px;
  border-bottom: 1px solid rgba(122, 136, 151, .22) !important;
  background: rgba(6, 12, 19, .44) !important;
  backdrop-filter: blur(14px) saturate(1.05);
}

html.character-theme .project-name {
  color: #f1eee8;
  font-size: 16px;
  font-weight: 650;
}

html.character-theme .model-pill {
  padding: 10px 16px;
  border: 1px solid rgba(118, 132, 147, .42) !important;
  background: rgba(12, 20, 29, .76) !important;
  color: #e6e5e1;
  box-shadow: 0 10px 28px rgba(0, 0, 0, .18);
}

html.character-theme.welcome-mode .turn-status-pill,
html.character-theme.welcome-mode .diagnostics-trigger,
html.character-theme.welcome-mode .token-usage-trigger,
html.character-theme.welcome-mode .git-status-trigger,
html.character-theme.welcome-mode .theme-trigger {
  display: none !important;
}

html.character-theme .theme-character-stage {
  inset: 0;
  background: #050b12;
}

html.character-theme:not(.welcome-mode) .theme-character-stage {
  opacity: .16;
}

html.character-theme .theme-character-stage::before {
  z-index: 1;
  background: linear-gradient(90deg, rgba(4, 10, 17, .7) 0%, rgba(4, 10, 17, .16) 46%, rgba(4, 10, 17, .02) 100%);
}

html.character-theme .theme-character-stage::after {
  z-index: 3;
  background:
    linear-gradient(90deg, rgba(3, 8, 14, .30) 0%, rgba(3, 8, 14, .07) 51%, transparent 78%),
    linear-gradient(0deg, rgba(3, 8, 14, .64) 0%, transparent 18% 84%, rgba(3, 8, 14, .18) 100%);
  opacity: 1;
}

html.character-theme .theme-character-aura,
html.character-theme .theme-character-watermark,
html.character-theme .theme-welcome-identity {
  display: none !important;
}

html.character-theme .theme-character-portrait {
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: #050b12;
  box-shadow: none;
  clip-path: none;
  -webkit-mask-image: none;
  mask-image: none;
}

html.character-theme .theme-character-portrait::after {
  display: none;
}

html.character-theme .theme-character-art {
  position: relative;
  left: -7%;
  width: 107%;
  height: auto;
  object-fit: contain;
  object-position: top center !important;
  opacity: 1;
  filter: none;
  transform: scale(1.002);
  transform-origin: center;
}

html.character-theme .theme-character-stage-enter .theme-character-art {
  animation: reference-theme-art-in .55s cubic-bezier(.22, .8, .2, 1) both;
}

@keyframes reference-theme-art-in {
  from { opacity: 0; transform: scale(1.025); }
  to { opacity: 1; transform: scale(1.002); }
}

html.character-theme .chat {
  background: transparent !important;
}

html.character-theme.welcome-mode .chat {
  min-height: 0;
  box-sizing: border-box;
  padding: 0 42px 10px 54px;
  overflow: auto;
}

html.character-theme .welcome {
  max-width: 650px;
  margin-top: clamp(96px, 14vh, 124px);
}

html.character-theme .hero-title-image {
  display: block;
  width: min(100%, 360px);
  max-width: 360px;
  height: auto;
  margin: 0 0 20px;
  filter: drop-shadow(0 10px 34px rgba(0, 0, 0, .64));
}

html.character-theme .welcome p {
  max-width: 610px;
  margin: 0;
  color: rgba(207, 214, 221, .82) !important;
  font-size: 16px;
  line-height: 1.62;
  text-shadow: 0 4px 18px rgba(0, 0, 0, .6);
}

html.character-theme .quick-grid {
  max-width: 650px;
  gap: 12px 14px;
  margin-top: 25px;
}

html.character-theme .quick {
  position: relative;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 16px;
  min-height: 78px;
  gap: 13px;
  align-items: center;
  padding: 14px 16px;
  overflow: hidden;
  border: 1px solid rgba(116, 130, 145, .48) !important;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(12, 21, 30, .88), rgba(18, 27, 37, .65)) !important;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
  box-shadow:
    0 18px 46px rgba(0, 0, 0, .26),
    inset 0 1px 0 rgba(255, 255, 255, .025);
  backdrop-filter: blur(16px) saturate(1.08);
}

html.character-theme .quick::before,
html.character-theme .quick::after {
  display: none;
}

html.character-theme .quick:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--theme-accent) 72%, #596674) !important;
  background: linear-gradient(135deg, rgba(15, 25, 35, .94), color-mix(in srgb, var(--theme-accent) 8%, rgba(18, 27, 37, .78))) !important;
  box-shadow:
    0 22px 52px rgba(0, 0, 0, .34),
    0 0 24px color-mix(in srgb, var(--theme-accent) 10%, transparent);
}

html.character-theme .quick-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 10px;
  color: var(--theme-accent) !important;
  font-size: 30px !important;
  filter: drop-shadow(0 0 12px color-mix(in srgb, var(--theme-accent) 28%, transparent));
}

html.character-theme .quick-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  color: inherit !important;
  font-size: inherit !important;
}

html.character-theme .quick-copy strong {
  display: block;
  margin: 0;
  padding: 0;
  color: #f0eee8;
  font-size: 15px;
  font-weight: 680;
}

html.character-theme .quick-copy > span {
  color: rgba(182, 192, 203, .78);
  font-size: 11px;
}

html.character-theme .quick-arrow {
  color: rgba(231, 234, 236, .76);
  font-size: 18px;
}

html.character-theme .composer-wrap {
  flex: 0 0 auto;
  min-height: 0;
  box-sizing: border-box;
  padding: 0 42px 15px;
  background: linear-gradient(0deg, #050b12 30%, rgba(5, 11, 18, .92) 68%, transparent) !important;
}

html.character-theme .composer {
  width: 100%;
  max-width: 820px;
  min-height: 136px;
  margin: 0;
  padding: 17px 18px 14px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 68%, #48525d) !important;
  border-radius: 15px;
  background:
    radial-gradient(circle at 86% 92%, color-mix(in srgb, var(--theme-accent) 7%, transparent), transparent 34%),
    linear-gradient(135deg, rgba(14, 23, 33, .96), rgba(18, 28, 39, .88)) !important;
  box-shadow:
    0 25px 70px rgba(0, 0, 0, .4),
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 9%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, .035);
  backdrop-filter: blur(22px) saturate(1.08);
}

html.character-theme .composer:focus-within {
  border-color: var(--theme-accent) !important;
  box-shadow:
    0 27px 76px rgba(0, 0, 0, .46),
    0 0 0 3px color-mix(in srgb, var(--theme-accent) 13%, transparent);
}

html.character-theme .composer textarea {
  height: 58px;
  min-height: 54px;
  max-height: 260px;
  resize: vertical;
  padding: 1px 4px;
  color: #e8e9e7;
  font-size: 16px;
  line-height: 1.55;
}

html.character-theme .composer textarea::placeholder {
  color: #8b96a2;
}

html.character-theme .composer-bottom {
  min-height: 42px;
}

html.character-theme .project-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 13px;
  border: 1px solid rgba(111, 125, 140, .34);
  border-radius: 10px;
  background: rgba(18, 28, 39, .72);
  color: #aeb9c5;
  cursor: pointer;
  transition: color .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease;
}

html.character-theme .project-button:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 68%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent-surface) 72%, rgba(18, 28, 39, .82));
  color: #fff;
  box-shadow: 0 0 18px color-mix(in srgb, var(--theme-accent) 16%, transparent);
}

html.character-theme .project-button .ph {
  color: var(--theme-accent);
  font-size: 17px;
}

html.character-theme .send {
  display: grid;
  width: 50px;
  height: 50px;
  place-items: center;
  border-radius: 11px;
  background: linear-gradient(135deg, #f5f3ed, #d7dfe8) !important;
  color: var(--theme-accent) !important;
  font-size: 22px;
  box-shadow:
    0 9px 24px rgba(0, 0, 0, .34),
    0 0 20px color-mix(in srgb, var(--theme-accent) 16%, transparent);
}

.theme-dock {
  width: 100%;
  max-width: 820px;
  margin: 17px 0 0;
}

.theme-dock[hidden] {
  display: none !important;
}

.theme-dock-heading {
  display: flex;
  align-items: center;
  gap: 3px;
  margin: 0 0 10px;
  color: #8e99a5;
  font-size: 13px;
}

.theme-dock-heading .ph {
  color: var(--theme-accent);
  font-size: 13px;
}

.theme-dock-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) 150px;
  gap: 12px;
}

.theme-dock-option,
.theme-dock-more {
  position: relative;
  min-width: 0;
  height: 76px;
  overflow: hidden;
  border: 1px solid rgba(100, 115, 131, .48);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(12, 21, 30, .94), rgba(18, 28, 39, .76));
  color: #e7e6e2;
  cursor: pointer;
  font: inherit;
}

.theme-dock-option {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  align-items: center;
  padding: 0 11px 0 0;
  text-align: left;
}

.theme-dock-option:hover,
.theme-dock-option.active,
.theme-dock-more:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 80%, #64717e);
  box-shadow:
    0 10px 28px rgba(0, 0, 0, .34),
    0 0 20px color-mix(in srgb, var(--theme-accent) 14%, transparent);
}

.theme-dock-option.active {
  background: linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 20%, #101923), color-mix(in srgb, var(--theme-accent) 42%, #201913));
}

.theme-dock-art-wrap {
  width: 74px;
  height: 76px;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, #000 72%, transparent 100%);
  mask-image: linear-gradient(90deg, #000 72%, transparent 100%);
}

.theme-dock-art {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center 38%;
  filter: saturate(.92) contrast(1.05) brightness(.78);
  transform: scale(1.08);
}

.theme-dock-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  margin-left: -4px;
}

.theme-dock-copy strong,
.theme-dock-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-dock-copy strong {
  color: #f0eee8;
  font-size: 14px;
  font-weight: 680;
}

.theme-dock-copy small {
  color: #8f9aa6;
  font-size: 9px;
  letter-spacing: .04em;
}

.theme-dock-check {
  position: absolute;
  top: 9px;
  right: 9px;
  display: none;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 50%;
  background: var(--theme-accent);
  color: #fff;
  font-size: 12px;
  box-shadow: 0 0 18px color-mix(in srgb, var(--theme-accent) 52%, transparent);
}

.theme-dock-option.active .theme-dock-check {
  display: grid;
}

.theme-dock-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 0 14px;
  color: #d4d7da;
  font-size: 14px;
}

.theme-dock-more .ph {
  color: #aeb8c2;
  font-size: 22px;
}

@media (max-width: 1100px) {
  html.character-theme .app {
    grid-template-columns: 255px minmax(0, 1fr);
  }

  html.character-theme.welcome-mode .chat {
    padding-left: 42px;
    padding-right: 34px;
  }

  html.character-theme .composer-wrap {
    padding-right: 34px;
    padding-left: 34px;
  }

  .theme-dock-options {
    display: flex;
    padding-bottom: 3px;
    overflow-x: auto;
  }

  .theme-dock-option {
    min-width: 175px;
  }

  .theme-dock-more {
    min-width: 140px;
  }
}

@media (max-height: 820px) {
  html.character-theme .topbar {
    height: 60px;
  }

  html.character-theme.welcome-mode .chat {
    padding-bottom: 14px;
  }

  html.character-theme .welcome {
    margin-top: 10px;
    padding-bottom: 8px;
  }

  html.character-theme .hero-title-image {
    margin-bottom: 8px;
    width: min(100%, 360px);
    max-width: 360px;
  }

  html.character-theme .welcome p {
    font-size: 13px;
    line-height: 1.38;
  }

  html.character-theme .quick-grid {
    gap: 12px 14px;
    margin-top: 22px;
  }

  html.character-theme .quick {
    grid-template-columns: 34px minmax(0, 1fr) 14px;
    min-height: 78px;
    gap: 13px;
    padding: 14px 16px;
  }

  html.character-theme .quick-icon {
    width: 38px;
    height: 38px;
    font-size: 30px !important;
  }

  html.character-theme .quick-copy strong {
    font-size: 15px;
  }

  html.character-theme .quick-copy > span {
    font-size: 11px;
  }

  html.character-theme .composer-wrap {
    padding-bottom: 10px;
  }

  html.character-theme .composer {
    min-height: 136px;
    padding: 11px 13px 9px;
  }

  html.character-theme .composer textarea {
    height: 54px;
    max-height: 180px;
    font-size: 14px;
  }

  html.character-theme .composer-bottom {
    min-height: 40px;
  }

  html.character-theme .send {
    width: 40px;
    height: 40px;
  }

  .theme-dock {
    margin-top: 9px;
  }

  .theme-dock-heading {
    margin-bottom: 6px;
    font-size: 11px;
  }

  .theme-dock-option,
  .theme-dock-more {
    height: 68px;
  }

  .theme-dock-option {
    grid-template-columns: 58px minmax(0, 1fr);
  }

  .theme-dock-art-wrap {
    width: 68px;
    height: 68px;
  }

  .theme-dock-copy strong {
    font-size: 12px;
  }
}

@media (max-width: 760px) {
  html.character-theme .app {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  html.character-theme .sidebar {
    padding-right: 14px;
    padding-left: 14px;
  }

  html.character-theme.welcome-mode .chat {
    padding-right: 22px;
    padding-left: 26px;
  }

  html.character-theme .quick-grid {
    grid-template-columns: 1fr;
  }

  html.character-theme .composer-wrap {
    padding-right: 18px;
    padding-left: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  html.character-theme .theme-character-stage-enter .theme-character-art {
    animation: none;
  }
}

html.character-theme.welcome-mode.composer-tall .welcome {
  margin-top: 12px;
}

html.character-theme.welcome-mode.composer-tall .hero-title-image {
  width: min(100%, 390px);
  max-width: 390px;
  margin-bottom: 8px;
}

html.character-theme.welcome-mode.composer-tall .welcome p {
  font-size: 13px;
  line-height: 1.38;
}

html.character-theme.welcome-mode.composer-tall .quick-grid {
  gap: 8px 10px;
  margin-top: 12px;
}

html.character-theme.welcome-mode.composer-tall .quick {
  min-height: 78px;
  padding: 14px 16px;
}

html.character-theme.welcome-mode.composer-tall .quick-icon {
  width: 38px;
  height: 38px;
  font-size: 30px !important;
}

html.character-theme.welcome-mode.composer-tall .quick-copy {
  gap: 3px;
}

html.character-theme.welcome-mode.composer-tall .quick-copy strong {
  font-size: 15px;
}

html.character-theme.welcome-mode.composer-tall .quick-copy > span {
  font-size: 11px;
}
`;

document.head.appendChild(referenceThemeStyle);

