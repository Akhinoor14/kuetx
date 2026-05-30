#!/usr/bin/env python3
"""Simple schedule generator for one course (demo).
Generates `public/generated_schedule.json` from embedded sample input.
"""
from datetime import date, timedelta, datetime
import json
import os


def daterange(start_date, end_date):
    for n in range(int((end_date - start_date).days) + 1):
        yield start_date + timedelta(n)


def is_weekday(d):
    return d.weekday() < 5  # Mon-Fri


def nearest_preferred(d, preferred_weekdays, available_set, max_shift=3):
    # Preferred weekdays: set of ints 0=Mon..6=Sun
    if d in available_set and d.weekday() in preferred_weekdays:
        return d
    # try small shifts
    for shift in range(0, max_shift + 1):
        for s in (-shift, shift):
            cand = d + timedelta(days=s)
            if cand in available_set and cand.weekday() in preferred_weekdays:
                return cand
    # fallback: nearest available
    for shift in range(0, max_shift + 14):
        for s in (-shift, shift):
            cand = d + timedelta(days=s)
            if cand in available_set:
                return cand
    return None


def generate_course_schedule(input_data):
    term_start = datetime.strptime(input_data["term_start"], "%Y-%m-%d").date()
    term_end = datetime.strptime(input_data["term_end"], "%Y-%m-%d").date()
    holidays = set(datetime.strptime(d, "%Y-%m-%d").date() for d in input_data.get("holidays", []))

    no_ct_first_days = input_data.get("no_ct_first_days", 14)
    no_ct_last_days = input_data.get("no_ct_last_days", 7)
    min_gap_days = input_data.get("min_gap_days", 14)
    preferred_weekdays = set(input_data.get("preferred_weekdays", [1,2,3]))  # Tue,Wed,Thu

    courses = input_data["courses"]

    # build teaching days (weekdays excluding holidays)
    teaching_days = [d for d in daterange(term_start, term_end) if is_weekday(d) and d not in holidays]

    results = {"term": input_data.get("term_name", "term"), "generated_at": date.today().isoformat(), "courses": []}

    available_set = set(teaching_days)

    banned_start = term_start + timedelta(days=no_ct_first_days)
    banned_end = term_end - timedelta(days=no_ct_last_days)

    for c in courses:
        n_cts = c.get("n_cts", 3)
        course_window_days = [d for d in teaching_days if banned_start <= d <= banned_end]
        if not course_window_days:
            warnings = ["No available days for CTs after applying no-CT windows and holidays"]
            results["courses"].append({"courseId": c["id"], "warnings": warnings})
            continue

        total_days = (course_window_days[-1] - course_window_days[0]).days
        spacing = max(1, total_days // (n_cts + 1))

        ct_list = []
        warnings = []

        for i in range(1, n_cts + 1):
            target = course_window_days[0] + timedelta(days=spacing * i)
            chosen = nearest_preferred(target, preferred_weekdays, available_set)
            if not chosen:
                warnings.append(f"Could not place CT{i} for course {c['id']}")
                continue
            owner = []
            # assign owners: teacher A, teacher B, combined for 3rd
            teachers = c.get("teachers", [])
            if n_cts == 4:
                # if 4 CTs, distribute 2 each if two teachers
                idx = i - 1
                if len(teachers) >= 2:
                    owner = [teachers[idx % len(teachers)]]
                else:
                    owner = teachers
            else:
                if i == 1:
                    owner = [teachers[0]] if teachers else []
                elif i == 2:
                    owner = [teachers[1]] if len(teachers) > 1 else (teachers or [])
                else:
                    owner = teachers

            ct_list.append({"type": f"CT{i}", "date": chosen.isoformat(), "owners": owner})

        # check min gap
        ct_dates = [datetime.fromisoformat(x["date"]).date() for x in ct_list]
        ct_dates.sort()
        for a, b in zip(ct_dates, ct_dates[1:]):
            if (b - a).days < min_gap_days:
                warnings.append(f"CTs {a} and {b} are closer than min_gap {min_gap_days} days")

        # lab quiz placement
        quiz_list = []
        if c.get("type") == "lab":
            # prefer last lab session date if provided
            lab_sessions = [datetime.strptime(s, "%Y-%m-%d").date() for s in c.get("lab_sessions", [])]
            if lab_sessions:
                qd = max(d for d in lab_sessions if d in available_set) if any(d in available_set for d in lab_sessions) else max(lab_sessions)
            else:
                qd = max([d for d in teaching_days if d <= term_end]) - timedelta(days=0)
            quiz_list.append({"type": "LabQuiz", "date": qd.isoformat()})

        results["courses"].append({
            "courseId": c["id"],
            "title": c.get("title"),
            "ctList": ct_list,
            "quizList": quiz_list,
            "warnings": warnings,
            "sourceModel": input_data.get("model", "balanced")
        })

    return results


def main():
    sample = {
        "term_name": "T2026S1",
        "term_start": "2026-09-01",
        "term_end": "2026-11-30",
        "holidays": ["2026-09-21", "2026-10-12"],
        "no_ct_first_days": 14,
        "no_ct_last_days": 7,
        "min_gap_days": 14,
        "preferred_weekdays": [1,2,3],
        "model": "balanced",
        "courses": [
            {"id": "CSE101", "title": "Intro to CS", "type": "theory", "n_cts": 3, "teachers": ["tA","tB"]},
            {"id": "PHY201L", "title": "Physics Lab", "type": "lab", "n_cts": 1, "teachers": ["tL"], "lab_sessions": ["2026-11-20","2026-11-23"]}
        ]
    }

    out = generate_course_schedule(sample)
    out_path = os.path.join(os.getcwd(), "public", "generated_schedule.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print("Wrote", out_path)


if __name__ == "__main__":
    main()
