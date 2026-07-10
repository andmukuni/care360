// Generates Lucid models from scripts/schema.json.
// Relationships are inferred from Laravel naming conventions (*_id -> belongsTo,
// *_by -> belongsTo User) because the production PostgreSQL database only
// defines 12 real FK constraints. Run: node scripts/generate-models.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const schema = JSON.parse(readFileSync(new URL('./schema.json', import.meta.url)))
const outDir = new URL('../app/models/', import.meta.url)
mkdirSync(outDir, { recursive: true })

const SKIP = new Set([
  'migrations',
  'cache',
  'cache_locks',
  'jobs',
  'job_batches',
  'failed_jobs',
  'sessions',
  'password_reset_tokens',
  'patient_password_reset_tokens',
  'personal_access_tokens',
  'model_has_permissions',
  'model_has_roles',
  'role_has_permissions',
  'medication_unit',
])
const isBackup = (t) => /_backup_/.test(t)
const HAND_WRITTEN = new Set(['users'])

function singular(word) {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('sses')) return word.slice(0, -2)
  if (word.endsWith('ss')) return word
  if (['catalog', 'data', 'status'].includes(word)) return word
  if (word.endsWith('s')) return word.slice(0, -1)
  return word
}
function pascal(str) {
  const parts = str.split('_')
  return parts
    .map((w, i) => {
      const part = i === parts.length - 1 ? singular(w) : w
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('')
}
function camelKeep(str) {
  const parts = str.split('_')
  return parts.map((w, i) => (i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('')
}
function fileName(table) {
  const parts = table.split('_')
  parts[parts.length - 1] = singular(parts[parts.length - 1])
  return parts.join('_')
}
function singularJoined(table) {
  const parts = table.split('_')
  parts[parts.length - 1] = singular(parts[parts.length - 1])
  return parts.join('_')
}

// Model name + stem lookup ---------------------------------------------------
const modelName = { users: 'User' }
const stemToTable = { user: 'users', users: 'users' }
for (const table of Object.keys(schema)) {
  if (SKIP.has(table) || isBackup(table)) continue
  modelName[table] = pascal(table)
  stemToTable[singularJoined(table)] = table
  stemToTable[table] = table
}

function tsType(col) {
  const t = col.data_type
  if (t === 'boolean') return 'boolean'
  if (['integer', 'bigint', 'smallint'].includes(t)) return 'number'
  if (['numeric', 'double precision', 'real'].includes(t)) return 'number'
  if (['json', 'jsonb'].includes(t)) return 'Record<string, any> | any[]'
  if (['date', 'timestamp without time zone', 'timestamp with time zone'].includes(t))
    return 'DateTime'
  return 'string'
}
function columnDecorator(col, isPk) {
  const t = col.data_type
  if (t === 'date') return `@column.date(${isPk ? '{ isPrimary: true }' : ''})`
  if (t.startsWith('timestamp')) {
    if (col.column_name === 'created_at') return `@column.dateTime({ autoCreate: true })`
    if (col.column_name === 'updated_at')
      return `@column.dateTime({ autoCreate: true, autoUpdate: true })`
    return `@column.dateTime(${isPk ? '{ isPrimary: true }' : ''})`
  }
  const opts = []
  if (isPk) opts.push('isPrimary: true')
  if (['json', 'jsonb'].includes(t)) opts.push('prepare: (v: any) => (v === null ? null : JSON.stringify(v))')
  return `@column(${opts.length ? `{ ${opts.join(', ')} }` : ''})`
}

// Pass 1: compute belongsTo relationships per table --------------------------
const belongsToMap = {} // table -> [{ column, relatedTable, propName }]
const hasManyMap = {} // relatedTable -> [{ owningTable, column }]

for (const [table, def] of Object.entries(schema)) {
  if (!modelName[table]) continue
  belongsToMap[table] = []
  const seenCols = new Set()

  // Real DB FKs take priority (accurate)
  for (const fk of def.fks) {
    if (!modelName[fk.foreign_table] || seenCols.has(fk.column_name)) continue
    belongsToMap[table].push({ column: fk.column_name, relatedTable: fk.foreign_table })
    seenCols.add(fk.column_name)
  }

  // Convention-based inference
  for (const col of def.columns) {
    const name = col.column_name
    if (seenCols.has(name) || name === 'id') continue
    let relatedTable = null
    if (name.endsWith('_id')) {
      const stem = name.slice(0, -3)
      relatedTable = stemToTable[stem] || null
    } else if (name.endsWith('_by')) {
      relatedTable = 'users' // *_by columns reference staff users
    } else if (name === 'user_id' || name === 'staff_id') {
      relatedTable = 'users'
    }
    if (relatedTable && modelName[relatedTable]) {
      belongsToMap[table].push({ column: name, relatedTable })
      seenCols.add(name)
    }
  }

  // Register reverse hasMany
  for (const rel of belongsToMap[table]) {
    ;(hasManyMap[rel.relatedTable] ||= []).push({ owningTable: table, column: rel.column })
  }
}

// Pass 2: emit models --------------------------------------------------------
function relNameFromColumn(column, relatedTable) {
  if (column.endsWith('_id')) return camelKeep(column.slice(0, -3))
  if (column.endsWith('_by')) {
    // started_by -> startedByUser (avoids clashing with the scalar `startedBy`)
    const suffix = relatedTable === 'users' ? 'User' : pascal(singularJoined(relatedTable))
    return camelKeep(column) + suffix
  }
  return camelKeep(singularJoined(relatedTable))
}

for (const [table, def] of Object.entries(schema)) {
  if (!modelName[table] || HAND_WRITTEN.has(table)) continue
  const cls = modelName[table]
  const usesSoftDelete = def.columns.some((c) => c.column_name === 'deleted_at')
  const needsDateTime = def.columns.some(
    (c) => c.data_type === 'date' || c.data_type.startsWith('timestamp')
  )

  const imports = new Set(['BaseModel', 'column'])
  const typeImports = new Set()
  const usedProps = new Set()
  const colLines = []

  for (const col of def.columns) {
    if (usesSoftDelete && col.column_name === 'deleted_at') continue
    const isPk = col.column_name === 'id'
    const prop = camelKeep(col.column_name)
    usedProps.add(prop)
    const nullable = col.is_nullable === 'YES'
    const type = tsType(col)
    let dec = columnDecorator(col, isPk)
    colLines.push(`  ${dec}`)
    colLines.push(`  declare ${prop}: ${type}${nullable ? ' | null' : ''}`)
    colLines.push('')
  }

  const relLines = []
  const related = new Set()

  for (const rel of belongsToMap[table] || []) {
    const relatedCls = modelName[rel.relatedTable]
    let name = relNameFromColumn(rel.column, rel.relatedTable)
    let base = name
    let n = 1
    while (usedProps.has(name)) name = base + ++n
    usedProps.add(name)
    imports.add('belongsTo')
    typeImports.add('BelongsTo')
    relLines.push(`  @belongsTo(() => ${relatedCls}, { foreignKey: '${camelKeep(rel.column)}' })`)
    relLines.push(`  declare ${name}: BelongsTo<typeof ${relatedCls}>`)
    relLines.push('')
    if (rel.relatedTable !== table) related.add(rel.relatedTable)
  }

  for (const rev of hasManyMap[table] || []) {
    if (rev.owningTable === table) continue
    const ownerCls = modelName[rev.owningTable]
    let name = camelKeep(rev.owningTable)
    // disambiguate multiple relations to same owner by suffixing the column stem
    let suffix = ''
    if (rev.column !== 'id' && !rev.column.endsWith('_id')) {
      suffix = pascal(rev.column) // e.g. startedBy -> StartedBy
    }
    let candidate = suffix ? camelKeep(rev.owningTable) + suffix : name
    let base = candidate
    let k = 1
    while (usedProps.has(candidate)) candidate = base + ++k
    usedProps.add(candidate)
    imports.add('hasMany')
    typeImports.add('HasMany')
    relLines.push(`  @hasMany(() => ${ownerCls}, { foreignKey: '${camelKeep(rev.column)}' })`)
    relLines.push(`  declare ${candidate}: HasMany<typeof ${ownerCls}>`)
    relLines.push('')
    related.add(rev.owningTable)
  }

  related.delete(table)

  const header = []
  if (needsDateTime) header.push(`import { DateTime } from 'luxon'`)
  if (usesSoftDelete) header.push(`import { compose } from '@adonisjs/core/helpers'`)
  header.push(`import { ${[...imports].sort().join(', ')} } from '@adonisjs/lucid/orm'`)
  if (typeImports.size)
    header.push(
      `import type { ${[...typeImports].sort().join(', ')} } from '@adonisjs/lucid/types/relations'`
    )
  if (usesSoftDelete) header.push(`import { SoftDeletes } from '../mixins/soft_deletes.js'`)
  for (const r of [...related].sort()) {
    if (r === 'users') header.push(`import User from './user.js'`)
    else header.push(`import ${modelName[r]} from './${fileName(r)}.js'`)
  }

  const extendsClause = usesSoftDelete
    ? `export default class ${cls} extends compose(BaseModel, SoftDeletes) {`
    : `export default class ${cls} extends BaseModel {`

  const body = [
    header.join('\n'),
    '',
    extendsClause,
    `  static table = '${table}'`,
    '',
    ...colLines,
    ...relLines,
    '}',
    '',
  ].join('\n')

  writeFileSync(new URL(`./${fileName(table)}.ts`, outDir), body)
}

const count = Object.keys(modelName).filter((t) => !HAND_WRITTEN.has(t)).length
console.log(`Generated ${count} models`)
