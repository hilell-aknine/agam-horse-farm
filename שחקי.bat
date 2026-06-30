@echo off
chcp 65001 >nul
title החווה של אגם
cd /d "%~dp0"
echo.
echo   ===================================
echo      פותח את החווה של אגם...
echo   ===================================
echo.
echo   אם הדפדפן לא נפתח לבד, פתחי:
echo   http://localhost:8753
echo.
echo   לסגירה: סגרי את החלון השחור הזה.
echo.
start "" "http://localhost:8753/index.html"
python -m http.server 8753
