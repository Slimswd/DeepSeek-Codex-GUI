const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { Menu, shell, screen } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn, execFile } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");
const net = require("net");
const tls = require("tls");
const https = require("https");
const readline = require("readline");
const recentProjects = require("./recent-projects");
const threadHistory = require("./thread-history");
const gitReview = require("./git-review-manager");
const {
  ACTIVE_STATUSES,
  TaskRuntimeManager
} = require("./task-runtime-manager");

let mainWindow = null;
let codexProcess = null;
let codexStartPromise = null;
let codexReconnectTimer = null;
let codexReconnectAttempt = 0;
let mihomoProcess = null;
let mihomoStartPromise = null;
let embeddedNetworkStatus = "checking";
let embeddedNetworkProbePromise = null;
let embeddedNetworkProbeTimer = null;
const EMBEDDED_PROXY_SUBSCRIPTION_URL = "https://dasho.xn--cp3a08l.com/api/v1/pq/15fc82a95cf663e1a8207f7f47bcad0b";
const EMBEDDED_PROXY_PORT = 17890;
let shuttingDown = false;

const WINDOW_STATE_FILE = "window-state.json";
let updatePromptShown = false;
let updateDownloadInProgress = false;
let updateReadyToInstall = false;
let updateInstallInProgress = false;

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", async (info) => {
    if (updatePromptShown || updateDownloadInProgress || updateReadyToInstall || updateInstallInProgress) return;
    updatePromptShown = true;
    mainWindow?.webContents.send("update-available", {
      version: info.version,
      currentVersion: app.getVersion()
    });
    updatePromptShown = false;
  });

  autoUpdater.on("update-downloaded", async () => {
    updateDownloadInProgress = false;
    updateReadyToInstall = true;
    mainWindow?.webContents.send("update-download-progress", { percent: 100, completed: true });
    mainWindow?.webContents.send("update-ready");
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow?.webContents.send("update-download-progress", {
      percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    });
  });

  autoUpdater.on("error", (error) => {
    if (updateDownloadInProgress || updateInstallInProgress) {
      mainWindow?.webContents.send("update-download-error", {
        message: error?.message || "更新下载失败"
      });
    }
    updateDownloadInProgress = false;
    updateInstallInProgress = false;
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // 没有网络或当前版本尚未发布时静默跳过。
    });
  }, 5000);
}

ipcMain.handle("download-update", async () => {
  if (updateReadyToInstall) {
    return { ok: true, ready: true };
  }
  if (updateDownloadInProgress) {
    return { ok: true, inProgress: true };
  }

  updateDownloadInProgress = true;
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (error) {
    updateDownloadInProgress = false;
    return { ok: false, message: error?.message || "更新下载失败" };
  }
});

ipcMain.handle("install-downloaded-update", () => {
  if (!updateReadyToInstall || updateInstallInProgress) {
    return { ok: false, message: "更新尚未准备完成" };
  }

  updateInstallInProgress = true;
  try {
    autoUpdater.quitAndInstall(true, true);
    return { ok: true };
  } catch (error) {
    updateInstallInProgress = false;
    return { ok: false, message: error?.message || "更新安装启动失败" };
  }
});

function getWindowStatePath() {
  return path.join(app.getPath("userData"), WINDOW_STATE_FILE);
}

function loadWindowState() {
  try {
    const state = JSON.parse(
      fs.readFileSync(getWindowStatePath(), "utf8")
    );

    if (
      Number.isFinite(state.x) &&
      Number.isFinite(state.y) &&
      Number.isFinite(state.width) &&
      Number.isFinite(state.height)
    ) {
      return state;
    }
  } catch {
    // 首次启动或状态文件损坏时使用默认窗口尺寸。
  }

  return null;
}

function isWindowStateVisible(state) {
  if (!state) return false;

  return screen.getAllDisplays().some(display => {
    const area = display.workArea;
    const overlapWidth =
      Math.min(state.x + state.width, area.x + area.width) -
      Math.max(state.x, area.x);
    const overlapHeight =
      Math.min(state.y + state.height, area.y + area.height) -
      Math.max(state.y, area.y);

    return overlapWidth >= 80 && overlapHeight >= 80;
  });
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const bounds = mainWindow.getNormalBounds();
  try {
    fs.mkdirSync(path.dirname(getWindowStatePath()), { recursive: true });
    fs.writeFileSync(
      getWindowStatePath(),
      JSON.stringify({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      }, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("保存窗口尺寸失败", error);
  }
}
let requestId = 1;
// 当前聚焦的任务只代表 UI 选择，不代表整个运行时的唯一任务。
// 所有实际 Thread / Turn 状态都保存在 taskRuntime 中。
let focusedThreadId = null;
let pendingAttachments = [];
let retryAttachmentPaths = [];
const generatedAttachmentPaths = new Set();

const taskRuntime = new TaskRuntimeManager({
  maxConcurrent: 2
});

const MODEL_SETTINGS_FILE = path.join(
  os.homedir(),
  ".deepseek-codex-gui",
  "model-settings.json"
);

const PROJECT_MODEL_SETTINGS_FILE = path.join(
  os.homedir(),
  ".deepseek-codex-gui",
  "project-model-settings.json"
);

const DIAGNOSTIC_LOG_FILE = path.join(
  os.homedir(),
  ".deepseek-codex-gui",
  "error-log.jsonl"
);

const THEME_SETTINGS_FILE = path.join(
  os.homedir(),
  ".deepseek-codex-gui",
  "theme-settings.json"
);

const PERMISSION_SETTINGS_FILE = path.join(
  os.homedir(),
  ".deepseek-codex-gui",
  "permission-settings.json"
);

const ONBOARDING_STATE_FILE = path.join(
  os.homedir(),
  ".deepseek-codex-gui",
  "onboarding-state.json"
);

const API_KEY_PROFILE_FILE = path.join(
  os.homedir(),
  ".deepseek-codex-gui",
  "api-key-profile.json"
);

const PERMISSION_MODES = new Set(["ask", "workspace", "full"]);

function loadPermissionMode() {
  try {
    const value = JSON.parse(fs.readFileSync(PERMISSION_SETTINGS_FILE, "utf8"));
    return PERMISSION_MODES.has(value?.mode) ? value.mode : "ask";
  } catch {
    return "ask";
  }
}

let permissionMode = loadPermissionMode();

function isOnboardingCompleted() {
  try {
    const state = JSON.parse(fs.readFileSync(ONBOARDING_STATE_FILE, "utf8"));
    return Boolean(state.completed && state.appVersion === app.getVersion());
  } catch { return false; }
}

function completeOnboarding() {
  fs.mkdirSync(path.dirname(ONBOARDING_STATE_FILE), { recursive: true });
  fs.writeFileSync(ONBOARDING_STATE_FILE, JSON.stringify({ completed: true, appVersion: app.getVersion(), completedAt: Date.now() }, null, 2), "utf8");
  return { completed: true };
}

function getCodexSetupStatus() {
  const executable = resolveCodexExecutable();
  const configPath = path.join(os.homedir(), ".codex-deepseek", "config.toml");
  return {
    codexInstalled: executable !== "codex",
    executable,
    configExists: fs.existsSync(configPath),
    configPath,
    apiConfigured: fs.existsSync(configPath) && /experimental_bearer_token\s*=\s*["']sk-[^"']+/i.test(fs.readFileSync(configPath, "utf8"))
  };
}

function normalizeApiKeyName(name) {
  const normalized = String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40);
  return normalized || "未命名 API";
}

function maskDeepSeekApiKey(apiKey) {
  const normalized = String(apiKey || "").trim();
  if (!normalized) return "未配置";
  if (normalized.length <= 12) return `${normalized.slice(0, 3)}****${normalized.slice(-2)}`;
  const head = normalized.slice(0, 7);
  const tail = normalized.slice(-4);
  return `${head}${"*".repeat(18)}${tail}`;
}

function readConfiguredDeepSeekApiKey() {
  const configPath = path.join(os.homedir(), ".codex-deepseek", "config.toml");
  try {
    const content = fs.readFileSync(configPath, "utf8");
    return content.match(/experimental_bearer_token\s*=\s*["']([^"']+)["']/)?.[1] || "";
  } catch {
    return "";
  }
}

function readDeepSeekApiProfile() {
  try {
    const profile = JSON.parse(fs.readFileSync(API_KEY_PROFILE_FILE, "utf8"));
    return {
      name: normalizeApiKeyName(profile?.name),
      updatedAt: Number.isFinite(profile?.updatedAt) ? profile.updatedAt : null
    };
  } catch {
    return { name: "未命名 API", updatedAt: null };
  }
}

function getDeepSeekApiProfile() {
  const apiKey = readConfiguredDeepSeekApiKey();
  const profile = readDeepSeekApiProfile();
  return {
    configured: Boolean(apiKey),
    name: apiKey ? profile.name : "未配置",
    maskedKey: maskDeepSeekApiKey(apiKey),
    updatedAt: apiKey ? profile.updatedAt : null
  };
}

function configureDeepSeekApi(apiKey, displayName) {
  const normalized = String(apiKey || "").trim();
  if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(normalized)) {
    throw new Error("API Key 格式不正确，应以 sk- 开头");
  }
  const name = normalizeApiKeyName(displayName);
  const folder = path.join(os.homedir(), ".codex-deepseek");
  const configPath = path.join(folder, "config.toml");
  fs.mkdirSync(folder, { recursive: true });
  let content = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : [
    'model = "deepseek-v4-flash"',
    'model_provider = "deepseek"',
    'preferred_auth_method = "apikey"',
    'forced_login_method = "api"',
    "",
    "[model_providers.deepseek]",
    'name = "deepseek"',
    'base_url = "https://api.deepseek.com/"',
    'wire_api = "responses"'
  ].join("\n") + "\n";
  const backupPath = `${configPath}.backup-${Date.now()}`;
  if (fs.existsSync(configPath)) fs.copyFileSync(configPath, backupPath);
  if (/experimental_bearer_token\s*=\s*/i.test(content)) {
    content = content.replace(/experimental_bearer_token\s*=\s*["'][^"']*["']/i, `experimental_bearer_token = "${normalized}"`);
  } else {
    const marker = "[model_providers.deepseek]";
    const index = content.indexOf(marker);
    if (index >= 0) {
      const end = content.indexOf("\n[", index + marker.length);
      const insertAt = end >= 0 ? end : content.length;
      content = `${content.slice(0, insertAt).replace(/\s*$/, "\n")}experimental_bearer_token = "${normalized}"\n${content.slice(insertAt)}`;
    } else {
      content += `\n[model_providers.deepseek]\nexperimental_bearer_token = "${normalized}"\n`;
    }
  }
  fs.writeFileSync(configPath, content, "utf8");
  fs.mkdirSync(path.dirname(API_KEY_PROFILE_FILE), { recursive: true });
  fs.writeFileSync(API_KEY_PROFILE_FILE, JSON.stringify({ name, updatedAt: Date.now() }, null, 2), "utf8");
  return {
    ok: true,
    configPath,
    backupPath: fs.existsSync(backupPath) ? backupPath : null,
    profile: {
      configured: true,
      name,
      maskedKey: maskDeepSeekApiKey(normalized),
      updatedAt: Date.now()
    }
  };
}

function savePermissionMode(mode) {
  if (!PERMISSION_MODES.has(mode)) throw new Error("无效的权限模式");
  permissionMode = mode;
  fs.mkdirSync(path.dirname(PERMISSION_SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(PERMISSION_SETTINGS_FILE, JSON.stringify({ mode }, null, 2), "utf8");
  return { mode };
}

const THEME_CATALOG = [
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

const ALLOWED_THEMES = new Set(
  THEME_CATALOG.map(theme => theme.id)
);

const DEFAULT_THEME = "dark";

const MAX_DIAGNOSTIC_ENTRIES = 120;

function redactDiagnosticValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map(redactDiagnosticValue);
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /token|api.?key|authorization|secret/i.test(key)
          ? "[已隐藏]"
          : redactDiagnosticValue(item)
      ])
    );
  }

  return String(value)
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-[已隐藏]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [已隐藏]");
}

