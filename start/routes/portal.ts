/*
|--------------------------------------------------------------------------
| Patient portal web routes (Phase 5)
|--------------------------------------------------------------------------
|
| Session-authenticated patient portal routes ported from the Laravel
| Portal\* controllers (routes/web.php `/portal` group). Guard `patient` +
| portalActive middleware. Portal auth routes (login/forgot/reset/logout) live
| in start/routes/auth.ts and are NOT redefined here.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const PatientDashboardController = () => import('#controllers/portal/patient_dashboard_controller')
const PatientDoctorController = () => import('#controllers/portal/patient_doctor_controller')
const PatientProfileController = () => import('#controllers/portal/patient_profile_controller')
const PatientVisitController = () => import('#controllers/portal/patient_visit_controller')
const PatientMedicalRecordController = () =>
  import('#controllers/portal/patient_medical_record_controller')
const PatientAppointmentController = () =>
  import('#controllers/portal/patient_appointment_controller')
const PatientBillingController = () => import('#controllers/portal/patient_billing_controller')
const PatientMembershipController = () => import('#controllers/portal/patient_membership_controller')
const PatientDocumentController = () => import('#controllers/portal/patient_document_controller')
const PatientRequestController = () => import('#controllers/portal/patient_request_controller')
const PatientMessageController = () => import('#controllers/portal/patient_message_controller')
const PatientFeedbackController = () => import('#controllers/portal/patient_feedback_controller')
const PatientEmergencyController = () => import('#controllers/portal/patient_emergency_controller')
const PatientDependentController = () => import('#controllers/portal/patient_dependent_controller')
const PatientNotificationController = () =>
  import('#controllers/portal/patient_notification_controller')

router
  .group(() => {
    // Dashboard + live visit status
    router.get('/', [PatientDashboardController, 'home']).as('home')
    router.get('/visit-status', [PatientDashboardController, 'visitStatus']).as('visit-status')
    router.get('/visit-status/poll', [PatientDashboardController, 'visitStatusPoll']).as('visit-status.poll')

    // Doctors
    router.get('/doctors', [PatientDoctorController, 'index']).as('doctors.index')
    router.get('/doctors/:doctor', [PatientDoctorController, 'show']).as('doctors.show')

    // Profile
    router.get('/profile', [PatientProfileController, 'show']).as('profile')
    router.get('/profile/edit', [PatientProfileController, 'edit']).as('profile.edit')
    router.put('/profile', [PatientProfileController, 'updateContact']).as('profile.update')
    router.put('/profile/next-of-kin', [PatientProfileController, 'updateNextOfKin']).as('profile.next-of-kin')
    router.put('/profile/password', [PatientProfileController, 'updatePassword']).as('profile.password')
    router.post('/profile/photo', [PatientProfileController, 'updatePhoto']).as('profile.photo')
    router.delete('/profile/photo', [PatientProfileController, 'removePhoto']).as('profile.photo.remove')

    // Visits
    router.get('/visits', [PatientVisitController, 'index']).as('visits')
    router.get('/visits/:encounter', [PatientVisitController, 'show']).as('visits.show')

    // Medical records
    router.get('/medical-history', [PatientMedicalRecordController, 'medicalHistory']).as('medical-history')
    router.get('/lab', [PatientMedicalRecordController, 'lab']).as('lab')
    router.get('/lab-requests', [PatientMedicalRecordController, 'labRequests']).as('lab-requests')
    router.get('/lab-requests/:labRequest', [PatientMedicalRecordController, 'labRequestShow']).as('lab-requests.show')
    router.get('/lab-results', [PatientMedicalRecordController, 'labResults']).as('lab-results')
    router.get('/lab-results/:labResult/download', [PatientMedicalRecordController, 'downloadLabReport']).as('lab-results.download')
    router.get('/prescriptions', [PatientMedicalRecordController, 'prescriptions']).as('prescriptions')
    router.get('/prescriptions/:prescription', [PatientMedicalRecordController, 'prescriptionShow']).as('prescriptions.show')
    router.get('/admissions', [PatientMedicalRecordController, 'admissions']).as('admissions')

    // Appointments (static segments before the :appointment param)
    router.get('/appointments', [PatientAppointmentController, 'index']).as('appointments.index')
    router.get('/appointments/create', [PatientAppointmentController, 'create']).as('appointments.create')
    router.get('/appointments/available-providers', [PatientAppointmentController, 'availableProviders']).as('appointments.available-providers')
    router.post('/appointments', [PatientAppointmentController, 'store']).as('appointments.store')
    router.get('/appointments/:appointment', [PatientAppointmentController, 'show']).as('appointments.show')
    router.put('/appointments/:appointment', [PatientAppointmentController, 'update']).as('appointments.update')
    router.post('/appointments/:appointment/cancel', [PatientAppointmentController, 'cancel']).as('appointments.cancel')

    // Billing
    router.get('/billing', [PatientBillingController, 'index']).as('billing.index')
    router.get('/billing/invoices/:invoice', [PatientBillingController, 'showInvoice']).as('billing.invoice')
    router.get('/billing/payments/:payment/receipt', [PatientBillingController, 'downloadReceipt']).as('billing.receipt')

    // Memberships
    router.get('/memberships', [PatientMembershipController, 'index']).as('memberships.index')
    router.post('/memberships/:plan/subscribe', [PatientMembershipController, 'subscribe']).as('memberships.subscribe')
    router.post('/memberships/subscriptions/:subscription/cancel', [PatientMembershipController, 'cancel']).as('memberships.cancel')
    router.get('/memberships/sandbox/:invoice', [PatientMembershipController, 'sandbox']).as('memberships.sandbox')
    router.post('/memberships/sandbox/:invoice/confirm', [PatientMembershipController, 'sandboxConfirm']).as('memberships.sandbox.confirm')

    // Documents
    router.get('/documents', [PatientDocumentController, 'index']).as('documents.index')
    router.post('/documents', [PatientDocumentController, 'store']).as('documents.store')
    router.get('/documents/:document/download', [PatientDocumentController, 'download']).as('documents.download')

    // Requests
    router.get('/requests', [PatientRequestController, 'index']).as('requests.index')
    router.post('/requests', [PatientRequestController, 'store']).as('requests.store')

    // Messages
    router.get('/messages', [PatientMessageController, 'index']).as('messages.index')
    router.post('/messages', [PatientMessageController, 'store']).as('messages.store')

    // Feedback
    router.get('/feedback', [PatientFeedbackController, 'index']).as('feedback.index')
    router.post('/feedback', [PatientFeedbackController, 'store']).as('feedback.store')

    // Emergency
    router.get('/emergency', [PatientEmergencyController, 'index']).as('emergency.index')
    router.post('/emergency/:emergencyService/call', [PatientEmergencyController, 'call']).as('emergency.call')

    // Dependents
    router.get('/dependents', [PatientDependentController, 'index']).as('dependents.index')
    router.post('/dependents', [PatientDependentController, 'store']).as('dependents.store')
    router.post('/dependents/switch/:dependent', [PatientDependentController, 'switch']).as('dependents.switch')
    router.post('/dependents/clear', [PatientDependentController, 'clear']).as('dependents.clear')

    // Notifications
    router.get('/notifications', [PatientNotificationController, 'index']).as('notifications')
    router.post('/notifications/:notification/read', [PatientNotificationController, 'markRead']).as('notifications.read')
    router.post('/notifications/read-all', [PatientNotificationController, 'markAllRead']).as('notifications.read-all')
  })
  .prefix('/portal')
  .as('portal')
  .use([middleware.auth({ guards: ['patient'] }), middleware.portalActive()])
