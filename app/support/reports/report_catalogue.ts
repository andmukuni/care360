/**
 * Central catalogue of available BARCODES reports (loan-style metadata).
 * Ported from App\Support\Reports\ReportCatalogue.
 */
export interface ReportCatalogueEntry {
  id: string
  key: string
  name: string
  description: string
  category: string
  type: string
  exportable: boolean
  module: boolean
  icon_bg: string
  icon_class: string
}

const ENTRIES: ReportCatalogueEntry[] = [
  {
    id: 'gyn-obs',
    key: 'gyn_obs',
    name: 'Gyn & OBS Dashboard',
    description:
      'Aggregated gynaecology and obstetrics indicators for the selected period — visits, deliveries, and related clinical metrics.',
    category: 'Clinical',
    type: 'View',
    exportable: true,
    module: false,
    icon_bg: 'bg-blue-100 dark:bg-blue-900/40',
    icon_class: 'text-blue-700 dark:text-blue-300',
  },
  {
    id: 'opd-register',
    key: 'opd_register',
    name: 'OPD Register',
    description:
      'MoH-style outpatient register: one row per OPD encounter with registration, screening, labs, and diagnosis fields for the date range.',
    category: 'Clinical',
    type: 'Table',
    exportable: true,
    module: false,
    icon_bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    icon_class: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    id: 'presumptive-tb',
    key: 'presumptive_tb',
    name: 'Presumptive TB Register',
    description:
      'Patients screened as presumptive TB during the period, with case numbers, symptoms, and screening clinician.',
    category: 'Clinical',
    type: 'Table',
    exportable: true,
    module: false,
    icon_bg: 'bg-amber-100 dark:bg-amber-900/40',
    icon_class: 'text-amber-700 dark:text-amber-300',
  },
  {
    id: 'pnc-register',
    key: 'pnc_register',
    name: 'PNC Register',
    description:
      'Postnatal care register — PNC visits and outcomes for mothers in the selected period.',
    category: 'Clinical',
    type: 'Table',
    exportable: true,
    module: false,
    icon_bg: 'bg-pink-100 dark:bg-pink-900/40',
    icon_class: 'text-pink-700 dark:text-pink-300',
  },
  {
    id: 'anc-register',
    key: 'anc_register',
    name: 'ANC Register',
    description:
      'Antenatal care register — ANC contacts, investigations, and pregnancy-related data for the period.',
    category: 'Clinical',
    type: 'Table',
    exportable: true,
    module: false,
    icon_bg: 'bg-rose-100 dark:bg-rose-900/40',
    icon_class: 'text-rose-700 dark:text-rose-300',
  },
  {
    id: 'art-register',
    key: 'art_register',
    name: 'ART Register',
    description:
      'MoH ART register (44 columns): one row per ART client with activity in the period. Full CSV export includes all register columns; some fields export blank until captured in workflows.',
    category: 'Clinical',
    type: 'Table',
    exportable: true,
    module: false,
    icon_bg: 'bg-indigo-100 dark:bg-indigo-900/40',
    icon_class: 'text-indigo-700 dark:text-indigo-300',
  },
  {
    id: 'hia-one-a',
    key: 'hia_one_a',
    name: 'HIA 1 A',
    description:
      'Health Information Annex 1A — diagnosis counts by MoH catalogue line and age band for outpatient events in the period.',
    category: 'Clinical',
    type: 'Table',
    exportable: true,
    module: false,
    icon_bg: 'bg-cyan-100 dark:bg-cyan-900/40',
    icon_class: 'text-cyan-700 dark:text-cyan-300',
  },
  {
    id: 'hia-one-b',
    key: 'hia_one_b',
    name: 'HIA 1 B',
    description:
      'Health Information Annex 1B — extended diagnosis catalogue with age-band counts for the selected period.',
    category: 'Clinical',
    type: 'Table',
    exportable: true,
    module: false,
    icon_bg: 'bg-teal-100 dark:bg-teal-900/40',
    icon_class: 'text-teal-700 dark:text-teal-300',
  },
  {
    id: 'shift-management',
    key: 'shift_management',
    name: 'Shift Management',
    description: 'Roster assignments and shift reporting for clinical staff.',
    category: 'Operations',
    type: 'Module',
    exportable: false,
    module: true,
    icon_bg: 'bg-violet-100 dark:bg-violet-900/40',
    icon_class: 'text-violet-700 dark:text-violet-300',
  },
  {
    id: 'shift-timeline',
    key: 'shift_timeline',
    name: 'Shift Timeline',
    description: 'Chronological view of shift activity and patient volumes.',
    category: 'Operations',
    type: 'Module',
    exportable: false,
    module: true,
    icon_bg: 'bg-violet-100 dark:bg-violet-900/40',
    icon_class: 'text-violet-700 dark:text-violet-300',
  },
]

export class ReportCatalogue {
  static all(): ReportCatalogueEntry[] {
    return ENTRIES
  }

  static findByKey(key: string): ReportCatalogueEntry | null {
    return ENTRIES.find((entry) => entry.key === key) ?? null
  }

  static titleForKey(key: string): string {
    return this.findByKey(key)?.name ?? 'Report'
  }

  static categories(): string[] {
    return [...new Set(ENTRIES.map((entry) => entry.category))].sort()
  }

  static exportableKeys(): string[] {
    return ENTRIES.filter((entry) => entry.exportable).map((entry) => entry.key)
  }
}
