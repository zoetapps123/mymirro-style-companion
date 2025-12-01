import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rgmlgeomgpzysqgqvhwm.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnbWxnZW9tZ3B6eXNxZ3F2aHdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY4MTM4MSwiZXhwIjoyMDc3MjU3MzgxfQ.TOSQWc_3S8LrpWLTBJpp8LN5yxzbZcT1BpUo4e26v9k' // Use service role key

const supabase = createClient(supabaseUrl, supabaseKey)

async function deleteAllFilesFromBucket(bucketName) {
  console.log(`Starting deletion from bucket: ${bucketName}`)
  
  let totalDeleted = 0
  let hasMore = true
  
  while (hasMore) {
    try {
      // List files in batches of 1000
      const { data: files, error: listError } = await supabase.storage
        .from(bucketName)
        .list('', {
          limit: 1000,
          offset: 0
        })
      
      if (listError) {
        console.error('Error listing files:', listError)
        break
      }
      
      if (!files || files.length === 0) {
        hasMore = false
        break
      }
      
      console.log(`Found ${files.length} files to delete...`)
      
      // Delete files in batch
      const filePaths = files.map(file => file.name)
      const { error: deleteError } = await supabase.storage
        .from(bucketName)
        .remove(filePaths)
      
      if (deleteError) {
        console.error('Error deleting batch:', deleteError)
        break
      }
      
      totalDeleted += files.length
      console.log(`Deleted ${files.length} files. Total deleted: ${totalDeleted}`)
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000))
      
    } catch (error) {
      console.error('Unexpected error:', error)
      break
    }
  }
  
  console.log(`Deletion complete. Total files deleted: ${totalDeleted}`)
}

// Run the deletion
deleteAllFilesFromBucket('outfits')
  .then(() => console.log('Script completed'))
  .catch(error => console.error('Script failed:', error))
