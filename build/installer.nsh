; DeepSeek Codex branded NSIS layer.
; Keep the electron-builder installation engine intact and only customize
; presentation, page copy, and the default install scope.

!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"
!ifndef BUILD_UNINSTALLER
  !include "StrContains.nsh"
!endif

!define MUI_BGCOLOR "0B121A"
!define MUI_TEXTCOLOR "F1EEE8"
!define MUI_HEADER_TRANSPARENT_TEXT
!define MUI_BRANDINGTEXT " "
!define MUI_INSTFILESPAGE_COLORS "D5DCE4 0B121A"
!define MUI_DIRECTORYPAGE_BGCOLOR "111820"
!define MUI_DIRECTORYPAGE_TEXTCOLOR "F1EEE8"
!define MUI_FINISHPAGE_LINK_COLOR "F47721"
!define MUI_ABORTWARNING
!define MUI_UNABORTWARNING
!define MUI_WELCOMEPAGE_TITLE_3LINES
!define MUI_FINISHPAGE_TITLE_3LINES
!define MUI_FINISHPAGE_TITLE "安装完成"
!define MUI_FINISHPAGE_TEXT "DeepSeek Codex 已成功安装。$\r$\n$\r$\n安装无需代理。使用 DeepSeek API 执行 Codex 任务时，请确保网络可访问 DeepSeek，必要时开启代理。$\r$\n$\r$\n首次启动将自动检查 Codex CLI 与 API 配置，并通过引导帮助您完成必要设置。"

; The install-mode page is skipped for new installs so the visible journey is
; Welcome -> Location -> Install -> Complete. Existing all-user installs keep
; their original scope during upgrades.
!macro customInstallMode
  !ifndef BUILD_UNINSTALLER
    ${If} $hasPerMachineInstallation == "1"
    ${AndIf} $hasPerUserInstallation == "0"
      StrCpy $isForceMachineInstall "1"
    ${Else}
      StrCpy $isForceCurrentInstall "1"
    ${EndIf}
  !endif
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "欢迎使用 DeepSeek Codex"
!define MUI_WELCOMEPAGE_TEXT "面向 Windows 的智能开发 Agent$\r$\n$\r$\nDeepSeek Codex 将安装桌面客户端与内置 Codex CLI，帮助您更高效地构建、运行与管理开发任务。$\r$\n$\r$\n• 内置 Codex CLI$\r$\n• 本地保存配置$\r$\n• 安装过程无需代理$\r$\n• 使用 DeepSeek 服务可能需要代理$\r$\n$\r$\n单击“下一步”继续。"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW BrandWelcomeShow
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customDirectoryPage
  Page custom BrandDirectoryCreate BrandDirectoryLeave
!macroend

; electron-builder calls this hook immediately before the native install page.
; We supply the branded location page here and then configure the next page.
!macro customPageAfterChangeDir
  !insertmacro customDirectoryPage
  !define MUI_PAGE_HEADER_TEXT "正在安装"
  !define MUI_PAGE_HEADER_SUBTEXT "正在准备 DeepSeek Codex 与内置 Codex CLI，请稍候。"
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW BrandInstallFilesShow
!macroend

!macro customFinishPage
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW BrandFinishShow
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customHeader
  SetFont /LANG=2052 "Microsoft YaHei UI" 9
  !ifdef BUILD_UNINSTALLER
    Caption "卸载 DeepSeek Codex"
    BrandingText " "
  !else
    Caption "安装 DeepSeek Codex"
    BrandingText " "
  !endif
!macroend

!ifndef BUILD_UNINSTALLER
Var BrandDirectoryPage
Var BrandDarkBrush
Var BrandDirectoryInput
Var BrandDirectoryBrowse
Var BrandUiFont

Function BrandWelcomeShow
  Call BrandStyleOuter
FunctionEnd

Function BrandDirectoryCreate
  GetDlgItem $0 $HWNDPARENT 1037
  SendMessage $0 ${WM_SETTEXT} 0 "STR:安装位置"
  GetDlgItem $0 $HWNDPARENT 1038
  SendMessage $0 ${WM_SETTEXT} 0 "STR:选择安装文件夹；推荐保留默认位置。"
  nsDialogs::Create 1018
  Pop $BrandDirectoryPage
  SetCtlColors $BrandDirectoryPage "F1EEE8" "0B121A"

  StrCmp $BrandDarkBrush "" 0 BrandDirectoryBrushReady
    System::Call 'gdi32::CreateSolidBrush(i 0x001A120B)p .r0'
    StrCpy $BrandDarkBrush $0
