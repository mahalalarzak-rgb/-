@echo off
chcp 65001 >nul
title بوت رفع التحديثات إلى GitHub - شركة الأرزاق بالله
echo ===================================================
echo   جاري تشغيل بوت مزامنة ورفع الملفات إلى GitHub...
echo ===================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync_github.ps1"

pause