function readDiagnosticEntries() {
  try {
    if (!fs.existsSync(DIAGNOSTIC_LOG_FILE)) {
      return [];
    }

    return fs
      .readFileSync(DIAGNOSTIC_LOG_FILE, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-MAX_DIAGNOSTIC_ENTRIES)
      .map(line => JSON.parse(line))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function recordDiagnosticError(scope, error, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    scope: String(scope || "unknown"),
    message: redactDiagnosticValue(
      error?.message || error || "未知错误"
    ),
    details: redactDiagnosticValue(details)
  };

  try {
    fs.mkdirSync(path.dirname(DIAGNOSTIC_LOG_FILE), {
      recursive: true
    });

    const entries = [
      ...readDiagnosticEntries(),
      entry
    ].slice(-MAX_DIAGNOSTIC_ENTRIES);

    fs.writeFileSync(
      DIAGNOSTIC_LOG_FILE,
      entries.map(item => JSON.stringify(item)).join("\n") + "\n",
      "utf8"
    );
  } catch (writeError) {
    console.warn("写入诊断日志失败：", writeError.message);
  }

  sendToRenderer("diagnostic-error", entry);
  return entry;
}

function clearDiagnosticEntries() {
  fs.mkdirSync(path.dirname(DIAGNOSTIC_LOG_FILE), {
    recursive: true
  });
  fs.writeFileSync(DIAGNOSTIC_LOG_FILE, "", "utf8");
}

function loadThemeSettings() {
  try {
    if (!fs.existsSync(THEME_SETTINGS_FILE)) {
      return DEFAULT_THEME;
    }

    const value = JSON.parse(
      fs.readFileSync(THEME_SETTINGS_FILE, "utf8")
    );

    return ALLOWED_THEMES.has(value?.theme)
      ? value.theme
      : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function saveThemeSettings(theme) {
  fs.mkdirSync(
    path.dirname(THEME_SETTINGS_FILE),
    { recursive: true }
  );

  fs.writeFileSync(
    THEME_SETTINGS_FILE,
    JSON.stringify({ theme }, null, 2),
    "utf8"
  );
}

let themeSettings = loadThemeSettings();

function getDiagnosticsSnapshot() {
  const focusedTask = taskRuntime.get(focusedThreadId);

  return {
    generatedAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    platform: `${process.platform} ${process.arch}`,
    electron: process.versions.electron,
    node: process.versions.node,
    codexExecutable: resolveCodexExecutable(),
    codexHome: agentState.codexHome,
    projectPath: agentState.projectPath,
    status: agentState.status,
    model: modelSettings.model,
    reasoning: modelSettings.reasoning,
    theme: themeSettings,
    hasThread: Boolean(focusedThreadId),
    hasTurn: Boolean(focusedTask?.currentTurnId),
    focusedThreadId,
    taskCount: taskRuntime.tasks.size,
    activeTaskCount: taskRuntime.activeCount(),
    queuedTaskCount: taskRuntime.queuedCount(),
    errors: readDiagnosticEntries()
  };
}

function testDeepSeekConnection() {
  const apiKey = readConfiguredDeepSeekApiKey();

  return new Promise(resolve => {
    const proxyDetected = Boolean(process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy);
    const request = https.request({
      hostname: "api.deepseek.com",
      path: "/models",
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      timeout: 8000
    }, response => {
      response.resume();
      const auth = response.statusCode === 200 ? "通过" : response.statusCode === 401 ? "API Key 无效" : `返回状态 ${response.statusCode}`;
      resolve({ network: "基础接口可访问", auth, proxy: proxyDetected ? "检测到环境代理变量" : "未检测到环境代理变量", ok: response.statusCode === 200 });
    });
    request.on("timeout", () => request.destroy(new Error("连接超时")));
    request.on("error", error => resolve({ network: error.message === "连接超时" ? "基础接口连接超时" : "基础接口无法访问", auth: apiKey ? "未完成验证" : "未配置 API Key", proxy: proxyDetected ? "检测到环境代理变量" : "未检测到环境代理变量", ok: false }));
    request.end();
  });
}

async function runOnboardingTaskTest() {
  if (agentState.status !== "ready") {
    throw new Error("DeepSeek Codex 尚未连接");
  }

  const testProject = path.join(os.tmpdir(), "deepseek-codex-onboarding-test");
  fs.mkdirSync(testProject, { recursive: true });
  const previousFocusedThreadId = focusedThreadId;
  const startedAt = Date.now();
  const task = await ensureThread(null, testProject);
  const threadId = task.threadId;

  try {
    await startTurnForTask(task, {
      message: "请只回复：测试成功",
      attachments: [],
      permissionMode: "workspace"
    });

    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const current = taskRuntime.get(threadId);
      if (current?.status === "completed") {
        return {
          ok: true,
          durationMs: Date.now() - startedAt,
          message: "已验证真实 Codex 任务"
        };
      }
      if (current?.status === "error") {
        throw new Error(current.lastError?.message || "Codex 任务执行失败");
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error("Codex 任务测试超时，请检查网络后重试");
  } finally {
    threadHistory.remove(threadId);
    taskRuntime.tasks.delete(threadId);
    focusedThreadId = previousFocusedThreadId;
  }
}

const DEFAULT_MODEL_SETTINGS = {
  model: "deepseek-v4-flash",
  reasoning: "high"
};

const DEFAULT_MODEL_CATALOG = [
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    efforts: ["low", "medium", "high"]
  }
];

function normalizeModelSettings(
  value,
  fallback = DEFAULT_MODEL_SETTINGS
) {
  const reasoning = [
    "low",
    "medium",
    "high"
  ].includes(value?.reasoning)
    ? value.reasoning
    : fallback.reasoning;

  return {
    model:
      typeof value?.model === "string" && value.model.trim()
        ? value.model.trim()
        : fallback.model,
    reasoning
  };
}

function normalizeProjectKey(projectPath) {
  if (!projectPath || typeof projectPath !== "string") {
    return "";
  }

  return path
    .resolve(projectPath)
    .replace(/[\\/]+/g, "\\")
    .toLowerCase();
}

function loadModelSettings() {
  try {
    if (!fs.existsSync(MODEL_SETTINGS_FILE)) {
      return {
        ...DEFAULT_MODEL_SETTINGS
      };
    }

    const value = JSON.parse(
      fs.readFileSync(MODEL_SETTINGS_FILE, "utf8")
    );

    return normalizeModelSettings(value);
  } catch {
    return {
      ...DEFAULT_MODEL_SETTINGS
    };
  }
}

function loadProjectModelSettings() {
  try {
    if (!fs.existsSync(PROJECT_MODEL_SETTINGS_FILE)) {
      return {};
    }

    const value = JSON.parse(
      fs.readFileSync(PROJECT_MODEL_SETTINGS_FILE, "utf8")
    );

    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}

function saveProjectModelSettings() {
  fs.mkdirSync(
    path.dirname(PROJECT_MODEL_SETTINGS_FILE),
    { recursive: true }
  );

  fs.writeFileSync(
    PROJECT_MODEL_SETTINGS_FILE,
    JSON.stringify(projectModelSettings, null, 2),
    "utf8"
  );
}

function getProjectModelSettings(projectPath) {
  const key = normalizeProjectKey(projectPath);
  const value = key ? projectModelSettings[key] : null;

  if (
    !value ||
    typeof value.model !== "string" ||
    !["low", "medium", "high"].includes(value.reasoning)
  ) {
    return null;
  }

  return normalizeModelSettings(value);
}

function applyModelSettingsForProject(projectPath) {
  const override =
    getProjectModelSettings(projectPath);

  modelSettings = override || {
    ...globalModelSettings
  };

  agentState = {
    ...agentState,
    model: modelSettings.model,
    reasoning: modelSettings.reasoning,
    tokenUsage: null
  };

  return {
    ...modelSettings,
    hasProjectOverride: Boolean(override)
  };
}

function saveModelSettings(settings) {
  fs.mkdirSync(
    path.dirname(MODEL_SETTINGS_FILE),
    { recursive: true }
  );

  fs.writeFileSync(
    MODEL_SETTINGS_FILE,
    JSON.stringify(settings, null, 2),
    "utf8"
  );
}

let globalModelSettings = loadModelSettings();
let projectModelSettings = loadProjectModelSettings();
let modelSettings = {
  ...globalModelSettings
};

const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_SIZE = 50 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".pdf", ".xlsx", ".xls", ".csv", ".txt", ".md",
  ".docx", ".pptx", ".json", ".html", ".js", ".ts", ".py"
]);

const pendingRequests = new Map();
const pendingApprovals = new Map();

const CODEX_RECONNECT_BASE_DELAY = 1000;
const CODEX_RECONNECT_MAX_DELAY = 30000;

let agentState = {
  status: "starting",
  model: modelSettings.model,
  reasoning: modelSettings.reasoning,
  theme: themeSettings,
  tokenUsage: null,
  codexHome: path.join(os.homedir(), ".codex-deepseek"),
  projectPath: null,
  message: "正在启动 DeepSeek Codex..."
};

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function getTaskRuntimeState() {
  return {
    focusedThreadId,
    tasks: taskRuntime.snapshots(),
    maxConcurrentTasks: taskRuntime.maxConcurrent,
    activeTaskCount: taskRuntime.activeCount(),
    queuedTaskCount: taskRuntime.queuedCount()
  };
}

function sendTaskList() {
  sendToRenderer("task-list", getTaskRuntimeState());
}

function sendState() {
  sendToRenderer("agent-state", {
    ...agentState,
    embeddedProxy: getEmbeddedProxyStatus(),
    ...getTaskRuntimeState()
  });
}

function sendTaskState(threadId) {
  const task = taskRuntime.get(threadId);
  if (!task) return;

  sendToRenderer("task-state", {
    ...taskRuntime.snapshot(threadId),
    focused: focusedThreadId === threadId,
    maxConcurrentTasks: taskRuntime.maxConcurrent,
    activeTaskCount: taskRuntime.activeCount(),
    queuedTaskCount: taskRuntime.queuedCount()
  });
  sendTaskList();
}

function emitTaskEvent(channel, threadId, data = {}) {
  const task = threadId ? taskRuntime.get(threadId) : null;

  sendToRenderer(channel, {
    ...data,
    threadId: threadId || data.threadId || null,
    turnId: data.turnId || task?.currentTurnId || null
  });
}

function resolveTaskContext(params = {}) {
  const direct = taskRuntime.resolveContext(params);
  if (direct) return direct;

  const active = [...taskRuntime.tasks.values()]
    .filter(task => ACTIVE_STATUSES.has(task.status));

  // 只有在运行时明确只有一个活动任务时才允许兼容性回退。
  // 多任务同时运行时绝不把事件猜给当前聚焦任务。
  if (active.length === 1) {
    return {
      threadId: active[0].threadId,
      turnId: params.turnId || active[0].currentTurnId || null,
      itemId: params.itemId || null
    };
  }

  return null;
}

function markTaskEvent(threadId, event) {
  if (!threadId) return;
  taskRuntime.recordEvent(threadId, event);
  sendTaskState(threadId);
}

function rejectPendingRequests(error) {
  for (const [id, pending] of pendingRequests.entries()) {
    clearTimeout(pending.timeout);
    pendingRequests.delete(id);
    pending.reject(error);
  }
}

function scheduleCodexReconnect(reason = "Codex app-server 连接中断") {
  if (shuttingDown || codexReconnectTimer) {
    return;
  }

  codexReconnectAttempt += 1;

  const delay = Math.min(
    CODEX_RECONNECT_MAX_DELAY,
    CODEX_RECONNECT_BASE_DELAY *
      2 ** Math.min(codexReconnectAttempt - 1, 5)
  );

  agentState = {
    ...agentState,
    status: "reconnecting",
    message:
      `${reason}，${Math.ceil(delay / 1000)} 秒后自动重连（第 ${codexReconnectAttempt} 次）`
  };

  sendState();

  codexReconnectTimer = setTimeout(() => {
    codexReconnectTimer = null;
    void startCodexAppServer({ reconnect: true });
  }, delay);
}

function terminateCodexProcess(child = codexProcess) {
  if (!child) return;

  if (codexProcess === child) {
    codexProcess = null;
  }

  try {
    child.kill();
  } catch {
    // 进程已经退出时无需重复处理。
  }
}

function getAttachmentDirectory() {
  return path.join(
    os.homedir(),
    ".deepseek-codex-attachments"
  );
}

function inspectAttachment(filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("附件路径无效");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error("文件不存在");
  }

  const stat = fs.statSync(filePath);

  if (!stat.isFile()) {
    throw new Error("只能上传文件");
  }

  const ext = path.extname(filePath).toLowerCase();

  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
    throw new Error("不支持的文件类型");
  }

  if (stat.size > MAX_ATTACHMENT_SIZE) {
    throw new Error("单个附件不能超过 20 MB");
  }

  return {
    ext,
    size: stat.size
  };
}

function validateAttachmentFiles(files) {
  const accepted = [];
  const rejected = [];
  let totalSize = 0;

  for (const file of Array.isArray(files) ? files : []) {
    const filePath =
      typeof file === "string"
        ? file
        : file?.path;

    const name =
      file?.name ||
      (filePath ? path.basename(filePath) : "附件");

    try {
      const info = inspectAttachment(filePath);

      if (
        totalSize + info.size >
        MAX_TOTAL_ATTACHMENT_SIZE
      ) {
        throw new Error("本次附件总大小不能超过 50 MB");
      }

      totalSize += info.size;

      accepted.push({
        path: filePath,
        name,
        ext: info.ext,
        size: info.size
      });
    } catch (error) {
      rejected.push({
        name,
        reason: error.message
      });
    }
  }

  return {
    files: accepted,
    rejected
  };
}

function cleanupAttachmentFiles(filePaths = []) {
  for (const filePath of filePaths) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn("清理临时附件失败：", error.message);
    }
  }
}

function cleanupRetryAttachmentPaths() {
  cleanupAttachmentFiles(retryAttachmentPaths);
  retryAttachmentPaths = [];
}

function cleanupTaskAttachmentPaths(threadId) {
  const task = taskRuntime.get(threadId);
  if (!task) return;

  cleanupAttachmentFiles(task.attachmentPaths || []);
  task.attachmentPaths = [];
  taskRuntime.touch(task);
}

function cleanupTaskRetryAttachmentPaths(threadId) {
  const task = taskRuntime.get(threadId);
  if (!task) return;

  cleanupAttachmentFiles(task.retryAttachmentPaths || []);
  task.retryAttachmentPaths = [];
  taskRuntime.touch(task);
}

function createTaskRetryAttachmentSnapshot(threadId, files = []) {
  const task = taskRuntime.ensure(threadId);
  cleanupTaskRetryAttachmentPaths(threadId);

  if (!Array.isArray(files) || !files.length) {
    return [];
  }

  const attachmentDir = getAttachmentDirectory();
  fs.mkdirSync(attachmentDir, { recursive: true });
  const snapshot = [];

  try {
    files.forEach((file, index) => {
      const info = inspectAttachment(file?.path);
      const extension = String(info.ext || ".bin")
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, "") || ".bin";
      const safeExtension = extension.startsWith(".")
        ? extension
        : `.${extension}`;
      const targetPath = path.join(
        attachmentDir,
        `retry-attachment-${String(threadId).slice(0, 8)}-${Date.now()}-${index}${safeExtension}`
      );

      fs.copyFileSync(file.path, targetPath);
      task.retryAttachmentPaths.push(targetPath);
      snapshot.push({
        path: targetPath,
        name: file.name || path.basename(file.path),
        ext: info.ext,
        size: info.size
      });
    });

    taskRuntime.touch(task);
    return snapshot;
  } catch (error) {
    cleanupTaskRetryAttachmentPaths(threadId);
    throw error;
  }
}

function createRetryAttachmentSnapshot(files = []) {
  cleanupRetryAttachmentPaths();

  if (!Array.isArray(files) || !files.length) {
    return [];
  }

  const attachmentDir = getAttachmentDirectory();
  fs.mkdirSync(attachmentDir, {
    recursive: true
  });

  const snapshot = [];

  try {
    files.forEach((file, index) => {
      const info = inspectAttachment(file?.path);
      const extension =
        String(info.ext || ".bin")
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, "") || ".bin";
      const safeExtension = extension.startsWith(".")
        ? extension
        : `.${extension}`;
      const targetPath = path.join(
        attachmentDir,
        `retry-attachment-${Date.now()}-${index}${safeExtension}`
      );

      fs.copyFileSync(file.path, targetPath);
      retryAttachmentPaths.push(targetPath);
      snapshot.push({
        path: targetPath,
        name: file.name || path.basename(file.path),
        ext: info.ext,
        size: info.size
      });
    });

    return snapshot;
  } catch (error) {
    cleanupRetryAttachmentPaths();
    throw error;
  }
}

