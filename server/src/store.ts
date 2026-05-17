import { appendFile } from 'node:fs/promises'
import type { StoredPulseEvent } from './types.js'

export class FileEventStore {
  constructor(private readonly sinkPath: string) {}

  async append(events: StoredPulseEvent[]) {
    if (!events.length) {
      return
    }

    const payload = `${events.map((event) => JSON.stringify(event)).join('\n')}\n`
    await appendFile(this.sinkPath, payload, 'utf8')
  }
}
