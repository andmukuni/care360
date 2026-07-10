export interface MembershipPlanTheme {
  primary: string
  primaryDark: string
  soft: string
  arcMuted: string
  label: string
}

const THEMES_BY_TIER: Record<number, MembershipPlanTheme> = {
  1: {
    primary: '#0E7C7B',
    primaryDark: '#0A5C5B',
    soft: '#E2F3F2',
    arcMuted: '#C5E8E6',
    label: 'Bronze',
  },
  2: {
    primary: '#5B4FCF',
    primaryDark: '#4338CA',
    soft: '#EEEDFB',
    arcMuted: '#D4D0F5',
    label: 'Silver',
  },
  3: {
    primary: '#D97706',
    primaryDark: '#B45309',
    soft: '#FBEFD8',
    arcMuted: '#F5D9A8',
    label: 'Gold',
  },
  4: {
    primary: '#475569',
    primaryDark: '#334155',
    soft: '#F1F5F9',
    arcMuted: '#CBD5E1',
    label: 'Platinum',
  },
}

const FALLBACK_THEME: MembershipPlanTheme = {
  primary: '#2D7DD2',
  primaryDark: '#1E5FA8',
  soft: '#E5EEFB',
  arcMuted: '#C8DAF5',
  label: 'Member',
}

/** Default brand card when there is no active membership tier. */
export const DEFAULT_MEMBERSHIP_CARD_THEME: MembershipPlanTheme = {
  primary: '#0E7C7B',
  primaryDark: '#0A5C5B',
  soft: '#E2F3F2',
  arcMuted: '#C5E8E6',
  label: 'Patient',
}

export function getPlanThemeByTier(tier: number | null | undefined): MembershipPlanTheme | null {
  if (tier == null) return null
  return THEMES_BY_TIER[tier] ?? FALLBACK_THEME
}

export function resolveMembershipCardTheme(tier: number | null | undefined): MembershipPlanTheme {
  return getPlanThemeByTier(tier) ?? DEFAULT_MEMBERSHIP_CARD_THEME
}
