# backup.ps1 - גיבוי לילי של החווה של אגם (משימה מתוזמנת AgamFarmBackup, 23:30).
# 1. git bundle מקומי של כל הענפים וההיסטוריה
# 2. צילום של מצב התיקייה (כולל עבודה שלא נשמרה) לענף backup/auto ב-GitHub. main לעולם לא נדחף מכאן.
# 3. ייצוא שורות החווה מהמסד ל-JSON מקומי + עותק לשרת הישן. לא ל-GitHub (שמות של ילדות).
# מאמת שכל קובץ נוצר ולא ריק, ולא סומך על קוד יציאה. 30 יום שמירה.
# שחזור: ראה CONTEXT.md, סעיף "שחזור מגיבוי".
param([switch]$NoPush)

# Continue: ב-PowerShell 5.1 אזהרות של git ב-stderr הופכות לשגיאה תחת Stop. בודקים $LASTEXITCODE ידנית
$ErrorActionPreference = 'Continue'
$Repo    = 'C:\Personal\Kids\agam-horse-farm'
$Root    = 'C:\Backups\agam-horse-farm'
$Secrets = 'C:\Users\saraa\.secrets\agam-horse-farm.env'
$PushPy  = 'C:\Users\saraa\Desktop\old-computer-scripts\push_file.py'
$Remote  = 'C:/server/backups'   # תיקייה קיימת בשרת (push_file לא יוצר תיקיות)
$Keep    = 30
$Stamp   = Get-Date -Format 'yyyy-MM-dd'

foreach ($d in 'git', 'db', 'logs') { New-Item -ItemType Directory -Force (Join-Path $Root $d) | Out-Null }
$Log = Join-Path $Root "logs\$Stamp.log"
function Log($msg) { $line = "$(Get-Date -Format 'HH:mm:ss') $msg"; Add-Content -Path $Log -Value $line -Encoding utf8; Write-Output $line }
$fail = 0

Set-Location $Repo

# ---------- 1. git bundle ----------
try {
  $bundle = Join-Path $Root "git\$Stamp.bundle"
  git bundle create $bundle --all 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'bundle create failed' }
  if ((Test-Path $bundle) -and (Get-Item $bundle).Length -gt 0) {
    git bundle verify $bundle 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'bundle verify failed' }
    Log "OK  bundle $([math]::Round((Get-Item $bundle).Length/1MB,1))MB"
  } else { throw 'bundle missing or empty' }
} catch { Log "FAIL bundle: $_"; $fail++ }

# ---------- 2. צילום לענף backup/auto ----------
# אינדקס זמני: לוקח גם קבצים חדשים שלא נוספו, בלי לגעת באינדקס האמיתי או בתיקייה
try {
  $tmpIndex = Join-Path $env:TEMP "agam-backup-index"
  Copy-Item (Join-Path $Repo '.git\index') $tmpIndex -Force -ErrorAction Stop
  $env:GIT_INDEX_FILE = $tmpIndex
  git add -A 2>$null
  $tree = (git write-tree 2>$null)
  if ($LASTEXITCODE -ne 0 -or -not $tree) { throw 'write-tree failed' }
  $tree = $tree.Trim()
  Remove-Item Env:GIT_INDEX_FILE
  Remove-Item $tmpIndex -Force
  $head = (git rev-parse HEAD).Trim()
  $remoteTree = (git ls-remote origin refs/heads/backup/auto 2>$null)
  $prevTree = $null
  if ($remoteTree) {
    git fetch -q origin backup/auto 2>$null
    $prevTree = (git rev-parse 'FETCH_HEAD^{tree}' 2>$null)
  }
  if ($prevTree -and $prevTree.Trim() -eq $tree) {
    Log 'OK  backup/auto unchanged'
  } elseif ($NoPush) {
    Log "SKIP backup/auto push (-NoPush), tree $tree"
  } else {
    $commit = (git commit-tree $tree -p $head -m "backup $Stamp (snapshot of working tree)").Trim()
    git push -q --force origin "${commit}:refs/heads/backup/auto" 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'push failed' }
    $check = (git ls-remote origin refs/heads/backup/auto) -split '\s' | Select-Object -First 1
    if ($check -ne $commit) { throw "remote ref mismatch ($check)" }
    Log "OK  backup/auto -> $($commit.Substring(0,7))"
  }
} catch { if ($env:GIT_INDEX_FILE) { Remove-Item Env:GIT_INDEX_FILE }; Log "FAIL backup/auto: $_"; $fail++ }

# ---------- 3. המסד: שורות החווה בלבד ----------
try {
  $cfg = @{}
  Get-Content $Secrets -Encoding utf8 | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object { $k, $v = $_ -split '=', 2; $cfg[$k] = $v.Trim() }
  $h = @{ apikey = $cfg.SUPABASE_SERVICE_ROLE_KEY; Authorization = "Bearer $($cfg.SUPABASE_SERVICE_ROLE_KEY)"; 'Accept-Profile' = 'public' }
  $out = [ordered]@{ taken_at = (Get-Date).ToString('o') }
  $missing = @()
  foreach ($t in 'game_saves', 'farm_profiles') {
    try {
      $out[$t] = Invoke-RestMethod -Headers $h -Uri "$($cfg.SUPABASE_URL)/rest/v1/${t}?select=*" -ErrorAction Stop
    } catch {
      # 404 = הטבלה עוד לא נוצרה (לפני שלב האבטחה). לא נחשב כשל
      if ($_.Exception.Response.StatusCode.value__ -eq 404) { $missing += $t } else { throw }
    }
  }
  if ($missing.Count -eq 2) {
    Log 'SKIP db: tables not created yet'
  } else {
    $dbFile = Join-Path $Root "db\$Stamp.json"
    $out | ConvertTo-Json -Depth 50 -Compress | Out-File $dbFile -Encoding utf8
    if (-not ((Test-Path $dbFile) -and (Get-Item $dbFile).Length -gt 0)) { throw 'db file missing or empty' }
    $n = @($out.game_saves).Count
    Log "OK  db $n saves, $([math]::Round((Get-Item $dbFile).Length/1KB))KB"
    $r = python $PushPy $dbFile "$Remote/agam-horse-farm-db-$Stamp.json" 2>&1
    if ($LASTEXITCODE -eq 0) { Log "OK  db copy to render server" } else { Log "WARN render server copy: $r" }
  }
} catch { Log "FAIL db: $_"; $fail++ }

# ---------- שמירה ל-30 יום ----------
foreach ($d in 'git', 'db', 'logs') {
  Get-ChildItem (Join-Path $Root $d) -File | Sort-Object Name -Descending | Select-Object -Skip $Keep | Remove-Item -Force
}

if ($fail) { Log "DONE with $fail failure(s)"; exit 1 } else { Log 'DONE ok'; exit 0 }
