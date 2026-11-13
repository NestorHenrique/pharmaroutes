# Routes

File-based (Next.js App Router). Single route:

| URL | File | Layout |
|---|---|---|
| `/` | `app/page.tsx` | `app/layout.tsx` |

`app/page.tsx` (~3000 lines, client) is the whole app. Not logged in: `components/LoginScreen.tsx` (or `NewPasswordScreen`). Logged in: gates (TermsGate, NameConfirmSheet, WeekSetupFlow, VisitPromptModal "Ja visitou?", Tour) then tabs switched by state `mainTab` via `components/BottomNav.tsx`:

- `hoje`: header (context line, city title, ProgressRing, day chips, search button, filters) + LiveStrip + NextDoctorCard + "Depois" list of DoctorCard + "Visitados hoje" + unavailable.
- `mapa`: RouteMap + next-stop card.
- `medicos`: search + chips + doctor rows.
- `eu`: MeTab (ring, stats, bars, shortcuts).
- Avisos: NotificationsSheet (full screen). "+" opens AddDoctorForm sheet.

Sheets/full screens opened from state: DoctorSheet (ficha), DoctorEditForm, StatusSheet, ReturnDatePicker, LocationSheet, StatusOverview, StatusGuide, ProfileSheet, EditProfileSheet, CityFilter, WeekSetupFlow, DoctorHistory, ConfirmSheet.

`app/components/*` and `app/hooks/useDoctors.ts` are dead code.