function cleanupStaleAttachmentFiles() {
  const attachmentDir = getAttachmentDirectory();
  const staleBefore = Date.now() - 24 * 60 * 60 * 1000;

  try {
    if (!fs.existsSync(attachmentDir)) return;

    for (const name of fs.readdirSync(attachmentDir)) {
      if (!/^(?:attachment-\d+-\d+|retry-attachment-[a-z0-9-]+|pasted-image-\d+|dropped-file-\d+-[a-z0-9]+)\.[a-z0-9]+$/i.test(name)) {
        continue;
      }

      const filePath = path.join(attachmentDir, name);
      const stat = fs.statSync(filePath);

      if (stat.isFile() && stat.mtimeMs < staleBefore) {
        cleanupAttachmentFiles([filePath]);
      }
    }
  } catch (error) {
    console.warn("清理历史临时附件失败：", error.message);
  }
}

function writeRpc(data) {
  if (!codexProcess || !codexProcess.stdin.writable) {
    throw new Error("Codex app-server 未运行");
  }

  codexProcess.stdin.write(JSON.stringify(data) + "\n");
}

function rpcRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!codexProcess || !codexProcess.stdin.writable) {
      const error = new Error("Codex app-server 未运行");
      recordDiagnosticError("rpc-unavailable", error, { method });
      reject(error);
      return;
    }

    const id = requestId++;

    pendingRequests.set(id, {
      resolve,
      reject,
      method,
      timeout: setTimeout(() => {
        pendingRequests.delete(id);
        const error = new Error(`请求超时: ${method}`);
        recordDiagnosticError("rpc-timeout", error, { method, requestId: id });
        reject(error);
      }, 30000)
    });

    try {
      writeRpc({
        method,
        id,
        params
      });
    } catch (error) {
      const pending = pendingRequests.get(id);
      clearTimeout(pending?.timeout);
      pendingRequests.delete(id);
      recordDiagnosticError("rpc-write", error, { method, requestId: id });
      reject(error);
    }
  });
}

function rpcNotification(method, params = {}) {
  if (!codexProcess || !codexProcess.stdin.writable) return;

  writeRpc({
    method,
    params
  });
}

function handleServerRequest(message) {
  const method = message.method;
  const params = message.params || {};
  const id = message.id;
  const context = resolveTaskContext(params);
  const threadId = context?.threadId || null;
  const turnId = context?.turnId || params.turnId || null;
  const itemId = context?.itemId || params.itemId || null;

  if (!threadId && taskRuntime.activeCount() > 1) {
    recordDiagnosticError(
      "ambiguous-approval-context",
      new Error("无法将审批请求安全归属到具体任务"),
      { method, requestId: id, params }
    );
  }

  if (
    method === "item/commandExecution/requestApproval"
  ) {
    pendingApprovals.set(String(id), {
      rpcId: id,
      type: "command",
      threadId,
      turnId,
      itemId
    });

    if (threadId) {
      const task = taskRuntime.setStatus(
        threadId,
        "waitingApproval"
      );
      task.approvals.push({
        requestId: String(id),
        type: "command",
        turnId,
        itemId,
        status: "pending",
        title: "DeepSeek Codex 请求执行命令",
        reason: params.reason || "",
        command:
          params.command ||
          params.parsedCmd ||
          params.commandLine ||
          "",
        cwd: params.cwd || ""
      });
      taskRuntime.recordEvent(threadId, {
        type: "approval-request",
        requestId: String(id),
        approvalType: "command",
        turnId,
        itemId,
        title: "DeepSeek Codex 请求执行命令",
        reason: params.reason || "",
        command:
          params.command ||
          params.parsedCmd ||
          params.commandLine ||
          "",
        cwd: params.cwd || ""
      });
      sendTaskState(threadId);
    }

    emitTaskEvent("approval-request", threadId, {
      requestId: String(id),
      type: "command",
      turnId,
      itemId,
      title: "DeepSeek Codex 请求执行命令",
      reason: params.reason || "",
      command:
        params.command ||
        params.parsedCmd ||
        params.commandLine ||
        "",
      cwd: params.cwd || "",
      params
    });

    return true;
  }

  if (
    method === "item/fileChange/requestApproval"
  ) {
    pendingApprovals.set(String(id), {
      rpcId: id,
      type: "file",
      threadId,
      turnId,
      itemId
    });

    if (threadId) {
      const task = taskRuntime.setStatus(
        threadId,
        "waitingApproval"
      );
      task.approvals.push({
        requestId: String(id),
        type: "file",
        turnId,
        itemId,
        status: "pending",
        title: "DeepSeek Codex 请求修改文件",
        reason: params.reason || "",
        grantRoot: params.grantRoot || ""
      });
      taskRuntime.recordEvent(threadId, {
        type: "approval-request",
        requestId: String(id),
        approvalType: "file",
        turnId,
        itemId,
        title: "DeepSeek Codex 请求修改文件",
        reason: params.reason || "",
        grantRoot: params.grantRoot || ""
      });
      sendTaskState(threadId);
    }

    emitTaskEvent("approval-request", threadId, {
      requestId: String(id),
      type: "file",
      turnId,
      itemId,
      title: "DeepSeek Codex 请求修改文件",
      reason: params.reason || "",
      grantRoot: params.grantRoot || "",
      params
    });

    return true;
  }

  return false;
}

function handleNotification(message) {
  const method = message.method;
  const params = message.params || {};
  const context = resolveTaskContext(params);
  const threadId = context?.threadId || null;
  const turnId =
    context?.turnId ||
    params.turnId ||
    params.turn?.id ||
    null;

  if (threadId && turnId) {
    taskRuntime.bindTurn(threadId, turnId);
  }

  // DeepSeek 最终回复
  if (method === "item/agentMessage/delta") {
    if (!threadId) return;

    const task = taskRuntime.ensure(threadId);
    task.streamedOutput += params.delta || "";
    taskRuntime.recordEvent(threadId, {
      type: "agent-delta",
      delta: params.delta || "",
      itemId: params.itemId || null,
      turnId
    });

    if (params.itemId) {
      taskRuntime.bindItem(threadId, params.itemId);
    }

    emitTaskEvent("agent-delta", threadId, {
      delta: params.delta || "",
      itemId: params.itemId || null,
      turnId
    });
    return;
  }

  // 一个操作开始
  if (method === "item/started") {
    const item = params.item || {};

    if (!threadId) return;

    if (item.id) {
      taskRuntime.bindItem(threadId, item.id);
    }

    if (item.type === "commandExecution") {
      const task = taskRuntime.ensure(threadId);
      task.commandExecutions.push({
        itemId: item.id,
        command: item.command || "",
        cwd: item.cwd || "",
        status: item.status || "inProgress"
      });
      taskRuntime.recordEvent(threadId, {
        type: "activity",
        kind: "command",
        phase: "started",
        itemId: item.id,
        turnId,
        command: item.command || "",
        cwd: item.cwd || "",
        status: item.status || "inProgress"
      });

      emitTaskEvent("agent-activity", threadId, {
        kind: "command",
        phase: "started",
        itemId: item.id,
        turnId,
        command: item.command || "",
        cwd: item.cwd || "",
        status: item.status || "inProgress"
      });
    }

    if (item.type === "fileChange") {
      taskRuntime.recordEvent(threadId, {
        type: "activity",
        kind: "file",
        phase: "started",
        itemId: item.id,
        turnId,
        changes: item.changes || [],
        status: item.status || "inProgress"
      });

      emitTaskEvent("agent-activity", threadId, {
        kind: "file",
        phase: "started",
        itemId: item.id,
        turnId,
        changes: item.changes || [],
        status: item.status || "inProgress"
      });
    }

    return;
  }

  // 命令实时输出
  if (method === "item/commandExecution/outputDelta") {
    if (!threadId) return;

    taskRuntime.recordEvent(threadId, {
      type: "activity",
      kind: "command-output",
      phase: "delta",
      itemId: params.itemId || null,
      turnId,
      delta: params.delta || ""
    });

    emitTaskEvent("agent-activity", threadId, {
      kind: "command-output",
      phase: "delta",
      itemId: params.itemId || null,
      turnId,
      delta: params.delta || ""
    });
    return;
  }

  // 一个操作完成
  if (method === "item/completed") {
    const item = params.item || {};

    if (!threadId) return;

    if (item.id) {
      taskRuntime.bindItem(threadId, item.id);
    }

    if (item.type === "commandExecution") {
      const task = taskRuntime.ensure(threadId);
      const command = task.commandExecutions
        .find(entry => entry.itemId === item.id);
      if (command) {
        Object.assign(command, {
          status: item.status || "completed",
          exitCode: item.exitCode,
          output: item.aggregatedOutput || ""
        });
      }
      taskRuntime.recordEvent(threadId, {
        type: "activity",
        kind: "command",
        phase: "completed",
        itemId: item.id,
        turnId,
        output: item.aggregatedOutput || "",
        command: item.command || "",
        cwd: item.cwd || "",
        status: item.status || "completed",
        exitCode: item.exitCode,
        durationMs: item.durationMs
      });

      emitTaskEvent("agent-activity", threadId, {
        kind: "command",
        phase: "completed",
        itemId: item.id,
        turnId,
        command: item.command || "",
        cwd: item.cwd || "",
        status: item.status || "completed",
        exitCode: item.exitCode,
        durationMs: item.durationMs,
        output: item.aggregatedOutput || ""
      });
    }

    if (item.type === "fileChange") {
      taskRuntime.recordEvent(threadId, {
        type: "activity",
        kind: "file",
        phase: "completed",
        itemId: item.id,
        turnId,
        changes: item.changes || [],
        status: item.status || "completed"
      });

      emitTaskEvent("agent-activity", threadId, {
        kind: "file",
        phase: "completed",
        itemId: item.id,
        turnId,
        changes: item.changes || [],
        status: item.status || "completed"
      });
    }

    return;
  }

  // 本轮代码改动 Diff
  if (method === "turn/diff/updated") {
    if (!threadId) return;

    const task = taskRuntime.ensure(threadId);
    task.diffs.push({
      turnId,
      diff: params.diff || "",
      updatedAt: new Date().toISOString()
    });
    taskRuntime.recordEvent(threadId, {
      type: "activity",
      kind: "diff",
      phase: "updated",
      turnId,
      diff: params.diff || ""
    });

    emitTaskEvent("agent-activity", threadId, {
      kind: "diff",
      phase: "updated",
      turnId,
      diff: params.diff || ""
    });
    return;
  }

  // Agent 计划
  if (method === "turn/plan/updated") {
    if (!threadId) return;

    taskRuntime.recordEvent(threadId, {
      type: "activity",
      kind: "plan",
      phase: "updated",
      turnId,
      explanation: params.explanation || "",
      plan: params.plan || []
    });

    emitTaskEvent("agent-activity", threadId, {
      kind: "plan",
      phase: "updated",
      turnId,
      explanation: params.explanation || "",
      plan: params.plan || []
    });
    return;
  }

  if (method === "thread/tokenUsage/updated") {
    if (threadId) {
      const task = taskRuntime.ensure(threadId);
      task.tokenUsage = params.tokenUsage || null;
      taskRuntime.touch(task);
      sendTaskState(threadId);
    } else {
      agentState = {
        ...agentState,
        tokenUsage: params.tokenUsage || null
      };
      sendState();
    }
    return;
  }

  // 中途错误
  if (method === "error") {
    const message =
      params.error?.message ||
      params.message ||
      "Codex 执行过程中发生错误";

    recordDiagnosticError("codex-notification", new Error(message), {
      method,
      turnId,
      threadId
    });

    if (threadId) {
      const task = taskRuntime.ensure(threadId);
      task.errors.push({
        message,
        turnId,
        timestamp: new Date().toISOString()
      });
      taskRuntime.recordEvent(threadId, {
        type: "activity",
        kind: "error",
        phase: "error",
        turnId,
        message
      });
    }

    emitTaskEvent("agent-activity", threadId, {
      kind: "error",
      phase: "error",
      turnId,
      message
    });
    return;
  }

  if (method === "turn/started") {
    const startedTurnId =
      params.turn?.id || params.turnId || null;

    if (!threadId || !startedTurnId) return;

    const startedTask = taskRuntime.bindTurn(
      threadId,
      startedTurnId
    );
    const hasPendingApproval = startedTask?.approvals
      ?.some(approval => approval.status === "pending");
    taskRuntime.setStatus(
      threadId,
      hasPendingApproval ? "waitingApproval" : "running"
    );
    taskRuntime.recordEvent(threadId, {
      type: "turn-state",
      status: "started",
      turnId: startedTurnId
    });

    emitTaskEvent("turn-state", threadId, {
      status: "started",
      turnId: startedTurnId
    });
    sendTaskState(threadId);

    return;
  }

  if (method === "turn/completed") {
    const completedTurnId =
      params.turn?.id ||
      params.turnId ||
      turnId;
    const completedStatus =
      params.turn?.status || "completed";

    if (!threadId) return;

    const normalizedStatus =
      completedStatus === "interrupted" ||
      completedStatus === "cancelled"
        ? "interrupted"
        : completedStatus === "failed" ||
          completedStatus === "error"
          ? "error"
          : "completed";

    const task = taskRuntime.get(threadId);
    if (task?.streamedOutput) {
      task.messages.push({
        role: "assistant",
        text: task.streamedOutput,
        turnId: completedTurnId,
        timestamp: new Date().toISOString()
      });
      task.streamedOutput = "";
    }

    taskRuntime.clearTurn(threadId, completedTurnId);
    cleanupTaskAttachmentPaths(threadId);
    if (normalizedStatus === "completed") {
      cleanupTaskRetryAttachmentPaths(threadId);
    }
    taskRuntime.setStatus(threadId, normalizedStatus, {
      lastError: params.turn?.error || null
    });
    taskRuntime.recordEvent(threadId, {
      type: "turn-state",
      status: normalizedStatus,
      turnId: completedTurnId,
      error: params.turn?.error || null
    });

    emitTaskEvent("turn-state", threadId, {
      status: normalizedStatus === "error"
        ? "failed"
        : normalizedStatus,
      error: params.turn?.error || null,
      turnId: completedTurnId
    });
    sendTaskState(threadId);
    void drainTaskQueue();
  }
}


function resolveCodexExecutable() {
  const candidates = [
    path.join(os.homedir(), "AppData", "Local", "Programs", "OpenAI", "Codex", "bin", "codex.exe"),
    path.join(process.env.APPDATA || "", "npm", "codex.cmd"),
    path.join(process.env.APPDATA || "", "npm", "codex.exe"),
    path.join(os.homedir(), ".deepseek-codex-gui", "codex-cli", "package", "vendor", "x86_64-pc-windows-msvc", "bin", "codex.exe")
  ];
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }

  // 如果以后 Codex 安装位置变化，
  // 则退回系统 PATH 查找。
  return "codex";
}

