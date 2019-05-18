#r "nuget:BaristaLabs.ChromeDevTools.Runtime, 70.0.3538.77"

using System.Runtime.InteropServices;
using BaristaLabs.ChromeDevTools.Runtime;
using BaristaLabs.ChromeDevTools.Runtime.Runtime;

[DllImport("ntdll.dll")]
static extern int NtQueryInformationProcess(IntPtr processHandle, int processInformationClass, ref PROCESS_BASIC_INFORMATION processInformation, int processInformationLength, out int returnLength);

[StructLayout(LayoutKind.Sequential)]
struct PROCESS_BASIC_INFORMATION
{
  public IntPtr Reserved1;
  public IntPtr PebBaseAddress;
  public IntPtr Reserved2_0;
  public IntPtr Reserved2_1;
  public IntPtr UniqueProcessId;
  public IntPtr InheritedFromUniqueProcessId;
}

Console.WriteLine("Finding the main process");
var processes = Process.GetProcessesByName("code");
processes = processes
  .Where(p =>
  {
    var parentId = GetParentPID(p);
    return !processes.Any(p => p.Id == parentId);
  })
  .ToArray();

var processId = processes.Single().Id;
Console.WriteLine("Assuming the main process ID is " + processId);

Console.WriteLine("Running process._debugProcess on the main process");
var process = new Process();
process.StartInfo.FileName = "node";
process.StartInfo.Arguments = $"debug.js {processId}";
process.StartInfo.RedirectStandardOutput = true;
process.StartInfo.RedirectStandardError = true;
process.Start();
process.WaitForExit();
Console.WriteLine(process.StandardOutput.ReadToEnd());
Console.WriteLine(process.StandardError.ReadToEnd());

Console.WriteLine("Waiting for the CDP endpoint to become responsive");
var session = new ChromeSession("ws://127.0.0.1:9229");
await session.Runtime.CompileScript(new CompileScriptCommand() { Expression = "console.log('test')", SourceURL = "C:/test.js", PersistScript = false });

// TODO: Figure out why the above fails
// TODO: Run the screenshot script

int GetParentPID(Process process)
{
  var processBasicInformation = new PROCESS_BASIC_INFORMATION();
  if (NtQueryInformationProcess(process.Handle, 0, ref processBasicInformation, Marshal.SizeOf(processBasicInformation), out int returnLength) != 0)
  {
    throw new Exception("Failed to query the OS for parent process ID.");
  }

  return processBasicInformation.InheritedFromUniqueProcessId.ToInt32();
}
