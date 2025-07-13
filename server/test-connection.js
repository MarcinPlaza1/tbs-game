const postgres = require('postgres');

async function testConnection() {
  const sql = postgres('postgresql://postgres:User123@localhost:5432/postgres');
  
  try {
    const result = await sql`SELECT version()`;
    console.log('✅ Połączenie z PostgreSQL udane!');
    console.log('Wersja:', result[0].version);
    
    // Test połączenia z naszą bazą
    const sqlTbs = postgres('postgresql://postgres:User123@localhost:5432/tbs_game');
    await sqlTbs`SELECT 1`;
    console.log('✅ Połączenie z bazą tbs_game udane!');
    
    await sqlTbs.end();
  } catch (error) {
    console.log('❌ Błąd połączenia:', error.message);
    console.log('Sprawdź:');
    console.log('1. Czy PostgreSQL działa na porcie 5432');
    console.log('2. Czy hasło użytkownika postgres to: User123');
    console.log('3. Czy baza danych tbs_game została utworzona');
  }
  
  await sql.end();
}

testConnection(); 