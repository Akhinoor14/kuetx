"""
KUET Official Faculty Directory Scraper
========================================

কী করে:
  1. KUET-এর প্রতিটা department-এর faculty listing page থেকে official
     teacher info (নাম, designation, department, email, phone, photo,
     profile url) scrape করে।
  2. প্রতিটা entry-কে `facultyDirectory/{normalizedEmail}` collection-এ
     Firestore-এ push করে (email-ই primary key — সেটাই
     src/lib/facultyDirectoryMatch.js auto-verify করার সময় lookup করে)।
     এই collection ইচ্ছাকৃতভাবে হালকা রাখা হয়েছে (শুধু identity fields)
     যাতে auto-verify lookup দ্রুত থাকে — নিচের point ৩-৪ দেখো, ভারী ডেটা
     (publications, education ইত্যাদি) আলাদা জায়গায় যায়।
  3. [নতুন, 2026-08-15] প্রতিটা teacher-এর individual profile page
     (`profile_url`) থেকেও scrape করে — Education, Experience,
     Scholarship and Award, Research, Teaching & Supervision — এই ৫টা
     tab-এর content। ছোট/bullet-ভিত্তিক content বলে এগুলো
     `facultyDirectory/{email}` document-এরই একটা `profileDetails`
     nested field হিসেবে রাখা হয় (Firestore-এর 1 MiB doc limit-এ এগুলো
     সমস্যা করবে না, কিন্তু publications করত — তাই সেটা point ৪-এ আলাদা)।
  4. [নতুন, 2026-08-15] Publications আলাদাভাবে scrape হয় এবং একটা পুরোপুরি
     আলাদা top-level collection `facultyPublications/{autoId}`-এ push
     হয় — প্রতিটা publication তার নিজের document, `teacherEmail` field
     দিয়ে owner-এর সাথে link করা। এটা ইচ্ছাকৃত ডিজাইন সিদ্ধান্ত: ৫০০+
     teacher, প্রত্যেকের গড়ে কয়েক ডজন publication ধরলে facultyDirectory
     document-এর ভেতরে array হিসেবে রাখলে (ক) বড় prolific teacher-এর
     document Firestore-এর 1 MiB limit-এর কাছাকাছি চলে যেতে পারে, (খ)
     auto-verify-এর প্রতিটা lookup-এ অপ্রয়োজনীয়ভাবে বড় payload আসত, (গ)
     future combined-publications page-এ department/বছর দিয়ে filter করতে
     পুরো collection scan লাগত বরং সরাসরি query না করে। আলাদা flat
     collection-এ রাখলে এই তিনটাই এড়ানো যায় — Firestore এই ধরনের অনেক
     ছোট document-এর flat collection-এর জন্যই optimized।
  5. একটা local JSON snapshot-ও রাখে (kuet_faculty_data.json) — debug ও
     audit trail-এর জন্য, GitHub Actions run-এর artifact হিসেবে আপলোড হয়।
     এতে publications ও profileDetails দুটোই থাকে (Firestore-এ যেভাবে
     ভাগ হয় সেটা এখানে শুধু organizational — snapshot-এ সব একসাথে, পড়তে
     সুবিধার জন্য)।

এটা manually চালানোর জন্য না — .github/workflows/kuet-faculty-scrape.yml
প্রতিদিন এটাকে schedule অনুযায়ী চালাবে GitHub Actions-এ, কোনো নিজস্ব
server/VPS ছাড়াই (free tier)।

কী এখনো TODO (তোমার করতে হবে):
  - CSE + EEE (real HTML দিয়ে) `/{slug}/faculty` listing pattern-এই
    confirm হয়েছে। ME, ECE ইত্যাদি বাকি department স্বচক্ষে/view-source
    দিয়ে দেখে নিশ্চিত করা এখনো ভালো — every department log line-এ কোন
    URL pattern hit করেছে সেটা print হবে।
  - Profile-page parser (`parse_profile_page` + publication sub-parsers)
    Amit Kumer Podder (`kuet.ac.bd/eee/amit`)-এর real HTML দিয়ে যাচাই
    করা হয়েছে (unit-tested নিচে — Education/Experience/Scholarship/
    Research/Teaching/Publications সবই)। কিন্তু এটা একজন teacher-এর একটা
    profile — অন্য department-এর profile page একই টেমপ্লেট ব্যবহার করে
    কিনা এখনো ভিন্নভাবে confirm করা হয়নি (listing page template একই
    হওয়ায় সম্ভাবনা বেশি, কিন্তু নিশ্চিত না)।
  - `iict` / `idm` / `iept` — এই ৩টা institute। slug (iict/idm/iept ঠিক
    এই বানানেই কিনা) এখনো নিজে verify করা হয়নি — ভুল হলে scraper শুধু
    0 teacher পাবে, crash করবে না (log-এ warning আসবে)।
  - GitHub repo secret হিসেবে FIREBASE_SERVICE_ACCOUNT_JSON বসাও (নিচে
    workflow file-এ বিস্তারিত আছে) — এখন সেই service account-এর
    facultyDirectory-এর পাশাপাশি facultyPublications collection-এও
    write access দরকার হবে (least-privilege scope আপডেট করে নাও)।

URL FALLBACK (2026-08-15):
  kuet.ac.bd-এর জন্য দুইটা URL pattern দেখা গেছে — `/{slug}/faculty`
  (confirmed, listing page) এবং `/dept/{slug}/people/faculty` (একই
  content, alias/পুরনো route হতে পারে)। প্রতিটা department-এর জন্য দুটো
  pattern-ই try করা হয়, primary empty হলে fallback।

PUBLICATION PARSING (2026-08-15, best-effort):
  Publication entry-র raw text ("13. Author1, Author2, ..., \"Title,\"
  Journal, vol. X, no: Y, pp. Z, Month, Year.") থেকে authors/title/
  journal/volume/issue/pages/year বের করার চেষ্টা করা হয় (regex-based,
  best-effort)। Punctuation source data-তে সবসময় consistent না (কোথাও
  ডাবল period, কোথাও DOI-এর বদলে ভুল ফরম্যাটের string) — তাই প্রতিটা
  ক্ষেত্রে যেটুকু parse করা যায় সেটুকুই আলাদা field-এ যায়, বাকি পুরো
  আসল লাইনটা সবসময় `raw_citation`-এ অক্ষত থাকে (fallback হিসেবে, parse
  ভুল হলেও তথ্য হারায় না)। Title-এর মধ্যে যদি `<a href>` লিংক থাকে
  (DOI/publisher লিংক), সেটা `link` field-এ আলাদাভাবে যায়। "International
  Journal" vs "International Conference" ইত্যাদি heading থেকে `category`
  field আসে।

Local test run (Firestore push ছাড়া, শুধু JSON বের করে দেখতে):
    python kuet_faculty_scraper.py --dry-run

Firestore-এ push সহ (production, GitHub Actions যেভাবে চালাবে):
    python kuet_faculty_scraper.py

Profile-page scraping (publications ইত্যাদি) স্কিপ করে শুধু listing
scrape করতে (দ্রুত টেস্টের জন্য):
    python kuet_faculty_scraper.py --dry-run --skip-profiles
"""

