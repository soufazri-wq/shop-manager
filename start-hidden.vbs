Set shell = CreateObject("WScript.Shell")
projectDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
nodeExe = "C:\Users\Fannan\AppData\Local\nodejs\node.exe"
shell.CurrentDirectory = projectDir
shell.Run Chr(34) & nodeExe & Chr(34) & " launcher.js", 0, False
