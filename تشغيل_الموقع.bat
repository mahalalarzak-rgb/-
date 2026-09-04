@echo off
title تشغيل خادم الموقع - شركة الأرزاق بالله
echo ===================================================
echo جاري تشغيل الموقع على خادم محلي لتفعيل المايكروفون...
echo ===================================================
echo.
echo سيتم فتح المتصفح تلقائيا الآن.
echo يرجى الموافقة على صلاحية استخدام المايكروفون عند ظهور الرسالة.
echo.
echo لا تغلق هذه النافذة السوداء طوال فترة استخدام الموقع!
echo لإغلاق الموقع، يمكنك إغلاق هذه النافذة أو الضغط على Ctrl+C.
echo.

start http://localhost:8080

powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:8080/'); $listener.Start(); Write-Host 'الخادم يعمل الآن على http://localhost:8080...'; while ($listener.IsListening) { $context = $listener.GetContext(); $req = $context.Request.Url.LocalPath; if ($req -eq '/') { $req = '/index.html' }; $path = Join-Path (Get-Location).Path $req; if (Test-Path $path -PathType Leaf) { $ext = [System.IO.Path]::GetExtension($path); $ct = 'text/plain'; switch ($ext) { '.html' { $ct = 'text/html; charset=utf-8' } '.css' { $ct = 'text/css; charset=utf-8' } '.js' { $ct = 'application/javascript; charset=utf-8' } '.jpg' { $ct = 'image/jpeg' } '.png' { $ct = 'image/png' } }; $context.Response.ContentType = $ct; $buffer = [System.IO.File]::ReadAllBytes($path); $context.Response.ContentLength64 = $buffer.Length; $context.Response.OutputStream.Write($buffer, 0, $buffer.Length) } else { $context.Response.StatusCode = 404 }; $context.Response.OutputStream.Close() }"
