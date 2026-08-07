Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
launcher = fso.BuildPath(appDir, "scripts\launch_storyloom.py")

On Error Resume Next
shell.Run "pyw " & Chr(34) & launcher & Chr(34), 0, False
If Err.Number <> 0 Then
  Err.Clear
  shell.Run "pythonw " & Chr(34) & launcher & Chr(34), 0, False
End If
If Err.Number <> 0 Then
  Err.Clear
  MsgBox "StoryLoom needs Python 3 to open. Install Python from python.org, then double-click StoryLoom.vbs again.", 48, "StoryLoom"
End If
