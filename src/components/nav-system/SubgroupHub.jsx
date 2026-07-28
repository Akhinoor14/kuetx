import { Link } from 'react-router-dom';
import { Circle } from 'lucide-react';
import { ICONS } from '../../lib/iconRegistry';
import { NAV } from '../../nav';

// Single synchronized accent color for hub headers/hero icon — no per-group hues.
const HUB_COLOR = 'var(--accent)';

// Per-item accent hues (same sat/lightness range, so colorful but not harsh).
// Falls back to HUB_COLOR if an item has no `accent` key.
const ACCENT_COLORS = {
  blue:   '#3b82f6',
  green:  '#22c55e',
  amber:  '#f59e0b',
  red:    '#ef4444',
  purple: '#a855f7',
};

function resolveAccent(key) {
  return ACCENT_COLORS[key] || HUB_COLOR;
}

// Resolve one { title, items, icon } section (or array of sections, if the
// group has multiple unnamed subgroups) from NAV.
// group: top-level group name (e.g. 'Campus Life', 'Tools', 'Overview')
// subgroup: optional subgroup name when the group has `subgroups` (e.g. 'Academic Core')
function resolveSection(navSource, group, subgroup, filterFn) {
  const section = navSource.find(s => s.group === group);
  if (!section) return null;

  if (subgroup) {
    const sub = (section.subgroups || []).find(s => s.name === subgroup);
    if (!sub) return null;
    const items = filterFn ? sub.items.filter(filterFn) : sub.items;
    if (!items.length) return null;
    return { title: sub.name, items, icon: sub.hubIcon || 'Circle' };
  }

  if (section.subgroups) {
    // Group has subgroups but none named — expand each subgroup as its own section.
    return section.subgroups
      .map(sub => {
        const items = filterFn ? sub.items.filter(filterFn) : sub.items;
        return items.length ? { title: sub.name, items, icon: sub.hubIcon || 'Circle' } : null;
      })
      .filter(Boolean);
  }

  const items = filterFn ? section.items.filter(filterFn) : section.items;
  if (!items.length) return null;
  return { title: section.group, items, icon: section.hubIcon || 'Circle' };
}

function HubSection({ title, items, icon }) {
  const HeaderIcon = ICONS[icon] || Circle;

  return (
    <div style={{ marginBottom: 28 }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: `color-mix(in srgb, ${HUB_COLOR} 15%, var(--surface))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <HeaderIcon size={16} color={HUB_COLOR} />
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h2>
        </div>
      )}

      {items.length > 0 && (() => {
        const [first, ...rest] = items;
        const firstAccent = resolveAccent(first.accent);
        const FirstIcon = ICONS[first.icon] || Circle;
        return (
          <>
            {/* Most-used item gets a full-width hero card — visual anchor,
                same pattern the approved mockups use for Courses/Attendance. */}
            <Link
              key={first.id}
              to={first.path}
              className="hub-grid-item hub-grid-item-hero"
              style={{
                display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12,
                marginBottom: 10,
              }}
            >
              <div
                className="hub-grid-item-icon"
                style={{
                  width: 40, height: 40, flexShrink: 0,
                  background: `color-mix(in srgb, ${firstAccent} 15%, var(--surface))`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <FirstIcon size={20} color={firstAccent} />
              </div>
              <div>
                <div className="hub-grid-item-label" style={{ fontWeight: 600, color: '#5c5a54', fontSize: 14 }}>
                  {first.label}
                </div>
                {first.subtitle && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{first.subtitle}</div>
                )}
              </div>
            </Link>

            <div className="hub-grid">
              {rest.map(item => {
                const accent = resolveAccent(item.accent);
                const Icon = ICONS[item.icon] || Circle;
                return (
                  <Link key={item.id} to={item.path} className="hub-grid-item">
                    <div
                      className="hub-grid-item-icon"
                      style={{
                        background: `color-mix(in srgb, ${accent} 15%, var(--surface))`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icon size={17} color={accent} />
                    </div>
                    <span className="hub-grid-item-label" style={{ fontWeight: 600, color: '#5c5a54' }}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        );
      })()}
    </div>
  );
}

/**
 * Renders one or more titled sections on a single hub page.
 *
 * Single-section usage (unchanged call shape):
 *   <SubgroupHub group="Campus Life" />
 *   <SubgroupHub group="Academics" subgroup="Academic Core" />
 *
 * Multi-section usage — pass `sections`, an array of { group, subgroup?, filterFn? }:
 *   <SubgroupHub
 *     pageTitle="Campus"
 *     sections={[{ group: 'Campus Life', subgroup: 'Campus Life' }]}
 *   />
 *
 * `extra` lets a caller inject a section that isn't backed by a plain
 * NAV group/subgroup lookup (e.g. Menu page's CR + Alerts block) —
 * pass { title, items, icon }, rendered first, above everything else.
 *
 * `navSource` (default: NAV) lets a caller point this at a different nav
 * config entirely — e.g. NAV_FACULTY for /faculty/* hub pages — without
 * duplicating this whole component. group/subgroup lookups above resolve
 * against whichever array is passed in.
 *
 * Every hub page gets a full-page, theme-tinted background (a very
 * faint accent wash top-to-bottom, not just behind the content column)
 * plus a small icon + title header — same visual language across all
 * hub pages so the app reads as one consistent system, not per-page
 * one-offs. Uses --accentRGB so it tracks light/dark theme automatically.
 */
export default function SubgroupHub({ group, subgroup, sections, pageTitle, extra, filterFn, navSource = NAV }) {
  const resolvedSections = [];

  if (extra) {
    if (Array.isArray(extra)) resolvedSections.push(...extra);
    else resolvedSections.push(extra);
  }

  if (sections && sections.length) {
    sections.forEach(({ group: g, subgroup: sg, filterFn: fn }) => {
      const result = resolveSection(navSource, g, sg, fn || filterFn);
      if (Array.isArray(result)) resolvedSections.push(...result);
      else if (result) resolvedSections.push(result);
    });
  } else if (group) {
    const result = resolveSection(navSource, group, subgroup, filterFn);
    if (Array.isArray(result)) resolvedSections.push(...result);
    else if (result) resolvedSections.push(result);
  }

  if (!resolvedSections.length) {
    return (
      <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
        <div style={{ padding: 24 }}>
          <p style={{ color: 'var(--muted)' }}>This section isn't available.</p>
        </div>
      </div>
    );
  }

  const title = pageTitle || resolvedSections[0].title;
  const HeroIcon = ICONS[resolvedSections[0].icon] || Circle;

  return (
    <div className="hub-page-bg" style={{ minHeight: '100vh' }}>
      <div className="page-container" style={{ padding: '20px 24px 40px' }}>
        <div className="hub-page-hero">
          <div className="hub-page-hero-main">
            <div className="hub-page-hero-head">
              <div className="hub-page-hero-icon">
                <HeroIcon size={24} color={HUB_COLOR} />
              </div>
              <h1 className="hub-page-hero-title">{title}</h1>
            </div>
          </div>
        </div>
        {resolvedSections.map((section, i) => (
          <HubSection
            key={`${section.title}-${i}`}
            title={section.title === title ? null : section.title}
            items={section.items}
            icon={section.icon}
          />
        ))}
      </div>
    </div>
  );
}