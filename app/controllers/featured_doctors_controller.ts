import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import FeaturedDoctor from '#models/featured_doctor'
import { round2 } from '#support/money_helpers'

/**
 * Featured doctor management for the patient portal.
 * Ported from App\Http\Controllers\FeaturedDoctorController.
 *
 * NOTE: the Laravel version accepted an uploaded `photo` file and ran it through
 * App\Services\Images\ProfilePhotoOptimizer (writing `photo_path`). That image
 * pipeline has no Adonis equivalent yet, so file uploads are not processed here —
 * only the `photo_url` field is supported. This is a deliberate stub (see return).
 */
const doctorValidator = vine.compile(
  vine.object({
    name: vine.string().trim().maxLength(120),
    specialty: vine.string().trim().maxLength(120),
    bio: vine.string().trim().maxLength(5000).nullable().optional(),
    rating: vine.number().min(0).max(5),
    patients_count: vine.number().min(0).nullable().optional(),
    years_experience: vine.number().min(0).max(80).nullable().optional(),
    review_count: vine.number().min(0).nullable().optional(),
    session_fee: vine.number().min(0).nullable().optional(),
    photo_url: vine.string().trim().url().maxLength(500).nullable().optional(),
    sort_order: vine.number().min(0).nullable().optional(),
    is_active: vine.boolean().optional(),
  })
)

export default class FeaturedDoctorsController {
  async index({ inertia }: HttpContext) {
    const doctors = await FeaturedDoctor.query().orderBy('sortOrder').orderBy('id')

    return inertia.render('featured-doctors/index', {
      doctors: doctors.map((d) => ({
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        bio: d.bio,
        rating: Number(d.rating),
        patientsCount: d.patientsCount,
        yearsExperience: d.yearsExperience,
        reviewCount: d.reviewCount,
        sessionFee: d.sessionFee !== null ? Number(d.sessionFee) : null,
        photoUrl: d.photoUrl,
        photoPath: d.photoPath,
        sortOrder: d.sortOrder,
        isActive: d.isActive,
      })),
    })
  }

  async store({ request, response, session }: HttpContext) {
    const data = await request.validateUsing(doctorValidator)
    await FeaturedDoctor.create(this.attributes(data))

    session.flash('success', 'Doctor created.')
    return response.redirect().toPath('/featured-doctors')
  }

  async update({ params, request, response, session }: HttpContext) {
    const doctor = await FeaturedDoctor.findOrFail(params.featured_doctor)
    const data = await request.validateUsing(doctorValidator)

    doctor.merge(this.attributes(data))
    await doctor.save()

    session.flash('success', 'Doctor updated.')
    return response.redirect().toPath('/featured-doctors')
  }

  async destroy({ params, response, session }: HttpContext) {
    const doctor = await FeaturedDoctor.findOrFail(params.featured_doctor)
    await doctor.delete()

    session.flash('success', 'Doctor deleted.')
    return response.redirect().toPath('/featured-doctors')
  }

  private attributes(data: {
    name: string
    specialty: string
    bio?: string | null
    rating: number
    patients_count?: number | null
    years_experience?: number | null
    review_count?: number | null
    session_fee?: number | null
    photo_url?: string | null
    sort_order?: number | null
    is_active?: boolean
  }): Record<string, any> {
    return {
      name: data.name,
      specialty: data.specialty,
      bio: data.bio ?? null,
      rating: round2(data.rating * 10) / 10,
      patientsCount: data.patients_count ?? null,
      yearsExperience: data.years_experience ?? null,
      reviewCount: data.review_count ?? null,
      sessionFee: data.session_fee !== undefined && data.session_fee !== null ? round2(data.session_fee) : null,
      photoUrl: data.photo_url ?? null,
      sortOrder: Math.trunc(data.sort_order ?? 0),
      isActive: data.is_active ?? false,
    }
  }
}