function resolveMihomoExecutable() {
  const candidates = process.resourcesPath
    ? [path.join(process.resourcesPath, "app.asar.unpacked", "resources", "mihomo", "mihomo.exe")]
    : [];
  candidates.push(path.join(__dirname, "resources", "mihomo", "mihomo.exe"));
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

async function writeEmbeddedProxyConfig(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const configPath = path.join(dataDir, "config.yaml");
  const response = await fetch(EMBEDDED_PROXY_SUBSCRIPTION_URL);
  if (!response.ok) throw new Error(`订阅下载失败（HTTP ${response.status}）`);
  const encoded = (await response.text()).trim();
  let decoded;
  try { decoded = Buffer.from(encoded, "base64").toString("utf8"); } catch { throw new Error("订阅格式无法解析"); }
  const proxies = decoded.split(/\r?\n/).map((line, index) => {
    if (!line.startsWith("vless://")) return null;
    const parsed = new URL(line);
    const params = parsed.searchParams;
    const name = decodeURIComponent(parsed.hash.slice(1) || `节点-${index + 1}`).replace(/[\r\n]/g, " ").slice(0, 40);
    return [
      `  - name: '${name.replace(/'/g, "''")}'`,
      "    type: vless",
      `    server: '${parsed.hostname}'`,
      `    port: ${parsed.port || 443}`,
      `    uuid: '${parsed.username}'`,
      "    udp: true",
      "    tls: true",
      `    servername: '${(params.get("sni") || params.get("host") || parsed.hostname).replace(/'/g, "''")}'`,
      "    network: ws",
      "    ws-opts:",
      `      path: '${decodeURIComponent(params.get("path") || "/").replace(/'/g, "''")}'`,
      "      headers:",
      `        Host: '${(params.get("host") || parsed.hostname).replace(/'/g, "''")}'`
    ].join("\n");
  }).filter(Boolean);
  if (!proxies.length) throw new Error("订阅中没有识别到可用 VLESS 节点");
  const config = [
    "mixed-port: 17890",
    "allow-lan: false",
    "mode: rule",
    "log-level: warning",
    "ipv6: false",
    "external-controller: 127.0.0.1:19090",
    "proxies:",
    ...proxies,
    "proxy-groups:",
    "  - name: DEEPSEEK-AUTO",
    "    type: url-test",
    "    proxies:",
    ...proxies.map((_, index) => `      - '${decodeURIComponent(new URL(decoded.split(/\r?\n/).filter((line) => line.startsWith("vless://"))[index]).hash.slice(1) || `节点-${index + 1}`).replace(/'/g, "''")}'`),
    "    url: http://www.gstatic.com/generate_204",
    "    interval: 300",
    "rules:",
    "  - MATCH,DEEPSEEK-AUTO",
    ""
  ].join("\n");
  fs.writeFileSync(configPath, config, "utf8");
  return configPath;
}

async function waitForLocalProxy(port = EMBEDDED_PROXY_PORT, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const reachable = await new Promise((resolve) => {
      const socket = require("net").connect({ host: "127.0.0.1", port }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
      socket.on("error", () => resolve(false));
    });
    if (reachable) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function ensureEmbeddedProxy() {
  if (mihomoProcess && !mihomoProcess.killed) {
    void refreshEmbeddedNetworkStatus();
    return { ok: true, port: EMBEDDED_PROXY_PORT, source: "内置代理" };
  }
  if (mihomoStartPromise) return mihomoStartPromise;
  mihomoStartPromise = (async () => {
    const executable = resolveMihomoExecutable();
    if (!executable) throw new Error("未找到内置代理核心");
    const dataDir = path.join(app.getPath("userData"), "embedded-proxy");
    const configPath = await writeEmbeddedProxyConfig(dataDir);
    const child = spawn(executable, ["-d", dataDir, "-f", configPath], {
      cwd: dataDir,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    mihomoProcess = child;
    child.stderr.on("data", (chunk) => recordDiagnosticError("mihomo-stderr", new Error(String(chunk).trim())));
    child.on("error", (error) => recordDiagnosticError("mihomo-process", error));
    child.on("exit", () => {
      if (mihomoProcess === child) mihomoProcess = null;
      if (embeddedNetworkProbeTimer) {
        clearTimeout(embeddedNetworkProbeTimer);
        embeddedNetworkProbeTimer = null;
      }
      setEmbeddedNetworkStatus("error");
    });
    const ready = await waitForLocalProxy();
    if (!ready) {
      try { child.kill(); } catch {}
      mihomoProcess = null;
      throw new Error("内置代理未能启动，请检查订阅是否有效");
    }
    void refreshEmbeddedNetworkStatus();
    return { ok: true, port: EMBEDDED_PROXY_PORT, source: "内置代理" };
  })();
  try { return await mihomoStartPromise; } finally { mihomoStartPromise = null; }
}

function setEmbeddedNetworkStatus(status) {
  const next = ["checking", "ok", "error"].includes(status) ? status : "error";
  if (embeddedNetworkStatus === next) return;
  embeddedNetworkStatus = next;
  sendState();
}

function scheduleEmbeddedNetworkProbe() {
  if (embeddedNetworkProbeTimer) clearTimeout(embeddedNetworkProbeTimer);
  embeddedNetworkProbeTimer = setTimeout(() => {
    embeddedNetworkProbeTimer = null;
    void refreshEmbeddedNetworkStatus();
  }, 30000);
}

function probeEmbeddedNetwork() {
  if (!mihomoProcess || mihomoProcess.killed) return Promise.resolve(false);
  if (embeddedNetworkProbePromise) return embeddedNetworkProbePromise;

  embeddedNetworkProbePromise = new Promise(resolve => {
    let settled = false;
    let socket = null;
    let secureSocket = null;
    let timer = null;

    const finish = result => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { secureSocket?.destroy(); } catch {}
      try { socket?.destroy(); } catch {}
      resolve(result);
    };

    timer = setTimeout(() => finish(false), 8000);
    socket = net.connect({ host: "127.0.0.1", port: EMBEDDED_PROXY_PORT });
    socket.setEncoding("utf8");
    let connectResponse = "";

    socket.once("connect", () => {
      socket.write(
        "CONNECT api.deepseek.com:443 HTTP/1.1\r\n" +
        "Host: api.deepseek.com:443\r\n" +
        "Connection: close\r\n\r\n"
      );
    });
    socket.on("data", chunk => {
      if (settled) return;
      connectResponse += chunk;
      const headerEnd = connectResponse.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;

      const statusLine = connectResponse.slice(0, connectResponse.indexOf("\r\n"));
      const statusCode = Number(statusLine.trim().split(/\s+/)[1] || 0);
      if (statusCode !== 200) {
        finish(false);
        return;
      }

      socket.removeAllListeners("data");
      secureSocket = tls.connect({ socket, servername: "api.deepseek.com" });
      secureSocket.once("secureConnect", () => {
        secureSocket.write(
          "GET / HTTP/1.1\r\n" +
          "Host: api.deepseek.com\r\n" +
          "Connection: close\r\n\r\n"
        );
      });
      let responseHead = "";
      secureSocket.on("data", data => {
        responseHead += data.toString();
        const lineEnd = responseHead.indexOf("\r\n");
        if (lineEnd >= 0) {
          const responseLine = responseHead.slice(0, lineEnd);
          const responseCode = Number(responseLine.trim().split(/\s+/)[1] || 0);
          finish(responseCode >= 200 && responseCode < 500 && responseCode !== 407);
        }
      });
      secureSocket.once("error", () => finish(false));
    });
    socket.once("timeout", () => finish(false));
    socket.setTimeout(8000);
    socket.once("error", () => finish(false));
    socket.once("close", () => finish(false));
  }).finally(() => {
    embeddedNetworkProbePromise = null;
  });

  return embeddedNetworkProbePromise;
}

async function refreshEmbeddedNetworkStatus() {
  if (!mihomoProcess || mihomoProcess.killed) {
    setEmbeddedNetworkStatus("error");
    return false;
  }

  setEmbeddedNetworkStatus("checking");
  const reachable = await probeEmbeddedNetwork();
  setEmbeddedNetworkStatus(reachable ? "ok" : "error");
  scheduleEmbeddedNetworkProbe();
  return reachable;
}

function getEmbeddedProxyStatus() {
  return {
    enabled: true,
    running: Boolean(mihomoProcess && !mihomoProcess.killed),
    networkStatus: embeddedNetworkStatus
  };
}

function bundledCodexPackage() {
  const folders = app.isPackaged
    ? [path.join(process.resourcesPath, "app.asar.unpacked", "resources", "codex-cli")]
    : [path.join(__dirname, "resources", "codex-cli")];
  for (const folder of folders) {
    const files = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
    const packageFile = files.find((file) => /^openai-codex-.*\.tgz$/i.test(file));
    if (packageFile) return path.join(folder, packageFile);
  }
  return null;
}

function bundledCodexWindowsPackage() {
  const folders = app.isPackaged
    ? [path.join(process.resourcesPath, "app.asar.unpacked", "resources", "codex-cli")]
    : [path.join(__dirname, "resources", "codex-cli")];
  for (const folder of folders) {
    const files = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
    const packageFile = files.find((file) => /win32-x64\.tgz$/i.test(file));
    if (packageFile) return path.join(folder, packageFile);
  }
  return null;
}

function installCodexCli() {
  return new Promise((resolve, reject) => {
    const packageSource = bundledCodexWindowsPackage();
    if (!packageSource) return reject(new Error("安装包中缺少 Codex CLI Windows 组件。"));
    const installRoot = path.join(os.homedir(), ".deepseek-codex-gui", "codex-cli");
    fs.mkdirSync(installRoot, { recursive: true });
    const child = spawn("tar.exe", ["-xzf", path.basename(packageSource), "-C", installRoot], {
      cwd: path.dirname(packageSource),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", (error) => reject(new Error(`无法启动系统解压工具：${error.message}`)));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`Codex CLI 安装失败（系统解压错误 ${code}）：${output.trim().slice(-240)}`));
      const executable = resolveCodexExecutable();
      if (executable === "codex") return reject(new Error("安装完成但未找到 Codex CLI，请重启软件后重试。"));
      resolve({ ok: true, bundled: true, executable, output: output.slice(-500) });
    });
  });
}

function runGitCommand(projectPath, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-C", projectPath, ...args],
      {
        cwd: projectPath,
        windowsHide: true,
        encoding: "utf8",
        timeout: options.timeout || 10000,
        maxBuffer: 2 * 1024 * 1024,
        env: {
          ...process.env,
          LC_ALL: "C.UTF-8",
          LANG: "C.UTF-8"
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }

        resolve(String(stdout || ""));
      }
    );
  });
}

function parseGitStatusOutput(output) {
  const value = String(output || "");
  let branchLine = "";
  const records = [];

  if (value.includes("\0")) {
    const tokens = value.split("\0");
    if (!tokens.at(-1)) tokens.pop();
    if (tokens[0]?.startsWith("## ")) {
      branchLine = tokens.shift();
    }

    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token.length < 3) continue;
      const code = token.slice(0, 2);
      const filePath = token.slice(3);
      const hasSecondPath =
        code.includes("R") || code.includes("C");
      const originalPath = hasSecondPath
        ? tokens[index + 1] || null
        : null;
      if (hasSecondPath) index += 1;
      records.push({ code, filePath, originalPath });
    }
  } else {
    const lines = value
      .split(/\r?\n/)
      .filter(Boolean);
    if (lines[0]?.startsWith("## ")) {
      branchLine = lines.shift();
    }

    for (const line of lines) {
      if (line.length < 3) continue;
      const code = line.slice(0, 2);
      const rawPath = line.slice(3);
      const renameSeparator = " -> ";
      const renameIndex = rawPath.lastIndexOf(renameSeparator);
      records.push({
        code,
        originalPath:
          renameIndex >= 0
            ? rawPath.slice(0, renameIndex)
            : null,
        filePath:
          renameIndex >= 0
            ? rawPath.slice(renameIndex + renameSeparator.length)
            : rawPath
      });
    }
  }

  const files = [];

  for (const record of records) {
    const { code, filePath, originalPath } = record;
    const hasStaged =
      code[0] !== " " && code[0] !== "?";
    const hasWorktree =
      code[1] !== " " && code[1] !== "?";
    const isConflict =
      code.includes("U") ||
      ["DD", "AA"].includes(code);

    files.push({
      code,
      index: code[0] || " ",
      worktree: code[1] || " ",
      path: filePath,
      originalPath,
      hasStaged,
      hasWorktree,
      isNew: code === "??" || code[0] === "A",
      isRenamed:
        code.includes("R") || code.includes("C"),
      kind:
        code === "??"
          ? "untracked"
          : isConflict
            ? "conflict"
            : hasStaged
              ? "staged"
              : "modified"
    });
  }

  let branch = "";
  let upstream = "";
  let ahead = 0;
  let behind = 0;

  if (branchLine.startsWith("## ")) {
    const value = branchLine.slice(3);
    const trackingMatch = value.match(
      /^(.*?)\.\.\.(\S+)(?: \[(.*?)\])?$/
    );

    if (trackingMatch) {
      branch = trackingMatch[1];
      upstream = trackingMatch[2];

      for (const item of String(trackingMatch[3] || "").split(",")) {
        const part = item.trim();
        const amount = Number(part.replace(/[^0-9]/g, ""));
        if (!Number.isFinite(amount)) continue;
        if (part.startsWith("ahead")) ahead = amount;
        if (part.startsWith("behind")) behind = amount;
      }
    } else if (value.startsWith("No commits yet on ")) {
      branch = value.replace("No commits yet on ", "").trim();
    } else {
      branch = value.split(" ")[0] || value;
    }
  }

  return {
    branch,
    upstream,
    ahead,
    behind,
    files,
    summary: {
      changed: files.length,
      staged: files.filter(item => item.hasStaged).length,
      modified: files.filter(item => item.hasWorktree).length,
      untracked: files.filter(item => item.kind === "untracked").length,
      conflicts: files.filter(item => item.kind === "conflict").length
    }
  };
}

async function getGitStatus(projectPath) {
  if (!projectPath || !fs.existsSync(projectPath)) {
    return {
      ok: false,
      isRepository: false,
      projectPath: projectPath || null,
      message: "请先选择项目文件夹"
    };
  }

  try {
    const [statusOutput, rootOutput] = await Promise.all([
      runGitCommand(projectPath, [
        "-c",
        "core.quotepath=false",
        "status",
        "--porcelain=v1",
        "-z",
        "--branch",
        "--untracked-files=all"
      ]),
      runGitCommand(projectPath, [
        "rev-parse",
        "--show-toplevel"
      ])
    ]);

    return {
      ok: true,
      isRepository: true,
      projectPath,
      repositoryRoot: rootOutput.trim() || projectPath,
      ...parseGitStatusOutput(statusOutput)
    };
  } catch (error) {
    const message =
      error?.code === "ENOENT"
        ? "系统未找到 Git，请先安装 Git"
        : /not a git repository/i.test(
            `${error?.stderr || ""} ${error?.message || ""}`
          )
          ? "当前项目不是 Git 仓库"
          : error?.stderr?.trim() ||
            error?.message ||
            "读取 Git 状态失败";

    recordDiagnosticError("git-status", error, {
      projectPath,
      code: error?.code || null
    });

    return {
      ok: false,
      isRepository: false,
      projectPath,
      message
    };
  }
}

