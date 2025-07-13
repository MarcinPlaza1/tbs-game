-- Skrypt do utworzenia bazy danych dla gry TBS
CREATE DATABASE tbs_game
  WITH
  OWNER = postgres
  ENCODING = 'UTF8'
  LC_COLLATE = 'Polish_Poland.1250'
  LC_CTYPE = 'Polish_Poland.1250'
  TABLESPACE = pg_default
  CONNECTION LIMIT = -1; 