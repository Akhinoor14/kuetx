# Notification Architecture — Telegram now, SMS later (Blaze-ready)

Context for the Class On/Off toggle feature
(`CLASS_TOGGLE_NOTIFICATION_PROMPT.md`) and any future notification work.
Written so a future session (once Blaze billing is enabled) doesn't have
to re-derive this from scratch.

## Current pipeline (live today)

One notice feed, one delivery channel:

1. Any group-facing event that should notify students (class toggled
   off/on, new member joined, a regular CR announcement, etc.) writes a
   document to `groups/{groupId}/notices/{noticeId}` via
   `postGroupNotice()` in `src/lib/groupSync.js` (client writes) or
   directly via the Admin SDK for server-authored system notices (e.g.
   `onMemberJoin` in `functions/index.js`).
2. Every notice write is picked up by the existing
   `onGroupNoticeCreateTelegram` Cloud Function
   (`functions/index.js`), which reads the group's
   `meta/classSetup.telegramChatId` (set once when the CR links the
   class's Telegram group via the bot's linking flow) and pushes the
   notice's title+body to that chat.
3. If a class has never linked Telegram, `telegramChatId` is unset and
   the trigger silently no-ops — not an error, no crash, nothing to
   configure per-caller.

Every notice writer is automatically Telegram-delivered for free — no
per-caller wiring needed. This is why the Class On/Off toggle feature
needed zero new Cloud Functions: it just calls the same
`postGroupNotice()` every other feature already calls.

## Why SMS isn't live yet

SMS gateway calls (Twilio or a local Bangladeshi gateway) require
outbound network access from a Cloud Function, which the free **Spark**
plan doesn't allow — only the pay-as-you-go **Blaze** plan does. The
project is currently on Spark, so SMS is deliberately deferred rather
than half-built.

## What's already in place so SMS is a plug-in, not a re-architecture

- **`channelHints` field** — `postGroupNotice()` accepts an optional
  `channelHints` array (e.g. `['telegram', 'sms']`) and, if passed,
  writes it onto the notice doc. No caller passes it today (every
  notice implicitly defaults to Telegram-only delivery, matching
  current behavior exactly), but the field is there so a future SMS
  trigger can filter `channelHints.includes('sms')` without needing to
  backfill or guess intent on old notices.
- **`TODO(Blaze)` comment block** — sits directly below
  `onGroupNoticeCreateTelegram` in `functions/index.js`, spelling out
  the three steps needed (read `channelHints`, read opt-in numbers from
  a new `smsOptInNumbers` field on `meta/classSetup`, call the SMS
  gateway) once Blaze is enabled.

## When Blaze is enabled — pickup checklist

1. Enable Blaze billing on the Firebase project.
2. Add `smsOptInNumbers` to `groups/{groupId}/meta/classSetup` (new
   field, doesn't exist yet — a CR-facing UI to opt numbers in would be
   a separate small feature).
3. Implement the `onGroupNoticeCreateSms` trigger per the `TODO(Blaze)`
   comment in `functions/index.js` (fan-out from inside
   `onGroupNoticeCreateTelegram`, or a second `exports.*` trigger on the
   same `notices` path — either works).
4. Decide + wire an SMS gateway (Twilio vs a local gateway — no
   decision made yet, whichever is cheaper/more reliable for
   Bangladeshi numbers).
5. Have callers that want SMS delivery start passing
   `channelHints: ['telegram', 'sms']` to `postGroupNotice()` — the
   Class On/Off toggle notices (`useClassManagementState.js`) are a
   reasonable first candidate, since a class actually being cancelled is
   the kind of time-sensitive event SMS is meant for.
