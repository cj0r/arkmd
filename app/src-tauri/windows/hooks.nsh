; Installer hooks for the Windows (NSIS) package: keep the .md file associations clean.
;
; Tauri's installer saves the extension's previous default as "<class>_backup" and, on uninstall, restores it and deletes
; the class. On an update the "previous" default is ArkMD's own class, so after an uninstall .md, .markdown, .mdown and
; .mkd still pointed at a class that no longer exists, and double-clicking such a file showed nothing sensible.
;
; Before the associations are written: if an extension currently points at ArkMD's class, put back the default that
; was there before ArkMD (the saved backup, or none), so the installer's own backup is the real previous default.
; After the uninstall: remove a default that still points at ArkMD's class, and the backup value.

!define ARKMD_CLASS "Markdown document"

!macro ARKMD_REPAIR_EXT EXT
  ReadRegStr $R8 SHCTX "Software\Classes\.${EXT}" ""
  ${If} $R8 == "${ARKMD_CLASS}"
    ReadRegStr $R9 SHCTX "Software\Classes\.${EXT}" "${ARKMD_CLASS}_backup"
    ${If} $R9 == ""
    ${OrIf} $R9 == "${ARKMD_CLASS}"
      DeleteRegValue SHCTX "Software\Classes\.${EXT}" ""
    ${Else}
      WriteRegStr SHCTX "Software\Classes\.${EXT}" "" "$R9"
    ${EndIf}
  ${EndIf}
!macroend

!macro ARKMD_CLEAN_EXT EXT
  ReadRegStr $R8 SHCTX "Software\Classes\.${EXT}" ""
  ${If} $R8 == "${ARKMD_CLASS}"
    DeleteRegValue SHCTX "Software\Classes\.${EXT}" ""
  ${EndIf}
  DeleteRegValue SHCTX "Software\Classes\.${EXT}" "${ARKMD_CLASS}_backup"
  DeleteRegKey /ifempty SHCTX "Software\Classes\.${EXT}"
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro ARKMD_REPAIR_EXT "md"
  !insertmacro ARKMD_REPAIR_EXT "markdown"
  !insertmacro ARKMD_REPAIR_EXT "mdown"
  !insertmacro ARKMD_REPAIR_EXT "mkd"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro ARKMD_CLEAN_EXT "md"
  !insertmacro ARKMD_CLEAN_EXT "markdown"
  !insertmacro ARKMD_CLEAN_EXT "mdown"
  !insertmacro ARKMD_CLEAN_EXT "mkd"
  ; the install folder remembered for the next install: gone with the program, unless this is an update
  ${If} $UpdateMode <> 1
    DeleteRegKey SHCTX "${MANUPRODUCTKEY}"
    DeleteRegKey /ifempty SHCTX "${MANUKEY}"
  ${EndIf}
!macroend
