param([switch]$EnableNewsletter)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ($EnableNewsletter -and (Select-String -LiteralPath (Join-Path $projectRoot 'coming-soon/coming-soon.js') -SimpleMatch 'In questa anteprima la tua email non viene inviata')) {
    throw 'Before enabling subscriptions, replace the preview privacy notice with the actual collection notice.'
}
$output = Join-Path $projectRoot 'dist-coming-soon'
if ((Split-Path -Parent $output) -ne $projectRoot -or (Split-Path -Leaf $output) -ne 'dist-coming-soon') {
    throw 'Refusing to build outside dist-coming-soon.'
}
if (Test-Path -LiteralPath $output) { Remove-Item -LiteralPath $output -Recurse -Force }
$public = Join-Path $output 'www'
$private = Join-Path $output 'tpr-newsletter'
New-Item -ItemType Directory -Path $public, $private, (Join-Path $public 'api') -Force | Out-Null
$encoding = [System.Text.UTF8Encoding]::new($false)

foreach ($name in @('index.html', 'coming-soon.css', 'coming-soon.js')) {
    $content = [System.IO.File]::ReadAllText((Join-Path $projectRoot "coming-soon/$name"))
    $content = $content.Replace('../assets/', '/assets/')
    if ($name -eq 'index.html') {
        $content = $content.Replace('<meta name="robots" content="noindex, nofollow">', '<meta name="robots" content="index, follow">' + "`n    " + '<link rel="canonical" href="https://thepeoplesroom.it/">')
        if ($EnableNewsletter) {
            $content = $content.Replace('data-endpoint=""', 'data-endpoint="/api/newsletter.php"')
        }
    }
    [System.IO.File]::WriteAllText((Join-Path $public $name), $content, $encoding)
}

$assets = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($name in @('index.html', 'coming-soon.css', 'coming-soon.js')) {
    $content = [System.IO.File]::ReadAllText((Join-Path $public $name))
    foreach ($match in [regex]::Matches($content, 'assets/([^"''()\s?`]+)')) {
        $relative = $match.Groups[1].Value
        if ($relative -match '\.\.' -or $relative -notmatch '\.(svg|otf|ttf|woff2?|png|webp|jpe?g)$') {
            throw "Unexpected asset path: $relative"
        }
        [void]$assets.Add($relative)
    }
}
foreach ($relative in $assets) {
    $source = Join-Path $projectRoot "assets/$relative"
    $target = Join-Path $public "assets/$relative"
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $target
}

Copy-Item -LiteralPath (Join-Path $projectRoot 'server/php/newsletter.php') -Destination $private
Copy-Item -LiteralPath (Join-Path $projectRoot 'server/php/config.example.php') -Destination $private
$entry = [System.IO.File]::ReadAllText((Join-Path $projectRoot 'server/php/public/newsletter.php'))
$entry = $entry.Replace("dirname(__DIR__) . '/newsletter.php'", "dirname(__DIR__, 2) . '/tpr-newsletter/newsletter.php'")
$entry = $entry.Replace("dirname(__DIR__) . '/config.php'", "dirname(__DIR__, 2) . '/tpr-newsletter/config.php'")
[System.IO.File]::WriteAllText((Join-Path $public 'api/newsletter.php'), $entry, $encoding)
[System.IO.File]::WriteAllText((Join-Path $public 'robots.txt'), "User-agent: *`nAllow: /`nDisallow: /api/`n", $encoding)

# Existing WordPress rewrites must be backed up before replacing .htaccess.
$htaccess = @'
DirectoryIndex index.html
Options -Indexes
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteRule ^coming-soon/?$ / [R=302,L]
</IfModule>
'@
[System.IO.File]::WriteAllText((Join-Path $public '.htaccess'), $htaccess, $encoding)

$files = Get-ChildItem -LiteralPath $output -Recurse -File | Measure-Object -Property Length -Sum
Write-Output "Prepared $($files.Count) files ($([math]::Round($files.Sum / 1MB, 2)) MiB) in $output. No credentials are included."
