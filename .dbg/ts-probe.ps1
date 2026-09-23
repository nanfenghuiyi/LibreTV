$ErrorActionPreference = 'Stop'
$tmp = Join-Path $env:TEMP "seg000.ts"
Invoke-WebRequest -Uri "https://t33.cdn2020.com/video/m3u8/2023/09/16/e12876d6/0000.ts" -OutFile $tmp -TimeoutSec 30 -UseBasicParsing
$bytes = [System.IO.File]::ReadAllBytes($tmp)
$pktLen = 188
$pmtPidFound = -1
$found = @()
for ($i = 0; $i -lt $bytes.Length - $pktLen; $i += $pktLen) {
  if ($bytes[$i] -ne 0x47) { continue }
  $pktPid = ((($bytes[$i+1] -band 0x1F) -shl 8) -bor $bytes[$i+2])
  $afc = ($bytes[$i+3] -shr 4) -band 0x3
  if (-not ($afc -band 0x1)) { continue }  # no payload
  $off = 4
  if ($afc -band 0x2) { $off += 1 + $bytes[$i+4] }  # adaptation field
  $p = $i + $off
  if ($p -ge $i + $pktLen) { continue }
  # pointer_field must be 0 for the first section in payload; scan start
  if ($bytes[$p] -ne 0x00) { continue }
  $start = $p + 1
  if ($pktPid -eq 0) {
    # PAT: table_id 0x00
    if ($bytes[$start] -ne 0x00) { continue }
    $sectionLen = ((($bytes[$start+1] -band 0x0F) -shl 8) -bor $bytes[$start+2])
    $j = $start + 8
    $end = $start + 3 + $sectionLen - 4
    while ($j -lt $end -and $j -lt $i + $pktLen) {
      $progNum = ($bytes[$j] -shl 8) -bor $bytes[$j+1]
      $pm = ((($bytes[$j+2] -band 0x1F) -shl 8) -bor $bytes[$j+3])
      if ($progNum -ne 0 -and $pmtPidFound -lt 0) { $pmtPidFound = $pm }
      $j += 4
    }
  } elseif ($pktPid -eq $pmtPidFound -and $pmtPidFound -ge 0) {
    # PMT: table_id 0x02
    if ($bytes[$start] -ne 0x02) { continue }
    $sectionLen = ((($bytes[$start+1] -band 0x0F) -shl 8) -bor $bytes[$start+2])
    $j = $start + 12
    $end = $start + 3 + $sectionLen - 4
    while ($j -lt $end -and $j -lt $i + $pktLen) {
      $st = $bytes[$j]
      $esLen = ((($bytes[$j+3] -band 0x0F) -shl 8) -bor $bytes[$j+4])
      $found += ("stream_type=0x{0:X2}" -f $st)
      $j += 5 + $esLen
    }
  }
}
"PMT PID: $pmtPidFound"
"stream types (unique):"
$found | Sort-Object -Unique
# stream_type 常见值: 0x1B=H.264 0x24=HEVC 0x0F=AAC 0x03/0x04=MP3 0x81=AC3
Remove-Item $tmp -ErrorAction SilentlyContinue
