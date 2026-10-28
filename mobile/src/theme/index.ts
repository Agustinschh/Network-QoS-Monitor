/** Sistema de diseño: paleta oscura, espaciados y tipografía. */

export const colors = {
  bg: '#0B0F1A',
  surface: '#141A2A',
  surfaceAlt: '#1C2438',
  border: '#26304A',
  text: '#E8ECF5',
  textMuted: '#8A94AD',
  primary: '#5B8CFF',
  primarySoft: 'rgba(91, 140, 255, 0.15)',
  // Escala de calidad (también usada luego por el heatmap)
  good: '#2ED6A3',
  fair: '#FFC857',
  poor: '#FF5C7A',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  subtitle: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  caption: { fontSize: 13, color: colors.textMuted },
  metric: { fontSize: 32, fontWeight: '700' as const, color: colors.text },
};
