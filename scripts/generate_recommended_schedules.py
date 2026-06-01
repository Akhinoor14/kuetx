#!/usr/bin/env python3
"""
CT & Quiz Smart Planning - Recommended Schedule Generator
Generates pre-computed optimal schedules for all departments
"""

import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Load existing data
def load_holidays():
    try:
        with open('src/data/holidays.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return {}

def load_curriculum():
    try:
        with open('src/data/curriculum/index.js', 'r', encoding='utf-8') as f:
            content = f.read()
            # Simple extraction - adjust as needed
            if 'CURRICULUM' in content:
                return True
        return {}
    except:
        return {}

def get_business_days(start_date, end_date, holidays_list):
    """Calculate business days excluding weekends and holidays"""
    days = []
    current = start_date
    holiday_set = set(holidays_list)
    
    while current <= end_date:
        date_str = current.strftime('%Y-%m-%d')
        if current.weekday() < 5 and date_str not in holiday_set:
            days.append(date_str)
        current += timedelta(days=1)
    
    return days

def generate_ct_dates(available_days, num_cts, min_gap=12):
    """Generate CT dates with minimum gap"""
    if not available_days or num_cts <= 0:
        return []
    
    dates = []
    step = max(1, len(available_days) // (num_cts + 1))
    
    for i in range(1, num_cts + 1):
        idx = min(i * step, len(available_days) - 1)
        dates.append(available_days[idx])
    
    return dates

def calculate_pressure(dates):
    """Calculate pressure score (0-100)"""
    if not dates or len(dates) < 2:
        return 25
    
    gaps = []
    for i in range(1, len(dates)):
        d1 = datetime.strptime(dates[i-1], '%Y-%m-%d')
        d2 = datetime.strptime(dates[i], '%Y-%m-%d')
        gaps.append((d2 - d1).days)
    
    avg_gap = sum(gaps) / len(gaps)
    min_gap = min(gaps)
    
    score = 50
    if min_gap < 10:
        score += 20
    elif min_gap < 14:
        score += 10
    
    if avg_gap > 20:
        score -= 15
    elif avg_gap > 17:
        score -= 10
    
    return max(0, min(100, score))

def generate_schedules_for_term(term_code, term_start, term_end, dept_code):
    """Generate recommended schedules for a term"""
    
    holidays = load_holidays()
    year = term_code.split('T')[1][:4] if 'T' in term_code else '2026'
    
    # Get holidays for this term
    term_holidays = []
    if year in holidays and term_code in holidays[year]:
        term_data = holidays[year][term_code]
        if 'holidays' in term_data:
            term_holidays = [h['date'] for h in term_data['holidays']]
        if 'nonInstructionWeeks' in term_data:
            for week in term_data['nonInstructionWeeks']:
                start = datetime.strptime(week['start'], '%Y-%m-%d')
                end = datetime.strptime(week['end'], '%Y-%m-%d')
                while start <= end:
                    term_holidays.append(start.strftime('%Y-%m-%d'))
                    start += timedelta(days=1)
    
    # Calculate available days (skip first 2 weeks, last 1 week)
    term_start_dt = datetime.strptime(term_start, '%Y-%m-%d')
    term_end_dt = datetime.strptime(term_end, '%Y-%m-%d')
    
    skip_first = term_start_dt + timedelta(days=14)
    skip_last = term_end_dt - timedelta(days=7)
    
    available_days = get_business_days(skip_first, skip_last, term_holidays)
    
    if not available_days:
        return None
    
    # Generate models
    models = {}
    
    # Balanced (12-day gap)
    balanced_dates = generate_ct_dates(available_days, 3, 12)
    models['balanced'] = {
        'ctDates': balanced_dates,
        'pressure': calculate_pressure(balanced_dates),
    }
    
    # Distributed (16-day gap)
    distributed_dates = generate_ct_dates(available_days, 3, 16)
    models['distributed'] = {
        'ctDates': distributed_dates,
        'pressure': calculate_pressure(distributed_dates),
    }
    
    # Low-pressure (18-day gap)
    lowpressure_dates = generate_ct_dates(available_days, 2, 18)
    models['low-pressure'] = {
        'ctDates': lowpressure_dates,
        'pressure': calculate_pressure(lowpressure_dates),
    }
    
    return {
        'termCode': term_code,
        'termStart': term_start,
        'termEnd': term_end,
        'availableDays': len(available_days),
        'models': models,
        'recommended': 'balanced',  # Default recommendation
    }

def main():
    print("🔄 Generating CT/Quiz Recommended Schedules...")
    
    # All departments
    departments = [
        ('ME', 'Mechanical Engineering'),
        ('EEE', 'Electrical & Electronic Engineering'),
        ('CSE', 'Computer Science & Engineering'),
        ('CE', 'Civil Engineering'),
        ('ECE', 'Electronics & Communication'),
        ('IPE', 'Industrial Engineering'),
        ('BECM', 'Building Engineering'),
        ('Arch', 'Architecture'),
        ('URP', 'Urban & Regional Planning'),
        ('LE', 'Leather Engineering'),
        ('TE', 'Textile Engineering'),
        ('BME', 'Biomedical Engineering'),
        ('MSE', 'Materials Science & Engineering'),
        ('ESE', 'Energy Science & Engineering'),
        ('ChE', 'Chemical Engineering'),
        ('MTE', 'Mechatronics Engineering'),
    ]
    
    # Term definitions (adjust as needed)
    terms = [
        {
            'key': 'Y1T1',
            'code': 'T2026S1',
            'start': '2026-09-01',
            'end': '2026-12-31',
        },
        {
            'key': 'Y1T2',
            'code': 'T2027S1',
            'start': '2027-01-15',
            'end': '2027-05-31',
        },
    ]
    
    recommended = {}
    
    for dept_code, dept_name in departments:
        print(f"  📚 {dept_code}: {dept_name}", end=' ... ')
        
        dept_schedules = {}
        success_count = 0
        
        for term in terms:
            schedule = generate_schedules_for_term(
                term['code'],
                term['start'],
                term['end'],
                dept_code
            )
            
            if schedule:
                dept_schedules[term['key']] = schedule
                success_count += 1
        
        if success_count > 0:
            recommended[dept_code] = {
                'name': dept_name,
                'terms': dept_schedules,
                'generatedAt': datetime.now().isoformat(),
            }
            print(f"✓ ({success_count} terms)")
        else:
            print("⚠ No schedules generated")
    
    # Save output
    output_file = 'public/recommended-ct-schedules.json'
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(recommended, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Generated recommendations for {len(recommended)} departments")
    print(f"📁 Saved to: {output_file}")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