import os
import re
import sys
import json
import time
import argparse
import logging
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

# ----------------------------------------------------------------------
# CONFIG
# ----------------------------------------------------------------------

BASE_URL = "https://kuet.ac.bd"

# Confirmed URL/HTML pattern (from actual page source, 2026-08-15):
#   https://kuet.ac.bd/{slug}/faculty  — card grid, grouped under <h4
#   class="underline_text"> rank headings ("Departmental Head",
#   "Professor", "Assistant Professor", "Lecturer", "Faculty on Leave").
#   Each card already carries its own designation in a <span>, so rank is
#   read straight off the card — the h4 headings are only needed to
#   detect the "Faculty on Leave" status.
#
# {slug: department_code} — slug is the URL path segment (matches this
# app's SUBDOMAIN_TO_UNIT_CODE in src/lib/facultyEmailVerify.js, so
# `department` values here line up with the app's existing ACADEMIC_UNITS
# codes). The 20 confirmed academic departments, plus the 3 institutes
# (iict/idm/iept) added with best-guess slugs — those 3 are NOT confirmed,
# see URL_PATTERNS note below; if the slug itself is wrong they'll just
# 404/0-result, not crash.
SLUG_TO_DEPT_CODE = {
    "ce": "CE", "eee": "EEE", "me": "ME", "cse": "CSE", "ece": "ECE",
    "iem": "IPE", "becm": "BECM", "arch": "Arch", "urp": "URP", "le": "LE",
    "te": "TE", "bme": "BME", "mse": "MSE", "ese": "ESE", "che": "ChE", "mte": "MTE",
    "math": "MATH", "chem": "CHEM", "phy": "PHY", "hum": "HUM",
    # institutes — slug guessed, unverified (see header TODO)
    "iict": "IICT", "idm": "IDM", "iept": "IEPT",
}

# Multiple URL shapes to try per department, in order. Both have been
# seen indexed for the same KUET pages (search results show identical
# "Head of the Department" content under both /eee/faculty and
# /dept/eee/people/faculty) — since this session's network can't fetch
# kuet.ac.bd directly (robots.txt blocks it here), we don't assume which
# one the live site actually serves for every department, so the scraper
# tries each candidate in order and uses the first one that yields any
# teachers. This makes the "confirm every department's template by hand"
# TODO less risky: a wrong/missing primary pattern degrades to a fallback
# attempt instead of silently scraping 0 teachers.
URL_PATTERN_TEMPLATES = [
    "{base}/{slug}/faculty",
    "{base}/dept/{slug}/people/faculty",
]


def candidate_urls(slug: str) -> list[str]:
    return [tmpl.format(base=BASE_URL, slug=slug) for tmpl in URL_PATTERN_TEMPLATES]


DEPARTMENT_FACULTY_URLS = {
    dept_code: candidate_urls(slug) for slug, dept_code in SLUG_TO_DEPT_CODE.items()
}

OUTPUT_JSON = Path(__file__).parent / "kuet_faculty_data.json"
LOG_FILE = Path(__file__).parent / "kuet_scraper.log"

HEADERS = {
    "User-Agent": "KUETX-Student-Project-FacultyDirectory/1.0 (contact: <tomar-email-lekho>)"
}
REQUEST_DELAY_SECONDS = 2

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler(LOG_FILE)],
)
logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------
# DATA MODEL
# ----------------------------------------------------------------------

@dataclass
class Teacher:
    name: str
    designation: str
    department: str
    email: Optional[str] = None          # official *.kuet.ac.bd address — primary match key
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    profile_url: Optional[str] = None
    on_leave: bool = False               # True if listed under the "Faculty on Leave" heading
    scraped_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def doc_id(self) -> Optional[str]:
        """facultyDirectory doc ID = normalized email — same normalization
        isFacultyEmailVerified/syncFacultyVerificationStatus use, so a
        client-side lookup by email always lands on this exact doc."""
        if not self.email:
            return None
        return self.email.strip().lower()