function requireCurrentGitProject() {
  const projectPath = agentState.projectPath;
  if (!projectPath || !fs.existsSync(projectPath)) {
    throw new Error("请先选择项目文件夹");
  }
  return projectPath;
}

async function getGitRemoteStatus(projectPath) {
  const status = await getGitStatus(projectPath);
  if (!status.ok || !status.isRepository) return status;

  try {
    const [remoteOutput, branchOutput] = await Promise.all([
      runGitCommand(projectPath, ["remote", "-v"]),
      runGitCommand(projectPath, ["branch", "--format=%(refname:short)%09%(upstream:short)%09%(HEAD)"])
    ]);
    const remotes = remoteOutput.split(/\r?\n/).filter(Boolean).map(line => {
      const match = line.match(/^(.+?)\s+(\S+)\s+\((fetch|push)\)$/);
      return match ? { name: match[1], url: match[2], direction: match[3] } : null;
    }).filter(Boolean);
    const branches = branchOutput.split(/\r?\n/).filter(Boolean).map(line => {
      const [name, upstream, head] = line.split("\t");
      return { name, upstream: upstream || null, current: head === "*" };
    });
    return { ...status, remotes, branches, currentBranch: status.branch || null };
  } catch (error) {
    return { ...status, remotes: [], branches: [], currentBranch: status.branch || null, remoteError: error?.stderr?.trim() || error?.message || "读取远程状态失败" };
  }
}

async function runGitRemoteAction(action, args, options = {}) {
  const projectPath = requireCurrentGitProject();
  const before = await getGitStatus(projectPath);
  if (!before.ok || !before.isRepository) throw new Error(before.message || "当前项目不是 Git 仓库");
  const output = await runGitCommand(projectPath, args, options);
  return {
    ok: true,
    action,
    output: String(output || "").trim(),
    status: await getGitRemoteStatus(projectPath)
  };
}

async function withFreshGitStatus(result = {}) {
  return {
    ...result,
    status: await getGitStatus(
      requireCurrentGitProject()
    )
  };
}

async function discardGitFilesSafely(filePaths) {
  const projectPath = requireCurrentGitProject();
  const snapshot = await getGitStatus(projectPath);
  if (!snapshot.ok || !snapshot.isRepository) {
    throw new Error(
      snapshot.message || "当前项目不是 Git 仓库"
    );
  }

  const requested = new Set(
    (Array.isArray(filePaths) ? filePaths : []).map(String)
  );
  const selected = snapshot.files.filter(item =>
    requested.has(item.path)
  );

  if (!selected.length) {
    throw new Error("请至少选择一个仍有改动的文件");
  }

  if (
    selected.some(
      item => item.kind === "conflict" || item.isRenamed
    )
  ) {
    throw new Error(
      "重命名或冲突文件不能单独撤销，请先解决冲突，或使用存档点恢复整个项目。"
    );
  }

  const safetyCheckpoint = await gitReview.createCheckpoint(
    projectPath,
    `撤销 ${selected.length} 个文件前自动保护`
  );
  const newFiles = selected.filter(item => item.isNew);
  const trackedFiles = selected.filter(item => !item.isNew);

  if (trackedFiles.length) {
    await gitReview.restoreFilesToHead(
      projectPath,
      trackedFiles.map(item => item.path),
      { createSafety: false }
    );
  }

  if (newFiles.some(item => item.hasStaged)) {
    await gitReview.unstageFiles(
      projectPath,
      newFiles
        .filter(item => item.hasStaged)
        .map(item => item.path)
    );
  }

  const recycled = [];
  for (const item of newFiles) {
    const normalized = gitReview.normalizeRepositoryPath(
      snapshot.repositoryRoot,
      item.path
    );
    if (fs.existsSync(normalized.absolutePath)) {
      await shell.trashItem(normalized.absolutePath);
      recycled.push(item.path);
    }
  }

  return withFreshGitStatus({
    ok: true,
    restored: trackedFiles.map(item => item.path),
    recycled,
    safetyCheckpoint,
    message:
      "所选改动已撤销；撤销前状态已保存为存档点，新文件已移入回收站。"
  });
}

async function resumeCurrentThreadAfterReconnect() {
  const tasks = [...taskRuntime.tasks.values()]
    .filter(task => task.projectPath);

  for (const task of tasks) {
    const wasActive = ACTIVE_STATUSES.has(task.status);

    try {
      const result = await rpcRequest(
        "thread/resume",
        {
          threadId: task.threadId,
          model: task.model || modelSettings.model,
          cwd: task.projectPath,
          approvalPolicy: "on-request",
          sandbox: "workspace-write"
        }
      );

      const resumedThreadId =
        result?.thread?.id || task.threadId;

      if (resumedThreadId !== task.threadId) {
        recordDiagnosticError(
          "codex-thread-resume-id-changed",
          new Error("thread/resume 返回了不同的 Thread ID"),
          {
            previousThreadId: task.threadId,
            resumedThreadId
          }
        );
      }

      if (wasActive) {
        taskRuntime.clearTurn(task.threadId);
        taskRuntime.setStatus(task.threadId, "error", {
          lastError: {
            message:
              "Codex app-server 已重连；原执行中的 Turn 未被伪造恢复，请检查后继续发送。"
          }
        });
        emitTaskEvent("turn-state", task.threadId, {
          status: "failed",
          error: task.lastError,
          turnId: task.currentTurnId || null
        });
      } else if (task.status !== "queued") {
        taskRuntime.setStatus(task.threadId, "idle");
      }

      sendTaskState(task.threadId);
    } catch (error) {
      recordDiagnosticError(
        "codex-thread-resume",
        error,
        { threadId: task.threadId }
      );

      taskRuntime.clearTurn(task.threadId);
      taskRuntime.setStatus(task.threadId, "error", {
        lastError: {
          message:
            "连接已恢复，但当前任务上下文无法恢复；请检查后继续发送。"
        }
      });

      emitTaskEvent("agent-activity", task.threadId, {
        kind: "error",
        phase: "error",
        message:
          "连接已恢复，但当前任务上下文无法恢复；请检查后继续发送。"
      });
      sendTaskState(task.threadId);
    }
  }

  await drainTaskQueue();
}

