import { createPulseServer } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const server = createPulseServer(config)

server.listen(config.port, config.host, () => {
  console.log(`Pulse collector listening on http://${config.host}:${config.port}`)
})
