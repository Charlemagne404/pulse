import { appendFile, readFile, stat } from 'node:fs/promises'
import type { StoredPulseEvent } from './types.js'

export interface FileEventSnapshot {
  events: StoredPulseEvent[]
  eventIds: Set<string>
  invalidLines: number
  duplicateEventIds: number
}

interface SnapshotCacheEntry {
  mtimeMs: number
  size: number
  snapshot: FileEventSnapshot
}

export class FileEventStore {
  private snapshotCache: SnapshotCacheEntry | undefined

  constructor(private readonly sinkPath: string) {}

  async append(events: StoredPulseEvent[]) {
    if (!events.length) {
      return
    }

    const payload = `${events.map((event) => JSON.stringify(event)).join('\n')}\n`
    await appendFile(this.sinkPath, payload, 'utf8')
    this.snapshotCache = undefined
  }

  async readSnapshot(): Promise<FileEventSnapshot> {
    try {
      const stats = await stat(this.sinkPath)

      if (this.snapshotCache && this.snapshotCache.mtimeMs === stats.mtimeMs && this.snapshotCache.size === stats.size) {
        return this.snapshotCache.snapshot
      }

      const raw = await readFile(this.sinkPath, 'utf8')
      const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

      const events: StoredPulseEvent[] = []
      const eventIds = new Set<string>()
      let invalidLines = 0
      let duplicateEventIds = 0

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as StoredPulseEvent
          if (!parsed || typeof parsed !== 'object' || typeof parsed.eventId !== 'string') {
            invalidLines += 1
            continue
          }

          if (eventIds.has(parsed.eventId)) {
            duplicateEventIds += 1
            continue
          }

          eventIds.add(parsed.eventId)
          events.push(parsed)
        } catch {
          invalidLines += 1
        }
      }

      const snapshot = {
        events,
        eventIds,
        invalidLines,
        duplicateEventIds,
      }

      this.snapshotCache = {
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        snapshot,
      }

      return snapshot
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          events: [],
          eventIds: new Set<string>(),
          invalidLines: 0,
          duplicateEventIds: 0,
        }
      }

      throw error
    }
  }

  async readAll() {
    const snapshot = await this.readSnapshot()
    return snapshot.events
  }
}
