const fs = require('fs');
const path = require('path');

function parseDate(s){ return new Date(s + 'T00:00:00'); }
function formatDate(d){ return d.toISOString().slice(0,10); }

function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }

function isWeekday(d){ const w = d.getDay(); return w >=1 && w <=5; }

function dateRange(a,b){ const res=[]; for(let d=new Date(a); d<=b; d=addDays(d,1)) res.push(new Date(d)); return res; }

function dateInSet(d, set){ return set.has(formatDate(d)); }

function nearestPreferred(target, preferredWeekdays, availableSet, maxShift=3){
  const tstr = formatDate(target);
  if (dateInSet(target, availableSet) && preferredWeekdays.has(target.getDay())) return target;
  for(let shift=0; shift<=maxShift; shift++){
    for(const s of [-shift, shift]){
      const cand = addDays(target, s);
      if (dateInSet(cand, availableSet) && preferredWeekdays.has(cand.getDay())) return cand;
    }
  }
  for(let shift=0; shift<=maxShift+14; shift++){
    for(const s of [-shift, shift]){
      const cand = addDays(target, s);
      if (dateInSet(cand, availableSet)) return cand;
    }
  }
  return null;
}

function generate(input){
  const termStart = parseDate(input.term_start);
  const termEnd = parseDate(input.term_end);
  const holidays = new Set((input.holidays||[]));
  const noFirst = input.no_ct_first_days||14;
  const noLast = input.no_ct_last_days||7;
  const minGap = input.min_gap_days||14;
  const preferredWeekdays = new Set((input.preferred_weekdays||[2,3,4])); // Tue-Thu (JS: 2=Tue)

  const days = dateRange(termStart, termEnd).filter(d=> isWeekday(d) && !holidays.has(formatDate(d)));
  const availableSet = new Set(days.map(d=>formatDate(d)));
  const bannedStart = addDays(termStart, noFirst);
  const bannedEnd = addDays(termEnd, -noLast);

  const out = { term: input.term_name||'term', generated_at: (new Date()).toISOString().slice(0,10), courses: [] };

  for(const c of input.courses){
    const n = c.n_cts||3;
    const courseWindow = days.filter(d=> d>=bannedStart && d<=bannedEnd);
    if (!courseWindow.length){ out.courses.push({courseId:c.id, warnings:['No available days for CTs after windows']}); continue; }
    const totalDays = (courseWindow[courseWindow.length-1] - courseWindow[0])/(1000*60*60*24);
    const spacing = Math.max(1, Math.floor(totalDays/(n+1)));
    const ctList = [];
    const warnings = [];
    for(let i=1;i<=n;i++){
      const target = addDays(courseWindow[0], spacing*i);
      const chosen = nearestPreferred(target, preferredWeekdays, availableSet);
      if (!chosen){ warnings.push(`Could not place CT${i} for ${c.id}`); continue; }
      let owner = [];
      const teachers = c.teachers||[];
      if (n===4){ const idx = i-1; owner = teachers.length>=2? [teachers[idx%teachers.length]]: teachers; }
      else { if (i===1) owner = teachers[0]? [teachers[0]]: []; else if (i===2) owner = teachers[1]? [teachers[1]]: (teachers||[]); else owner = teachers; }
      ctList.push({ type:`CT${i}`, date: formatDate(chosen), owners: owner });
    }
    // check min gap
    const ctDates = ctList.map(x=>parseDate(x.date)).sort((a,b)=>a-b);
    for(let i=0;i<ctDates.length-1;i++){
      const a=ctDates[i], b=ctDates[i+1];
      const diff = (b-a)/(1000*60*60*24);
      if (diff < minGap) warnings.push(`CTs ${formatDate(a)} and ${formatDate(b)} are closer than min_gap ${minGap} days`);
    }
    const quizList = [];
    if (c.type==='lab'){
      const labSessions = (c.lab_sessions||[]).map(s=>parseDate(s));
      let qd;
      if (labSessions.length){ qd = labSessions.filter(d=> availableSet.has(formatDate(d))).sort((a,b)=>a-b).pop() || labSessions[labSessions.length-1]; }
      else { qd = days[days.length-1]; }
      quizList.push({ type:'LabQuiz', date: formatDate(qd) });
    }
    out.courses.push({ courseId:c.id, title:c.title, ctList, quizList, warnings, sourceModel: input.model||'balanced' });
  }
  return out;
}

function main(){
  const sample = {
    term_name: 'T2026S1', term_start: '2026-09-01', term_end: '2026-11-30', holidays: ['2026-09-21','2026-10-12'],
    no_ct_first_days:14, no_ct_last_days:7, min_gap_days:14, preferred_weekdays:[2,3,4], model:'balanced',
    courses:[ {id:'CSE101', title:'Intro to CS', type:'theory', n_cts:3, teachers:['tA','tB']}, {id:'PHY201L', title:'Physics Lab', type:'lab', n_cts:1, teachers:['tL'], lab_sessions:['2026-11-20','2026-11-23']} ]
  };
  const out = generate(sample);
  const outPath = path.join(process.cwd(), 'public', 'generated_schedule.json');
  fs.mkdirSync(path.dirname(outPath), { recursive:true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', outPath);
}

if (require.main === module) main();
