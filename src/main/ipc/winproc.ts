import { ipcMain, BrowserWindow } from 'electron'
import { execSync, exec } from 'child_process'
import { IPC_CHANNELS } from '../../shared/constants'

let ownerWindow: BrowserWindow | null = null

export function setWinProcOwnerWindow(win: BrowserWindow | null) {
  ownerWindow = win
}

export interface WinProcess {
  pid: number
  name: string
  windowTitle: string
  mainWindowHandle: number
  executablePath: string
  memoryMB: number
  cpuTime: string
  threadCount: number
}

export interface WinWindow {
  handle: number
  title: string
  className: string
  processId: number
  processName: string
  rect: { left: number; top: number; right: number; bottom: number }
  isVisible: boolean
}

export interface MemoryDumpResult {
  success: boolean
  pid: number
  processName: string
  baseAddress: string
  regionSize: string
  readableRegions: string[]
  strings: string[]
  error?: string
}

// Channel constants for process operations
const WINPROC_CHANNELS = {
  LIST_PROCESSES: 'winproc:list-processes',
  LIST_WINDOWS: 'winproc:list-windows',
  DUMP_MEMORY: 'winproc:dump-memory',
  DUMP_MEMORY_STRINGS: 'winproc:dump-memory-strings',
  READ_PROCESS_MEMORY: 'winproc:read-process-memory',
  GET_UI_TREE: 'winproc:get-ui-tree',
  INJECT_JS_TO_WEBVIEW: 'winproc:inject-js-to-webview',
}

