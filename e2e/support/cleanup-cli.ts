// npm run e2e:cleanup — removes [E2E] leftovers after an interrupted run.
import { cleanUp } from './backend'

cleanUp()
  .then(() => console.log('E2E data and accounts removed.'))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
