import { supabase } from '@/integrations/supabase/client';
import { ScrapedNumber } from '@/types';
import { operatorMatcher } from '@/utils/operatorMatcher';

export class DatabaseService {
  // Récupérer tous les numéros de la base de données (sans limite 1000)
  static async getAllNumbers(): Promise<ScrapedNumber[]> {
    const pageSize = 1000; // limite par défaut côté API
    let from = 0;
    let to = pageSize - 1;
    const rows: any[] = [];

    while (true) {
      const { data, error } = await supabase
        .from('scraped_numbers')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching numbers (range:', from, to, '):', error);
        throw error;
      }

      if (data && data.length > 0) {
        rows.push(...data);
      }

      // Si on a reçu moins que pageSize, on a tout récupéré
      if (!data || data.length < pageSize) break;

      from += pageSize;
      to += pageSize;
    }

    console.log(`Fetched ${rows.length} numbers from database (paged)`);

    // Mapper les données de la base vers le format ScrapedNumber
    return rows.map(row => ({
      id: row.id,
      phoneNumber: row.phone_number,
      rawNumber: row.raw_number,
      category: row.category,
      comment: row.comment || '',
      date: row.date,
      operator: row.operator,
      operatorCode: row.operator_code,
      source: row.source,
      signalements: row.signalements,
    }));
  }

  // Mettre à jour les opérateurs des numéros qui ont "Inconnu"
  static async updateOperators(numbers: ScrapedNumber[]): Promise<void> {
    const unknownNumbers = numbers.filter(n => !n.operator || n.operator === 'Inconnu' || /�/.test(n.operator || ''));
    
    if (unknownNumbers.length === 0) {
      console.log('✅ No unknown operators to update');
      return;
    }

    console.log(`🔍 Updating operators for ${unknownNumbers.length} unknown numbers...`);
    console.log(`📞 Sample numbers:`, unknownNumbers.slice(0, 5).map(n => ({
      phone: n.phoneNumber,
      current: n.operator
    })));

    // Matcher les opérateurs
    const matched = operatorMatcher.matchNumbers(unknownNumbers);

    console.log(`📊 Matching results:`, matched.slice(0, 5).map(n => ({
      phone: n.phoneNumber,
      operator: n.operator,
      code: n.operatorCode
    })));

    // Mettre à jour en batch
    const updates = matched
      .filter(n => n.operator !== 'Inconnu')
      .map(n => ({
        id: n.id,
        operator: n.operator,
        operator_code: n.operatorCode,
      }));

    console.log(`✅ Successfully matched ${updates.length}/${unknownNumbers.length} operators`);
    console.log(`❌ Still unknown: ${unknownNumbers.length - updates.length} numbers`);

    if (updates.length > 0) {
      // Use backend function with service role to bypass RLS for secure updates
      const { data, error } = await supabase.functions.invoke('update-operators', {
        body: { updates },
      });

      if (error) {
        console.error('❌ Edge function update-operators failed:', error);
      } else {
        console.log('💾 Operator updates saved via edge function:', data);
      }
    } else {
      console.warn('⚠️ No operators could be matched. Possible issues:');
      console.warn('  - CSV data not loaded correctly');
      console.warn('  - Phone number format mismatch');
      console.warn('  - Number not in ARCEP ranges');
    }
  }
}