@dataclass
class Publication:
    """One publication entry. Best-effort parsed from raw citation text —
    see PUBLICATION PARSING note in the module docstring. `raw_citation`
    always holds the untouched original text so nothing is ever lost even
    when the structured fields below come out wrong or incomplete."""
    teacher_email: str
    category: str                # e.g. "International Journal", "International Conference" — taken straight from the page's own section heading, not a fixed enum, so unusual headings pass through unchanged
    raw_citation: str            # the full original text, always populated, exact fallback
    title: Optional[str] = None
    link: Optional[str] = None   # DOI/publisher URL if the title was wrapped in <a href>
    authors: Optional[str] = None
    venue: Optional[str] = None  # journal/publisher/conference name
    year: Optional[str] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    order_in_list: Optional[int] = None  # the "13.", "12." numbering from the source page, for stable ordering
    scraped_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    # Manual-wins fields (see push_to_firestore docstring / CURRENT.md).
    # Scraper always writes source="scraper", isManuallyEdited=False —
    # the frontend (facultyPublicationsSync.js) is the only writer that
    # ever sets isManuallyEdited=True, and once true the scraper skips
    # that doc forever after, on every future run.
    source: str = "scraper"
    isManuallyEdited: bool = False


@dataclass
class ProfileDetails:
    """Everything from the profile page's other tabs (Bio/Education/
    Experience/Scholarship/Research/Teaching). Kept as heading-grouped
    text blocks rather than deeply structured fields — unlike
    publications, this content doesn't have an obvious common schema
    across entries (an award and a course-taught list don't share
    fields), and it's small enough per-teacher that Firestore's doc size
    limit is a non-issue. Each list item is stored as its own string,
    HTML tags stripped but line-break structure (via <br>) preserved as
    a joined multi-line string."""
    bio: Optional[str] = None
    education: list[str] = field(default_factory=list)
    experience: list[str] = field(default_factory=list)
    scholarship_and_award: list[str] = field(default_factory=list)
    research: list[str] = field(default_factory=list)
    teaching_and_supervision: Optional[str] = None
    google_scholar_url: Optional[str] = None
    orcid_url: Optional[str] = None
    linkedin_url: Optional[str] = None


# ----------------------------------------------------------------------
# SCRAPER
# ----------------------------------------------------------------------

def fetch_page(url: str) -> Optional[BeautifulSoup]:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except requests.RequestException as e:
        logger.error(f"Failed to fetch {url}: {e}")
        return None


def parse_department_page(dept_code: str, soup: BeautifulSoup) -> list[Teacher]:
    """
    NOTE: this parser targets the `/{slug}/faculty` card-grid structure
    below (confirmed against real CSE + EEE page content). If a
    department only resolves via the `/dept/{slug}/people/faculty`
    fallback pattern and that page's HTML structure turns out to differ
    from this one, this function will legitimately return an empty list
    for it (not crash) — scrape_all_departments() logs that as a 0-count
    department so it's visible in the run log and can be fixed by adding
    a second parser branch here later. Not silently swallowed.

    Confirmed structure (from actual page source, see the CURRENT.md
    changelog entry for the date this was verified):

        <div class="container mb-5">
          <div class="row justify-content-md-center">      <- head section
            <h4 class="underline_text">Departmental Head</h4>
            <div class="col-md-4 ...">
              <a href="https://kuet.ac.bd/{dept}/{slug}">
                <div class="card">
                  <div class="card-img"><img src="..."></div>
                  <div class="card-action">
                    <div class="title">NAME</div>
                    <span>DESIGNATION</span>
                    <div class="contact email"><div>icon</div><div class="mx-1">EMAIL<br></div></div>
                  </div>
                </div>
              </a>
            </div>
          </div>
          <div class="row">                                <- everyone else
            <h4 class="underline_text pt-4">Professor</h4>
            <div class="col-md-6 ...">...same card structure...</div>
            ...
            <h4 class="underline_text pt-4">Faculty on Leave</h4>
            <div class="col-md-6 ...">...cards, designation still accurate...</div>
          </div>
        </div>

    Rank/designation is read straight off each card's own <span> — the
    h4 headings group by rank too, but the card's own span is the direct
    source, so h4 tracking is only needed here to flag on_leave. The
    department head's card is a duplicate of their entry in the
    Professor/etc. section further down (same email) — deduped by email
    below, first occurrence wins.

    find_all(['h4', 'div']) walks in document order regardless of
    nesting depth, so an h4 update always applies to every card that
    follows it until the next h4 — including across the head-section /
    everyone-else row boundary, which is fine since "Departmental Head"
    itself never needs on_leave tracking.
    """
    container = soup.select_one("div.container.mb-5") or soup
    teachers: list[Teacher] = []
    seen_emails: set[str] = set()
    on_leave = False

    for el in container.find_all(["h4", "div"]):
        classes = el.get("class") or []
        if el.name == "h4" and "underline_text" in classes:
            heading_text = el.get_text(strip=True)
            on_leave = "leave" in heading_text.lower()
            continue

        if el.name != "div" or "card" not in classes:
            continue

        title_el = el.select_one(".card-action .title")
        designation_el = el.select_one(".card-action > span")
        email_el = el.select_one(".contact.email .mx-1")
        img_el = el.select_one(".card-img img")
        link_el = el.find_parent("a")

        if not title_el or not email_el:
            continue

        email = email_el.get_text(strip=True).lower()
        if not email or email in seen_emails:
            continue  # dedupe (Departmental Head card repeats in the rank section below)
        seen_emails.add(email)

        teachers.append(Teacher(
            name=title_el.get_text(strip=True),
            designation=designation_el.get_text(strip=True) if designation_el else "",
            department=dept_code,
            email=email,
            photo_url=img_el["src"] if img_el and img_el.has_attr("src") else None,
            profile_url=link_el["href"] if link_el and link_el.has_attr("href") else None,
            on_leave=on_leave,
        ))

    return teachers