BrandDirectoryBrushReady:
  System::Call 'user32::SetClassLongPtr(p $BrandDirectoryPage, i -10, p $BrandDarkBrush)p .r0'
  System::Call 'user32::RedrawWindow(p $BrandDirectoryPage, p 0, p 0, i 0x0185)'

  ${NSD_CreateLabel} 0u 2u 300u 28u "DeepSeek Codex 将安装到下面的文件夹。您也可以选择其他位置。"
  Pop $0
  SetCtlColors $0 "D5DCE4" "0B121A"

  ${NSD_CreateLabel} 0u 39u 300u 12u "目标文件夹"
  Pop $0
  SetCtlColors $0 "8F9BA7" "0B121A"

  ${NSD_CreateText} 0u 55u 230u 18u "$INSTDIR"
  Pop $BrandDirectoryInput
  System::Call 'uxtheme::SetWindowTheme(p $BrandDirectoryInput, w " ", w " ")i .r0'
  SetCtlColors $BrandDirectoryInput "F1EEE8" "111820"

  ${NSD_CreateButton} 238u 55u 62u 18u "浏览…"
  Pop $BrandDirectoryBrowse
  ${NSD_OnClick} $BrandDirectoryBrowse BrandDirectoryBrowseClick

  ${NSD_CreateLabel} 0u 87u 300u 34u "安装程序会自动创建 DeepSeek Codex 子文件夹。配置与 API 信息仍只保存在当前 Windows 用户的本机环境中。"
  Pop $0
  SetCtlColors $0 "AAB4BF" "0B121A"

  ${NSD_CreateLabel} 0u 132u 300u 18u "内置 Codex CLI  ·  本地配置  ·  常规安装无需代理"
  Pop $0
  SetCtlColors $0 "F47721" "0B121A"

  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:安装"
  Call BrandStyleOuter
  nsDialogs::Show
FunctionEnd

Function BrandDirectoryBrowseClick
  Pop $0
  ${NSD_GetText} $BrandDirectoryInput $1
  nsDialogs::SelectFolderDialog "选择 DeepSeek Codex 安装位置" "$1"
  Pop $2
  StrCmp $2 "error" BrandDirectoryBrowseDone
  ${NSD_SetText} $BrandDirectoryInput "$2"
BrandDirectoryBrowseDone:
FunctionEnd

Function BrandDirectoryLeave
  ${NSD_GetText} $BrandDirectoryInput $0
  StrCmp $0 "" 0 BrandDirectoryHasPath
    MessageBox MB_OK|MB_ICONEXCLAMATION "请选择一个有效的安装文件夹。"
    Abort

BrandDirectoryHasPath:
  StrCpy $INSTDIR "$0"
  ${StrContains} $1 "${APP_FILENAME}" $INSTDIR
  ${If} $1 == ""
    StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
  ${EndIf}
FunctionEnd

Function BrandInstallFilesShow
  Call BrandStyleOuter
  Call BrandThemeNativePage
FunctionEnd

Function BrandFinishShow
  Call BrandStyleOuter
FunctionEnd

Function BrandStyleOuter
  Push $0
  Push $1

  ; Repaint only the navigation/branding strip. Touching hidden header controls
  ; on full-window pages causes edge artifacts on some Windows scaling levels.
  SetCtlColors $HWNDPARENT "F1EEE8" "0B121A"
  System::Call 'user32::InvalidateRect(p $HWNDPARENT, p 0, i 1)'
  System::Call 'user32::UpdateWindow(p $HWNDPARENT)'
  GetDlgItem $0 $HWNDPARENT 1028
  SetCtlColors $0 "AAB4BF" "0B121A"
  StrCmp $BrandUiFont "" 0 BrandFontReady
    System::Call 'gdi32::CreateFontW(i -16, i 0, i 0, i 0, i 400, i 0, i 0, i 0, i 134, i 0, i 0, i 5, i 0, w "Microsoft YaHei UI")p .r1'
    StrCpy $BrandUiFont $1
BrandFontReady:
  SendMessage $0 ${WM_SETFONT} $BrandUiFont 1
  GetDlgItem $0 $HWNDPARENT 1256
  SetCtlColors $0 "7F8B98" "0B121A"
  System::Call 'user32::RedrawWindow(p r0, p 0, p 0, i 0x0185)'

  Pop $1
  Pop $0
FunctionEnd

Function BrandThemeNativePage
  Push $0
  Push $1
  Push $2
  Push $3

  FindWindow $1 "#32770" "" $HWNDPARENT
  StrCmp $1 0 BrandNativeThemeDone
  System::Call 'uxtheme::SetWindowTheme(p r1, w " ", w " ")i .r3'
  SetCtlColors $1 "F1EEE8" "0B121A"

  GetDlgItem $2 $1 1006
  SetCtlColors $2 "D5DCE4" "0B121A"
  GetDlgItem $2 $1 1019
  System::Call 'uxtheme::SetWindowTheme(p r2, w " ", w " ")i .r3'
  SetCtlColors $2 "F1EEE8" "111820"
  GetDlgItem $2 $1 1023
  SetCtlColors $2 "8F9BA7" "0B121A"
  GetDlgItem $2 $1 1024
  SetCtlColors $2 "8F9BA7" "0B121A"
  GetDlgItem $2 $1 1016
  SetCtlColors $2 "D5DCE4" "071018"
  GetDlgItem $2 $1 1001
  System::Call 'uxtheme::SetWindowTheme(p r2, w " ", w " ")i .r3'
  SetCtlColors $2 "E4E8EC" "17212C"
  GetDlgItem $2 $1 1027
  System::Call 'uxtheme::SetWindowTheme(p r2, w " ", w " ")i .r3'
  SetCtlColors $2 "E4E8EC" "17212C"

  GetDlgItem $2 $1 1004
  SendMessage $2 ${PBM_SETBKCOLOR} 0 0x001A120B
  SendMessage $2 ${PBM_SETBARCOLOR} 0 0x002177F4
  System::Call 'user32::RedrawWindow(p r1, p 0, p 0, i 0x0185)'

BrandNativeThemeDone:
  Pop $3
  Pop $2
  Pop $1
  Pop $0
FunctionEnd
!endif
