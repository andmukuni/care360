import { Transmit } from '@adonisjs/transmit-client'
import { readXsrfToken } from '~/support/xsrf'
import { randomClientId } from '~/support/random_client_id'

let instance: Transmit | null = null

function attachXsrf(request: Request) {
  const token = readXsrfToken()
  if (token) {
    request.headers.set('X-XSRF-TOKEN', token)
  }
}

export function staffTransmit() {
  if (!instance) {
    instance = new Transmit({
      baseUrl: window.location.origin,
      uidGenerator: randomClientId,
      beforeSubscribe: attachXsrf,
      beforeUnsubscribe: attachXsrf,
    })
  }

  return instance
}
