const { format } = require('date-fns');

const items = [
  { data: '2026-04-21', id: '1' }
];

const parseLocalDate = (dateStr) => new Date(dateStr + "T00:00:00");

const lastEntryDate = items.reduce((max, i) => (i.data > max ? i.data : max), "");
console.log("lastEntryDate:", lastEntryDate);

const dataFim = parseLocalDate('2026-05-20');
console.log("dataFim:", dataFim);

const validDataFim = (() => {
  if (!dataFim) return undefined;
  if (lastEntryDate && format(dataFim, "yyyy-MM-dd") > lastEntryDate) {
    return parseLocalDate(lastEntryDate);
  }
  return dataFim;
})();
console.log("validDataFim:", validDataFim);

const dataInicio = parseLocalDate('2026-04-21');

const filtered = items.filter((i) => {
  const itemDate = parseLocalDate(i.data);
  if (dataInicio) { if (itemDate < dataInicio) return false; }
  if (validDataFim) { 
    const fim = new Date(validDataFim); 
    fim.setHours(23, 59, 59, 999); 
    if (itemDate > fim) return false; 
  }
  return true;
});

console.log("filtered length:", filtered.length);
