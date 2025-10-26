import { supabase } from '@/integrations/supabase/client';
import { ScrapedNumber } from '@/types';
import { operatorMatcher } from '@/utils/operatorMatcher';

export class DatabaseService {
  // Récupérer tous les numéros de la base de données
  static async getAllNumbers(): Promise<ScrapedNumber[]> {
    const { data, error } = await supabase
      .from('scraped_numbers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching numbers:', error);
      throw error;
    }

    // Mapper les données de la base vers le format ScrapedNumber
    return (data || []).map(row => ({
      id: row.id,
      phoneNumber: row.phone_number,
      rawNumber: row.raw_number,
      category: row.category,
      comment: row.comment || '',
      date: row.date,
      operator: row.operator,
      operatorCode: row.operator_code,
    }));
  }

  // Mettre à jour les opérateurs des numéros qui ont "Inconnu"
  static async updateOperators(numbers: ScrapedNumber[]): Promise<void> {
    const unknownNumbers = numbers.filter(n => n.operator === 'Inconnu');
    
    if (unknownNumbers.length === 0) {
      console.log('No unknown operators to update');
      return;
    }

    console.log(`🔍 Updating operators for ${unknownNumbers.length} numbers...`);
    console.log(`📞 Sample numbers to match:`, unknownNumbers.slice(0, 3).map(n => n.phoneNumber));

    // Matcher les opérateurs
    const matched = operatorMatcher.matchNumbers(unknownNumbers);

    // Mettre à jour en batch
    const updates = matched
      .filter(n => n.operator !== 'Inconnu')
      .map(n => ({
        id: n.id,
        operator: n.operator,
        operator_code: n.operatorCode,
      }));

    console.log(`✅ Successfully matched ${updates.length}/${unknownNumbers.length} operators`);

    if (updates.length > 0) {
      let successCount = 0;
      for (const update of updates) {
        const { error } = await supabase
          .from('scraped_numbers')
          .update({
            operator: update.operator,
            operator_code: update.operator_code,
          })
          .eq('id', update.id);
        
        if (!error) successCount++;
      }
      
      console.log(`💾 Successfully saved ${successCount} operator updates to database`);
    } else {
      console.warn('⚠️ No operators could be matched. Check CSV data loading.');
    }
  }
}
