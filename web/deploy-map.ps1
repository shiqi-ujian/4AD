# deploy-map.ps1 — 4AD 地图工具站 → 服务器 map.chmweb.cn 部署
# 用法: pwsh -File web/deploy-map.ps1
# 说明:
#   - 入口页 web/index.html 的链接按服务器目录结构重写（./hexmap/、./combatmap/、changelog.html）
#   - 产物 *.dist.html 原样上传（绝不修改产物本身）
#   - 依赖 E:\yingren\shiqi-ujian-chm-web\.deploy-tools\ssh-key-run.js（ssh2 密钥直连）

$ErrorActionPreference = 'Stop'

# 兼容 -File 与 & 两种调用方式（-Command 下 $PSScriptRoot 可能为空）
$scriptPath = if ($PSScriptRoot) { Join-Path $PSScriptRoot (Split-Path -Leaf $MyInvocation.MyCommand.Path) } else { $MyInvocation.MyCommand.Path }
if (-not $scriptPath) { $scriptPath = $PSCommandPath }
$web = Split-Path -Parent $scriptPath                 # 4AD/web
$root = Split-Path -Parent $web                       # 4AD 项目根
$sshHelper = 'E:\yingren\shiqi-ujian-chm-web\.deploy-tools\ssh-key-run.js'
$remoteBase = '/var/www/chmweb/map'

if (!(Test-Path $sshHelper)) { throw "ssh helper not found: $sshHelper" }

function Ssh([string]$cmd) {
  node $sshHelper $cmd 60
  if ($LASTEXITCODE -ne 0) { throw "ssh command failed: $cmd" }
}

function Put([string]$local, [string]$remote) {
  Ssh "put:$local`:$remote"
  Write-Output "uploaded: $local -> $remote"
}

# 1) 重写入口页链接（部署版；本地源文件不动）
$portal = [System.IO.File]::ReadAllText((Join-Path $web 'index.html'), [System.Text.Encoding]::UTF8)
$portal = $portal.Replace('./2_工具/hexmap.dist.html', './hexmap/')
$portal = $portal.Replace('2_工具/combatmap.dist.html', './combatmap/')
$portal = $portal.Replace('更新日志.html', 'changelog.html')
$tmpIndex = Join-Path $env:TEMP 'map-index.html'
[System.IO.File]::WriteAllText($tmpIndex, $portal, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "portal rewritten -> $tmpIndex"

# 2) 服务器目录
Ssh "mkdir -p $remoteBase/combatmap $remoteBase/hexmap"

# 3) 上传（index.html 必须最后传，先传其余文件避免半成品）
Put (Join-Path $web '更新日志.html')      "$remoteBase/changelog.html"
Put (Join-Path $root '2_工具\combatmap.dist.html') "$remoteBase/combatmap/index.html"
Put (Join-Path $root '2_工具\hexmap.dist.html')    "$remoteBase/hexmap/index.html"
Put $tmpIndex                                "$remoteBase/index.html"

Remove-Item $tmpIndex -ErrorAction SilentlyContinue
Write-Output 'OK: map site deployed to map.chmweb.cn'
