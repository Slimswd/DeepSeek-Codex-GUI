const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("deepseekCodex", {
  selectProject: () =>
    ipcRenderer.invoke("select-project"),

  selectAttachments: () =>
    ipcRenderer.invoke(
      "select-attachments"
    ),

  validateDroppedAttachments: (files) =>
    ipcRenderer.invoke(
      "validate-dropped-attachments",
      files
    ),

  savePastedImage: (payload) =>
    ipcRenderer.invoke(
      "save-pasted-image",
      payload
    ),

  saveDroppedFile: (payload) =>
    ipcRenderer.invoke(
      "save-dropped-file",
      payload
    ),

  getAttachmentPreview: (filePath) =>
    ipcRenderer.invoke(
      "get-attachment-preview",
      filePath
    ),

  setPendingAttachments: (files) =>
    ipcRenderer.invoke(
      "set-pending-attachments",
      files
    ),

  getAgentState: () =>
    ipcRenderer.invoke("get-agent-state"),

  getTaskStates: () =>
    ipcRenderer.invoke("get-task-states"),

  getTaskState: (threadId) =>
    ipcRenderer.invoke("get-task-state", threadId),

  selectTask: (threadId) =>
    ipcRenderer.invoke("select-task", threadId),

  getThemeSettings: () =>
    ipcRenderer.invoke("get-theme-settings"),

  setThemeSettings: (theme) =>
    ipcRenderer.invoke("set-theme-settings", theme),

  getPermissionSettings: () =>
    ipcRenderer.invoke("get-permission-settings"),

  setPermissionSettings: (mode) =>
    ipcRenderer.invoke("set-permission-settings", mode),

  getOnboardingState: () => ipcRenderer.invoke("get-onboarding-state"),
  getEmbeddedProxyStatus: () => ipcRenderer.invoke("get-embedded-proxy-status"),

  completeOnboarding: () => ipcRenderer.invoke("complete-onboarding"),

    openCodexConfigFolder: () => ipcRenderer.invoke("open-codex-config-folder"),
    getCodexSetupStatus: () => ipcRenderer.invoke("get-codex-setup-status"),
    installCodexCli: () => ipcRenderer.invoke("install-codex-cli"),
    getDeepSeekApiProfile: () => ipcRenderer.invoke("get-deepseek-api-profile"),
    configureDeepSeekApi: (payload) => ipcRenderer.invoke("configure-deepseek-api", payload),
    testDeepSeekConnection: () => ipcRenderer.invoke("test-deepseek-connection"),
  runOnboardingTaskTest: () => ipcRenderer.invoke("run-onboarding-task-test"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on("update-download-progress", (_event, data) => callback(data));
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on("update-available", (_event, data) => callback(data));
  },
  onUpdateDownloadError: (callback) => {
    ipcRenderer.on("update-download-error", (_event, data) => callback(data));
  },
  downloadUpdate: () => ipcRenderer.invoke("download-update"),

  getGitStatus: () =>
    ipcRenderer.invoke("get-git-status"),

  getGitRemoteStatus: () =>
    ipcRenderer.invoke("get-git-remote-status"),

  fetchGitRemote: () =>
    ipcRenderer.invoke("git-fetch"),

  pullGitRemote: () =>
    ipcRenderer.invoke("git-pull"),

  pushGitRemote: () =>
    ipcRenderer.invoke("git-push"),

  switchGitBranch: (branchName) =>
    ipcRenderer.invoke("git-switch-branch", branchName),

  initializeGitRepository: () =>
    ipcRenderer.invoke("git-init-repository"),

  getGitFileDiff: (filePath) =>
    ipcRenderer.invoke("get-git-file-diff", filePath),

  stageGitFiles: (filePaths) =>
    ipcRenderer.invoke("git-stage-files", filePaths),

  unstageGitFiles: (filePaths) =>
    ipcRenderer.invoke("git-unstage-files", filePaths),

  createGitCheckpoint: (label) =>
    ipcRenderer.invoke("git-create-checkpoint", label),

  listGitCheckpoints: () =>
    ipcRenderer.invoke("git-list-checkpoints"),

  restoreGitCheckpoint: (checkpointId) =>
    ipcRenderer.invoke(
      "git-restore-checkpoint",
      checkpointId
    ),

  discardGitFiles: (filePaths) =>
    ipcRenderer.invoke("git-discard-files", filePaths),

  commitStagedGitChanges: (message) =>
    ipcRenderer.invoke("git-commit-staged", message),

  getDiagnostics: () =>
    ipcRenderer.invoke("get-diagnostics"),

  clearDiagnostics: () =>
    ipcRenderer.invoke("clear-diagnostics"),

  getRetryAttachments: () =>
    ipcRenderer.invoke("get-retry-attachments"),

  getModelSettings: () =>
    ipcRenderer.invoke("get-model-settings"),

  listModels: () =>
    ipcRenderer.invoke("list-models"),

  setModelSettings: (settings) =>
    ipcRenderer.invoke(
      "set-model-settings",
      settings
    ),

  newTask: () => ipcRenderer.invoke("new-task"),

  renameThreadHistory: (threadId, title) =>
    ipcRenderer.invoke(
      "rename-thread-history",
      {
        threadId,
        title
      }
    ),

  deleteThreadHistory: (threadId) =>
    ipcRenderer.invoke(
      "delete-thread-history",
      threadId
    ),

  exportThreadMarkdown: (threadId) =>
    ipcRenderer.invoke(
      "export-thread-markdown",
      threadId
    ),

  getThreadHistory: () => ipcRenderer.invoke("get-thread-history"),

  resumeThread: (threadId) => ipcRenderer.invoke("resume-thread", threadId),

  getRecentProjects: () =>
    ipcRenderer.invoke("get-recent-projects"),

  removeRecentProject: (projectPath) =>
    ipcRenderer.invoke(
      "remove-recent-project",
      projectPath
    ),

  openRecentProject: (projectPath) =>
    ipcRenderer.invoke(
      "open-recent-project",
      projectPath
    ),

  openProjectFolder: (projectPath) =>
    ipcRenderer.invoke(
      "open-project-folder",
      projectPath
    ),

  getProjectWorkspace: () => ipcRenderer.invoke("get-project-workspace"),
  searchProjectWorkspace: (query) => ipcRenderer.invoke("search-project-workspace", query),
  openProjectFile: (relativePath) => ipcRenderer.invoke("open-project-file", relativePath),

  interruptTurn: (context = {}) =>
    ipcRenderer.invoke("interrupt-turn", {
      threadId: context?.threadId || null,
      turnId: context?.turnId || null
    }),

  sendMessage: (text, attachments = [], options = {}) =>
    ipcRenderer.invoke("send-message", {
      text,
      attachments,
      retry: Boolean(options?.retry),
      threadId: options?.threadId || null,
      clientTaskId: options?.clientTaskId || null
      ,permissionMode: options?.permissionMode || null
    }),

  respondApproval: (requestId, decision, context = {}) =>
    ipcRenderer.invoke("respond-approval", {
      requestId,
      decision,
      threadId: context?.threadId || null,
      turnId: context?.turnId || null,
      itemId: context?.itemId || null
    }),

  onAgentState: (callback) => {
    ipcRenderer.on(
      "agent-state",
      (_event, state) => callback(state)
    );
  },

  onAgentDelta: (callback) => {
    ipcRenderer.on(
      "agent-delta",
      (_event, data) => callback(data)
    );
  },

  onTurnState: (callback) => {
    ipcRenderer.on(
      "turn-state",
      (_event, data) => callback(data)
    );
  },

  onApprovalRequest: (callback) => {
    ipcRenderer.on(
      "approval-request",
      (_event, data) => callback(data)
    );
  },

  onActivity: (callback) => {
    ipcRenderer.on(
      "agent-activity",
      (_event, data) => callback(data)
    );
  },

  onTaskState: (callback) => {
    ipcRenderer.on(
      "task-state",
      (_event, data) => callback(data)
    );
  },

  onTaskList: (callback) => {
    ipcRenderer.on(
      "task-list",
      (_event, data) => callback(data)
    );
  },

  onTaskConflictWarning: (callback) => {
    ipcRenderer.on(
      "task-conflict-warning",
      (_event, data) => callback(data)
    );
  }
});







