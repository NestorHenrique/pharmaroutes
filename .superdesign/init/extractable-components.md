# Extractable components

## BottomNav
- Source: `components/BottomNav.tsx`
- Category: layout
- Description: Floating bottom bar (68px, radius 26px, blur) with Hoje, Mapa, center violet action button, Avisos, Eu
- Extractable props: activeTab (string, default: "hoje"), avisosCount (number, default: 0)
- Hardcoded: icons, labels, all CSS

## ProgressRing
- Source: `components/ProgressRing.tsx`
- Category: basic
- Description: Green progress ring with "done/total" in the center
- Extractable props: done (number), total (number), size (number, default 56)

## BottomSheet
- Source: `components/BottomSheet.tsx`
- Category: layout
- Description: Sheet rising from the bottom with handle, title, content and Cancelar/Salvar footer
- Extractable props: title (string)

## NextDoctorCard
- Source: `components/NextDoctorCard.tsx`
- Category: basic
- Description: Big violet "Proximo" card with Ir / Cheguei / Visitei
- Extractable props: arrived (boolean, default: false)

## LiveStrip
- Source: `components/LiveStrip.tsx`
- Category: basic
- Description: Horizontal chips, one per live status with counter and minutes
