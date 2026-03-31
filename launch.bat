@echo off
title Belyo — Lancement
echo.
echo  ==========================================
echo   Belyo - Demarrage du serveur local...
echo  ==========================================
echo.

:: Se placer dans le dossier du .bat (peu importe d'ou il est lance)
cd /d "%~dp0"
echo  [OK] Dossier : %cd%
echo.
echo  [INFO] Version en ligne : https://belyo.vercel.app
echo.

:: Chercher Python
where python >nul 2>&1
if %errorlevel% == 0 (
    echo  [OK] Python trouve
    goto :launch
)

where python3 >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON=python3
    goto :launch
)

echo  [ERREUR] Python n'est pas installe.
echo  Telechargez Python sur https://www.python.org/downloads/
echo  Cochez "Add Python to PATH" pendant l'installation.
echo.
pause
exit /b 1

:launch
set PYTHON=python
echo  Ouverture du navigateur sur http://localhost:8081
echo  Appuyez sur Ctrl+C dans cette fenetre pour arreter le serveur.
echo.

:: Ouvrir le navigateur apres 1 seconde
start "" /b cmd /c "timeout /t 1 >nul && start http://localhost:8081"

:: Lancer le serveur HTTP Python depuis le bon dossier
%PYTHON% -m http.server 8081

pause