export function registerWinProcHandlers(): void {
  // List all running processes with windows
  ipcMain.handle(WINPROC_CHANNELS.LIST_PROCESSES, async () => {
    try {
      // PowerShell script to list processes with windows, memory, etc.
      const psScript = `
        Get-Process |
        Where-Object { $_.MainWindowTitle -ne '' } |
        Sort-Object -Property PM -Descending |
        Select-Object -First 80 |
        ForEach-Object {
          [PSCustomObject]@{
            PID = $_.Id
            Name = $_.ProcessName
            WindowTitle = if ($_.MainWindowTitle.Length -gt 80) { $_.MainWindowTitle.Substring(0,80) + '...' } else { $_.MainWindowTitle }
            MainWindowHandle = [int]$_.MainWindowHandle
            Path = try { $_.Path } catch { '' }
            MemoryMB = [math]::Round($_.WorkingSet64 / 1MB, 1)
            CPU = if ($_.TotalProcessorTime) { $_.TotalProcessorTime.ToString() } else { '' }
            Threads = $_.Threads.Count
          }
        } |
        ConvertTo-Json -Compress
      `
      const result = execSync(
        `powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`,
        { maxBuffer: 10 * 1024 * 1024, timeout: 15000 }
      )
      return { success: true, data: JSON.parse(result.toString() || '[]') }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to list processes' }
    }
  })

  // List all top-level windows
  ipcMain.handle(WINPROC_CHANNELS.LIST_WINDOWS, async () => {
    try {
      // Use C# compiler via PowerShell for reliable window enumeration
      const psScript = `
        Add-Type @"
        using System;
        using System.Collections.Generic;
        using System.Runtime.InteropServices;
        using System.Text;
        using System.Diagnostics;
        
        public class WinEnumerator {
            [DllImport("user32.dll")]
            static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
            [DllImport("user32.dll")]
            static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
            [DllImport("user32.dll")]
            static extern int GetWindowTextLength(IntPtr hWnd);
            [DllImport("user32.dll")]
            static extern bool IsWindowVisible(IntPtr hWnd);
            [DllImport("user32.dll")]
            static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
            [DllImport("user32.dll")]
            static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
            [DllImport("user32.dll")]
            static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
            
            public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
            public struct WinInfo { public IntPtr Handle; public string Title; public string ClassName; public uint ProcessId; public RECT Rect; public bool IsVisible; }
            private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
            
            public static List<WinInfo> GetWindows() {
                var windows = new List<WinInfo>();
                EnumWindows((hWnd, lParam) => {
                    if (!IsWindowVisible(hWnd)) return true;
                    int length = GetWindowTextLength(hWnd);
                    if (length == 0) return true;
                    var sb = new StringBuilder(length + 1);
                    GetWindowText(hWnd, sb, sb.Capacity);
                    string title = sb.ToString();
                    if (string.IsNullOrWhiteSpace(title)) return true;
                    
                    var classSb = new StringBuilder(256);
                    GetClassName(hWnd, classSb, classSb.Capacity);
                    
                    uint pid;
                    GetWindowThreadProcessId(hWnd, out pid);
                    
                    RECT rect;
                    GetWindowRect(hWnd, out rect);
                    
                    windows.Add(new WinInfo { Handle = hWnd, Title = title, ClassName = classSb.ToString(), ProcessId = pid, Rect = rect, IsVisible = true });
                    return true;
                }, IntPtr.Zero);
                return windows;
            }
        }
"@
        $windows = [WinEnumerator]::GetWindows()
        $windows | Select-Object @{N='Handle';E={[int]$_.Handle}}, Title, ClassName, @{N='ProcessId';E={$_.ProcessId}}, @{N='Left';E={$_.Rect.Left}}, @{N='Top';E={$_.Rect.Top}}, @{N='Right';E={$_.Rect.Right}}, @{N='Bottom';E={$_.Rect.Bottom}}, IsVisible | ConvertTo-Json -Compress
      `
      const result = execSync(
        `powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`,
        { maxBuffer: 10 * 1024 * 1024, timeout: 20000 }
      )
      const raw = result.toString().trim()
      let data: any[] = []
      try {
        const parsed = JSON.parse(raw || '[]')
        data = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        return { success: false, error: 'Failed to parse window data', raw }
      }
      
      // Enrich with process names
      const windows = data.map((w: any) => {
        let processName = ''
        try {
          const procResult = execSync(`powershell -NoProfile -Command "(Get-Process -Id ${w.ProcessId} -ErrorAction SilentlyContinue).ProcessName"`, { timeout: 1000 })
          processName = procResult.toString().trim()
        } catch {}
        return {
          handle: w.Handle,
          title: w.Title,
          className: w.ClassName,
          processId: w.ProcessId,
          processName,
          rect: { left: w.Left, top: w.Top, right: w.Right, bottom: w.Bottom },
          isVisible: w.IsVisible,
        }
      })

      return { success: true, data: windows }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to list windows' }
    }
  })

  // Dump memory strings from a process
  ipcMain.handle(WINPROC_CHANNELS.DUMP_MEMORY_STRINGS, async (_event, pid: number) => {
    try {
      // Use PowerShell to create a minidump first (fast), then extract strings
      const scriptPath = `$env:TEMP\\ezek_dump_${pid}.dmp`
      const psScript = `
        $ErrorActionPreference = 'Stop'
        try {
          # Create minidump of process
          $proc = Get-Process -Id ${pid} -ErrorAction Stop
          $dumpPath = '${scriptPath}'
          
          # Use procdump-style approach: read process memory via .NET
          Add-Type -TypeDefinition @'
          using System;
          using System.Diagnostics;
          using System.Runtime.InteropServices;
          
          public class MemReader {
              [DllImport("kernel32.dll")]
              public static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);
              [DllImport("kernel32.dll")]
              public static extern bool ReadProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int dwSize, out int lpNumberOfBytesRead);
              [DllImport("kernel32.dll")]
              public static extern bool CloseHandle(IntPtr hObject);
              [DllImport("kernel32.dll")]
              public static extern int VirtualQueryEx(IntPtr hProcess, IntPtr lpAddress, out MEMORY_BASIC_INFORMATION lpBuffer, uint dwLength);
              
              [StructLayout(LayoutKind.Sequential)]
              public struct MEMORY_BASIC_INFORMATION {
                  public IntPtr BaseAddress;
                  public IntPtr AllocationBase;
                  public uint AllocationProtect;
                  public IntPtr RegionSize;
                  public uint State;
                  public uint Protect;
                  public uint Type;
              }
              
              public const uint MEM_COMMIT = 0x1000;
              public const uint MEM_PRIVATE = 0x20000;
              public const uint PAGE_READABLE = 0x1A;
              public const uint PROCESS_QUERY_INFORMATION = 0x0400;
              public const uint PROCESS_VM_READ = 0x0010;
              
              public static string DumpStrings(int pid, int maxRegions, int maxStrings) {
                  IntPtr hProcess = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid);
                  if (hProcess == IntPtr.Zero) return "ERROR: Cannot open process (try as admin)";
                  
                  var strings = new System.Collections.Generic.List<string>();
                  IntPtr addr = IntPtr.Zero;
                  int regions = 0;
                  
                  while (regions < maxRegions) {
                      MEMORY_BASIC_INFORMATION mbi;
                      if (VirtualQueryEx(hProcess, addr, out mbi, (uint)Marshal.SizeOf(typeof(MEMORY_BASIC_INFORMATION))) == 0) break;
                      
                      if (mbi.State == MEM_COMMIT && ((int)mbi.RegionSize) < 1048576 && ((int)mbi.RegionSize) > 256) {
                          byte[] buffer = new byte[(int)mbi.RegionSize];
                          int bytesRead;
                          if (ReadProcessMemory(hProcess, mbi.BaseAddress, buffer, (int)mbi.RegionSize, out bytesRead) && bytesRead > 0) {
                              ExtractStrings(buffer, bytesRead, strings, 4, 200);
                          }
                          regions++;
                      }
                      addr = new IntPtr(mbi.BaseAddress.ToInt64() + (long)mbi.RegionSize);
                  }
                  CloseHandle(hProcess);
                  return string.Join("\\n", strings.GetRange(0, Math.Min(strings.Count, maxStrings)));
              }
              
              static void ExtractStrings(byte[] data, int length, System.Collections.Generic.List<string> results, int minLen, int maxLen) {
                  var current = new System.Text.StringBuilder();
                  for (int i = 0; i < length && results.Count < 1000; i++) {
                      byte b = data[i];
                      if (b >= 32 && b <= 126) { current.Append((char)b); }
                      else {
                          if (current.Length >= minLen && current.Length <= maxLen) {
                              var s = current.ToString();
                              if (HasContent(s)) results.Add(s);
                          }
                          current.Clear();
                      }
                  }
              }
              
              static bool HasContent(string s) {
                  int letters = 0;
                  foreach (char c in s) { if (char.IsLetter(c)) letters++; }
                  return letters >= 2;
              }
          }
'@
          $result = [MemReader]::DumpStrings(${pid}, 500, 200)
          Write-Output $result
        } catch {
          Write-Output "ERROR: $($_.Exception.Message)"
        }
      `
      
      const result = execSync(
        `powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`,
        { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
      )
      
      const output = result.toString().trim()
      if (output.startsWith('ERROR:')) {
        return { success: false, pid, error: output.replace('ERROR: ', '') }
      }
      
      const strings = output.split('\\n').filter(s => s.length > 0)
      return { success: true, pid, strings, count: strings.length }
    } catch (err: any) {
      return { success: false, pid, error: err.message || 'Failed to dump memory' }
    }
  })

  // Get UI Automation tree for a window
  ipcMain.handle(WINPROC_CHANNELS.GET_UI_TREE, async (_event, windowHandle: number) => {
    try {
      const psScript = `
        Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
        $automation = [System.Windows.Automation.AutomationElement]
        
        function Get-UIElementTree($element, $depth) {
            if ($depth -gt 6) { return }
            $condition = [System.Windows.Automation.Condition]::TrueCondition
            $children = $element.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
            foreach ($child in $children) {
                $name = $child.Current.Name
                $className = $child.Current.ClassName
                $controlType = $child.Current.ControlType.ProgrammaticName
                $isEnabled = $child.Current.IsEnabled
                $automationId = $child.Current.AutomationId
                
                if ($name -or $className) {
                    $indent = '  ' * $depth
                    $line = "$indent[$controlType] class='$className' name='$name' autoId='$automationId' enabled=$isEnabled"
                    Write-Output $line
                }
                Get-UIElementTree $child ($depth + 1)
            }
        }
        
        try {
            $element = $automation::FromHandle([IntPtr]${windowHandle})
            if ($element) {
                Get-UIElementTree $element 0
            }
        } catch {
            Write-Output "UI Automation not available for this window"
        }
      `
      const result = execSync(
        `powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`,
        { maxBuffer: 5 * 1024 * 1024, timeout: 15000 }
      )
      return { success: true, handle: windowHandle, uiTree: result.toString().trim().split('\n').filter(l => l.trim()) }
    } catch (err: any) {
      return { success: false, handle: windowHandle, error: err.message }
    }
  })

  // Inject JS into a webview within the app (for game automation)
  ipcMain.handle(WINPROC_CHANNELS.INJECT_JS_TO_WEBVIEW, async (_event, jsCode: string) => {
    try {
      if (ownerWindow) {
        const result = await ownerWindow.webContents.executeJavaScript(`
          (function() {
            const webviews = document.querySelectorAll('webview');
            if (webviews.length > 0) {
              return webviews[0].executeJavaScript(${JSON.stringify(jsCode)});
            }
            return null;
          })()
        `)
        return { success: true, result }
      }
      return { success: false, error: 'No owner window' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Fallback: simple process memory region reader
  ipcMain.handle(WINPROC_CHANNELS.READ_PROCESS_MEMORY, async (_event, pid: number, address?: string, size?: number) => {
    try {
      const addr = address || '0'
      const sz = size || 4096
      const psScript = `
        Add-Type -TypeDefinition @'
        using System;
        using System.Runtime.InteropServices;
        public class RawMem {
            [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint a, bool b, int c);
            [DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr h, IntPtr addr, byte[] buf, int sz, out int r);
            [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
        }
'@
        $h = [RawMem]::OpenProcess(0x0410, $false, ${pid})
        if ($h -eq [IntPtr]::Zero) { "ERROR: Cannot open" }
        $buf = New-Object byte[] ${sz}
        $read = 0
        $addr = [IntPtr]${addr}
        [RawMem]::ReadProcessMemory($h, $addr, $buf, ${sz}, [ref]$read)
        [RawMem]::CloseHandle($h)
        [System.BitConverter]::ToString($buf[0..([Math]::Min($read, 1024) - 1)]) -replace '-',' '
      `
      const result = execSync(`powershell -NoProfile -Command "${psScript}"`, { maxBuffer: 5 * 1024 * 1024, timeout: 10000 })
      const output = result.toString().trim()
      if (output.startsWith('ERROR:')) return { success: false, pid, error: output }
      return { success: true, pid, hex: output }
    } catch (err: any) {
      return { success: false, pid, error: err.message }
    }
  })
}
