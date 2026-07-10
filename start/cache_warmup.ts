/**
 * Fire-and-forget warm-up of reference-data catalogs on application boot.
 */
if (process.env.NODE_ENV !== 'test') {
  const ReferenceDataCache = (await import('#services/cache/reference_data_cache')).default
  await ReferenceDataCache.warmCatalogs().catch(() => {
    // Warm-up is best-effort; cold cache will populate on first request.
  })
}
