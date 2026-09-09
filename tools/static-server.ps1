param(
  [string]$Root = (Get-Location).Path,
  [int]$Port = 4173
)

$ResolvedRoot = (Resolve-Path -LiteralPath $Root).Path
$Prefix = "http://127.0.0.1:$Port/"

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
}

[void][Reflection.Assembly]::LoadWithPartialName("System.Net")
[void][Reflection.Assembly]::LoadWithPartialName("System.Net.Sockets")

$Listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse("127.0.0.1"), $Port)
$Listener.Start()
Write-Host "Serving $ResolvedRoot at $Prefix"

try {
  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    $Stream = $Client.GetStream()
    $Reader = [IO.StreamReader]::new($Stream, [Text.Encoding]::ASCII, $false, 1024, $true)
    $RequestLine = $Reader.ReadLine()

    while ($true) {
      $HeaderLine = $Reader.ReadLine()
      if ([string]::IsNullOrEmpty($HeaderLine)) {
        break
      }
    }

    if ([string]::IsNullOrWhiteSpace($RequestLine)) {
      $Client.Close()
      continue
    }

    $Parts = $RequestLine.Split(" ")
    $RequestUrl = $Parts[1]
    $RequestPath = [Uri]::UnescapeDataString($RequestUrl.Split("?")[0].TrimStart("/"))

    if ([string]::IsNullOrWhiteSpace($RequestPath)) {
      $RequestPath = "index.html"
    }

    $Candidate = Join-Path -Path $ResolvedRoot -ChildPath $RequestPath
    $ResolvedCandidate = $null

    if (Test-Path -LiteralPath $Candidate -PathType Container) {
      $Candidate = Join-Path -Path $Candidate -ChildPath "index.html"
    }

    if (Test-Path -LiteralPath $Candidate -PathType Leaf) {
      $ResolvedCandidate = (Resolve-Path -LiteralPath $Candidate).Path
    }

    if ($null -eq $ResolvedCandidate -or -not $ResolvedCandidate.StartsWith($ResolvedRoot, [StringComparison]::OrdinalIgnoreCase)) {
      $Payload = [Text.Encoding]::UTF8.GetBytes("Not found")
      $Header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($Payload.Length)`r`nConnection: close`r`n`r`n"
      $HeaderBytes = [Text.Encoding]::ASCII.GetBytes($Header)
      $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
      $Stream.Write($Payload, 0, $Payload.Length)
      $Stream.Flush()
      $Client.Close()
      continue
    }

    $Extension = [IO.Path]::GetExtension($ResolvedCandidate).ToLowerInvariant()
    $ContentType = $MimeTypes[$Extension]
    if ([string]::IsNullOrWhiteSpace($ContentType)) {
      $ContentType = "application/octet-stream"
    }

    $Bytes = [IO.File]::ReadAllBytes($ResolvedCandidate)
    $Header = "HTTP/1.1 200 OK`r`nContent-Type: $ContentType`r`nContent-Length: $($Bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $HeaderBytes = [Text.Encoding]::ASCII.GetBytes($Header)
    $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
    $Stream.Write($Bytes, 0, $Bytes.Length)
    $Stream.Flush()
    $Client.Close()
  }
}
finally {
  $Listener.Stop()
}