# ----------------------------------------------------------------------
# PROFILE PAGE SCRAPER (Education/Experience/Scholarship/Research/
# Teaching + Publications)
# ----------------------------------------------------------------------

# Regex to strip the leading "13. " / "1. " list number that KUET
# prefixes every citation with — captured separately so it can become
# order_in_list instead of staying stuck to the author string.
_LEADING_NUMBER_RE = re.compile(r"^\s*(\d+)\.\s*")

# A citation's tail commonly ends "..., Venue, vol. X, no: Y, pp. Z, Month, Year."
# or some subset of those fields — none are guaranteed present, so each
# is its own optional regex applied to the tail segment independently
# rather than one big all-or-nothing pattern (a single strict pattern
# would fail entirely on the punctuation-inconsistent entries the
# person flagged, e.g. double periods, DOI strings dropped in where a
# date should be).
_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
_VOLUME_RE = re.compile(r"\bvol\.?\s*([A-Za-z0-9 ]+?)(?:,|$)", re.IGNORECASE)
_ISSUE_RE = re.compile(r"\bno:?\.?\s*([A-Za-z0-9 ]+?)(?:,|$)", re.IGNORECASE)
_PAGES_RE = re.compile(r"\bpp\.?\s*([\d\-–]+)", re.IGNORECASE)


def _parse_publication_li(li_tag, category: str, teacher_email: str) -> Optional[Publication]:
    """Best-effort structured parse of one <li> publication entry.
    raw_citation always captures the full original text verbatim so nothing
    is lost even where the regexes below miss or misfire on inconsistent
    source punctuation."""
    raw_citation = li_tag.get_text(" ", strip=True)
    raw_citation = re.sub(r"\s+", " ", raw_citation).strip()
    if not raw_citation:
        return None

    order_in_list = None
    m = _LEADING_NUMBER_RE.match(raw_citation)
    body = raw_citation
    if m:
        order_in_list = int(m.group(1))
        body = raw_citation[m.end():]

    # Title: prefer the <a> inside <b> (linked title) or plain <b> text
    # (unlinked title) — both patterns appear in the source (see e.g.
    # entries 13/7 vs entry 12 in the sample profile).
    title = None
    link = None
    bold_el = li_tag.find("b")
    if bold_el:
        a_el = bold_el.find("a")
        if a_el:
            title = a_el.get_text(strip=True)
            href = a_el.get("href", "").strip()
            # source data has some malformed hrefs (bare DOI strings, stray
            # leading spaces, "DOI:" prefix left in) — only keep it as a
            # link if it actually looks like a URL, otherwise it's noise
            if href and (href.startswith("http://") or href.startswith("https://")):
                link = href
        else:
            title = bold_el.get_text(strip=True)

    # Authors: everything before the quoted/bolded title in the raw text.
    # The source consistently uses `, "Title,"` or `, "Title` (bold) as the
    # separator between the author list and the title.
    authors = None
    quote_idx = body.find('"')
    if quote_idx != -1:
        authors = body[:quote_idx].strip().rstrip(",").strip()
    elif title:
        t_idx = body.find(title)
        if t_idx > 0:
            authors = body[:t_idx].strip().strip('",').strip()

    # Tail = whatever comes after the title, where venue/vol/no/pp/year live.
    tail = body
    if title:
        t_idx = body.find(title)
        if t_idx != -1:
            tail = body[t_idx + len(title):]

    year_match = _YEAR_RE.search(tail)
    year = year_match.group(0) if year_match else None

    volume_match = _VOLUME_RE.search(tail)
    volume = volume_match.group(1).strip() if volume_match else None

    issue_match = _ISSUE_RE.search(tail)
    issue = issue_match.group(1).strip() if issue_match else None

    pages_match = _PAGES_RE.search(tail)
    pages = pages_match.group(1).strip() if pages_match else None

    # Venue: best-effort — the first comma-separated segment of the tail
    # that isn't "vol./no:/pp." and isn't just the year, since that's
    # where the journal/publisher name consistently sits in this source
    # (e.g. "IEEE, vol. 9, pp. 51865-95, 2021" -> "IEEE").
    venue = None
    tail_clean = tail.lstrip('",. ').strip()
    if tail_clean:
        first_segment = tail_clean.split(",")[0].strip().rstrip(".")
        if first_segment and not re.match(r"^(vol\.?|no:?\.?|pp\.?|\d{4})", first_segment, re.IGNORECASE):
            venue = first_segment or None

    return Publication(
        teacher_email=teacher_email,
        category=category,
        raw_citation=raw_citation,
        title=title,
        link=link,
        authors=authors or None,
        venue=venue,
        year=year,
        volume=volume,
        issue=issue,
        pages=pages,
        order_in_list=order_in_list,
    )


