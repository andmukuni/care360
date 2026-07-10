/*
|--------------------------------------------------------------------------
| JSON API routes (Phase 5)
|--------------------------------------------------------------------------
|
| Token-authenticated APIs ported from routes/api.php:
|   - /api/v1/portal/*  patient mobile app  (patient_api guard)
|   - /api/v1/staff/*   registration desk   (api guard + staffApi)
| These routes are CSRF-exempt (config/shield.ts).
|
| NOTE (throttling): the Laravel routes used `throttle:6,1` (auth) and
| `throttle:60,1` (authenticated). No rate limiter is installed in this Adonis
| app (@adonisjs/limiter is not a dependency), so throttling is DEFERRED. See the
| Phase 5 report — installing @adonisjs/limiter + a throttle middleware is
| required to restore brute-force protection.
|
| NOTE (payments): the mobile-money payment ACTION endpoints (pay/status/otp/
| retry) are owned by start/routes/payments.ts (Phase 6) and are intentionally
| NOT redefined here.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

// Staff desk API
const StaffAuthController = () => import('#controllers/api/staff/staff_auth_controller')
const StaffRegistrationController = () => import('#controllers/api/staff/registration_controller')
const StaffAppointmentController = () => import('#controllers/api/staff/appointment_controller')

// Patient portal mobile API
const AuthController = () => import('#controllers/api/portal/auth_controller')
const DashboardController = () => import('#controllers/api/portal/dashboard_controller')
const DoctorController = () => import('#controllers/api/portal/doctor_controller')
const DependentController = () => import('#controllers/api/portal/dependent_controller')
const NotificationController = () => import('#controllers/api/portal/notification_controller')
const ProfileController = () => import('#controllers/api/portal/profile_controller')
const VisitController = () => import('#controllers/api/portal/visit_controller')
const MedicalRecordController = () => import('#controllers/api/portal/medical_record_controller')
const LabController = () => import('#controllers/api/portal/lab_controller')
const PrescriptionController = () => import('#controllers/api/portal/prescription_controller')
const AppointmentController = () => import('#controllers/api/portal/appointment_controller')
const BillingController = () => import('#controllers/api/portal/billing_controller')
const MembershipController = () => import('#controllers/api/portal/membership_controller')
const DocumentController = () => import('#controllers/api/portal/document_controller')
const RequestController = () => import('#controllers/api/portal/request_controller')
const MessageController = () => import('#controllers/api/portal/message_controller')
const FeedbackController = () => import('#controllers/api/portal/feedback_controller')
const EmergencyController = () => import('#controllers/api/portal/emergency_controller')
const PaymentController = () => import('#controllers/api/portal/payment_controller')

router
  .group(() => {
    /**
     * Patient portal mobile API (v1/portal). portalLocale resolves the request
     * language for localized output.
     */
    router
      .group(() => {
        // Public (no token).
        router.post('/register', [AuthController, 'register'])
        router.post('/login', [AuthController, 'login'])
        router.post('/forgot-password', [AuthController, 'forgotPassword'])
        router.post('/reset-password', [AuthController, 'resetPassword'])

        // Authenticated patient (valid Sanctum token).
        router
          .group(() => {
            // Identity + sign-out: available to pending (awaiting-approval) patients.
            router
              .group(() => {
                router.get('/me', [AuthController, 'me'])
                router.post('/logout', [AuthController, 'logout'])
              })
              .use(middleware.portalApiAuth())

            // Full portal access — requires staff approval (portal_enabled = true).
            router
              .group(() => {
                router.get('/dashboard', [DashboardController, 'index'])
                router.get('/visit-status', [DashboardController, 'visitStatus'])

                router.get('/doctors', [DoctorController, 'index'])
                router.get('/doctors/:doctor/availability', [DoctorController, 'availability'])
                router.get('/doctors/:doctor', [DoctorController, 'show'])

                router.get('/dependents', [DependentController, 'index'])
                router.post('/dependents', [DependentController, 'store'])
                router.post('/dependents/switch/:dependent', [DependentController, 'switch'])
                router.post('/dependents/clear', [DependentController, 'clear'])

                router.get('/notifications', [NotificationController, 'index'])
                router.post('/notifications/:notification/read', [NotificationController, 'markRead'])
                router.post('/notifications/read-all', [NotificationController, 'markAllRead'])

                router.get('/profile', [ProfileController, 'show'])
                router.put('/profile/contact', [ProfileController, 'updateContact'])
                router.put('/profile/next-of-kin', [ProfileController, 'updateNextOfKin'])
                router.put('/profile/password', [ProfileController, 'updatePassword'])
                router.post('/profile/photo', [ProfileController, 'updatePhoto'])
                router.delete('/profile/photo', [ProfileController, 'removePhoto'])

                router.get('/visits', [VisitController, 'index'])
                router.get('/visits/:encounter', [VisitController, 'show'])

                router.get('/records/summary', [MedicalRecordController, 'summary'])
                router.get('/medical-history', [MedicalRecordController, 'medicalHistory'])
                router.get('/lab-requests', [MedicalRecordController, 'labRequests'])
                router.get('/lab-requests/:labRequest', [MedicalRecordController, 'labRequestShow'])
                router.get('/admissions', [MedicalRecordController, 'admissions'])

                router.get('/lab-results', [LabController, 'index'])
                router.get('/lab-results/:labResult', [LabController, 'show'])
                router.get('/lab-results/:labResult/report', [LabController, 'report'])

                router.get('/prescriptions', [PrescriptionController, 'index'])
                router.get('/prescriptions/:prescription', [PrescriptionController, 'show'])

                router.get('/appointments', [AppointmentController, 'index'])
                router.get('/appointments/options', [AppointmentController, 'options'])
                router.post('/appointments', [AppointmentController, 'store'])
                router.get('/appointments/:appointment', [AppointmentController, 'show'])
                router.put('/appointments/:appointment', [AppointmentController, 'update'])
                router.post('/appointments/:appointment/cancel', [AppointmentController, 'cancel'])

                router.get('/billing', [BillingController, 'index'])
                router.get('/billing/invoices', [BillingController, 'invoices'])
                router.get('/billing/invoices/:invoice', [BillingController, 'showInvoice'])
                router.get('/billing/payments', [BillingController, 'payments'])
                router.get('/billing/payments/:payment/receipt', [BillingController, 'receipt'])

                // Mobile-money payment actions (Phase 8 reconciliation).
                //
                // The mobile app calls these under /api/v1/portal/* (matching the
                // Laravel routes/api.php names payments.pay/index/status/otp/retry).
                // Phase 6 mounted equivalent handlers at /portal/* in
                // start/routes/payments.ts; those are intentionally LEFT IN PLACE.
                // These canonical /api/v1/portal/* routes delegate to the api portal
                // PaymentController (which reuses the Phase 6 MobileMoneyPaymentService).
                router.post('/billing/invoices/:invoice/pay', [PaymentController, 'pay'])
                router.get('/payments', [PaymentController, 'index'])
                router.get('/payments/:collection', [PaymentController, 'status'])
                router.post('/payments/:collection/otp', [PaymentController, 'submitOtp'])
                router.post('/payments/:collection/retry', [PaymentController, 'retry'])

                router.get('/memberships', [MembershipController, 'index'])
                router.get('/memberships/corporate', [MembershipController, 'corporate'])
                router.post('/memberships/corporate', [MembershipController, 'storeCorporateLead'])
                router.post('/memberships/:plan/enroll', [MembershipController, 'enroll'])
                router.post('/memberships/:plan/subscribe', [MembershipController, 'subscribe'])
                router.post('/memberships/top-up', [MembershipController, 'topUp'])
                router.get('/memberships/ledger', [MembershipController, 'ledger'])
                router.get('/memberships/subscriptions/:subscription/cancel-preview', [MembershipController, 'cancelPreview'])
                router.post('/memberships/subscriptions/:subscription/cancel', [MembershipController, 'cancel'])
                router.post('/memberships/invoices/:invoice/checkout', [MembershipController, 'checkout'])
                router.post('/memberships/invoices/:invoice/sandbox/confirm', [MembershipController, 'sandboxConfirm'])

                router.get('/documents', [DocumentController, 'index'])
                router.post('/documents', [DocumentController, 'store'])
                router.get('/documents/:document/download', [DocumentController, 'download'])

                router.get('/requests', [RequestController, 'index'])
                router.post('/requests', [RequestController, 'store'])

                router.get('/messages', [MessageController, 'index'])
                router.post('/messages', [MessageController, 'store'])

                router.post('/feedback', [FeedbackController, 'store'])

                router.get('/emergency-services', [EmergencyController, 'index'])
                router.post('/emergency-services/:emergencyService/call', [EmergencyController, 'logCall'])
              })
              .use(middleware.portalApiActive())
          })
          .use(middleware.auth({ guards: ['patient_api'] }))
      })
      .prefix('v1/portal')
      .use(middleware.portalLocale())

    /**
     * Staff registration-desk API (v1/staff). Token auth via the `api` guard.
     */
    router
      .group(() => {
        router.post('/auth/login', [StaffAuthController, 'login'])
        router.post('/login', [StaffAuthController, 'login'])

        router
          .group(() => {
            router.get('/auth/me', [StaffAuthController, 'me'])
            router.get('/me', [StaffAuthController, 'me'])
            router.post('/auth/logout', [StaffAuthController, 'logout'])
            router.post('/logout', [StaffAuthController, 'logout'])

            router.get('/reference', [StaffRegistrationController, 'reference'])

            router
              .group(() => {
                router.get('/lookup', [StaffRegistrationController, 'lookup'])
                router.get('/patients', [StaffRegistrationController, 'patients'])
                router.get('/patients/search', [StaffRegistrationController, 'search'])
                router.get('/households', [StaffRegistrationController, 'households'])
                router.get('/households/search', [StaffRegistrationController, 'searchHouseholds'])
                router.get('/households/:ref', [StaffRegistrationController, 'householdShow'])
              })
              .use(middleware.permissionOrLegacy({ permissions: 'registration.search-patient' }))

            router
              .get('/queue', [StaffRegistrationController, 'stageQueue'])
              .use(middleware.permissionOrLegacy({ permissions: 'registration.view-queue|triage.view-queue' }))
            router
              .get('/triage/queue', [StaffRegistrationController, 'stageQueue'])
              .use(middleware.permissionOrLegacy({ permissions: 'registration.view-queue|triage.view-queue' }))

            router
              .get('/appointments', [StaffAppointmentController, 'index'])
              .use(middleware.permissionOrLegacy({ permissions: 'patients.read' }))
            router
              .get('/appointments/:appointment', [StaffAppointmentController, 'show'])
              .use(middleware.permissionOrLegacy({ permissions: 'patients.read' }))
            router
              .post('/appointments/:appointment/confirm', [StaffAppointmentController, 'confirm'])
              .use(middleware.permissionOrLegacy({ permissions: 'patients.write' }))
            router
              .post('/appointments/:appointment/decline', [StaffAppointmentController, 'decline'])
              .use(middleware.permissionOrLegacy({ permissions: 'patients.write' }))
            router
              .post('/appointments/:appointment/queue', [StaffAppointmentController, 'checkIn'])
              .use(middleware.permissionOrLegacy({ permissions: 'registration.create-encounter' }))

            router
              .get('/portal-registrations', [StaffRegistrationController, 'portalRegistrations'])
              .use(middleware.permissionOrLegacy({ permissions: 'patients.read' }))
            router
              .post('/portal-registrations/:ref/approve', [StaffRegistrationController, 'approvePortalRegistration'])
              .use(middleware.permissionOrLegacy({ permissions: 'patients.manage-portal' }))
            router
              .post('/portal-registrations/:ref/decline', [StaffRegistrationController, 'declinePortalRegistration'])
              .use(middleware.permissionOrLegacy({ permissions: 'patients.manage-portal' }))

            router
              .post('/encounters/start', [StaffRegistrationController, 'startAndQueue'])
              .use(middleware.permissionOrLegacy({ permissions: 'registration.create-encounter|registration.queue-to-triage' }))
          })
          .use([middleware.auth({ guards: ['api'] }), middleware.staffApi()])
      })
      .prefix('v1/staff')
  })
  .prefix('/api')
