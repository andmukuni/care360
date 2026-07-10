import { randomUUID } from 'node:crypto'
import { mkdirSync, unlinkSync } from 'node:fs'
import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import SystemSetting from '#models/system_setting'
import ClinicSettings from '#support/clinic_settings'
import paymentsConfig from '#config/payments'

/**
 * System settings. Ported from App\Http\Controllers\SettingsController.
 *
 * Settings are stored as (group, key, value) rows in `system_settings`. The
 * static SystemSetting::allGrouped()/saveGroup() helpers from Laravel do not
 * exist on the Adonis model, so the equivalent queries are inlined here. The
 * Laravel `update` returned JSON; here it redirects back with a flash so the
 * shared Inertia flash banner shows the confirmation.
 */

interface FieldMeta {
  label: string
  type: 'text' | 'email' | 'password' | 'select' | 'textarea' | 'file'
  placeholder?: string
  options?: Record<string, string>
  accept?: string
}

interface GroupMeta {
  label: string
  icon: string
  fields: Record<string, FieldMeta>
}

function schema(): Record<string, GroupMeta> {
  return {
    clinic: {
      label: 'Clinic',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m4-10h2m4 0h2m-8 4h2m4 0h2M9 7h6',
      fields: {
        facility_name: { label: 'Facility Name', type: 'text', placeholder: 'International Hospital Zambia' },
        facility_code: { label: 'Facility Code', type: 'text', placeholder: 'AOHC-001' },
        facility_type: {
          label: 'Facility Type',
          type: 'select',
          options: { hospital: 'Hospital', clinic: 'Clinic', health_post: 'Health Post', laboratory: 'Laboratory' },
        },
        address: { label: 'Physical Address', type: 'text', placeholder: '123 Health St, Lilongwe' },
        phone: { label: 'Contact Phone', type: 'text', placeholder: '+265 999 000 000' },
        email: { label: 'Contact Email', type: 'email', placeholder: 'admin@facility.mw' },
        timezone: { label: 'Timezone', type: 'text', placeholder: 'Africa/Blantyre' },
        locale: { label: 'Locale', type: 'text', placeholder: 'en' },
        currency: { label: 'Currency Code', type: 'text', placeholder: 'MWK' },
        hide_logo: {
          label: 'Hide Logo',
          type: 'select',
          options: {
            no: 'Show logo across the system',
            yes: 'Hide logo everywhere',
          },
        },
        logo: {
          label: 'Facility Logo',
          type: 'file',
          accept: 'image/png,image/jpeg,image/webp',
        },
      },
    },
    email: {
      label: 'Email',
      icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-2 10H5a2 2 0 01-2-2V8a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2z',
      fields: {
        mailer: {
          label: 'Mail Driver',
          type: 'select',
          options: { smtp: 'SMTP', log: 'Log (dev)', null: 'Null (disabled)' },
        },
        host: { label: 'SMTP Host', type: 'text', placeholder: 'mail.facility.mw' },
        port: { label: 'SMTP Port', type: 'text', placeholder: '587' },
        encryption: { label: 'Encryption', type: 'select', options: { tls: 'TLS', ssl: 'SSL', none: 'None' } },
        username: { label: 'SMTP Username', type: 'text', placeholder: 'noreply@facility.mw' },
        password: { label: 'SMTP Password', type: 'password', placeholder: '••••••••' },
        from_address: { label: 'From Address', type: 'email', placeholder: 'noreply@facility.mw' },
        from_name: { label: 'From Name', type: 'text', placeholder: 'International Hospital Zambia' },
      },
    },
    sms: {
      label: 'SMS',
      icon: 'M8 10h8m-8 4h5m-8 8l4-4h10a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v16l5-4z',
      fields: {
        provider: {
          label: 'SMS Provider',
          type: 'select',
          options: { none: 'Disabled', africastalking: "Africa's Talking", twilio: 'Twilio' },
        },
        africastalking_key: { label: "Africa's Talking API Key", type: 'text', placeholder: 'at_live_…' },
        africastalking_user: { label: "Africa's Talking Username", type: 'text', placeholder: 'sandbox' },
        twilio_sid: { label: 'Twilio Account SID', type: 'text', placeholder: 'ACxxxxxxxx' },
        twilio_token: { label: 'Twilio Auth Token', type: 'password', placeholder: '••••••••' },
        twilio_from: { label: 'Twilio From Number', type: 'text', placeholder: '+1 555 000 0000' },
        default_country_code: { label: 'Default Country Code', type: 'text', placeholder: '+265' },
      },
    },
    notifications: {
      label: 'Notifications',
      icon: 'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9',
      fields: {
        channels: {
          label: 'Default Channels',
          type: 'select',
          options: { mail: 'Email only', database: 'In-app only', 'mail+database': 'Email + In-app' },
        },
        daily_summary_time: { label: 'Daily Summary Time', type: 'text', placeholder: '18:00' },
        critical_alert_email: { label: 'Critical Alert Email', type: 'email', placeholder: 'alerts@facility.mw' },
        queue_notifications: {
          label: 'Queue Notifications',
          type: 'select',
          options: { yes: 'Yes – send async', no: 'No – send inline' },
        },
      },
    },
    payments: {
      label: 'Payments',
      icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      fields: {
        gateway: {
          label: 'Payment Gateway',
          type: 'select',
          options: { sandbox: 'Sandbox (test, auto-approves)', lenco: 'Lenco (mobile money)' },
        },
        country: { label: 'Mobile Money Country', type: 'select', options: { zm: 'Zambia', mw: 'Malawi' } },
        fee_bearer: {
          label: 'Who Pays Gateway Fee',
          type: 'select',
          options: { merchant: 'Hospital (merchant)', customer: 'Patient (customer)' },
        },
        lenco_base_url: { label: 'Lenco Base URL', type: 'text', placeholder: 'https://api.lenco.co/access/v2' },
        lenco_token: { label: 'Lenco API Token', type: 'password', placeholder: '••••••••' },
        lenco_webhook_secret: { label: 'Lenco Webhook Secret', type: 'password', placeholder: '••••••••' },
      },
    },
    wellness_fund: {
      label: 'Wellness Fund',
      icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      fields: {
        fund_name: { label: 'Fund Name', type: 'text', placeholder: 'IHZ Wellness Fund' },
        default_consultation_fee: { label: 'Default Consultation Fee (ZMW)', type: 'text', placeholder: '150' },
        default_lab_test_fee: { label: 'Default Lab Test Fee (ZMW)', type: 'text', placeholder: '120' },
        default_pharmacy_item_fee: { label: 'Default Pharmacy Item Fee (ZMW)', type: 'text', placeholder: '35' },
        default_treatment_room_fee: { label: 'Default Treatment Room Fee (ZMW)', type: 'text', placeholder: '100' },
        refund_admin_fee_percent: { label: 'Refund Admin Fee (%)', type: 'text', placeholder: '30' },
        min_months_before_refund: { label: 'Min Months Before Refund', type: 'text', placeholder: '3' },
        credit_period_days: { label: 'Credit Period (days)', type: 'text', placeholder: '30' },
        late_interest_percent_monthly: { label: 'Late Interest (%/month)', type: 'text', placeholder: '1.5' },
        suspend_discount_on_outstanding: {
          label: 'Suspend Discount on Outstanding',
          type: 'select',
          options: { yes: 'Yes', no: 'No' },
        },
        exclude_pharmacy: { label: 'Exclude Pharmacy from Discount', type: 'select', options: { yes: 'Yes', no: 'No' } },
        exclude_outsourced: {
          label: 'Exclude Outsourced from Discount',
          type: 'select',
          options: { yes: 'Yes', no: 'No' },
        },
        excluded_service_codes: { label: 'Excluded Service Codes', type: 'textarea', placeholder: 'One code per line' },
        corporate_signup_enabled: {
          label: 'Corporate Signup Enabled',
          type: 'select',
          options: { yes: 'Yes', no: 'No' },
        },
        corporate_signup_url: { label: 'Corporate Signup URL', type: 'text', placeholder: '/wellness-fund/corporate' },
        corp_a_threshold_1: { label: 'Corp A Threshold 1 (ZMW)', type: 'text', placeholder: '500000' },
        corp_a_discount_1: { label: 'Corp A Discount 1 (%)', type: 'text', placeholder: '8' },
        corp_a_threshold_2: { label: 'Corp A Threshold 2 (ZMW)', type: 'text', placeholder: '1000000' },
        corp_a_discount_2: { label: 'Corp A Discount 2 (%)', type: 'text', placeholder: '10' },
        corp_b_threshold_1: { label: 'Corp B Threshold 1 (ZMW/mo)', type: 'text', placeholder: '500000' },
        corp_b_discount_1: { label: 'Corp B Discount 1 (%)', type: 'text', placeholder: '7.5' },
        corp_b_threshold_2: { label: 'Corp B Threshold 2 (ZMW/mo)', type: 'text', placeholder: '1000000' },
        corp_b_discount_2: { label: 'Corp B Discount 2 (%)', type: 'text', placeholder: '9' },
        corp_c_discount: { label: 'Corp C Hybrid Discount (%)', type: 'text', placeholder: '11' },
      },
    },
    security: {
      label: 'Security',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      fields: {
        session_lifetime: { label: 'Session Lifetime (minutes)', type: 'text', placeholder: '120' },
        password_min_length: { label: 'Min Password Length', type: 'text', placeholder: '8' },
        require_2fa: { label: 'Require 2FA', type: 'select', options: { no: 'No', yes: 'Yes – all users' } },
        force_https: { label: 'Force HTTPS', type: 'select', options: { yes: 'Yes', no: 'No' } },
        login_throttle: { label: 'Login Throttle (attempts)', type: 'text', placeholder: '5' },
      },
    },
  }
}