def parse_publications_tab(soup: BeautifulSoup, teacher_email: str) -> list[Publication]:
    """Confirmed structure (from real profile HTML, Amit Kumer Podder /eee/amit,
    verified 2026-08-15):

        <div id="profile" class="tab-pane ...">          <- Publications tab pane, id="profile" despite the name
          <u><b>International Journal</b></u>
          <ul class="list-unstyled">
            <li>13. Authors, "<b><a href="...">Title</a></b>," Venue, vol. X, ... .</li>
            ...
          </ul>
          <u><b>International Conference</b></u>
          <ul class="list-unstyled"> ... </ul>
        </div>

    Category headings are plain <u><b>text</b></u> pairs, not consistently
    class-tagged, so this walks the tab pane in document order tracking
    the most recent <u> heading text, same pattern as the on_leave
    tracking in parse_department_page — proven approach, reused here.
    """
    pane = soup.select_one("#profile") or soup.select_one('[id*="profile"]')
    if pane is None:
        return []

    publications: list[Publication] = []
    current_category = "Uncategorized"

    for el in pane.find_all(["u", "li"]):
        if el.name == "u":
            current_category = el.get_text(strip=True) or current_category
            continue
        if el.name == "li":
            pub = _parse_publication_li(el, current_category, teacher_email)
            if pub:
                publications.append(pub)

    return publications


def _br_to_newlines(soup_fragment_html: str) -> BeautifulSoup:
    """Some KUET profile pages have malformed unclosed <br> tags (seen in
    the Teaching & Supervision tab — a bare <br> swallows every sibling
    that follows as its own children, up to a stray closing </br>, which
    BeautifulSoup's tree-builder honours literally). Calling
    br.replace_with("\\n") on a soup already parsed that way deletes
    everything nested under the malformed <br>, silently truncating the
    text. Fix: convert <br>/<br/> to a literal newline in the raw HTML
    *before* parsing, so there's no <br> element left for the parser to
    mis-nest around. Safe for well-formed <br> too (no-op difference)."""
    fixed_html = re.sub(r"<br\s*/?>", "\n", soup_fragment_html, flags=re.IGNORECASE)
    return BeautifulSoup(fixed_html, "html.parser")


def _list_items_text(soup: BeautifulSoup, pane_id: str) -> list[str]:
    """Generic helper for the simpler tabs (Education, Experience,
    Scholarship and Award, Research): each is a <ul><li>...</li></ul>
    inside its tab-pane div. <br> tags inside an <li> are converted to
    newlines (via _br_to_newlines, see its docstring for why a literal
    string replace is used instead of BeautifulSoup's replace_with) so
    multi-line entries (e.g. an Education entry's degree / institution /
    result / thesis lines) don't get flattened into one run-on sentence."""
    pane = soup.select_one(f"#{pane_id}")
    if pane is None:
        return []
    items = []
    for li in pane.select("li"):
        li_fixed = _br_to_newlines(str(li))
        text = li_fixed.get_text()
        text = re.sub(r"\n\s*\n+", "\n", text)  # collapse repeated blank lines from stacked <br>
        text = "\n".join(line.strip() for line in text.split("\n") if line.strip())
        if text:
            items.append(text)
    return items


def parse_profile_page(soup: BeautifulSoup, teacher_email: str) -> tuple[ProfileDetails, list[Publication]]:
    """Parses everything on a teacher's individual profile page except
    the header card (name/designation/email/phone — already captured
    from the listing page, no need to re-parse it here). Returns
    (ProfileDetails, list of Publication) as two separate pieces since
    they're written to Firestore in two different places (see module
    docstring point 3 vs 4).
    """
    details = ProfileDetails()

    bio_pane = soup.select_one("#home")
    if bio_pane:
        p = bio_pane.select_one("p")
        if p:
            details.bio = p.get_text(strip=True) or None

    details.education = _list_items_text(soup, "contact")   # tab id="contact" is Education, despite the name (see source)
    details.experience = _list_items_text(soup, "experience")
    details.scholarship_and_award = _list_items_text(soup, "scholarship")
    details.research = _list_items_text(soup, "research")

    teaching_pane = soup.select_one("#teaching")
    if teaching_pane:
        teaching_fixed = _br_to_newlines(str(teaching_pane))
        text = teaching_fixed.get_text()
        text = re.sub(r"\n\s*\n+", "\n", text)
        details.teaching_and_supervision = "\n".join(
            line.strip() for line in text.split("\n") if line.strip()
        ) or None

    # Google Scholar / ORCID / LinkedIn icons — present as <a href> even
    # when the href happens to be empty (unfilled by the teacher), so
    # only keep non-empty ones.
    for a_el in soup.select("a img[src*='googlescholar']"):
        href = (a_el.find_parent("a") or {}).get("href", "").strip() if a_el.find_parent("a") else ""
        if href:
            details.google_scholar_url = href
    for a_el in soup.select("a img[src*='orcid']"):
        href = (a_el.find_parent("a") or {}).get("href", "").strip() if a_el.find_parent("a") else ""
        if href:
            details.orcid_url = href
    for a_el in soup.select("a img[src*='linkedin']"):
        href = (a_el.find_parent("a") or {}).get("href", "").strip() if a_el.find_parent("a") else ""
        if href:
            details.linkedin_url = href

    publications = parse_publications_tab(soup, teacher_email)

    return details, publications


