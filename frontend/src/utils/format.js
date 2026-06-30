export function formatAmount(amount) {
  if (amount === null || amount === undefined) return 'Rs. 0';
  return 'Rs. ' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function formatTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function calcAnk(pana) {
  if (!pana || pana.length !== 3 || !/^\d{3}$/.test(pana)) return '';
  return ((+pana[0] + +pana[1] + +pana[2]) % 10).toString();
}

// Always display panas as 3-char strings with leading zeros preserved
export function formatPana(p) {
  return String(p == null ? '' : p).padStart(3, '0');
}

// Format a number correctly based on its bet type
// single_ank → as-is (1 digit), jodi → pad to 2, everything else (pana) → pad to 3
export function formatNumber(number, betType) {
  const num = String(number == null ? '' : number);
  if (betType === 'single_ank') return num;
  if (betType === 'jodi')       return num.padStart(2, '0');
  return num.padStart(3, '0');
}
