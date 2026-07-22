import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import { randomUUID } from 'node:crypto'
import MedicalDictionaryTerm, { type DictionaryDomain } from '#models/medical_dictionary_term'
import MedicalDictionaryService from '#services/clinical/medical_dictionary_service'
import type User from '#models/user'

const DOMAINS: DictionaryDomain[] = ['diagnosis', 'drug', 'lab', 'symptom']

function parseDomain(raw: unknown): DictionaryDomain | null {
  const value = String(raw ?? '').trim()
  return DOMAINS.includes(value as DictionaryDomain) ? (value as DictionaryDomain) : null
}

export default class MedicalDictionaryController {
  /** Catalog browse page */
  async index({ request, inertia, auth }: HttpContext) {
    const qs = request.qs()
    const domain = parseDomain(qs.domain) ?? 'diagnosis'
    const search = qs.search ? String(qs.search).trim() : ''
    const page = Math.max(1, Number(qs.page ?? 1))
    const perPage = 40

    const filters = MedicalDictionaryTerm.query()
      .where('domain', domain)
      .if(search !== '', (q) => {
        const like = `%${search}%`
        q.where((sub) => {
          sub
            .whereILike('label', like)
            .orWhereILike('code', like)
            .orWhereILike('hierarchy_path', like)
            .orWhereILike('synonyms', like)
            .orWhereILike('definition', like)
        })
      })

    // Count without ORDER BY — Postgres rejects aggregates ordered by non-grouped columns (42803).
    const totalRow = await filters.clone().count('* as total').first()
    const total = Number((totalRow as any)?.$extras?.total ?? (totalRow as any)?.total ?? 0)
    const terms = await filters
      .clone()
      .orderBy('label')
      .offset((page - 1) * perPage)
      .limit(perPage)

    const domainCounts: Record<string, number> = {}
    for (const d of DOMAINS) {
      const row = await MedicalDictionaryTerm.query().where('domain', d).count('* as total').first()
      domainCounts[d] = Number((row as any)?.$extras?.total ?? (row as any)?.total ?? 0)
    }

    return inertia.render('dictionary/index', {
      domain,
      search,
      page,
      perPage,
      total,
      domainCounts,
      terms: terms.map((t) => MedicalDictionaryService.serialize(t)),
      canManage: await this.userCanManage(auth.user as User | undefined),
    })
  }

  /** JSON typeahead for clinical forms */
  async search({ request, response }: HttpContext) {
    const qs = request.qs()
    const domain = parseDomain(qs.domain)
    const q = String(qs.q ?? '').trim()
    const limit = Number(qs.limit ?? 20)

    const results = await MedicalDictionaryService.search({
      domain,
      q,
      limit,
      activeOnly: true,
    })

    return response.json({ query: q, domain, count: results.length, results })
  }

  async show({ params, response }: HttpContext) {
    const term = await MedicalDictionaryService.find(Number(params.id))
    if (!term) {
      return response.notFound({ message: 'Term not found' })
    }
    return response.json(term)
  }

  async store({ request, response, session, auth }: HttpContext) {
    const data = await vine.validate({
      schema: vine.object({
        domain: vine.enum(DOMAINS),
        label: vine.string().trim().minLength(1).maxLength(500),
        code: vine.string().trim().maxLength(120).optional().nullable(),
        definition: vine.string().trim().optional().nullable(),
        hierarchy_path: vine.string().trim().maxLength(1000).optional().nullable(),
        synonyms: vine.string().trim().optional().nullable(),
        hia_code: vine.string().trim().maxLength(80).optional().nullable(),
        is_active: vine.boolean().optional(),
      }),
      data: request.all(),
    })

    const term = new MedicalDictionaryTerm()
    term.domain = data.domain
    term.label = data.label
    term.code = data.code ?? null
    term.definition = data.definition ?? null
    term.hierarchyPath = data.hierarchy_path ?? null
    term.hiaCode = data.hia_code ?? null
    term.source = 'manual'
    term.sourceId = `manual:${randomUUID()}`
    term.isActive = data.is_active !== false
    term.updatedBy = auth.user?.id ?? null
    term.setSynonymList(
      (data.synonyms ?? '')
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
    await term.save()

    session.flash('success', 'Dictionary term created.')
    return response.redirect().toPath(`/dictionary?domain=${term.domain}`)
  }

  async update({ params, request, response, session, auth }: HttpContext) {
    const term = await MedicalDictionaryTerm.findOrFail(params.id)
    const data = await vine.validate({
      schema: vine.object({
        label: vine.string().trim().minLength(1).maxLength(500),
        code: vine.string().trim().maxLength(120).optional().nullable(),
        definition: vine.string().trim().optional().nullable(),
        hierarchy_path: vine.string().trim().maxLength(1000).optional().nullable(),
        synonyms: vine.string().trim().optional().nullable(),
        hia_code: vine.string().trim().maxLength(80).optional().nullable(),
        is_active: vine.boolean().optional(),
      }),
      data: request.all(),
    })

    term.label = data.label
    term.code = data.code ?? null
    term.definition = data.definition ?? null
    term.hierarchyPath = data.hierarchy_path ?? null
    term.hiaCode = data.hia_code ?? null
    term.isActive = data.is_active !== false
    term.updatedBy = auth.user?.id ?? null
    term.setSynonymList(
      (data.synonyms ?? '')
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
    await term.save()

    session.flash('success', 'Dictionary term updated.')
    return response.redirect().toPath(`/dictionary?domain=${term.domain}&search=${encodeURIComponent(term.label)}`)
  }

  async destroy({ params, response, session }: HttpContext) {
    const term = await MedicalDictionaryTerm.findOrFail(params.id)
    const domain = term.domain
    if (term.source === 'manual') {
      await term.delete()
      session.flash('success', 'Term deleted.')
    } else {
      term.isActive = false
      await term.save()
      session.flash('success', 'Synced term deactivated (source sync can restore it).')
    }
    return response.redirect().toPath(`/dictionary?domain=${domain}`)
  }

  async sync({ response, session }: HttpContext) {
    const result = await MedicalDictionaryService.syncAll()
    session.flash(
      'success',
      `Dictionary synced — ICD-11: ${result.icd11}, NTG: ${result.ntg}, drugs: ${result.medications}, lab: ${result.lab}, symptoms: ${result.symptoms}.`
    )
    return response.redirect().back()
  }

  private async userCanManage(user: User | null | undefined) {
    if (!user) return false
    return user.hasAnyPermission(['settings.manage', 'medications.write', 'test-types.write'])
  }
}
