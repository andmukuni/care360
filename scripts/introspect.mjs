// Read-only schema introspection for the existing PostgreSQL database.
// Usage: node scripts/introspect.mjs [tableName]
// Reads DB_* from environment (run with: node --env-file=.env scripts/introspect.mjs)
import pg from 'pg'

const { Client } = pg

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: false,
  connectionTimeoutMillis: 15000,
})

const target = process.argv[2]

try {
  await client.connect()
  if (!target) {
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    )
    console.log(`CONNECTED. ${tables.rows.length} tables in public schema:`)
    for (const r of tables.rows) console.log('  ' + r.table_name)
  } else {
    const cols = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default,
              character_maximum_length, numeric_precision, numeric_scale
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [target]
    )
    console.log(`Table ${target}: ${cols.rows.length} columns`)
    for (const c of cols.rows) {
      const len = c.character_maximum_length ? `(${c.character_maximum_length})` : ''
      console.log(
        `  ${c.column_name} :: ${c.data_type}${len} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}${c.column_default ? ' default ' + c.column_default : ''}`
      )
    }
  }
} catch (err) {
  console.error('DB ERROR:', err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
