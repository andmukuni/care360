import { Transmit } from '@adonisjs/transmit-client'
import { readXsrfToken } from '~/support/xsrf'

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
      beforeSubscribe: attachXsrf,
      beforeUnsubscribe: attachXsrf,
    })
  }

  return instance
}
