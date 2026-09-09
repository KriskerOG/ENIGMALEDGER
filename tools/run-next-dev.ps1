param(
  [int]$Port = 3000
)

$NodeBin = "C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
$NodeExe = Join-Path -Path $NodeBin -ChildPath "node.exe"
$PnpmCli = "C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\pnpm\bin\pnpm.cjs"

$env:Path = "$NodeBin;$env:Path"

& $NodeExe $PnpmCli run dev --hostname 127.0.0.1 --port $Port

