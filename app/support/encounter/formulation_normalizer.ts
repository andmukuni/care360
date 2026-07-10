/**
 * Normalises prescription formulation labels for consistent storage and display.
 * Ported from App\Support\Encounter\FormulationNormalizer.
 *
 * Liquid forms (Syrup, Suspension) are stored and shown as mL to align with
 * screening and pharmacy quantity units.
 */
export class FormulationNormalizer {
  private static readonly LIQUID_TO_ML: Record<string, string> = {
    syrup: 'mL',
    suspension: 'mL',
  }

  static normalize(formulation: string | null | undefined): string | null | undefined {
    if (formulation === null || formulation === undefined || formulation === '') {
      return formulation
    }

    const key = formulation.trim().toLowerCase()

    return this.LIQUID_TO_ML[key] ?? formulation
  }
}
