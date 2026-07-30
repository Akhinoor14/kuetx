// iconRegistry.js
//
// PERFORMANCE FIX: several components look up an icon by a STRING NAME
// stored in nav/category/guide config data (e.g. `{ icon: 'BookOpen' }`
// in nav.js/nav-faculty.js/founderCategories.js/guideContent.js, or
// `hubIcon`/`GROUP_ICONS` in the nav-system files, or `<Icon name="X" />`
// in GuideModal.jsx), then render it via `ICONS[name]` — a genuinely
// dynamic lookup, not a fixed per-component icon. The old fix for the
// `import * as Icons from 'lucide-react'` bundle-size problem (see git
// history) removed that import entirely and converted call sites to
// static named imports — but a dynamic `Icons[name]` lookup has no single
// fixed icon to import by name, so removing the namespace import silently
// left `Icons` undefined at those call sites at runtime
// (ReferenceError: Icons is not defined), even though the build itself
// succeeded (dynamic property access on an undefined identifier is only
// caught when that code path actually executes, not at build time).
//
// Fix: keep the dynamic-lookup capability, but via this small explicit
// registry instead of `import * as Icons from 'lucide-react'` (which
// pulls in and prevents tree-shaking of the ENTIRE icon library, ~500KB+
// unminified, most of which is never used).
//
// This list was built by exhaustively grepping every `icon:`, `hubIcon:`
// (single- AND double-quoted, since guideContent.js is JSON-style
// double-quoted while the nav files are single-quoted), every
// GROUP_ICONS map value, and every `<Icon name="...">` call site across
// the entire src/ tree — not just the handful of files that looked like
// they might use it. 69 icons total, verified against the installed
// lucide-react package's actual exports before being committed here.
//
// IMPORTANT: if a new icon-by-name string is EVER added anywhere in the
// app (a new nav entry, a new guide step, a new category, a new
// `<Icon name="...">` call), it must also be added to both the import
// list AND the ICONS map below, or that specific lookup will silently
// fall back to whatever `|| Circle` (or similar) fallback its call site
// already has — it will NOT throw, so this class of bug can go unnoticed
// until someone visits that specific screen. When adding new icon-by-name
// config anywhere, grep this file first to confirm the name is present.
import {
  Activity, AlertOctagon, AlertTriangle, ArrowUpRight, BarChart2, Bell,
  BellRing, BookMarked, BookOpen, BookOpenCheck, Briefcase, Calendar, CalendarCheck,
  CalendarDays, CalendarClock, CheckCircle2, CheckSquare, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList,
  Clock, Cloud, CloudCog, Cpu, Cross, Database, Droplet,
  Facebook, FileSearch, FileText, Flag, FlaskConical, FolderKanban,
  GitBranch, Github, GraduationCap, Grid, Heart, HelpCircle,
  Home, Info, Landmark, Layers, LayoutGrid, Lightbulb,
  Linkedin, List, Lock, Mail, MapPin, Megaphone,
  MessageCircle, Moon, NotebookText, Palette, Presentation, Rocket, Scissors, Search,
  Settings, Shield, ShoppingBag, Sparkles, Star, StickyNote, Store, Sunrise, Timer,
  TrendingUp, User, UserCog, Users, Users2, UtensilsCrossed, Video, Wallet,
  Wrench, X, Zap,
} from 'lucide-react';

export const ICONS = {
  Activity, AlertOctagon, AlertTriangle, ArrowUpRight, BarChart2, Bell,
  BellRing, BookMarked, BookOpen, BookOpenCheck, Briefcase, Calendar, CalendarCheck,
  CalendarDays, CalendarClock, CheckCircle2, CheckSquare, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList,
  Clock, Cloud, CloudCog, Cpu, Cross, Database, Droplet,
  Facebook, FileSearch, FileText, Flag, FlaskConical, FolderKanban,
  GitBranch, Github, GraduationCap, Grid, Heart, HelpCircle,
  Home, Info, Landmark, Layers, LayoutGrid, Lightbulb,
  Linkedin, List, Lock, Mail, MapPin, Megaphone,
  MessageCircle, Moon, NotebookText, Palette, Presentation, Rocket, Scissors, Search,
  Settings, Shield, ShoppingBag, Sparkles, Star, StickyNote, Store, Sunrise, Timer,
  TrendingUp, User, UserCog, Users, Users2, UtensilsCrossed, Video, Wallet,
  Wrench, X, Zap,
};

export default ICONS;
