# Group invites: brief for Claude Design

For Claude Design, 2026-10-05. **Not built, on purpose:** v8-1 draws an invite card on My groups (8c, *Hana invited you to Mueller Pickleball*, Join / Not now), but the build has no group invites, so there's nothing to show (HANDOFF-to-DESIGN §4). This brief says what the card needs behind it. How it looks and where it sits are Design's call.

---

## 1. How joining works today

- A group has one **invite link** (`/join/CODE`) and **code**. Anyone with either joins straight away; nobody approves them.
- Only owners and admins can see or copy the link (Group ⋯ → Invite · Copy link; Edit group → Invite link & code). Plain members can't share it (open question §5 Q22).
- Nobody is ever invited *by name*, so there's no record of who invited whom, and nothing to accept or turn down.

## 2. What's needed

A personal invite, from one person to another, that the invited person can accept or ignore:

1. **Sending.** Where a member invites a specific person: from the group page, from My friends, from someone's profile, or all three. Who they can pick (friends, people from their other groups, anyone in Spark Hub?), and several at once or one at a time.
2. **Who's allowed.** Owners and admins only, or every member (this answers Q22 too).
3. **Someone not on Spark Hub yet.** Whether the sheet falls back to sharing the link (as today), or sends something that names the inviter.
4. **The invited person.** The 8c card on My groups (Join / Not now), and anything else: a notification, the bell, an email? (Email is off for now: push notifications and the in-app bell only.)
5. **Not now.** Does it hide for good, come back, or tell the inviter?
6. **The inviter's side.** Whether they see *invited · waiting · joined*, and whether they can take an invite back.
7. **Several invites** to the same group, or to several groups at once.
8. **After joining.** The build already has a *Welcome to {group}* screen for people who join by link. Same screen, or one that names who invited them?

## 3. Things the build needs to know

- Does an invite skip the link entirely, so a group could one day be **invite-only** (no link), or is it just a friendlier way to share the same link?
- Does an invite **expire**?
- Can a member **block** invites from someone, or does Not now cover it?
- Invite link 1b (*Ana Torrez invited you · 20 members*, §5 Q4) names an inviter on the link landing. If personal invites exist, should that landing use them?

## 4. What exists to build on

- Groups, roles (owner · admin · member), join codes and `join_group`; My friends with friend links; push notifications and the bell; the Welcome to {group} screen.
- A personal invite needs a new table (who, whom, which group, status) and a migration, so it's a back-end change as well as a design one.
