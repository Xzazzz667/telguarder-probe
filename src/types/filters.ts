export type PeriodFilter = 
  | 'today' 
  | 'this_week' 
  | 'this_month' 
  | 'this_quarter' 
  | 'this_year' 
  | 'yesterday' 
  | 'last_week' 
  | 'last_month' 
  | 'last_quarter' 
  | 'last_year' 
  | 'custom' 
  | 'all';

export const getPeriodDates = (period: PeriodFilter): { from: Date; to: Date } | null => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case 'today':
      return { from: today, to: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) };
    
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: yesterday, to: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1) };
    
    case 'this_week':
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + 1);
      return { from: startOfWeek, to: now };
    
    case 'last_week':
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - today.getDay() - 6);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
      return { from: lastWeekStart, to: lastWeekEnd };
    
    case 'this_month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfMonth, to: now };
    
    case 'last_month':
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: lastMonthStart, to: lastMonthEnd };
    
    case 'this_quarter':
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      const startOfQuarter = new Date(now.getFullYear(), quarterStartMonth, 1);
      return { from: startOfQuarter, to: now };
    
    case 'last_quarter':
      const lastQuarterStartMonth = Math.floor(now.getMonth() / 3) * 3 - 3;
      const lastQuarterStart = new Date(now.getFullYear(), lastQuarterStartMonth, 1);
      const lastQuarterEnd = new Date(now.getFullYear(), lastQuarterStartMonth + 3, 0);
      return { from: lastQuarterStart, to: lastQuarterEnd };
    
    case 'this_year':
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return { from: startOfYear, to: now };
    
    case 'last_year':
      const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
      return { from: lastYearStart, to: lastYearEnd };
    
    default:
      return null;
  }
};
