# Skrypt konfiguracji bazy danych dla TBS Game
Write-Host "🚀 Konfiguracja bazy danych dla TBS Game" -ForegroundColor Green

# 1. Kopiowanie pliku konfiguracyjnego
Write-Host "1. Tworzenie pliku .env..." -ForegroundColor Yellow
if (Test-Path "server\.env") {
    Write-Host "   Plik .env już istnieje, pomijam..." -ForegroundColor Yellow
} else {
    Copy-Item "server\env-config.txt" "server\.env"
    Write-Host "   ✅ Plik .env został utworzony" -ForegroundColor Green
}

# 2. Informacje o bazie danych
Write-Host "`n2. Tworzenie bazy danych PostgreSQL..." -ForegroundColor Yellow
Write-Host "   Opcja A: Użyj pgAdmin (GUI)" -ForegroundColor Cyan
Write-Host "   1. Otwórz pgAdmin" -ForegroundColor White
Write-Host "   2. Połącz się z serwerem PostgreSQL" -ForegroundColor White
Write-Host "   3. Kliknij prawym przyciskiem na 'Databases'" -ForegroundColor White
Write-Host "   4. Wybierz 'Create' > 'Database...'" -ForegroundColor White
Write-Host "   5. Wpisz nazwę: tbs_game" -ForegroundColor White
Write-Host "   6. Kliknij 'Save'" -ForegroundColor White

Write-Host "`n   Opcja B: Użyj SQL Shell (psql)" -ForegroundColor Cyan
Write-Host "   1. Znajdź 'SQL Shell (psql)' w menu Start" -ForegroundColor White
Write-Host "   2. Naciśnij Enter dla wszystkich wartości domyślnych" -ForegroundColor White
Write-Host "   3. Wpisz hasło: User1234" -ForegroundColor White
Write-Host "   4. Wykonaj polecenie: CREATE DATABASE tbs_game;" -ForegroundColor White

Write-Host "`n3. Po utworzeniu bazy danych, uruchom migracje:" -ForegroundColor Yellow
Write-Host "   cd server" -ForegroundColor White
Write-Host "   bun run db:generate" -ForegroundColor White
Write-Host "   bun run db:migrate" -ForegroundColor White
Write-Host "   bun run db:seed" -ForegroundColor White

Write-Host "`n4. Uruchom aplikację:" -ForegroundColor Yellow
Write-Host "   bun run dev" -ForegroundColor White

Write-Host "`n🎮 Aplikacja będzie dostępna na:" -ForegroundColor Green
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "   Backend API: http://localhost:3000" -ForegroundColor Cyan
Write-Host "   Game Server: ws://localhost:2567" -ForegroundColor Cyan 