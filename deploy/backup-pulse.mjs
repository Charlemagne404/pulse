import { mkdir, rename, unlink } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { dirname, join, resolve } from 'node:path'

const databasePath = resolve(process.env.PULSE_DB_PATH || '/var/lib/pulse/pulse.sqlite')
const backupDirectory = resolve(process.env.PULSE_BACKUP_DIR || '/var/backups/pulse')
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const backupPath = join(backupDirectory, `pulse-${timestamp}.sqlite`)
const temporaryPath = `${backupPath}.tmp`

await mkdir(dirname(backupPath), { recursive: true })
await unlink(temporaryPath).catch(() => {})

const database = new DatabaseSync(databasePath, { readOnly: true })
try {
  const escapedPath = temporaryPath.replaceAll("'", "''")
  database.exec(`VACUUM INTO '${escapedPath}'`)
} finally {
  database.close()
}

await rename(temporaryPath, backupPath)
console.log(`Pulse backup created at ${backupPath}`)
