param([switch]$NoBrowser)
$ErrorActionPreference="Stop"
Set-Location $PSScriptRoot
$pgBin="C:\Program Files\PostgreSQL\18\bin"
& "$pgBin\pg_ctl.exe" -D "$PSScriptRoot\.pgdata" status *> $null
if($LASTEXITCODE -ne 0){
 & "$pgBin\pg_ctl.exe" -D "$PSScriptRoot\.pgdata" -l "$PSScriptRoot\.pgdata\server.log" -o "-p 5433 -h 127.0.0.1" start
 if($LASTEXITCODE -ne 0){throw "Не удалось запустить PostgreSQL"}
}
npm.cmd run db:init
if($LASTEXITCODE -ne 0){throw "Не удалось подготовить базу"}
if(!$NoBrowser){Start-Process "http://localhost:3000"}
npm.cmd run dev
