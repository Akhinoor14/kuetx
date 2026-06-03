# KUETx — Student Life OS

A comprehensive student life tracker built for KUET students.  
Based on the KUET Academic Ordinance (effective from 2nd Term of Session 2011-12).

## Features

- 📚 Course management with KUET grading system
- 📅 Attendance tracker with auto marks calculation
- 📝 CT & marks entry (Theory / Sessional / Project)
- 📊 GPA & CGPA calculator (auto from marks)
- 🧮 Smart calculators — Legacy CGPA import, Max achievable CGPA, Target planner
- ⚠️ Smart alerts — probation risk, struck-off warnings, Dean's List eligibility
- 💰 Money tracker — expenses by category
- 🕌 Namaz tracker with jamat times
- 📓 Class diary — topic coverage per class
- ⭐ Smart Score — holistic life rating out of 100
- 🌙 3 Themes: Light, Milky, Dark
- 💾 All data stored in localStorage — no server, no login

## Deploy to Vercel

### Option 1: GitHub → Vercel (recommended)
1. Push this folder to a GitHub repo
2. Import the repo in [vercel.com](https://vercel.com)
3. Framework: **Vite** | Build: `npm run build` | Output: `dist`
4. Deploy ✓

### Option 2: Vercel CLI
```bash
npm install
npm run build
npx vercel --prod
```

### Option 3: Local dev
```bash
npm install
npm run dev
```

## Stack
- React 18 + Vite
- Tailwind CSS
- Recharts
- React Router v6
- localStorage (zero backend)

## Developer
**Md Akhinoor Islam**  
KUET — Dept. of Energy Science & Engineering  
[A3KM Studio](https://a3kmstudio.vercel.app)
