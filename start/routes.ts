/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes. Route groups for the
| staff app, patient portal, and JSON APIs are registered from dedicated
| modules under start/routes/*.
|
*/

import router from '@adonisjs/core/services/router'

const AuthController = () => import('#controllers/auth_controller')

router.get('/', [AuthController, 'home'])

// Feature route groups (added incrementally during the migration).
import './routes/health.js'
import './routes/auth.js'
import './routes/payments.js'
import './routes/staff.js'
import './routes/portal.js'
import './routes/api.js'
import './routes/public.js'
