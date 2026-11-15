# Mobile Design

Native stacks and bottom tabs, system typography, 48-point touch targets and safe
areas. French labels; concise headings with labelled references and business dates.
List rows, separators and unframed sections replace desktop tables. Each detail
view stays within one account's space. Native back navigation remains enabled.

Semantic tokens live in src/theme.tsx. Neutral white/charcoal surfaces, green
primary actions, blue claim accent, amber attention and red errors. Both schemes
are explicit; no automatic color inversion, gradients or decorative illustrations.
System text scaling remains enabled. Reuse the existing product mark as a bitmap
asset, without inventing agency branding. Agency identity is supplied by the API.

Use StyleSheet, Lucide icons, stable FlatList rows, native refresh and sharing.
No hover-only interaction. Loading, permission denial, no results, pagination,
expired sessions, network loss and unavailable documents are distinct states.

Native device screenshots and large-font checks are release gates; a browser
preview is not evidence of native iOS/Android correctness.
