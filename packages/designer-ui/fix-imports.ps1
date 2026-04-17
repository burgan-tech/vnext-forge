$root = Join-Path $PSScriptRoot "src"

$mapping = @{
    "@shared/lib/utils/cn"                      = "lib/utils/cn"
    "@shared/lib/error/vNextErrorHelpers"       = "lib/error/vNextErrorHelpers"
    "@shared/lib/logger/createLogger"           = "lib/logger/createLogger"
    "@shared/notification/model/notificationStore" = "notification/model/notificationStore"
    "@shared/notification/model/types"          = "notification/model/types"
    "@shared/notification/ui/NotificationContainer" = "notification/ui/NotificationContainer"
    "@shared/api/client"                        = "api/client"
    "@shared/api/HostNavigationBridge"          = "api/HostNavigationBridge"
    "@shared/api/vscodeTransport"               = "api/vscodeTransport"
    "@shared/hooks/useAsync"                    = "hooks/useAsync"
    "@shared/hooks/useDebounce"                 = "hooks/useDebounce"
    "@shared/config/config"                     = "config/config"
    "@app/layouts/AppLayout"                    = "app/AppLayout"
    "@app/providers/AppProviders"               = "app/AppProviders"
    "@app/routes/AppRouter"                     = "app/AppRouter"
}

$uiMapping = @{} # @shared/ui/X => ui/X
$moduleMapping = @{} # @modules/X => modules/X

$files = Get-ChildItem -Path $root -Recurse -Include *.ts,*.tsx -File

foreach ($file in $files) {
    $relPath = $file.FullName.Substring($root.Length + 1) -replace '\\', '/'
    $depth = ($relPath -split '/').Count - 1
    $prefix = ''
    for ($i = 0; $i -lt $depth; $i++) { $prefix += '../' }
    if ($prefix -eq '') { $prefix = './' }

    $content = Get-Content -Raw -Path $file.FullName

    foreach ($k in $mapping.Keys) {
        $target = $prefix + $mapping[$k]
        $content = $content -replace [Regex]::Escape($k), $target
    }

    # @shared/ui/<Name> -> <prefix>ui/<Name>
    $content = [Regex]::Replace($content, '@shared/ui/', "${prefix}ui/")

    # @modules/<rest> -> <prefix>modules/<rest>
    $content = [Regex]::Replace($content, '@modules/', "${prefix}modules/")

    # @app/store/<rest> -> <prefix>store/<rest>
    $content = [Regex]::Replace($content, '@app/store/', "${prefix}store/")
    # @store/<rest> -> <prefix>store/<rest>
    $content = [Regex]::Replace($content, '@store/', "${prefix}store/")
    # @pages/<rest> -> <prefix>pages/<rest>
    $content = [Regex]::Replace($content, '@pages/', "${prefix}pages/")
    # @app/<rest> (catch-all) -> <prefix>app/<rest>
    $content = [Regex]::Replace($content, '@app/', "${prefix}app/")
    # @hooks/<rest> -> <prefix>hooks/<rest>
    $content = [Regex]::Replace($content, '@hooks/', "${prefix}hooks/")
    # remaining @shared/<rest> -> <prefix><rest>
    $content = [Regex]::Replace($content, '@shared/', "${prefix}")
    # Pre-existing relative imports referenced "../../app/store/..." in source;
    # after the move app/store collapsed to top-level store/.
    $content = [Regex]::Replace($content, '(\.\./)+app/store/', "${prefix}store/")
    $content = [Regex]::Replace($content, '(\.\./)+app/layouts/', "${prefix}app/")
    $content = [Regex]::Replace($content, '(\.\./)+app/providers/', "${prefix}app/")
    $content = [Regex]::Replace($content, '(\.\./)+app/routes/', "${prefix}app/")
    # Pre-existing relative imports referenced "../shared/..." or "../../shared/...";
    # after the move shared/ collapsed to top-level (lib/, ui/, hooks/, ...).
    $content = [Regex]::Replace($content, '(\.\./)+shared/', "${prefix}")

    Set-Content -NoNewline -Path $file.FullName -Value $content
}

Write-Host "Rewrote imports in $($files.Count) files."