def scrape_teacher_profile(teacher: Teacher) -> tuple[Optional[ProfileDetails], list[Publication]]:
    """Fetches and parses one teacher's profile page. Returns (None, [])
    on fetch failure or missing profile_url/email — logged, never raises,
    so one broken profile page never aborts the whole run."""
    if not teacher.profile_url or not teacher.email:
        return None, []
    soup = fetch_page(teacher.profile_url)
    time.sleep(REQUEST_DELAY_SECONDS)
    if soup is None:
        logger.warning(f"  [profile] fetch failed for {teacher.name} ({teacher.profile_url})")
        return None, []
    try:
        details, publications = parse_profile_page(soup, teacher.email)
        logger.info(f"  [profile] {teacher.name}: {len(publications)} publications, "
                    f"{len(details.education)} education, {len(details.experience)} experience entries")
        return details, publications
    except Exception as e:
        # A malformed/unexpected profile page structure should degrade to
        # "no profile details for this one teacher", not crash the whole
        # scrape run — 500+ teachers means some outlier page is inevitable.
        logger.error(f"  [profile] parse error for {teacher.name} ({teacher.profile_url}): {e}")
        return None, []


def scrape_department_with_fallback(dept_code: str, urls: list[str]) -> list[Teacher]:
    """Try each candidate URL in order; use the first one that yields
    any teachers. A candidate that fetches fine but parses to 0 teachers
    is treated the same as a fetch failure — it means that URL wasn't
    the right page/structure for this department, so move to the next
    candidate. If every candidate comes up empty, that's logged clearly
    so it surfaces in the run log instead of silently vanishing into the
    combined 0-count."""
    for i, url in enumerate(urls):
        soup = fetch_page(url)
        time.sleep(REQUEST_DELAY_SECONDS)
        if soup is None:
            logger.warning(f"  [{dept_code}] fetch failed for {url}, trying next pattern" if i + 1 < len(urls) else f"  [{dept_code}] fetch failed for {url}, no more patterns to try")
            continue
        dept_teachers = parse_department_page(dept_code, soup)
        if dept_teachers:
            logger.info(f"  [{dept_code}] {len(dept_teachers)} teachers via {url}")
            return dept_teachers
        logger.warning(f"  [{dept_code}] 0 teachers parsed from {url}" + (", trying next pattern" if i + 1 < len(urls) else ", no more patterns to try"))
    logger.error(f"  [{dept_code}] ALL URL patterns failed/empty: {urls}")
    return []


def scrape_all_departments(only_department: Optional[str] = None) -> list[Teacher]:
    """only_department: if set (e.g. "CSE"), scrape just that one dept
    instead of all 20 — for fast local testing via --only-department,
    so a first parse-check doesn't require running all 500+ teachers."""
    all_teachers: list[Teacher] = []
    depts_to_scrape = DEPARTMENT_FACULTY_URLS
    if only_department:
        code = only_department.strip().upper()
        if code not in DEPARTMENT_FACULTY_URLS:
            logger.error(f"--only-department '{code}' not found. Valid codes: {list(DEPARTMENT_FACULTY_URLS.keys())}")
            return []
        depts_to_scrape = {code: DEPARTMENT_FACULTY_URLS[code]}
    for dept_code, urls in depts_to_scrape.items():
        logger.info(f"Scraping {dept_code} (candidates: {urls})")
        dept_teachers = scrape_department_with_fallback(dept_code, urls)
        all_teachers.extend(dept_teachers)
    return all_teachers


# ----------------------------------------------------------------------
# FIRESTORE PUSH
# ----------------------------------------------------------------------

# ----------------------------------------------------------------------
# DIFF HELPERS — write only when scraped data actually differs from
# what's already in Firestore. See NOTE in push_to_firestore() above.
# ----------------------------------------------------------------------

# scraped_at ছাড়া বাকি সব ফিল্ড compare হয়, কারণ এটা প্রতিবার scrape-এ
# বদলায় (current timestamp) even when কোনো real content বদলায়নি —
# এটাকে compare-এ ধরলে diff logic কার্যত অকেজো হয়ে যেত (সবসময় "changed"
# দেখাত)।
_IGNORE_KEYS_FOR_DIFF = {"scraped_at"}


def _normalize_for_diff(value):
    """
    Firestore round-trip আর Python dataclass value-এর মধ্যে ছোটখাটো টাইপ
    পার্থক্য (যেমন tuple vs list, বা nested dict-এর key order) থাকতে
    পারে যেগুলো আসল content বদলায় না। Recursively normalize করে দুটো
    dict নিরাপদে compare করা যায়।
    """
    if isinstance(value, dict):
        return {k: _normalize_for_diff(v) for k, v in sorted(value.items()) if k not in _IGNORE_KEYS_FOR_DIFF}
    if isinstance(value, (list, tuple)):
        return [_normalize_for_diff(v) for v in value]
    return value


def _teacher_doc_unchanged(existing: dict, new_data: dict) -> bool:
    """existing (Firestore থেকে) আর new_data (এই run-এ scraped) content-এ
    হুবহু এক কিনা — এক হলে write skip করা নিরাপদ।"""
    return _normalize_for_diff(existing) == _normalize_for_diff(new_data)


def _publication_doc_unchanged(existing: dict, new_data: dict) -> bool:
    """একই যুক্তি publication doc-এর জন্য। isManuallyEdited/source-এর মতো
    scraper-controlled meta ফিল্ডও তুলনায় ধরা হয় — কারণ সেগুলো বদলালে
    (যেমন এই migration-এর মতো একটা fix) সেটাও একটা real write হওয়া
    উচিত, স্কিপ করা উচিত না।"""
    return _normalize_for_diff(existing) == _normalize_for_diff(new_data)