/** Effective defaults shown in the form when no DB value is saved. */
async function effectiveDefaults(group: string): Promise<Record<string, string>> {
  if (group === 'clinic') {
    return ClinicSettings.defaults()
  }

  if (group === 'payments') {
    const lenco = paymentsConfig.gateways.lenco
    return {
      gateway: paymentsConfig.gateway,
      country: paymentsConfig.country,
      fee_bearer: paymentsConfig.feeBearer,
      lenco_base_url: lenco.baseUrl ?? '',
      lenco_token: lenco.token ?? '',
      lenco_webhook_secret: lenco.webhookSecret ?? '',
    }
  }

  if (group === 'wellness_fund') {
    return {
      fund_name: 'IHZ Wellness Fund',
      default_consultation_fee: '150',
      default_lab_test_fee: '120',
      default_pharmacy_item_fee: '35',
      default_treatment_room_fee: '100',
      refund_admin_fee_percent: '30',
      min_months_before_refund: '3',
      credit_period_days: '30',
      late_interest_percent_monthly: '1.5',
      suspend_discount_on_outstanding: 'yes',
      exclude_pharmacy: 'yes',
      exclude_outsourced: 'yes',
      excluded_service_codes: '',
      corporate_signup_enabled: 'yes',
      corporate_signup_url: '/wellness-fund/corporate',
      corp_a_threshold_1: '500000',
      corp_a_discount_1: '8',
      corp_a_threshold_2: '1000000',
      corp_a_discount_2: '10',
      corp_b_threshold_1: '500000',
      corp_b_discount_1: '7.5',
      corp_b_threshold_2: '1000000',
      corp_b_discount_2: '9',
      corp_c_discount: '11',
    }
  }

  return {}
}

