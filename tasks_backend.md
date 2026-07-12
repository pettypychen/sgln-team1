# Backend Implementation Tasks

Track all backend integration tasks for Firestore + Firebase Auth + Admin UI.

---

## Pre-requisites (Firebase Console — no code)

- [x] Enable Firestore Database in Firebase console (sgln-team1-f8d61)
- [ ] Enable Authentication → Google sign-in provider in Firebase console

---

## Phase 1: Firebase SDK Setup

- [x] Install `firebase` npm package in `app/frontend`
- [x] Create `app/frontend/src/lib/firebase.ts` — initialise Firebase app, Firestore, and Auth
- [x] Add Firebase config env variables to `.env` (API key, project ID, etc.)
- [x] Add `.env` to `.gitignore`

---

## Phase 2: Data Migration Script

- [x] Create `scripts/seed-firestore.ts` — one-time script to seed existing hardcoded simulation data into Firestore
- [x] Map `MA_DUE_DILIGENCE_MODULE` structure to Firestore document schema
- [x] Run seed script locally to populate Firestore `/simulations` collection
- [x] Verify data appears correctly in Firebase console

---

## Phase 3: Read Layer

- [x] Create `app/frontend/src/hooks/useSimulation.ts` — fetch simulation by slug from Firestore
- [x] Add loading and error states for async data fetch
- [x] Update `ModuleWorkspacePage.tsx` to use `useSimulation` hook instead of hardcoded `MA_DUE_DILIGENCE_MODULE` import
- [x] Test that existing simulation loads correctly from Firestore

---

## Phase 4: Firebase Auth

- [ ] Create `app/frontend/src/lib/auth.ts` — Google sign-in helper functions
- [ ] Create `app/frontend/src/context/AuthContext.tsx` — auth state provider
- [ ] Create `app/frontend/src/components/ProtectedRoute.tsx` — redirect unauthenticated users to sign-in
- [ ] Create `app/frontend/src/pages/SignInPage.tsx` — Google sign-in button
- [ ] Add `/signin` and `/admin/*` routes to `App.tsx`
- [ ] Test sign-in and redirect flow

---

## Phase 5: Admin UI

- [ ] Create `app/frontend/src/pages/admin/AdminSimulationsPage.tsx` — list all simulations with edit/delete buttons
- [ ] Create `app/frontend/src/pages/admin/AdminEditSimulationPage.tsx` — form to create or edit a simulation
- [ ] Implement create simulation — write new document to Firestore `/simulations`
- [ ] Implement edit simulation — update existing Firestore document
- [ ] Implement delete simulation — remove Firestore document with confirmation prompt
- [ ] Add markdown editor for `caseMarkdown` and `evaluationMarkdown` fields
- [ ] Add navigation link to admin panel (visible only when signed in)

---

## Phase 6: Firestore Security Rules

- [ ] Create `firestore.rules` at project root
- [ ] Write rules: public read on `/simulations`, authenticated write only
- [ ] Add `firestore.rules` to `firebase.json` deploy config
- [ ] Deploy rules via `firebase deploy --only firestore:rules`
- [ ] Test that unauthenticated users cannot write

---

## Phase 7: Deploy

- [ ] Run `npm run build` in `app/frontend`
- [ ] Run `firebase deploy` to push hosting + rules to Firebase
- [ ] Verify live site at https://sgln-team1-f8d61.web.app
- [ ] Smoke test: load simulation from Firestore, sign in, create/edit/delete a simulation