def push_to_firestore(teachers: list[Teacher], profiles: dict[str, ProfileDetails], publications: list[Publication]) -> dict:
    """
    Writes to two places (see module docstring points 2-4 for rationale):

      facultyDirectory/{normalizedEmail} — Teacher fields + profileDetails
        nested field. Stays light (no publications array) so auto-verify
        lookups in src/lib/facultyDirectoryMatch.js don't pull unrelated
        bulk data.

      facultyPublications/{autoId} — one document per publication, each
        carrying teacherEmail so the app can query
        `where('teacherEmail', '==', email)` for one teacher's list, or
        query across the whole collection (e.g. by department once that's
        denormalized in, or by year) for a combined publications page
        without ever loading a full facultyDirectory doc.

    Auth: GitHub Actions secret FIREBASE_SERVICE_ACCOUNT_JSON (পুরো
    service-account JSON, একটা env var-এ) থেকে credential লোড হয়। এই
    service account-কে Firestore Console-এ facultyDirectory এবং
    facultyPublications — দুটো collection-এই write access দাও
    (least-privilege) — পুরো project-এর Editor role দেওয়ার দরকার নেই।
    """
    import firebase_admin
    from firebase_admin import credentials, firestore
    # firebase_admin.firestore doesn't re-export FieldPath (that's a
    # firebase-admin>=7.x API surface change vs older versions this
    # script was originally written against) — import it directly from
    # google-cloud-firestore instead.
    from google.cloud.firestore_v1.field_path import FieldPath

    if not firebase_admin._apps:
        raw_cred = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        if not raw_cred:
            raise RuntimeError(
                "FIREBASE_SERVICE_ACCOUNT_JSON env var missing — set it as a "
                "GitHub Actions secret (see .github/workflows/kuet-faculty-scrape.yml)"
            )
        cred = credentials.Certificate(json.loads(raw_cred))
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    batch = db.batch()
    written, skipped_no_email, skipped_unchanged = 0, 0, 0
    batch_ops = 0

    def _commit_if_full():
        nonlocal batch, batch_ops
        # Firestore batch-এর 500-write limit — চেক করে chunk করে commit
        if batch_ops >= 400:
            batch.commit()
            batch = db.batch()
            batch_ops = 0

    # ------------------------------------------------------------------
    # Diff-based write: প্রতিবার পুরো collection re-write করলে (৪৩৬ teacher
    # + ৬০০০+ publication) Firestore Spark plan-এর দৈনিক write quota
    # (20,000) সহজেই শেষ হয়ে যায় — অথচ বেশিরভাগ document run-to-run
    # অপরিবর্তিতই থাকে (scraper শুধু publicly listed তথ্য টানে, যেটা
    # নিয়মিত বদলায় না)। তাই write করার আগে existing document read করে
    # compare করা হয় — একই হলে write skip, শুধু আসল পরিবর্তন হলেই write।
    # এতে reads বাড়ে (free quota 50,000/day — অনেক জায়গা আছে) কিন্তু
    # writes নাটকীয়ভাবে কমে।
    logger.info("Bulk-fetching existing facultyDirectory docs for diff comparison...")
    existing_teacher_docs = {}
    for snap in db.collection("facultyDirectory").stream():
        existing_teacher_docs[snap.id] = snap.to_dict() or {}
    logger.info(f"Fetched {len(existing_teacher_docs)} existing teacher docs.")

    for t in teachers:
        doc_id = t.doc_id()
        if not doc_id:
            skipped_no_email += 1
            continue
        ref = db.collection("facultyDirectory").document(doc_id)
        doc_data = asdict(t)
        prof = profiles.get(doc_id)
        if prof is not None:
            doc_data["profileDetails"] = asdict(prof)

        existing = existing_teacher_docs.get(doc_id)
        if existing is not None and _teacher_doc_unchanged(existing, doc_data):
            skipped_unchanged += 1
            continue

        batch.set(ref, doc_data, merge=True)
        written += 1
        batch_ops += 1
        _commit_if_full()

    # Manual-wins: teachers can add/edit/delete their own publications from
    # /faculty/publications (facultyPublicationsSync.js). Any doc they've
    # touched is flagged isManuallyEdited: true, and this scraper must
    # NEVER overwrite it on a rerun — the whole reason a teacher edits a
    # scraped entry is that the scraper got something wrong, so their
    # correction always outranks the next scrape. We batch-read existing
    # doc ids in chunks of 30 (Firestore 'in' query limit) before writing,
    # and skip any that come back manually-edited.
    all_pub_ids = []
    id_to_pub = {}
    for pub in publications:
        # Deterministic doc id (email + order_in_list + category) instead
        # of a random autoId — reruns overwrite the same publications
        # instead of accumulating duplicates every day the scraper runs.
        key_source = f"{pub.teacher_email}|{pub.category}|{pub.order_in_list}|{(pub.title or pub.raw_citation)[:80]}"
        doc_id = re.sub(r"[^a-zA-Z0-9]+", "-", key_source).strip("-").lower()[:250]
        all_pub_ids.append(doc_id)
        id_to_pub[doc_id] = pub

    # Denormalize teacher name + department code onto each publication so
    # the frontend's combined /publications browse page can display and
    # filter (by department, by teacher name) without doing a second
    # facultyDirectory lookup per row. Built from the same `teachers` list
    # already scraped this run — keyed by normalized email to match
    # Publication.teacher_email.
    teacher_by_email = {t.doc_id(): t for t in teachers if t.doc_id()}

    manually_edited_ids = set()
    existing_pub_docs = {}
    pubs_col = db.collection("facultyPublications")
    for i in range(0, len(all_pub_ids), 30):
        chunk = all_pub_ids[i:i + 30]
        if not chunk:
            continue
        docs = pubs_col.where(
            FieldPath.document_id(), "in", chunk
        ).stream()
        for d in docs:
            data = d.to_dict() or {}
            if data.get("isManuallyEdited"):
                manually_edited_ids.add(d.id)
            existing_pub_docs[d.id] = data

    pubs_written, pubs_skipped_manual, pubs_skipped_unchanged = 0, 0, 0
    for doc_id, pub in id_to_pub.items():
        if doc_id in manually_edited_ids:
            pubs_skipped_manual += 1
            continue
        ref = pubs_col.document(doc_id)
        # NOTE: asdict(pub) writes Publication.teacher_email as literal
        # key "teacher_email". Every other field in this dataclass is
        # read by the frontend under that same snake_case name (title,
        # link, authors, venue, year, raw_citation, etc. — see
        # facultyPublicationsSync.js / PublicationsBrowse.jsx), so those
        # stay untouched. But teacherEmail is the one field the frontend
        # and firestore.rules read as camelCase (it's the denormalized
        # query/ownership key, alongside teacherName/teacherDeptCode
        # below) — "teacher_email" from asdict silently never matches
        # `pub.teacherEmail`, `where('teacherEmail', ...)`, or the rules'
        # teacherEmail check. That breaks three things with no error: the
        # teacher-name button on each row never becomes clickable, a
        # teacher's own scraped publications don't show on their profile
        # preview, and edit/delete never appears for the owner. Add the
        # camelCase key alongside the original.
        pub_data = asdict(pub)
        pub_data["teacherEmail"] = pub_data.pop("teacher_email")
        pub_data["source"] = "scraper"
        pub_data["isManuallyEdited"] = False
        matching_teacher = teacher_by_email.get(pub.teacher_email)
        if matching_teacher is not None:
            pub_data["teacherName"] = matching_teacher.name
            pub_data["teacherDeptCode"] = matching_teacher.department

        existing = existing_pub_docs.get(doc_id)
        if existing is not None and _publication_doc_unchanged(existing, pub_data):
            pubs_skipped_unchanged += 1
            continue

        batch.set(ref, pub_data, merge=True)
        pubs_written += 1
        batch_ops += 1
        _commit_if_full()

    batch.commit()
    logger.info(
        f"Firestore push done: faculty written={written} skipped(no-email)={skipped_no_email} "
        f"skipped(unchanged)={skipped_unchanged} | publications written={pubs_written} "
        f"skipped(manual-edit)={pubs_skipped_manual} skipped(unchanged)={pubs_skipped_unchanged}"
    )
    return {
        "written": written,
        "skipped_no_email": skipped_no_email,
        "skipped_unchanged": skipped_unchanged,
        "publications_written": pubs_written,
        "publications_skipped_manual": pubs_skipped_manual,
        "publications_skipped_unchanged": pubs_skipped_unchanged,
    }


