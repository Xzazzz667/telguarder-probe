import { supabase } from '@/integrations/supabase/client';

export class CleanupService {
  static async deleteRecentNumbers(limit: number = 10): Promise<{ success: boolean; totalDeleted?: number; error?: string }> {
    try {
      console.log(`Calling delete-recent-numbers with limit=${limit}`);

      const { data, error } = await supabase.functions.invoke('delete-recent-numbers', {
        body: { limit },
      });

      if (error) {
        console.error('Error calling edge function:', error);
        throw new Error(error.message || 'Failed to delete numbers');
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to delete numbers');
      }

      console.log(`Successfully deleted ${data.totalDeleted} numbers from ${data.sources} sources`);
      return { success: true, totalDeleted: data.totalDeleted };
    } catch (error) {
      console.error('Error in deleteRecentNumbers:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
