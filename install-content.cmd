@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================================
echo  ДУП Portal - установка контента без изменения файлов
echo ==========================================================
echo.
echo Этот скрипт ничего не конвертирует и не редактирует.
echo Он только копирует файлы в ожидаемые папки.
echo.
echo Пример ручного запуска из PowerShell:
echo   Copy-Item "C:\path\dup_game_1.html" ".\processes\realization\guide\dup_game_1.html"
echo   Copy-Item "C:\path\diagram.bpmn" ".\processes\realization\diagram\realization.bpmn"
echo   Copy-Item "C:\path\regulation.pdf" ".\processes\realization\document\regulation.pdf"
echo.
pause
