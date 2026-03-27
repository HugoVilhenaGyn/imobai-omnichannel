@echo off
title ImobAI - Servidor de Desenvolvimento
echo ==========================================
echo   INICIANDO SISTEMA IMOBAI (ANTIGRAVITY)
echo ==========================================
echo.
echo 1. Abrindo o navegador em http://localhost:5173/
start http://localhost:5173/
echo.
echo 2. Iniciando o servidor Vite...
echo    (Mantenha esta janela aberta enquanto usa o sistema)
echo.
npm.cmd run dev
pause