# ----------------------------------------------------------------------
# MAIN
# ----------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="শুধু JSON বের করবে, Firestore-এ push করবে না")
    parser.add_argument("--skip-profiles", action="store_true",
                         help="listing page-ই যথেষ্ট হলে profile-page scraping (publications ইত্যাদি) স্কিপ করো — দ্রুত টেস্টের জন্য")
    parser.add_argument("--only-department", type=str, default=None,
                         help="শুধু একটা department code (e.g. CSE, EEE) scrape করো — প্রথমবার parse ঠিক আছে কিনা দ্রুত যাচাই করতে, ৫০০+ teacher-এর পুরো run না করে")
    args = parser.parse_args()

    logger.info("=== KUET faculty scrape started ===")
    teachers = scrape_all_departments(only_department=args.only_department)

    if not teachers:
        logger.warning("No teachers scraped — selectors বসানো হয়নি নাকি site structure বদলেছে, চেক করো।")

    profiles: dict[str, ProfileDetails] = {}
    all_publications: list[Publication] = []
    if not args.skip_profiles:
        logger.info(f"Scraping {len(teachers)} individual profile pages (education/experience/publications/...)")
        for i, t in enumerate(teachers, 1):
            details, pubs = scrape_teacher_profile(t)
            doc_id = t.doc_id()
            if details is not None and doc_id:
                profiles[doc_id] = details
            all_publications.extend(pubs)
            if i % 25 == 0:
                logger.info(f"  ...profile progress: {i}/{len(teachers)}")
    else:
        logger.info("--skip-profiles set, skipping individual profile page scrape.")

    output = {
        "last_run": datetime.now(timezone.utc).isoformat(),
        "total_teachers": len(teachers),
        "total_publications": len(all_publications),
        "teachers": [
            {**asdict(t), "profileDetails": asdict(profiles[t.doc_id()]) if t.doc_id() in profiles else None}
            for t in teachers
        ],
        "publications": [asdict(p) for p in all_publications],
    }
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    logger.info(f"JSON snapshot written to {OUTPUT_JSON}")

    if args.dry_run:
        logger.info("--dry-run set, skipping Firestore push.")
    elif teachers:
        push_to_firestore(teachers, profiles, all_publications)


if __name__ == "__main__":
    main()
