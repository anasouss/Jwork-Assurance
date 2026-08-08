SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'compagnies_assurance'
      AND column_name = 'prefixe_dossier'
);

SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE compagnies_assurance ADD COLUMN prefixe_dossier varchar(10) NULL AFTER prefixe_carte_verte',
    'SELECT 1'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

SET @unique_index_exists = (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'compagnies_assurance'
      AND column_name = 'prefixe_dossier'
      AND non_unique = 0
);

SET @sql = IF(
    @unique_index_exists = 0,
    'CREATE UNIQUE INDEX uk_compagnie_prefixe_dossier ON compagnies_assurance (prefixe_dossier)',
    'SELECT 1'
);
PREPARE statement FROM @sql;
EXECUTE statement;
DEALLOCATE PREPARE statement;

