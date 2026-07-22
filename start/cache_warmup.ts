/**
 * Fire-and-forget warm-up of reference-data catalogs on application boot.
 */
if (process.env.NODE_ENV !== 'test') {
  const ReferenceDataCache = (await import('#services/cache/reference_data_cache')).default
  // Do not await — a hung DB/Redis call must not block HTTP server boot.
  void ReferenceDataCache.warmCatalogs().catch(() => {
    // Warm-up is best-effort; cold cache will populate on first request.
  })
}
