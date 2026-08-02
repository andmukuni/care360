import pg from 'pg'

/**
 * PostgreSQL BIGINT (OID 20) defaults to string in node-pg to avoid JS precision
 * loss. Clinical-scale primary keys fit safely in Number — parse globally so
 * Lucid models and Inertia props receive numeric ids.
 */
pg.types.setTypeParser(20, (value) => {
  if (value === null) {
    return null
  }
  return Number.parseInt(value, 10)
})