function deleteStoredLogo(relativePath: string | null | undefined): void {
  if (!relativePath) return
  try {
    unlinkSync(app.makePath('public/storage', relativePath))
  } catch {
    // File may already be gone; ignore.
  }
}

export default class SettingsController {
  async index({ inertia }: HttpContext) {
    const definition = schema()

    const rows = await SystemSetting.all()
    const saved: Record<string, Record<string, string | null>> = {}
    for (const row of rows) {
      saved[row.group] ??= {}
      saved[row.group][row.key] = row.value
    }

    const groups: Record<
      string,
      GroupMeta & {
        fields: Record<string, FieldMeta & { value: string; previewUrl?: string | null }>
      }
    > = {}

    for (const [group, meta] of Object.entries(definition)) {
      const current = saved[group] ?? {}
      const defaults = await effectiveDefaults(group)
      const fields: Record<string, FieldMeta & { value: string; previewUrl?: string | null }> = {}

      for (const [key, field] of Object.entries(meta.fields)) {
        if (field.type === 'file' && key === 'logo') {
          const logoPath = current.logo_path ?? null
          const previewUrl = logoPath
            ? logoPath.startsWith('/')
              ? logoPath
              : `/storage/${logoPath}`
            : '/images/app-icon.png'
          fields[key] = {
            ...field,
            value: logoPath ?? '',
            previewUrl,
          }
          continue
        }

        const savedValue = current[key]
        fields[key] = {
          ...field,
          value: savedValue !== null && savedValue !== undefined && savedValue !== '' ? savedValue : (defaults[key] ?? ''),
        }
      }

      groups[group] = { ...meta, fields }
    }

    return inertia.render('settings/index', { groups })
  }

  async update({ params, request, response, session }: HttpContext) {
    const definition = schema()
    const group = String(params.group)

    if (!(group in definition)) {
      session.flash('error', 'Unknown settings group.')
      return response.redirect().back()
    }

    const allowed = Object.keys(definition[group].fields).filter((key) => definition[group].fields[key].type !== 'file')
    const data = request.only(allowed) as Record<string, string | null>

    for (const key of allowed) {
      if (!(key in data)) continue
      await SystemSetting.updateOrCreate({ group, key }, { value: data[key] ?? null })
    }

    if (group === 'clinic') {
      await this.handleClinicLogo(request)
      ClinicSettings.clearCache()
    }

    session.flash('success', 'Settings saved.')
    return response.redirect().back()
  }

  private async handleClinicLogo(request: HttpContext['request']): Promise<void> {
    const removeLogo = Boolean(request.input('remove_logo', false))
    const existing = await SystemSetting.query().where('group', 'clinic').where('key', 'logo_path').first()

    if (removeLogo) {
      deleteStoredLogo(existing?.value)
      await SystemSetting.updateOrCreate({ group: 'clinic', key: 'logo_path' }, { value: null })
      return
    }

    const logo = request.file('logo', {
      size: '2mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    })

    if (!logo) return

    if (!logo.isValid) {
      return
    }

    const dir = app.makePath('public/storage/clinic-branding')
    mkdirSync(dir, { recursive: true })
    const fileName = `${randomUUID()}.${logo.extname}`
    await logo.move(dir, { name: fileName, overwrite: true })

    deleteStoredLogo(existing?.value)
    await SystemSetting.updateOrCreate(
      { group: 'clinic', key: 'logo_path' },
      { value: `clinic-branding/${fileName}` }
    )
  }
}