async function startCodexAppServer(options = {}) {
  if (codexStartPromise) {
    return codexStartPromise;
  }

  const reconnecting = Boolean(options.reconnect);

  codexStartPromise = (async () => {
    const codexHome = path.join(
      os.homedir(),
      ".codex-deepseek"
    );

    agentState = {
      ...agentState,
      status: reconnecting ? "reconnecting" : "starting",
      message: reconnecting
        ? "正在自动重连 DeepSeek V4 Flash..."
        : "正在连接 DeepSeek V4 Flash..."
    };

    sendState();

    const codexExecutable =
      resolveCodexExecutable();
    const embeddedProxy = await ensureEmbeddedProxy();
    const child = spawn(
      codexExecutable,
      ["app-server", "--stdio"],
      {
        env: {
          ...process.env,
          CODEX_HOME: codexHome,
          HTTP_PROXY: `http://127.0.0.1:${embeddedProxy.port}`,
          HTTPS_PROXY: `http://127.0.0.1:${embeddedProxy.port}`,
          ALL_PROXY: `http://127.0.0.1:${embeddedProxy.port}`,
          http_proxy: `http://127.0.0.1:${embeddedProxy.port}`,
          https_proxy: `http://127.0.0.1:${embeddedProxy.port}`,
          all_proxy: `http://127.0.0.1:${embeddedProxy.port}`
        },
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    codexProcess = child;

    const rl = readline.createInterface({
      input: child.stdout
    });

    rl.on("line", (line) => {
      if (!line.trim()) return;

      let message;

      try {
        message = JSON.parse(line);
      } catch {
        return;
      }

      // Codex 对我们的 RPC 请求返回结果
      if (
        message.id !== undefined &&
        pendingRequests.has(message.id)
      ) {
        const pending =
          pendingRequests.get(message.id);

        clearTimeout(pending.timeout);
        pendingRequests.delete(message.id);

        if (message.error) {
          const error = new Error(
            message.error.message ||
            "Codex RPC error"
          );
          recordDiagnosticError("rpc-error", error, {
            method: pending.method,
            requestId: message.id,
            code: message.error.code
          });
          pending.reject(error);
        } else {
          pending.resolve(message.result);
        }

        return;
      }

      // Codex 主动请求我们审批
      if (
        message.id !== undefined &&
        message.method
      ) {
        if (handleServerRequest(message)) {
          return;
        }
      }

      // 普通通知
      if (message.method) {
        handleNotification(message);
      }
    });

    child.stderr.on("data", (data) => {
      const text = data.toString().trim();
      if (!text) return;
      console.log("[Codex]", text);
      recordDiagnosticError("codex-stderr", new Error(text));
    });

    child.on("error", (error) => {
      recordDiagnosticError("codex-process", error);
    });

    child.on("exit", (code) => {
      const isCurrentProcess =
        codexProcess === child;

      if (isCurrentProcess) {
        codexProcess = null;
      }

      rl.close();

      if (!isCurrentProcess) {
        return;
      }

      const exitMessage =
        `Codex app-server 已退出 (${code ?? "unknown"})`;

      if (code !== 0) {
        recordDiagnosticError(
          "codex-exit",
          new Error(exitMessage),
          { code }
        );
      }

      rejectPendingRequests(new Error(exitMessage));
      pendingApprovals.clear();

      for (const task of taskRuntime.tasks.values()) {
        if (!ACTIVE_STATUSES.has(task.status)) continue;

        const interruptedTurnId = task.currentTurnId;
        taskRuntime.clearTurn(task.threadId, interruptedTurnId);
        cleanupTaskAttachmentPaths(task.threadId);
        taskRuntime.setStatus(task.threadId, "error", {
          lastError: {
            message:
              "Codex app-server 连接中断，当前任务已停止"
          }
        });
        taskRuntime.recordEvent(task.threadId, {
          type: "turn-state",
          status: "failed",
          turnId: interruptedTurnId,
          error: task.lastError
        });
        emitTaskEvent("turn-state", task.threadId, {
          status: "failed",
          error: task.lastError,
          turnId: interruptedTurnId
        });
        sendTaskState(task.threadId);
      }

      if (shuttingDown) {
        agentState = {
          ...agentState,
          status: "offline",
          message: exitMessage
        };
        sendState();
        return;
      }

      scheduleCodexReconnect(exitMessage);
    });

    try {
      const initResult =
        await rpcRequest("initialize", {
          clientInfo: {
            name: "deepseek_codex_gui",
            title: "DeepSeek Codex GUI",
            version: "0.3.0"
          }
        });

      rpcNotification("initialized");

      await resumeCurrentThreadAfterReconnect();

      if (
        codexProcess !== child ||
        !child.stdin.writable
      ) {
        throw new Error(
          "Codex app-server 在恢复连接期间再次退出"
        );
      }

      codexReconnectAttempt = 0;

      agentState = {
        ...agentState,
        status: "ready",
        codexHome:
          initResult?.codexHome ||
          codexHome,
        message:
          "DeepSeek V4 Flash 已连接"
      };

      sendState();
      return true;
    } catch (error) {
      recordDiagnosticError("codex-start", error);
      terminateCodexProcess(child);

      if (shuttingDown) {
        agentState = {
          ...agentState,
          status: "offline",
          message: error.message
        };
        sendState();
        return false;
      }

      scheduleCodexReconnect(
        `连接失败：${error.message}`
      );
      return false;
    }
  })();

  try {
    return await codexStartPromise;
  } finally {
    codexStartPromise = null;
  }
}

function getFocusedTask() {
  return focusedThreadId
    ? taskRuntime.get(focusedThreadId)
    : null;
}

async function ensureThread(
  requestedThreadId = null,
  projectPath = agentState.projectPath
) {
  const existingThreadId =
    requestedThreadId || focusedThreadId;

  if (existingThreadId) {
    const existingTask = taskRuntime.get(existingThreadId);
    if (existingTask) return existingTask;
  }

  if (!projectPath) {
    throw new Error("请先选择项目文件夹");
  }

  const result = await rpcRequest("thread/start", {
    model: modelSettings.model,
    cwd: projectPath,
    approvalPolicy: "on-request",
    sandbox: "workspace-write"
  });

  const threadId = result?.thread?.id;
  if (!threadId) {
    throw new Error("Codex 没有返回新的 Thread ID");
  }

  const task = taskRuntime.ensure(threadId, {
    projectPath,
    model: modelSettings.model,
    reasoning: modelSettings.reasoning,
    status: "idle"
  });

  threadHistory.upsert({
    threadId,
    projectPath,
    title: "新任务",
    titleSource: "auto"
  });

  sendTaskState(threadId);
  return task;
}

function getActiveTasksForProject(projectPath, excludingThreadId = null) {
  const projectKey = normalizeProjectKey(projectPath);

  return [...taskRuntime.tasks.values()]
    .filter(task =>
      task.threadId !== excludingThreadId &&
      normalizeProjectKey(task.projectPath) === projectKey &&
      ACTIVE_STATUSES.has(task.status)
    );
}

function summarizeTaskTitle(message) {
  let title = String(message || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(请|帮我|麻烦你|能否|可以|我想|我需要|请帮我)\s*/i, "")
    .split(/[。！？!?；;]/)[0]
    .trim();

  if (!title) return "新任务";
  return title.length > 16
    ? `${title.slice(0, 16).trim()}…`
    : title;
}

function notifyProjectConflict(task) {
  const conflicts = getActiveTasksForProject(
    task.projectPath,
    task.threadId
  );

  if (!conflicts.length) return;

  emitTaskEvent("task-conflict-warning", task.threadId, {
    projectPath: task.projectPath,
    conflictingThreadIds: conflicts.map(item => item.threadId),
    message:
      "当前项目已有其他任务正在执行。多个任务同时修改同一项目可能产生文件覆盖或上下文冲突，请谨慎操作。"
  });
}

async function startTurnForTask(task, payload) {
  if (!task || !payload) {
    throw new Error("缺少任务运行参数");
  }

  const threadId = task.threadId;
  task.permissionMode = payload.permissionMode || task.permissionMode || permissionMode;
  task.model = task.model || modelSettings.model;
  task.reasoning = task.reasoning || modelSettings.reasoning;
  taskRuntime.setStatus(threadId, "starting");
  notifyProjectConflict(task);
  sendTaskState(threadId);

  const attachmentCollector = [];
  task.attachmentPaths = attachmentCollector;

  try {
    const input = buildTurnInputWithAttachments(
      payload.message,
      payload.attachments,
      task.projectPath,
      attachmentCollector
    );

    const permission = task.permissionMode === "full"
      ? { approvalPolicy: "never", sandbox: "danger-full-access" }
      : task.permissionMode === "workspace"
        ? { approvalPolicy: "never", sandbox: "workspace-write" }
        : { approvalPolicy: "on-request", sandbox: "workspace-write" };

    const result = await rpcRequest("turn/start", {
      threadId,
      model: task.model,
      effort: task.reasoning,
      input,
      ...permission
    });

    const turnId = result?.turn?.id || null;
    if (turnId) {
      taskRuntime.bindTurn(threadId, turnId);
    }
    const hasPendingApproval = task.approvals
      .some(approval => approval.status === "pending");
    taskRuntime.setStatus(
      threadId,
      hasPendingApproval ? "waitingApproval" : "running"
    );
    sendTaskState(threadId);

    return {
      ok: true,
      threadId,
      turnId,
      retryAttachments: payload.attachments
    };
  } catch (error) {
    recordDiagnosticError("send-message", error, {
      threadId,
      model: task.model,
      reasoning: task.reasoning,
      hasAttachments: payload.attachments.length > 0
    });

    cleanupTaskAttachmentPaths(threadId);
    taskRuntime.setStatus(threadId, "error", {
      lastError: { message: error.message }
    });
    emitTaskEvent("turn-state", threadId, {
      status: "failed",
      error: { message: error.message },
      turnId: task.currentTurnId || null
    });
    sendTaskState(threadId);
    void drainTaskQueue();
    throw error;
  }
}

async function drainTaskQueue() {
  while (taskRuntime.canStart()) {
    const entry = taskRuntime.takeNextRunnable();
    if (!entry) break;

    const task = taskRuntime.get(entry.threadId);
    if (!task) continue;

    sendTaskState(entry.threadId);
    void startTurnForTask(task, entry.payload)
      .catch(() => {
        // startTurnForTask 已经把错误状态发送给 renderer。
      });
  }
}

function createWindow() {
  const savedWindowState = loadWindowState();
  const windowBounds = isWindowStateVisible(savedWindowState)
    ? savedWindowState
    : { width: 1200, height: 780 };

  mainWindow =
    new BrowserWindow({
      x: windowBounds.x,
      y: windowBounds.y,
      width: windowBounds.width,
      height: windowBounds.height,
      minWidth: 900,
      minHeight: 600,
      backgroundColor: "#0b0f14",
      title: "DeepSeek Codex",
      icon: path.join(__dirname, "assets", "brand", "deepseek-codex-app.ico"),
      autoHideMenuBar: true,

      webPreferences: {
        preload:
          path.join(
            __dirname,
            "preload.js"
          ),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

  mainWindow.on("close", saveWindowState);

  mainWindow.loadFile("index.html");

  mainWindow.webContents.on(
    "did-finish-load",
    sendState
  );

  mainWindow.webContents.on(
    "context-menu",
    (_event, params) => {
      const isEditable = Boolean(params.isEditable);
      const hasSelection = Boolean(
        params.selectionText
      );

      if (!isEditable && !hasSelection) {
        return;
      }

      const editFlags = params.editFlags || {};
      const menu = Menu.buildFromTemplate([
        {
          label: "复制",
          enabled: Boolean(
            hasSelection && editFlags.canCopy
          ),
          click: () => mainWindow.webContents.copy()
        },
        {
          label: "剪切",
          enabled: Boolean(
            isEditable && editFlags.canCut
          ),
          click: () => mainWindow.webContents.cut()
        },
        {
          label: "粘贴",
          enabled: Boolean(
            isEditable && editFlags.canPaste
          ),
          click: () => mainWindow.webContents.paste()
        },
        {
          label: "删除",
          enabled: Boolean(
            isEditable && editFlags.canDelete
          ),
          click: () => mainWindow.webContents.delete()
        },
        { type: "separator" },
        {
          label: "全选",
          enabled: Boolean(
            isEditable || editFlags.canSelectAll
          ),
          click: () => mainWindow.webContents.selectAll()
        }
      ]);

      menu.popup({
        window: mainWindow
      });
    }
  );
}

ipcMain.handle(
  "select-project",
  async () => {
    const result =
      await dialog.showOpenDialog(
        mainWindow,
        {
          title:
            "选择要用 DeepSeek Codex 打开的项目",
          properties: [
            "openDirectory",
            "createDirectory"
          ]
        }
      );

    if (
      result.canceled ||
      !result.filePaths.length
    ) {
      return null;
    }

    agentState.projectPath =
      result.filePaths[0];

    applyModelSettingsForProject(
      agentState.projectPath
    );

    focusedThreadId = null;

    recentProjects.add(
      agentState.projectPath
    );

    sendState();

    return agentState.projectPath;
  }
);

ipcMain.handle(
  "new-task",
  async () => {
    focusedThreadId = null;
    agentState = {
      ...agentState,
      tokenUsage: null
    };
    sendState();

    return {
      ok: true,
      projectPath: agentState.projectPath
    };
  }
);

ipcMain.handle(
  "get-agent-state",
  () => ({
    ...agentState,
    ...getTaskRuntimeState()
  })
);

ipcMain.handle(
  "get-task-states",
  () => getTaskRuntimeState()
);

ipcMain.handle(
  "get-task-state",
  (_event, threadId) => taskRuntime.snapshot(threadId)
);

ipcMain.handle(
  "select-task",
  async (_event, threadId) => {
    const task = taskRuntime.get(threadId);
    if (!task) {
      throw new Error("找不到运行中的任务");
    }

    focusedThreadId = task.threadId;
    agentState.projectPath = task.projectPath;
    applyModelSettingsForProject(task.projectPath);
    agentState = {
      ...agentState,
      tokenUsage: task.tokenUsage || null
    };
    sendState();

    return taskRuntime.snapshot(threadId);
  }
);

ipcMain.handle(
  "get-theme-settings",
  () => ({
    theme: themeSettings,
    themes: THEME_CATALOG
  })
);

ipcMain.handle(
  "set-theme-settings",
  (_event, theme) => {
    if (!ALLOWED_THEMES.has(theme)) {
      throw new Error("主题无效");
    }

    themeSettings = theme;
    saveThemeSettings(themeSettings);

    agentState = {
      ...agentState,
      theme: themeSettings
    };

    sendState();

    return {
      ok: true,
      theme: themeSettings
    };
  }
);

ipcMain.handle(
  "get-git-status",
  () => getGitStatus(agentState.projectPath)
);

ipcMain.handle(
  "get-git-remote-status",
  () => getGitRemoteStatus(agentState.projectPath)
);

ipcMain.handle(
  "git-fetch",
  () => runGitRemoteAction("fetch", ["fetch", "--prune"], { timeout: 120000 })
);

ipcMain.handle(
  "git-pull",
  async () => {
    const status = await getGitStatus(requireCurrentGitProject());
    if (status.summary?.conflicts) throw new Error("当前项目已有冲突，请先解决冲突后再拉取");
    return runGitRemoteAction("pull", ["pull", "--ff-only"], { timeout: 120000 });
  }
);

ipcMain.handle(
  "git-push",
  async () => {
    const status = await getGitStatus(requireCurrentGitProject());
    if (!status.upstream) throw new Error("当前分支还没有配置远程跟踪分支，请先在 GitHub Desktop 中发布分支");
    return runGitRemoteAction("push", ["push"], { timeout: 120000 });
  }
);

ipcMain.handle(
  "git-switch-branch",
  async (_event, branchName) => {
    const projectPath = requireCurrentGitProject();
    const status = await getGitStatus(projectPath);
    if (status.summary?.changed) throw new Error("当前项目有未提交修改，请先提交或创建安全存档后再切换分支");
    const branch = String(branchName || "").trim();
    if (!/^[A-Za-z0-9._\/-]+$/.test(branch)) throw new Error("分支名称无效");
    return runGitRemoteAction("switch", ["switch", branch], { timeout: 30000 });
  }
);

ipcMain.handle(
  "git-init-repository",
  async () => {
    const projectPath = agentState.projectPath;
    if (!projectPath || !fs.existsSync(projectPath)) {
      return { ok: false, message: "请先选择项目文件夹" };
    }
    try {
      await runGitCommand(projectPath, ["init"]);
      return { ok: true, message: "已初始化 Git 仓库", status: await getGitStatus(projectPath) };
    } catch (error) {
      return { ok: false, message: error?.code === "ENOENT" ? "系统未找到 Git，请先安装 Git" : error?.stderr?.trim() || error?.message || "初始化 Git 失败" };
    }
  }
);

ipcMain.handle(
  "get-git-file-diff",
  (_event, filePath) =>
    gitReview.getFileDiff(
      requireCurrentGitProject(),
      filePath
    )
);

ipcMain.handle(
  "git-stage-files",
  async (_event, filePaths) =>
    withFreshGitStatus(
      await gitReview.stageFiles(
        requireCurrentGitProject(),
        filePaths
      )
    )
);

ipcMain.handle(
  "git-unstage-files",
  async (_event, filePaths) =>
    withFreshGitStatus(
      await gitReview.unstageFiles(
        requireCurrentGitProject(),
        filePaths
      )
    )
);

ipcMain.handle(
  "git-create-checkpoint",
  async (_event, label) =>
    withFreshGitStatus({
      ok: true,
      checkpoint: await gitReview.createCheckpoint(
        requireCurrentGitProject(),
        label
      )
    })
);

ipcMain.handle(
  "git-list-checkpoints",
  () =>
    gitReview.listCheckpoints(
      requireCurrentGitProject()
    )
);

ipcMain.handle(
  "git-restore-checkpoint",
  async (_event, checkpointId) =>
    withFreshGitStatus(
      await gitReview.restoreCheckpoint(
        requireCurrentGitProject(),
        checkpointId
      )
    )
);

ipcMain.handle(
  "git-discard-files",
  (_event, filePaths) =>
    discardGitFilesSafely(filePaths)
);

ipcMain.handle(
  "git-commit-staged",
  async (_event, message) =>
    withFreshGitStatus(
      await gitReview.commitStaged(
        requireCurrentGitProject(),
        message
      )
    )
);

ipcMain.handle(
  "get-diagnostics",
  () => getDiagnosticsSnapshot()
);

ipcMain.handle(
  "clear-diagnostics",
  () => {
    clearDiagnosticEntries();
    return {
      ok: true
    };
  }
);

ipcMain.handle(
  "get-retry-attachments",
  () => (getFocusedTask()?.retryAttachmentPaths || retryAttachmentPaths)
    .filter(filePath => fs.existsSync(filePath))
    .map(filePath => {
      const info = inspectAttachment(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        ext: info.ext,
        size: info.size
      };
    })
);

ipcMain.handle(
  "get-model-settings",
  () => {
    const projectOverride =
      getProjectModelSettings(agentState.projectPath);

    return {
      ...modelSettings,
      defaults: globalModelSettings,
      globalDefaults: globalModelSettings,
      projectPath: agentState.projectPath,
      hasProjectOverride: Boolean(projectOverride),
      scope: projectOverride ? "project" : "global",
      models: DEFAULT_MODEL_CATALOG
    };
  }
);

ipcMain.handle(
  "list-models",
  async () => {
    if (!codexProcess || !codexProcess.stdin.writable) {
      return DEFAULT_MODEL_CATALOG;
    }

    try {
      const result = await rpcRequest(
        "model/list",
        {
          limit: 100,
          includeHidden: false
        }
      );

      const models =
        Array.isArray(result?.data)
          ? result.data
              .filter(model => model && !model.hidden)
              .map(model => ({
                id:
                  model.model ||
                  model.id,
                label:
                  model.displayName ||
                  model.model ||
                  model.id,
                description:
                  model.description || "",
                efforts:
                  Array.isArray(model.supportedReasoningEfforts)
                    ? model.supportedReasoningEfforts.map(
                        effort => effort.reasoningEffort
                      )
                    : ["low", "medium", "high"]
              }))
              .filter(model => model.id)
          : [];

      return models.length
        ? models
        : DEFAULT_MODEL_CATALOG;
    } catch {
      return DEFAULT_MODEL_CATALOG;
    }
  }
);

ipcMain.handle(
  "set-model-settings",
  async (_event, payload) => {
    const focusedTask = getFocusedTask();
    if (focusedTask && ACTIVE_STATUSES.has(focusedTask.status)) {
      throw new Error("当前任务执行中，请完成或停止后再切换设置");
    }

    const model =
      typeof payload?.model === "string"
        ? payload.model.trim()
        : "";

    const reasoning =
      String(payload?.reasoning || "").toLowerCase();
    const scope =
      ["project", "global", "inherit"].includes(payload?.scope)
        ? payload.scope
        : "project";

    if (!model || model.length > 160) {
      throw new Error("模型名称无效");
    }

    if (!["low", "medium", "high"].includes(reasoning)) {
      throw new Error("推理强度无效");
    }

    const nextSettings = {
      model,
      reasoning
    };

    if (
      (scope === "project" || scope === "inherit") &&
      !agentState.projectPath
    ) {
      throw new Error("请先选择项目后再使用项目级设置");
    }

    if (scope === "project") {
      projectModelSettings[
        normalizeProjectKey(agentState.projectPath)
      ] = nextSettings;
      saveProjectModelSettings();
      modelSettings = nextSettings;
    } else if (scope === "inherit") {
      delete projectModelSettings[
        normalizeProjectKey(agentState.projectPath)
      ];
      saveProjectModelSettings();
      modelSettings = {
        ...globalModelSettings
      };
    } else {
      globalModelSettings = nextSettings;
      saveModelSettings(globalModelSettings);

      if (!getProjectModelSettings(agentState.projectPath)) {
        modelSettings = {
          ...globalModelSettings
        };
      }
    }

    agentState = {
      ...agentState,
      model,
      reasoning
    };

    sendState();

    return {
      ok: true,
      ...modelSettings,
      savedScope: scope,
      globalDefaults: globalModelSettings,
      hasProjectOverride: Boolean(
        getProjectModelSettings(agentState.projectPath)
      )
    };
  }
);

ipcMain.handle(
  "get-thread-history",
  () => {
    return threadHistory.list(
      agentState.projectPath || null
    );
  }
);

ipcMain.handle(
  "resume-thread",
  async (_event, threadId) => {
    const record =
      threadHistory.get(threadId);

    if (!record) {
      throw new Error("找不到这条历史任务");
    }

    agentState.projectPath =
      record.projectPath;

    applyModelSettingsForProject(
      record.projectPath
    );

    recentProjects.add(
      record.projectPath
    );

    const existingTask = taskRuntime.get(threadId);
    if (
      existingTask &&
      ACTIVE_STATUSES.has(existingTask.status)
    ) {
      focusedThreadId = threadId;
      agentState = {
        ...agentState,
        tokenUsage: existingTask.tokenUsage || null
      };
      sendState();

      return {
        record,
        thread: null,
        task: taskRuntime.snapshot(threadId),
        alreadyRunning: ACTIVE_STATUSES.has(existingTask.status)
      };
    }

    const result =
      await rpcRequest(
        "thread/resume",
        {
          threadId,
          model: modelSettings.model,
          cwd: record.projectPath,
          approvalPolicy: "on-request",
          sandbox: "workspace-write"
        }
      );

    const resumedThreadId =
      result.thread.id;

    focusedThreadId = resumedThreadId;
    const resumedTask = taskRuntime.ensure(resumedThreadId, {
      projectPath: record.projectPath,
      model: modelSettings.model,
      reasoning: modelSettings.reasoning,
      historyThread: result.thread,
      status: "idle"
    });
    resumedTask.historyThread = result.thread;
    taskRuntime.touch(resumedTask);

    threadHistory.upsert({
      threadId: resumedThreadId,
      projectPath: record.projectPath,
      title: record.title
    });

    sendState();
    sendTaskState(resumedThreadId);

    return {
      record,
      thread: result.thread,
      task: taskRuntime.snapshot(resumedThreadId),
      alreadyRunning: false
    };
  }
);

ipcMain.handle(
  "get-recent-projects",
  () => {
    return recentProjects.load();
  }
);

ipcMain.handle(
  "open-recent-project",
  async (_event, projectPath) => {
    if (
      !projectPath ||
      !require("fs").existsSync(projectPath)
    ) {
      throw new Error("项目文件夹不存在");
    }

    agentState.projectPath =
      projectPath;

    applyModelSettingsForProject(projectPath);

    focusedThreadId = null;

    recentProjects.add(projectPath);

    sendState();

    return projectPath;
  }
);

ipcMain.handle(
  "open-project-folder",
  async (_event, projectPath) => {
    if (
      !projectPath ||
      !fs.existsSync(projectPath) ||
      !fs.statSync(projectPath).isDirectory()
    ) {
      throw new Error("项目文件夹不存在");
    }

    const errorMessage = await shell.openPath(projectPath);
    if (errorMessage) {
      throw new Error(errorMessage);
    }

    return { ok: true, projectPath };
  }
);

function resolveWorkspacePath(projectPath, relativePath = "") {
  if (!projectPath || typeof projectPath !== "string") throw new Error("未选择项目");
  const root = path.resolve(projectPath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error("项目文件夹不存在");
  const target = path.resolve(root, relativePath || ".");
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("路径超出项目目录");
  return { root, target };
}

function listWorkspaceEntries(projectPath, query = "") {
  const { root } = resolveWorkspacePath(projectPath);
  const ignored = new Set([".git", "node_modules", "dist", "release", "backup", "backups"]);
  const result = [];
  const needle = String(query || "").trim().toLowerCase();
  const walk = (directory, depth) => {
    if (depth > 5 || result.length >= 800) return;
    let entries = [];
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (ignored.has(entry.name) || entry.name.startsWith(".")) continue;
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
      if (needle && !relative.toLowerCase().includes(needle)) {
        if (entry.isDirectory()) walk(absolute, depth + 1);
        continue;
      }
      let stat;
      try { stat = fs.statSync(absolute); } catch { continue; }
      result.push({ name: entry.name, path: relative, type: entry.isDirectory() ? "directory" : "file", size: stat.size, modifiedAt: stat.mtimeMs });
      if (entry.isDirectory()) walk(absolute, depth + 1);
      if (result.length >= 800) return;
    }
  };
  walk(root, 0);
  return result;
}

ipcMain.handle("get-project-workspace", () => {
  const projectPath = agentState.projectPath;
  const entries = listWorkspaceEntries(projectPath);
  return { projectPath, entries, recent: entries.filter(item => item.type === "file").sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 8) };
});

ipcMain.handle("search-project-workspace", (_event, query) => ({
  projectPath: agentState.projectPath,
  entries: listWorkspaceEntries(agentState.projectPath, query).slice(0, 120)
}));

ipcMain.handle("open-project-file", async (_event, relativePath) => {
  const { target } = resolveWorkspacePath(agentState.projectPath, relativePath);
  if (!fs.statSync(target).isFile()) throw new Error("只能打开文件");
  const errorMessage = await shell.openPath(target);
  if (errorMessage) throw new Error(errorMessage);
  return { ok: true };
});

ipcMain.handle(
  "get-permission-settings",
  () => ({ mode: permissionMode })
);

ipcMain.handle(
  "set-permission-settings",
  (_event, mode) => savePermissionMode(mode)
);

ipcMain.handle(
  "get-onboarding-state",
  () => ({ completed: isOnboardingCompleted() })
);

ipcMain.handle("get-embedded-proxy-status", () => getEmbeddedProxyStatus());

ipcMain.handle(
  "complete-onboarding",
  () => completeOnboarding()
);

ipcMain.handle(
  "open-codex-config-folder",
  async () => {
    const folder = path.join(os.homedir(), ".codex-deepseek");
    fs.mkdirSync(folder, { recursive: true });
    const errorMessage = await shell.openPath(folder);
    if (errorMessage) throw new Error(errorMessage);
    return { ok: true, folder };
  }
);

ipcMain.handle("get-codex-setup-status", () => getCodexSetupStatus());

ipcMain.handle("get-deepseek-api-profile", () => getDeepSeekApiProfile());

ipcMain.handle("install-codex-cli", () => installCodexCli());

ipcMain.handle("configure-deepseek-api", (_event, payload) => {
  const input = payload && typeof payload === "object" ? payload : { apiKey: payload };
  const result = configureDeepSeekApi(input.apiKey, input.name);
  scheduleCodexReconnect("API 配置已更新");
  return result;
});

ipcMain.handle("test-deepseek-connection", () => testDeepSeekConnection());
ipcMain.handle("run-onboarding-task-test", () => runOnboardingTaskTest());
ipcMain.handle("check-for-updates", async () => {
  if (!app.isPackaged) {
    await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "检查更新",
      message: "开发环境不执行更新检查。",
      detail: "请使用已安装的正式版本进行更新测试。"
    });
    return { ok: true, development: true };
  }

  if (updateReadyToInstall) {
    mainWindow?.webContents.send("update-ready");
    return { ok: true, ready: true };
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result || result.updateInfo.version === app.getVersion()) {
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "检查更新",
        message: `当前已经是最新版本（${app.getVersion()}）。`
      });
    }
    return { ok: true, version: result?.updateInfo?.version || app.getVersion() };
  } catch {
    await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "检查更新失败",
      message: "暂时无法连接 GitHub Releases，请检查网络后重试。"
    });
    return { ok: false };
  }
});

