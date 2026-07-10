import transmit from '@adonisjs/transmit/services/main'
import { middleware } from '#start/kernel'
import type { HttpContext } from '@adonisjs/core/http'

transmit.registerRoutes((route) => {
  route.middleware(middleware.auth())
})

transmit.authorize('staff/queues', (ctx: HttpContext) => {
  return !!ctx.auth.user
})
