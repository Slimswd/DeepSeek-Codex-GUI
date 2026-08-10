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

  completeOnboarding: () => ipcRenderer.invoke("complete-onboarding"),

    openCodexConfigFolder: () => ipcRenderer.invoke("open-codex-config-folder"),
    getCodexSetupStatus: () => ipcRenderer.invoke("get-codex-setup-status"),
    installCodexCli: () => ipcRenderer.invoke("install-codex-cli"),
    configureDeepSeekApi: (apiKey) => ipcRenderer.invoke("configure-deepseek-api", apiKey),
    testDeepSeekConnection: () => ipcRenderer.invoke("test-deepseek-connection"),
  runOnboardingTaskTest: () => ipcRenderer.invoke("run-onboarding-task-test"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),

  getGitStatus: () =>
    ipcRenderer.invoke("get-git-status"),

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







