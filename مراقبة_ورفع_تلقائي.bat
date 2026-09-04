@echo off
chcp 65001 >nul
title مراقبة ورفع تلقائي على GitHub - الأرزاق بالله
echo ===================================================
echo    بوت المراقبة والرفع التلقائي على GitHub
echo    سيرفع أي تغيير في الملفات تلقائياً خلال 8 ثواني
echo ===================================================
echo.
echo لا تغلق هذه النافذة طوال وقت العمل على المشروع!
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto_sync_watcher.ps1"

pause