ipcMain.handle(
  "send-message",
  async (_event, payload) => {
    const text =
      payload && typeof payload === "object"
        ? payload.text
        : payload;

    const attachments =
      payload && typeof payload === "object"
        ? payload.attachments
        : pendingAttachments;

    const isRetry = Boolean(
      payload &&
      typeof payload === "object" &&
      payload.retry
    );

    const requestedPermissionMode =
      payload && typeof payload === "object" && PERMISSION_MODES.has(payload.permissionMode)
        ? payload.permissionMode
        : permissionMode;

    const message =
      String(text || "").trim();

    if (!message) {
      throw new Error(
        "请输入任务内容"
      );
    }

    if (
      agentState.status !== "ready"
    ) {
      throw new Error(
        "DeepSeek Codex 尚未连接"
      );
    }

    const requestedThreadId =
      payload && typeof payload === "object"
        ? payload.threadId
        : null;
    const task = await ensureThread(
      requestedThreadId || focusedThreadId,
      agentState.projectPath
    );
    const threadId = task.threadId;
    focusedThreadId = threadId;
    agentState.projectPath = task.projectPath;

    if (
      ACTIVE_STATUSES.has(task.status) ||
      task.status === "queued"
    ) {
      throw new Error(
        task.status === "queued"
          ? "该任务已经排队，请等待它开始或切换到其他任务"
          : "该任务已有正在执行的 Turn，请切换到其他任务或等待当前任务完成"
      );
    }

    const inputAttachments = Array.isArray(attachments)
      ? attachments
      : pendingAttachments;

    const turnAttachments = isRetry
      ? inputAttachments
      : createTaskRetryAttachmentSnapshot(
          threadId,
          inputAttachments
        );

    const oldHistory =
      threadHistory.get(threadId);

    if (!oldHistory || oldHistory.titleSource !== "manual") {
      const cleanTitle = summarizeTaskTitle(message);

      threadHistory.upsert({
        threadId,
        projectPath: task.projectPath,
        title: cleanTitle,
        titleSource: "auto"
      });
    }

    taskRuntime.addMessage(threadId, {
      role: "user",
      text: message,
      attachments: turnAttachments.map(file => ({
        name: file.name,
        ext: file.ext,
        size: file.size
      })),
      timestamp: new Date().toISOString()
    });

    const turnPayload = {
      message,
      attachments: turnAttachments,
      retry: isRetry,
      permissionMode: requestedPermissionMode
    };

    if (!taskRuntime.canStart()) {
      taskRuntime.enqueue(threadId, turnPayload);
      taskRuntime.recordEvent(threadId, {
        type: "turn-state",
        status: "queued",
        message: "已进入并发队列，等待其他任务完成"
      });
      sendTaskState(threadId);
      pendingAttachments = [];

      return {
        ok: true,
        queued: true,
        threadId,
        turnId: null,
        retryAttachments: turnAttachments
      };
    }

    const result = await startTurnForTask(task, turnPayload);

    // turn/start 成功后清空后台待发送附件
    pendingAttachments = [];

    return {
      ok: true,
      queued: false,
      threadId,
      turnId:
        result?.turn?.id || null,
      retryAttachments: turnAttachments
    };
  }
);

ipcMain.handle(
  "respond-approval",
  async (_event, payload) => {
    const requestKey =
      String(payload.requestId);

    const approval =
      pendingApprovals.get(
        requestKey
      );

    if (!approval) {
      throw new Error(
        "审批请求已经失效"
      );
    }

    if (
      payload.threadId &&
      approval.threadId &&
      payload.threadId !== approval.threadId
    ) {
      throw new Error("审批请求不属于当前任务");
    }

    if (
      payload.turnId &&
      approval.turnId &&
      payload.turnId !== approval.turnId
    ) {
      throw new Error("审批请求不属于当前 Turn");
    }

    if (
      payload.itemId &&
      approval.itemId &&
      String(payload.itemId) !== String(approval.itemId)
    ) {
      throw new Error("审批请求不属于当前操作");
    }

    const decision =
      payload.decision === "accept"
        ? "accept"
        : "decline";

    writeRpc({
      id: approval.rpcId,
      result: {
        decision
      }
    });

    pendingApprovals.delete(
      requestKey
    );

    if (approval.threadId) {
      const task = taskRuntime.get(approval.threadId);
      if (task) {
        for (const item of task.approvals) {
          if (item.requestId === requestKey) {
            item.status = decision === "accept"
              ? "accepted"
              : "declined";
          }
        }
        const hasPendingApproval = task.approvals
          .some(item => item.status === "pending");
        taskRuntime.setStatus(
          approval.threadId,
          hasPendingApproval
            ? "waitingApproval"
            : decision === "accept"
              ? "running"
              : "stopping"
        );
        taskRuntime.recordEvent(approval.threadId, {
          type: "approval-response",
          requestId: requestKey,
          decision,
          turnId: approval.turnId
        });
        sendTaskState(approval.threadId);
      }
    }

    return {
      ok: true
    };
  }
);

app.whenReady().then(
  async () => {
    cleanupStaleAttachmentFiles();
    createWindow();
    setupAutoUpdater();

    await startCodexAppServer();

    // 自动恢复上次使用的项目
    const recent = recentProjects.load();

    if (recent.length > 0) {
      agentState.projectPath = recent[0];
      applyModelSettingsForProject(
        agentState.projectPath
      );
      focusedThreadId = null;
      sendState();
    }

    app.on("activate", () => {
      if (
        BrowserWindow
          .getAllWindows()
          .length === 0
      ) {
        createWindow();
      }
    });
  }
);

function shutdownCodexAppServer() {
  if (shuttingDown) return;

  shuttingDown = true;

  if (codexReconnectTimer) {
    clearTimeout(codexReconnectTimer);
    codexReconnectTimer = null;
  }

  rejectPendingRequests(
    new Error("应用正在退出")
  );
  pendingApprovals.clear();
  terminateCodexProcess();
  if (mihomoProcess) {
    try { mihomoProcess.kill(); } catch {}
    mihomoProcess = null;
  }
}

app.on("before-quit", shutdownCodexAppServer);

app.on(
  "window-all-closed",
  () => {
    for (const task of taskRuntime.tasks.values()) {
      cleanupTaskAttachmentPaths(task.threadId);
      cleanupTaskRetryAttachmentPaths(task.threadId);
    }
    cleanupAttachmentFiles(retryAttachmentPaths);
    retryAttachmentPaths = [];

    if (
      process.platform !==
      "darwin"
    ) {
      app.quit();
    }
  }
);







// ===== 历史任务管理 =====

function markdownEscape(value) {
  return String(value ?? "").replace(/\r\n/g, "\n");
}

function formatExportDate(value) {
  if (!value) return "未知";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("zh-CN");
}

function appendMarkdownItem(lines, item) {
  if (!item) return;
  if (item.type === "userMessage") {
    const text = item.content?.map(part => part?.text || "").join("") || item.text;
    if (text) lines.push(`### 用户\n\n${markdownEscape(text)}\n`);
  } else if (item.type === "agentMessage" && item.text) {
    lines.push(`### Agent\n\n${markdownEscape(item.text)}\n`);
  } else if (item.type === "commandExecution") {
    lines.push(`### 命令执行\n\n**命令：** \`${markdownEscape(item.command || "") }\`\n\n**目录：** \`${markdownEscape(item.cwd || "") }\`\n\n**状态：** ${item.status || "未知"}\n\n${item.aggregatedOutput ? `\n\`\`\`text\n${markdownEscape(item.aggregatedOutput)}\n\`\`\`\n` : ""}`);
  } else if (item.type === "fileChange") {
    const changes = Array.isArray(item.changes) ? item.changes : [];
    lines.push(`### 文件修改\n\n**状态：** ${item.status || "未知"}\n\n${changes.map(change => `- ${markdownEscape(change.path || change.filePath || "未命名文件")}`).join("\n") || "- 未提供文件列表"}\n`);
  }
}

