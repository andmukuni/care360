// Read-only full-schema dump -> writes scripts/schema.json for model generation.
// Run: node --env-file=.env scripts/dump-schema.mjs
import pg from 'pg'
import { writeFileSync } from 'node:fs'

const { Client } = pg
const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionTimeoutMillis: 15000,
})

await client.connect()

const cols = await client.query(
  `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default,
          character_maximum_length, numeric_precision, numeric_scale, ordinal_position
   FROM information_schema.columns
   WHERE table_schema = 'public'
   ORDER BY table_name, ordinal_position`
)

const fks = await client.query(
  `SELECT tc.table_name, kcu.column_name,
          ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
   FROM information_schema.table_constraints tc
   JOIN information_schema.key_column_usage kcu
     ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
   JOIN information_schema.constraint_column_usage ccu
     ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
   WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
   ORDER BY tc.table_name`
)

const schema = {}
for (const c of cols.rows) {
  ;(schema[c.table_name] ||= { columns: [], fks: [] }).columns.push(c)
}
for (const f of fks.rows) {
  if (schema[f.table_name]) schema[f.table_name].fks.push(f)
}

writeFileSync(new URL('./schema.json', import.meta.url), JSON.stringify(schema, null, 2))
console.log(`Wrote schema.json: ${Object.keys(schema).length} tables`)
await client.end()
