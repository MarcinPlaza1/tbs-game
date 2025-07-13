import { db } from './client';
import { users, games, gamePlayers, refreshTokens, passwordResetTokens } from './schema';
import { sql } from 'drizzle-orm';

async function resetData() {
  try {
    console.log('🔄 Rozpoczynam reset danych...');
    
    // Wyłącz sprawdzanie kluczy obcych tymczasowo
    await db.execute(sql`SET session_replication_role = replica;`);
    
    // Usuń dane w odpowiedniej kolejności
    console.log('📋 Usuwam graczy w grach...');
    await db.delete(gamePlayers);
    
    console.log('🎮 Usuwam gry...');
    await db.delete(games);
    
    console.log('🔐 Usuwam tokeny odświeżania...');
    await db.delete(refreshTokens);
    
    console.log('🔑 Usuwam tokeny resetowania hasła...');
    await db.delete(passwordResetTokens);
    
    console.log('👤 Usuwam użytkowników...');
    await db.delete(users);
    
    // Włącz z powrotem sprawdzanie kluczy obcych
    await db.execute(sql`SET session_replication_role = DEFAULT;`);
    
    console.log('✅ Reset danych zakończony pomyślnie!');
    console.log('📊 Zachowano: mapy gier');
    console.log('🗑️  Usunięto: użytkownicy, gry, tokeny, sesje');
    
  } catch (error) {
    console.error('❌ Błąd podczas resetu danych:', error);
    throw error;
  }
}

// Uruchom reset jeśli skrypt wywołano bezpośrednio
if (require.main === module) {
  resetData()
    .then(() => {
      console.log('🎉 Reset danych zakończony!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Reset danych nie powiódł się:', error);
      process.exit(1);
    });
}

export { resetData }; 