function buildThreadMarkdown(record, task, thread) {
  const source = thread || task?.historyThread;
  const lines = [
    `# ${markdownEscape(record.title || "Thread 任务")}`,
    "",
    `- **Thread ID：** \`${record.threadId}\``,
    `- **项目：** \`${markdownEscape(record.projectPath || task?.projectPath || "") }\``,
    `- **创建时间：** ${formatExportDate(record.createdAt)}`,
    `- **更新时间：** ${formatExportDate(record.updatedAt)}`,
    `- **导出时间：** ${formatExportDate(Date.now())}`,
    "",
    "---",
    "",
    "## 对话与执行记录",
    ""
  ];

  let count = 0;
  for (const turn of source?.turns || []) {
    for (const item of turn.items || []) {
      const before = lines.length;
      appendMarkdownItem(lines, item);
      if (lines.length > before) count += 1;
    }
  }
  for (const message of task?.messages || []) {
    const before = lines.length;
    appendMarkdownItem(lines, {
      type: message.role === "user" ? "userMessage" : "agentMessage",
      text: message.text
    });
    if (lines.length > before) count += 1;
  }
  for (const event of task?.events || []) {
    if (event?.kind === "command" && event.phase === "completed") {
      const before = lines.length;
      appendMarkdownItem(lines, { type: "commandExecution", ...event, aggregatedOutput: event.output });
      if (lines.length > before) count += 1;
    }
  }

  if (task) {
    lines.push("## 任务摘要\n");
    lines.push(`- **最终状态：** ${task.status || "未知"}`);
    lines.push(`- **模型：** ${markdownEscape(task.model || "未知")}`);
    lines.push(`- **推理强度：** ${markdownEscape(task.reasoning || "未知")}`);
    if (task.currentTurnId) lines.push(`- **当前 Turn：** \`${task.currentTurnId}\``);
    lines.push("");

    const attachments = [
      ...(task.attachmentPaths || []),
      ...(task.retryAttachmentPaths || [])
    ].filter(Boolean);
    if (attachments.length) {
      lines.push("## 附件\n");
      for (const file of [...new Set(attachments)]) lines.push(`- \`${markdownEscape(path.basename(file))}\``);
      lines.push("");
    }

    if ((task.approvals || []).length) {
      lines.push("## 审批记录\n");
      for (const approval of task.approvals) {
        lines.push(`- **${markdownEscape(approval.title || approval.type || "审批")}**：${approval.status || "未知"}${approval.command ? ` — \`${markdownEscape(approval.command)}\`` : ""}`);
      }
      lines.push("");
    }

    if (task.tokenUsage) {
      lines.push("## Token 使用\n");
      for (const [key, value] of Object.entries(task.tokenUsage)) {
        if (value !== null && value !== undefined && typeof value !== "object") lines.push(`- **${key}：** ${value}`);
      }
      lines.push("");
    }

    if ((task.errors || []).length) {
      lines.push("## 错误记录\n");
      for (const error of task.errors) lines.push(`- ${markdownEscape(error.message || error.error || error)}`);
      lines.push("");
    }
  }
  if (!count) lines.push("暂无可导出的对话内容。\n");
  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n");
}

ipcMain.handle(
  "export-thread-markdown",
  async (_event, threadId) => {
    if (!threadId) throw new Error("缺少 threadId");
    const record = threadHistory.get(threadId);
    if (!record) throw new Error("找不到这条历史任务");

    let task = taskRuntime.get(threadId);
    let thread = task?.historyThread || null;
    // 当前运行中的任务可能尚未拿到历史快照，但已经有可导出的消息/事件。
    // 先使用现有 TaskState，避免导出动作被无意义的 thread/resume 阻塞。
    const hasRuntimeContent = Boolean(
      task && (
        task.messages?.length ||
        task.events?.length ||
        task.historyThread
      )
    );
    if (!thread && !hasRuntimeContent) {
      const result = await rpcRequest("thread/resume", {
        threadId,
        model: modelSettings.model,
        cwd: record.projectPath,
        approvalPolicy: "on-request",
        sandbox: "workspace-write"
      });
      thread = result?.thread || null;
    }

    const content = buildThreadMarkdown(record, task, thread);
    const safeTitle = String(record.title || "thread")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .trim() || "thread";
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "导出 Thread Markdown",
      defaultPath: path.join(app.getPath("downloads"), `${safeTitle}.md`),
      filters: [{ name: "Markdown 文件", extensions: ["md"] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, content, "utf8");
    return { canceled: false, filePath: result.filePath };
  }
);

ipcMain.handle(
  "rename-thread-history",
  async (_event, data) => {
    const { threadId, title } = data || {};

    if (!threadId) {
      throw new Error("缺少 threadId");
    }

    return threadHistory.rename(
      threadId,
      title
    );
  }
);

ipcMain.handle(
  "delete-thread-history",
  async (_event, threadId) => {
    if (!threadId) {
      throw new Error("缺少 threadId");
    }

    const removed =
      threadHistory.remove(threadId);

    // 如果删掉的刚好是当前恢复中的任务，
    // 退出当前 Thread，但保留当前项目
    if (
      removed &&
      focusedThreadId === threadId
    ) {
      focusedThreadId = null;
    }

    return {
      ok: removed
    };
  }
);



// ===== 中断当前 Turn =====

ipcMain.handle(
  "interrupt-turn",
  async (_event, payload = {}) => {
    const threadId =
      payload.threadId || focusedThreadId;
    const task = taskRuntime.get(threadId);

    if (!threadId || !task) {
      return {
        ok: false,
        message: "当前没有活动 Thread"
      };
    }

    const turnId =
      payload.turnId || task.currentTurnId;

    if (!turnId) {
      return {
        ok: false,
        message: "当前没有正在执行的任务"
      };
    }

    taskRuntime.setStatus(threadId, "stopping");
    taskRuntime.recordEvent(threadId, {
      type: "turn-state",
      status: "stopping",
      turnId
    });
    sendTaskState(threadId);

    await rpcRequest(
      "turn/interrupt",
      {
        threadId,
        turnId
      }
    );

    return {
      ok: true,
      threadId,
      turnId
    };
  }
);



// ===== 最近项目移除 =====

ipcMain.handle(
  "remove-recent-project",
  async (_event, projectPath) => {

    if (!projectPath) {
      throw new Error("缺少项目路径");
    }

    const projects =
      recentProjects.remove(projectPath);

    return {
      ok: true,
      projects
    };
  }
);


// ===== 选择附件 =====

ipcMain.handle(
  "select-attachments",
  async () => {

    const result =
      await dialog.showOpenDialog(
        mainWindow,
        {
          title: "选择附件",

          properties: [
            "openFile",
            "multiSelections"
          ],

          filters: [
            {
              name: "常用文件",
              extensions: [
                "png",
                "jpg",
                "jpeg",
                "webp",
                "gif",
                "pdf",
                "xlsx",
                "xls",
                "csv",
                "txt",
                "md",
                "docx",
                "pptx",
                "json",
                "html",
                "js",
                "ts",
                "py"
              ]
            },
            {
              name: "所有文件",
              extensions: ["*"]
            }
          ]
        }
      );

    if (result.canceled) {
      return [];
    }

    return validateAttachmentFiles(result.filePaths);
  }
);

ipcMain.handle(
  "validate-dropped-attachments",
  async (_event, files) => {
    return validateAttachmentFiles(files);
  }
);

ipcMain.handle(
  "save-pasted-image",
  async (_event, payload) => {
    const dataUrl =
      payload && typeof payload.dataUrl === "string"
        ? payload.dataUrl
        : "";

    const match = dataUrl.match(
      /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i
    );

    if (!match) {
      throw new Error("只支持粘贴 PNG、JPEG 或 WebP 图片");
    }

    const mimeType = match[1].toLowerCase();
    const extension =
      mimeType === "image/jpeg"
        ? ".jpg"
        : mimeType === "image/webp"
          ? ".webp"
          : ".png";

    const buffer = Buffer.from(match[2], "base64");

    if (buffer.length > MAX_ATTACHMENT_SIZE) {
      throw new Error("单个附件不能超过 20 MB");
    }

    const attachmentDir = getAttachmentDirectory();

    fs.mkdirSync(attachmentDir, {
      recursive: true
    });

    const filePath = path.join(
      attachmentDir,
      `pasted-image-${Date.now()}${extension}`
    );

    fs.writeFileSync(filePath, buffer);
    generatedAttachmentPaths.add(filePath);

    return {
      path: filePath,
      name:
        typeof payload?.name === "string" && payload.name
          ? payload.name
          : `pasted-image${extension}`,
      ext: extension,
      size: buffer.length
    };
  }
);

ipcMain.handle(
  "save-dropped-file",
  async (_event, payload) => {
    const dataUrl =
      payload && typeof payload.dataUrl === "string"
        ? payload.dataUrl
        : "";

    const originalName =
      payload && typeof payload.name === "string"
        ? path.basename(payload.name)
        : "";

    const mimeExtensionMap = {
      "application/pdf": ".pdf",
      "text/csv": ".csv",
      "text/plain": ".txt",
      "application/vnd.ms-excel": ".xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx"
    };

    const extension =
      path.extname(originalName).toLowerCase() ||
      mimeExtensionMap[String(payload?.mimeType || "").toLowerCase()] ||
      "";

    if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
      throw new Error("不支持的附件类型或文件扩展名缺失");
    }

    const match = dataUrl.match(
      /^data:[^;,]+;base64,([A-Za-z0-9+/=]+)$/i
    );

    if (!match) {
      throw new Error("无法读取拖入文件内容");
    }

    const buffer = Buffer.from(match[1], "base64");

    if (buffer.length > MAX_ATTACHMENT_SIZE) {
      throw new Error("单个附件不能超过 20 MB");
    }

    const attachmentDir = getAttachmentDirectory();

    fs.mkdirSync(attachmentDir, {
      recursive: true
    });

    const filePath = path.join(
      attachmentDir,
      `dropped-file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`
    );

    fs.writeFileSync(filePath, buffer);
    const info = inspectAttachment(filePath);
    generatedAttachmentPaths.add(filePath);

    return {
      path: filePath,
      name: originalName || `dropped-file${extension}`,
      ext: info.ext,
      size: info.size
    };
  }
);

ipcMain.handle(
  "get-attachment-preview",
  async (_event, filePath) => {
    const info = inspectAttachment(filePath);

    const mimeByExtension = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif"
    };

    const mimeType = mimeByExtension[info.ext];

    if (!mimeType || info.size > 8 * 1024 * 1024) {
      return null;
    }

    const data = fs.readFileSync(filePath).toString("base64");

    return `data:${mimeType};base64,${data}`;
  }
);



// ===== 当前待发送附件 =====

ipcMain.handle(
  "set-pending-attachments",
  async (_event, files) => {
    const nextAttachments =
      Array.isArray(files)
        ? files
            .filter(
              file =>
                file &&
                typeof file.path === "string" &&
                (() => {
                  try {
                    inspectAttachment(file.path);
                    return true;
                  } catch {
                    return false;
                  }
                })()
            )
            .map(
              file => ({
                path: file.path,
                name:
                  file.name ||
                  path.basename(file.path),
                ext:
                  (
                    file.ext ||
                    path.extname(file.path)
                  ).toLowerCase(),
                size: file.size ||
                  fs.statSync(file.path).size
              })
            )
        : [];

    const nextPaths = new Set(
      nextAttachments.map(file => file.path)
    );

    for (const filePath of generatedAttachmentPaths) {
      if (!nextPaths.has(filePath)) {
        cleanupAttachmentFiles([filePath]);
        generatedAttachmentPaths.delete(filePath);
      }
    }

    pendingAttachments = nextAttachments;

    return {
      ok: true,
      count: pendingAttachments.length
    };
  }
);


// ===== 构建 Codex 附件输入 =====

function buildTurnInputWithAttachments(
  message,
  files = pendingAttachments,
  projectPath = agentState.projectPath,
  attachmentCollector = []
) {
  const input = [];

  const attachments = [];
  let totalSize = 0;

  for (const file of Array.isArray(files) ? files : []) {
    const info = inspectAttachment(file?.path);

    totalSize += info.size;

    if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
      throw new Error("本次附件总大小不能超过 50 MB");
    }

    attachments.push({
      path: file.path,
      name:
        typeof file.name === "string" && file.name
          ? file.name
          : path.basename(file.path),
      ext: info.ext,
      size: info.size
    });
  }

  let finalText =
    String(message || "").trim();

  if (
    attachments.length === 0
  ) {
    return [
      {
        type: "text",
        text: finalText
      }
    ];
  }

  if (!projectPath) {
    throw new Error(
      "请先选择项目文件夹"
    );
  }

  const attachmentDir = getAttachmentDirectory();

  fs.mkdirSync(
    attachmentDir,
    {
      recursive: true
    }
  );

  const imageExtensions =
    new Set([
      ".png",
      ".jpg",
      ".jpeg",
      ".webp"
    ]);

  const normalFiles = [];

  attachments.forEach(
    (file, index) => {

      const ext =
        (
          file.ext ||
          path.extname(file.path)
        ).toLowerCase();

      const rawExtension =
        ext
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, "");

      const extension =
        rawExtension && rawExtension.startsWith(".")
          ? rawExtension
          : ".bin";

      const copiedName =
        `attachment-${Date.now()}-${index}${extension}`;

      const copiedPath =
        path.join(
          attachmentDir,
          copiedName
        );

      fs.copyFileSync(
        file.path,
        copiedPath
      );

      attachmentCollector.push(copiedPath);

      if (generatedAttachmentPaths.has(file.path)) {
        cleanupAttachmentFiles([file.path]);
        generatedAttachmentPaths.delete(file.path);
      }

      if (
        imageExtensions.has(ext)
      ) {

        input.push({
          type: "localImage",
          path: copiedPath
        });

      } else {

        normalFiles.push(
          copiedPath
        );
      }
    }
  );

  if (normalFiles.length) {

    const fileList =
      normalFiles
        .map(
          filePath =>
            `- ${filePath}`
        )
        .join("\n");

    finalText +=
      `\n\n用户同时提供了以下本地附件。请读取这些文件并结合我的要求处理：\n${fileList}`;
  }

  input.unshift({
    type: "text",
    text: finalText
  });

  return input;
}


