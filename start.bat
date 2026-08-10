@echo off
chcp 65001 >nul
title Shop Manager - نظام تسيير المحلات
cd /d "%~dp0"

echo ============================================
echo   نظام تسيير المحلات - التشغيل
echo ============================================
echo.

if not exist "node_modules" (
  echo تثبيت الاعتماديات... (المرة الأولى فقط)
  call npm install
  if errorlevel 1 goto :error
  call npm run db:init
)

echo تشغيل الخادم والواجهة...
echo افتح المتصفح على: http://localhost:5173
echo.
call npm run dev

goto :eof

:error
echo.
echo حدث خطأ أثناء التثبيت. تأكد من تثبيت Node.js.
pause
