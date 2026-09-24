import {dateParts, wallTimeToDate, slotDue} from './messages.mjs';
export function nextCheck(config, now = new Date(), completed = []) {
  if (!config.schedule?.enabled) return null;
  const due = slotDue(config, now, completed);
  if (due) return 'ממתין לבדיקה הקרובה ברקע';
  const p = dateParts(now, config.timeZone);
  const checks = config.schedule.checks || (config.schedule.weekdays || []).flatMap(weekday => config.schedule.times.map(time => ({weekday,time})));
  const candidates=[];
  for(let offset=0;offset<=7;offset++){
    const d=new Date(Date.UTC(p.year,p.month-1,p.day+offset,12));
    for(const check of checks.filter(c=>c.weekday===d.getUTCDay())){
      const date=wallTimeToDate({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:Number(check.time.slice(0,2)),minute:Number(check.time.slice(3))},config.timeZone);
      if(date>now && (!config.schedule.effectiveAfter || date>new Date(config.schedule.effectiveAfter)))candidates.push(date);
    }
  }
  candidates.sort((a,b)=>a-b);
  return candidates.length ? new Intl.DateTimeFormat('he-IL',{timeZone:config.timeZone,weekday:'long',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(candidates[0]) : null;
}
export const statusLabels = {completed:'העדכון הסתיים',completed_with_issues:'העדכון הסתיים; חלק מהקבצים ממתינים לתיקון',no_changes:'נבדק — אין שינויים',no_files:'נבדק — לא נמצאו קבצים',preview_ready:'בדיקת התאמה בלבד',recovered:'הפעולה הקודמת נבדקה',failed:'הבדיקה נכשלה',running:'בדיקה מתבצעת',disabled:'התזמון כבוי',not_due:'ממתין למועד הבא'};
