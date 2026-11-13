# Page dependency trees

## / (whole app)
Entry: app/page.tsx
Dependencies:
- components/LoginScreen.tsx
  - components/PasswordForm.tsx
- components/NewPasswordScreen.tsx
- components/TermsGate.tsx
- components/NameConfirmSheet.tsx
- components/WeekSetupFlow.tsx
- components/VisitPromptModal.tsx
- components/Tour.tsx
- components/StatusGuide.tsx
- components/InstallBanner.tsx
- components/ConnectionBanner.tsx
- components/Toast.tsx
- components/EmptyState.tsx
- components/BottomNav.tsx
- components/ProgressRing.tsx
- components/LiveStrip.tsx
- components/NextDoctorCard.tsx
- components/RouteMap.tsx
  - lib/coords.ts
- components/MeTab.tsx
  - components/ProgressRing.tsx
- components/NotificationsSheet.tsx
- components/DoctorCard.tsx
  - components/LocationPills.tsx
  - components/PresenceTags.tsx
  - components/StatusSheet.tsx
    - components/ReturnDatePicker.tsx
      - components/MonthCalendar.tsx
  - components/Icons.tsx
- components/DoctorSheet.tsx
  - components/DoctorHistory.tsx
  - components/DoctorEditForm.tsx
    - components/LocationsEditor.tsx
    - components/LocationSheet.tsx
    - components/AgendaEditor.tsx
    - components/ComboBox.tsx
- components/AddDoctorForm.tsx
- components/BottomSheet.tsx
- components/PickerSheet.tsx
- components/ConfirmSheet.tsx
- components/StatusOverview.tsx
- components/ProfileSheet.tsx
- components/EditProfileSheet.tsx
- components/CityFilter.tsx
- components/RepAvatar.tsx
- app/globals.css, constants.ts, utils.ts, types/doctor.ts, types/status.ts

## Tab "Hoje" (mainTab=hoje)
- app/page.tsx:2187:2296 (header) and :2625:2741 (main)
- components/LiveStrip.tsx, NextDoctorCard.tsx, DoctorCard.tsx, ProgressRing.tsx, BottomNav.tsx

## Tab "Mapa"
- app/page.tsx:2742:2758, components/RouteMap.tsx, NextDoctorCard.tsx, BottomNav.tsx

## Tab "Medicos"
- app/page.tsx:2297:2330 and :2759:2803, BottomNav.tsx

## Tab "Eu"
- app/page.tsx:2804:2830, components/MeTab.tsx, ProgressRing.tsx, BottomNav.tsx
