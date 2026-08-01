# KUETx Telegram notice bot — setup (Phase F)

Not auto-deployed. New infra someone with Firebase deploy access needs to
set up once. Telegram-only — WhatsApp's official API doesn't support
posting into groups/Channels, so it isn't part of this (see the note atop
`onGroupNoticeCreateTelegram` in `index.js`).

## 1. Create the bot
1. Open Telegram, message **@BotFather**.
2. `/newbot` → give it a name and a username ending in `bot`
   (e.g. `KUETxNoticeBot`).
3. BotFather gives you a token like `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`.
   Keep it secret — treat it like a password.
4. (Optional but recommended) `/setjoingroups` → Enable, so the bot can be
   added to groups. `/setprivacy` → **Disable**, so the bot can actually
   see the `/register <code>` command in a group (by default bots only see
   messages that start with `/`, which is exactly what we need, so default
   is usually fine — Disable if `/register` isn't being picked up).

## 2. Store the token (no Blaze plan needed)
Secret Manager (`firebase functions:secrets:set`) requires the Blaze
(pay-as-you-go) plan. Until that upgrade happens, use a plain `.env` file
instead — Firebase Functions v2 auto-loads it, and it works fine on the
free Spark plan:

```bash
cd functions
cp .env.example .env
# open .env and paste the real token after TELEGRAM_BOT_TOKEN=
```

`functions/.env` is already in `.gitignore` — never commit the real file,
only `.env.example` (which has no real token in it).

When the project later upgrades to Blaze, this can be swapped for
`firebase functions:secrets:set TELEGRAM_BOT_TOKEN` for slightly stronger
at-rest encryption — not required to get this working today.

## 3. Deploy the functions
```bash
firebase deploy --only functions:startTelegramLink,functions:telegramWebhook,functions:onGroupNoticeCreateTelegram
```
Note the deployed URL for `telegramWebhook` printed at the end
(looks like `https://us-central1-<project>.cloudfunctions.net/telegramWebhook`).

## 4. Point Telegram at the webhook (one-time, ever)
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<telegramWebhook URL>"
```
Replace `<TOKEN>` with the real bot token and `<telegramWebhook URL>` with
the URL from step 3. You only do this once — Telegram remembers it.

## 5. Update the bot username shown in the app
`src/pages/ClassSetup.jsx` currently shows the placeholder handle
`@KUETxNoticeBot` in the "Connect Telegram" instructions — update that
string to whatever username you actually registered in step 1.

## How it works end-to-end
1. CR opens `/class-setup` → "Telegram notices" → **Connect Telegram**.
   This calls `startTelegramLink`, which mints a random code
   (`KX-XXXXX`) tied to their own `groupId` and stores it in
   `telegramLinkCodes/{code}` for 15 minutes.
2. CR adds the bot to their class's own Telegram group, sends
   `/register KX-XXXXX` there.
3. Telegram POSTs the update to `telegramWebhook`, which looks up the
   code, resolves the `groupId`, and saves that chat's id onto
   `groups/{groupId}/meta/classSetup.telegramChatId`.
4. From then on, every new `groups/{groupId}/notices/{id}` doc (same
   trigger source the existing push-notification function already uses)
   also gets mirrored to that one Telegram chat via
   `onGroupNoticeCreateTelegram` — and only that one chat. A class that
   never connects Telegram just never gets a `telegramChatId`, so the
   function no-ops for them.

## Security notes
- A student can only mint a link code for **their own** `groupId` —
  `startTelegramLink` checks the caller's `groups/{groupId}/members/{uid}`
  doc has `role: 'cr'` or `'acr'` before issuing a code.
- Link codes expire in 15 minutes and are single-use (`used: true` after
  the first successful `/register`), so an old code leaked or seen in a
  screenshot can't be replayed later.
- Codes are looked up by their own random string, not by `groupId` — so
  nobody can skip the CR-only gate by just guessing/knowing another
  class's `groupId` (e.g. `2k23_cse`) and registering a chat for it
  themselves.
