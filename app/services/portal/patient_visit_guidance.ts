import { EncounterStage } from '#enums/encounter_stage'
import { EncounterStatus } from '#enums/encounter_status'

export interface VisitGuidance {
  title: string
  message: string
  tone: string
}

/**
 * Patient-safe visit guidance for the current encounter stage and status.
 *
 * Ported from App\Support\Portal\PatientVisitGuidance (+ App\Support\Portal\PortalTranslator).
 *
 * PORT-GAP: the Laravel version resolves copy through the translator
 * (trans('portal.guidance.*')) so it is fully localized (en/es/fr/zh/pt/ja under
 * lang/*). The AdonisJS app has no i18n layer wired up, so the English strings
 * from lang/en/portal.php are embedded here verbatim. Wire this to a translation
 * service to restore multi-language support. Also belongs under app/support/.
 */
const STAGE_LABELS: Record<string, string> = {
  registration: 'Registration',
  triage: 'Triage',
  screening: 'Screening',
  lab: 'Lab',
  screening_review: 'Screening Review',
  pharmacy: 'Pharmacy',
  treatment_room: 'Treatment Room',
  completed: 'Completed',
}

const GUIDANCE: Record<string, VisitGuidance> = {
  fallback: {
    title: 'Visit in progress',
    message: 'Please follow staff directions for your next step.',
    tone: 'info',
  },
  registration_queued: {
    title: 'Registration',
    message: 'You are in the registration queue. Please wait to be called.',
    tone: 'waiting',
  },
  triage_queued: {
    title: 'Visit Triage',
    message: 'Please go to :department for vitals.',
    tone: 'action',
  },
  screening_queued: {
    title: 'Visit Screening',
    message: 'Please proceed to :department for your consultation.',
    tone: 'action',
  },
  lab_queued: {
    title: 'Visit Lab',
    message: 'Please go to the :department department.',
    tone: 'action',
  },
  screening_review_queued: {
    title: 'Screening review',
    message: 'Please wait while your case is reviewed by clinical staff.',
    tone: 'waiting',
  },
  pharmacy_queued: {
    title: 'Visit Pharmacy',
    message: 'Please go to :department to collect your medication.',
    tone: 'action',
  },
  treatment_room_queued: {
    title: 'Visit Treatment Room',
    message: 'Please proceed to the :department.',
    tone: 'action',
  },
  completed_info: {
    title: 'Visit complete',
    message: 'Your visit has been completed. Thank you for choosing our clinic.',
    tone: 'info',
  },
  registration_started: {
    title: 'At Registration',
    message: 'Staff are completing your check-in. Please stay nearby.',
    tone: 'info',
  },
  started_default: {
    title: ':department',
    message: 'Your visit is being prepared. Please wait for further instructions.',
    tone: 'info',
  },
  registration_in_progress: {
    title: 'At Registration',
    message: 'Staff are completing your check-in.',
    tone: 'info',
  },
  triage_in_progress: {
    title: 'With Triage',
    message: 'A nurse is recording your vitals.',
    tone: 'info',
  },
  screening_in_progress: {
    title: 'With clinician',
    message: 'You are with the screening team.',
    tone: 'info',
  },
  lab_in_progress: {
    title: 'Lab in progress',
    message: 'Your lab tests are being processed.',
    tone: 'info',
  },
  screening_review_in_progress: {
    title: 'Under review',
    message: 'Your case is being reviewed by clinical staff.',
    tone: 'info',
  },
  pharmacy_in_progress: {
    title: 'At Pharmacy',
    message: 'You are collecting your medication.',
    tone: 'info',
  },
  treatment_room_in_progress: {
    title: 'Receiving treatment',
    message: 'You are in the treatment room.',
    tone: 'info',
  },
  completed_in_progress: {
    title: 'Visit complete',
    message: 'Your visit has been completed.',
    tone: 'info',
  },
}

export default class PatientVisitGuidance {
  /** Poll while a visit is active (stage/status updates). */
  static readonly POLL_INTERVAL_SECONDS = 15

  /** Poll while waiting for check-in so the app detects when staff start an encounter. */
  static readonly IDLE_POLL_INTERVAL_SECONDS = 15

  forStageAndStatus(stage: string, status: string, queuePosition: number | null = null): VisitGuidance {
    const encounterStage = this.tryStage(stage)
    const encounterStatus = this.tryStatus(status)

    if (!encounterStage || !encounterStatus) {
      return this.guidance('fallback')
    }

    const department = this.stageLabel(encounterStage)
    const queue = this.queueSuffix(queuePosition)

    if (encounterStatus === EncounterStatus.Queued) {
      switch (encounterStage) {
        case EncounterStage.Registration:
          return this.guidance('registration_queued', {}, queue)
        case EncounterStage.Triage:
          return this.guidance('triage_queued', { department }, queue)
        case EncounterStage.Screening:
          return this.guidance('screening_queued', { department }, queue)
        case EncounterStage.Lab:
          return this.guidance('lab_queued', { department }, queue)
        case EncounterStage.ScreeningReview:
          return this.guidance('screening_review_queued', {}, queue)
        case EncounterStage.Pharmacy:
          return this.guidance('pharmacy_queued', { department }, queue)
        case EncounterStage.TreatmentRoom:
          return this.guidance('treatment_room_queued', { department }, queue)
        case EncounterStage.Completed:
          return this.guidance('completed_info')
      }
    }

    if (encounterStatus === EncounterStatus.Started) {
      if (encounterStage === EncounterStage.Registration) {
        return this.guidance('registration_started')
      }

      return this.guidance('started_default', { department })
    }

    if (encounterStatus === EncounterStatus.InProgress) {
      switch (encounterStage) {
        case EncounterStage.Registration:
          return this.guidance('registration_in_progress')
        case EncounterStage.Triage:
          return this.guidance('triage_in_progress')
        case EncounterStage.Screening:
          return this.guidance('screening_in_progress')
        case EncounterStage.Lab:
          return this.guidance('lab_in_progress')
        case EncounterStage.ScreeningReview:
          return this.guidance('screening_review_in_progress')
        case EncounterStage.Pharmacy:
          return this.guidance('pharmacy_in_progress')
        case EncounterStage.TreatmentRoom:
          return this.guidance('treatment_room_in_progress')
        case EncounterStage.Completed:
          return this.guidance('completed_in_progress')
      }
    }

    return this.guidance('fallback')
  }

  private stageLabel(stage: EncounterStage): string {
    return STAGE_LABELS[stage] ?? stage
  }

  private queueSuffix(queuePosition: number | null): string {
    if (queuePosition === null) {
      return ''
    }

    return ` You are queue #${queuePosition}.`
  }

  private guidance(key: string, replace: Record<string, string> = {}, queueSuffix: string = ''): VisitGuidance {
    const entry = GUIDANCE[key] ?? GUIDANCE.fallback

    return {
      title: this.replace(entry.title, replace),
      message: this.replace(entry.message, replace) + queueSuffix,
      tone: entry.tone,
    }
  }

  private replace(text: string, replace: Record<string, string>): string {
    let out = text
    for (const [key, value] of Object.entries(replace)) {
      out = out.replace(new RegExp(`:${key}`, 'g'), value)
    }
    return out
  }

  private tryStage(value: string): EncounterStage | null {
    const match = Object.values(EncounterStage).find((s) => s === value)
    return (match as EncounterStage) ?? null
  }

  private tryStatus(value: string): EncounterStatus | null {
    const match = Object.values(EncounterStatus).find((s) => s === value)
    return (match as EncounterStatus) ?? null
  }
}
