-- Delete all files from storage bucket in batches
-- Run this in Supabase SQL Editor

DO $$
DECLARE
    batch_size INTEGER := 1000;
    deleted_count INTEGER;
    total_deleted INTEGER := 0;
BEGIN
    LOOP
        -- Delete files in batches
        DELETE FROM storage.objects 
        WHERE bucket_id = 'outfits'
        AND id IN (
            SELECT id FROM storage.objects 
            WHERE bucket_id = 'outfits' 
            LIMIT batch_size
        );
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        total_deleted := total_deleted + deleted_count;
        
        RAISE NOTICE 'Deleted % files. Total: %', deleted_count, total_deleted;
        
        -- Exit if no more files to delete
        EXIT WHEN deleted_count = 0;
        
        -- Small delay between batches
        PERFORM pg_sleep(0.1);
    END LOOP;
    
    RAISE NOTICE 'Deletion complete. Total files deleted: %', total_deleted;
END $$;
