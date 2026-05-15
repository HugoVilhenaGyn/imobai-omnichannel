@echo off
setlocal enabledelayedexpansion
title ImobAI - Manutencao Semanal de Banco
color 0B

echo ========================================================
echo   VERIFICADOR DE ATIVIDADE SUPABASE (EVITAR PAUSA)
echo ========================================================
echo.
echo Este script realizara uma consulta ao seu banco de dados
echo para garantir que o Supabase nao pause seu projeto.
echo.
echo [!] Pressione qualquer tecla para INICIAR...
pause > nul

cls
echo.
echo [1/2] Iniciando comunicacao com o servidor...
echo.

:: Simulação de Barra de Progresso
set "bar=########################################"
for /L %%i in (1,2,40) do (
    set /a "pct=%%i * 100 / 40"
    cls
    echo.
    echo [1/2] Estabelecendo conexao segura...
    echo.
    echo !bar:~0,%%i! %%pct%%%
    ping -n 1 127.0.0.1 > nul
)

cls
echo.
echo [2/2] Enviando sinal de atividade...
echo.

:: Chamada real para o Supabase
for /f "tokens=*" %%i in ('curl.exe -s -o /dev/null -I -w "%%{http_code}" "https://donfkpdjlazwcjugnfjd.supabase.co/rest/v1/contacts?select=id&limit=1" -H "apikey: sb_publishable_zO2EEQmw2vCDJtWAoyPjpA_H8tTXekx"') do set status=%%i

ping -n 2 127.0.0.1 > nul

cls
echo.
if "%status%"=="200" (
    color 0A
    echo ========================================================
    echo    SUCESSO: O BANCO DE DADOS ESTA ATIVO!
    echo ========================================================
    echo.
    echo    Sua atividade semanal foi registrada.
    echo    O sistema continuara online pelos proximos 7 dias.
    echo.
) else (
    color 0C
    echo ========================================================
    echo    ALERTA: O BANCO DE DADOS PODE ESTAR PAUSADO
    echo ========================================================
    echo.
    echo    O que fazer agora?
    echo    1. Acesse: https://supabase.com/dashboard
    echo    2. Clique no seu projeto (donfkpdjlazwcjugnfjd)
    echo    3. Clique no botao "Restore Project"
    echo    4. Aguarde 2 minutos e tente novamente.
    echo.
)

echo ========================================================
echo Pressione qualquer tecla para sair...
pause > nul
