import User from '#models/user'

/**
 * Portal doctors catalog. Ported from App\Support\Portal\PortalDoctorsCatalog +
 * User::toPortalDoctorArray(). Lists staff flagged `is_portal_bookable` for the
 * patient-facing "our doctors" directory and appointment booking.
 *
 * NOTE (PORT-GAP): the Laravel version localizes labels via PortalStaffLocalizer
 * and derives a headline/primary-role label. Those niceties are omitted here;
 * the core fields the portal UI needs are preserved.
 */
export type PortalDoctor = {
  id: number
  name: string
  title: string | null
  specialty: string | null
  role: string | null
  roles: string[]
  headline: string | null
  rating: number | null
  patients_count: number | null
  years_experience: number | null
  review_count: number | null
  session_fee: string | null
  photo_url: string | null
  bio: string | null
}

function headline(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default class PortalDoctorsCatalog {
  private toArray(user: User, roleNames: string[]): PortalDoctor {
    const roles = roleNames.map(headline)

    return {
      id: user.id,
      name: user.name,
      title: user.title ? user.title.trim() : null,
      specialty: user.specialty ? user.specialty.trim() : null,
      role: roles[0] ?? null,
      roles,
      headline: user.specialty ? user.specialty.trim() : (roles[0] ?? null),
      rating: user.rating !== null && user.rating !== undefined ? Number(user.rating) : null,
      patients_count: user.patientsCount ?? null,
      years_experience: user.yearsExperience ?? null,
      review_count: user.reviewCount ?? null,
      session_fee:
        user.sessionFee !== null && user.sessionFee !== undefined
          ? Number(user.sessionFee).toFixed(2)
          : null,
      photo_url: user.profilePhotoPath ?? null,
      bio: user.bio ? user.bio.trim() : null,
    }
  }

  async allActive(): Promise<PortalDoctor[]> {
    const users = await User.query().where('is_portal_bookable', true).orderBy('name', 'asc')

    const out: PortalDoctor[] = []
    for (const user of users) {
      out.push(this.toArray(user, await user.getRoleNames()))
    }
    return out
  }

  async findActive(id: number): Promise<PortalDoctor | null> {
    const user = await User.query()
      .where('is_portal_bookable', true)
      .where('id', id)
      .first()

    if (!user) return null
    return this.toArray(user, await user.getRoleNames())
  }
}
