/*
|--------------------------------------------------------------------------
| Staff web routes (Phase 4)
|--------------------------------------------------------------------------
|
| Authenticated staff HMS routes ported from routes/web.php (the `web,auth`
| group). The whole group is wrapped in middleware.auth() at the bottom. Write
| routes are gated by the `permissionOrLegacy` named middleware, matching the
| Laravel permission strings.
|
| Route ordering note: literal segments are registered before dynamic `:param`
| routes within each module to avoid the param swallowing the literal.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const UnitsController = () => import('#controllers/units_controller')
const WardsController = () => import('#controllers/wards_controller')
const BedsController = () => import('#controllers/beds_controller')
const AccessoriesController = () => import('#controllers/accessories_controller')
const MedicationsController = () => import('#controllers/medications_controller')
const MedicalDictionaryController = () => import('#controllers/medical_dictionary_controller')
const TestTypesController = () => import('#controllers/test_types_controller')
const PossibleResultsController = () => import('#controllers/possible_results_controller')
const LabResultFormsController = () => import('#controllers/lab_result_forms_controller')
const LabSpecimenTypesController = () => import('#controllers/lab_specimen_types_controller')

const UsersController = () => import('#controllers/users_controller')
const StaffSignatureInviteController = () => import('#controllers/staff_signature_invite_controller')
const AccessControlController = () => import('#controllers/access_control_controller')
const AnnouncementsController = () => import('#controllers/announcements_controller')
const NotificationsController = () => import('#controllers/notifications_controller')
const SettingsController = () => import('#controllers/settings_controller')
const CalendarController = () => import('#controllers/calendar_controller')

const MembershipPlansController = () => import('#controllers/membership_plans_controller')
const RateCardController = () => import('#controllers/rate_card_controller')
const SubscriptionsController = () => import('#controllers/subscriptions_controller')
const FeaturedDoctorsController = () => import('#controllers/featured_doctors_controller')
const HealthTipsController = () => import('#controllers/health_tips_controller')
const EmergencyServicesController = () => import('#controllers/emergency_services_controller')
const PlatformComplaintsController = () => import('#controllers/platform_complaints_controller')
const CorporateLeadsController = () => import('#controllers/corporate_membership_leads_controller')
const AppointmentsController = () => import('#controllers/appointments_controller')
const PatientPortalAdminController = () => import('#controllers/patient_portal_admin_controller')
const PaymentTransactionsController = () => import('#controllers/payment_transactions_controller')

const PatientsController = () => import('#controllers/patients_controller')
const HouseholdsController = () => import('#controllers/households_controller')

const RegistrationController = () => import('#controllers/registration_controller')
const TriageController = () => import('#controllers/triage_controller')
const ScreeningController = () => import('#controllers/screening_controller')
const LabController = () => import('#controllers/lab_controller')
const ScreeningReviewController = () => import('#controllers/screening_review_controller')
const PharmacyController = () => import('#controllers/pharmacy_controller')
const TreatmentRoomController = () => import('#controllers/treatment_room_controller')
const EncountersController = () => import('#controllers/encounters_controller')

const ReportController = () => import('#controllers/report_controller')
const ShiftReportController = () => import('#controllers/shift_report_controller')
const GynObsReportController = () => import('#controllers/gyn_obs_report_controller')
const PresumptiveTbReportController = () => import('#controllers/presumptive_tb_report_controller')
const OpdRegisterController = () => import('#controllers/opd_register_controller')

const perm = (permissions: string) => middleware.permissionOrLegacy({ permissions })

router
  .group(() => {
    // ── Reception kiosk dashboard ──────────────────────────────────────────
    router.get('/reception-dashboard', [AuthController, 'receptionDashboard']).as('reception.dashboard')

    // ── Profile (current user) ─────────────────────────────────────────────
    router.get('/profile', [UsersController, 'profile']).as('profile.show')
    router.get('/profile/edit', [UsersController, 'editProfile']).as('profile.edit')
    router.put('/profile', [UsersController, 'updateProfile']).as('profile.update')
    router
      .post('/profile/signature-invite', [StaffSignatureInviteController, 'createForSelf'])
      .as('profile.signature-invite')
    router
      .delete('/profile/signature', [StaffSignatureInviteController, 'destroyForSelf'])
      .as('profile.signature.destroy')

    // ── Patients ───────────────────────────────────────────────────────────
    router.get('/patients', [PatientsController, 'index']).as('patients.index')
    router.get('/patients/create', [PatientsController, 'create']).as('patients.create')
    router.post('/patients', [PatientsController, 'store']).as('patients.store')
    router.get('/patients/:ref', [PatientsController, 'show']).as('patients.show')
    router.get('/patients/:ref/edit', [PatientsController, 'edit']).as('patients.edit')
    router.put('/patients/:ref', [PatientsController, 'update']).as('patients.update')
    router
      .post('/patients/:ref/portal-invitation', [PatientsController, 'sendPortalInvitation'])
      .as('patients.portal-invitation')
      .use(perm('patients.manage-portal'))
    router
      .put('/patients/:ref/portal-password', [PatientsController, 'updatePortalPassword'])
      .as('patients.portal-password')
      .use(perm('patients.manage-portal'))
    router.get('/patients/:ref/encounters', [PatientsController, 'encounters']).as('patients.encounters')
    router
      .post('/patients/:ref/notifications/read-all', [PatientsController, 'markAllNotificationsRead'])
      .as('patients.notifications.read-all')
    router
      .post('/patients/:ref/notifications/:notification/read', [PatientsController, 'markNotificationRead'])
      .as('patients.notifications.read')

    // ── Patient portal admin (invoices / documents / dependents) ───────────
    router
      .post('/patients/:ref/invoices', [PatientPortalAdminController, 'storeInvoice'])
      .as('patients.invoices.store')
      .use(perm('patients.write'))
    router
      .post('/patients/:ref/documents/:document/approve', [PatientPortalAdminController, 'approveDocument'])
      .as('patients.documents.approve')
      .use(perm('patients.write'))
    router
      .post('/lab-results/:labResult/release-to-patient', [PatientPortalAdminController, 'releaseLabResult'])
      .as('lab-results.release-to-patient')
      .use(perm('lab.update-results'))
    router
      .post('/patients/:ref/dependents', [PatientPortalAdminController, 'storeDependent'])
      .as('patients.dependents.store')
      .use(perm('patients.manage-portal'))

    // ── Appointments (staff) ───────────────────────────────────────────────
    router.get('/appointments', [AppointmentsController, 'index']).as('appointments.index').use(perm('patients.read'))
    router.get('/appointments/:appointment', [AppointmentsController, 'show']).as('appointments.show').use(perm('patients.read'))
    router.put('/appointments/:appointment/confirm', [AppointmentsController, 'confirm']).as('appointments.confirm').use(perm('patients.write'))
    router.put('/appointments/:appointment/decline', [AppointmentsController, 'decline']).as('appointments.decline').use(perm('patients.write'))
    router.post('/appointments/:appointment/queue', [AppointmentsController, 'queue']).as('appointments.queue').use(perm('registration.create-encounter'))

    // ── Patient requests / portal registrations / payment transactions ─────
    router.get('/patient-requests', [PatientPortalAdminController, 'patientRequests']).as('patient-requests.index').use(perm('patients.read'))

    router.get('/payment-transactions', [PaymentTransactionsController, 'index']).as('payment-transactions.index').use(perm('patients.read'))
    router.post('/payment-transactions/:collection/check', [PaymentTransactionsController, 'checkStatus']).as('payment-transactions.check').use(perm('patients.write'))
    router.post('/payment-transactions/:collection/retry', [PaymentTransactionsController, 'retry']).as('payment-transactions.retry').use(perm('patients.write'))

    router.get('/portal-registrations', [PatientPortalAdminController, 'portalRegistrations']).as('portal-registrations.index').use(perm('patients.read'))
    router.post('/portal-registrations/:ref/approve', [PatientPortalAdminController, 'approvePortalRegistration']).as('portal-registrations.approve').use(perm('patients.manage-portal'))
    router.post('/portal-registrations/:ref/decline', [PatientPortalAdminController, 'declinePortalRegistration']).as('portal-registrations.decline').use(perm('patients.manage-portal'))

    // ── Households ─────────────────────────────────────────────────────────
    router.get('/households', [HouseholdsController, 'index']).as('households.index')
    router.get('/households/create', [HouseholdsController, 'create']).as('households.create')
    router.post('/households', [HouseholdsController, 'store']).as('households.store')
    router.post('/households/extract-head-patients', [HouseholdsController, 'extractHeadPatients']).as('households.extract-head-patients')
    router.get('/households/extract-head-patients/:batchId/status', [HouseholdsController, 'extractHeadPatientsStatus']).as('households.extract-head-patients.status')
    router.get('/households/barcodes/print', [HouseholdsController, 'printBarcodes']).as('households.barcodes.print')
    router.post('/households/:ref/extract-head-patient', [HouseholdsController, 'extractHeadPatient']).as('households.extract-head-patient')
    router.post('/households/:ref/members', [HouseholdsController, 'storeMember']).as('households.members.store')
    router.put('/households/:ref/members/:patientRef', [HouseholdsController, 'updateMember']).as('households.members.update')
    router.post('/households/:ref/members/:patientRef/set-head', [HouseholdsController, 'setMemberAsHead']).as('households.members.set-head')
    router.delete('/households/:ref/members/:patientRef', [HouseholdsController, 'removeMember']).as('households.members.remove')
    router.post('/households/:ref/members/:patientRef/transfer', [HouseholdsController, 'transferMember']).as('households.members.transfer')
    router.get('/households/:ref/patients/search', [HouseholdsController, 'searchPatients']).as('households.patients.search')
    router.get('/households/:ref/transfer-households/search', [HouseholdsController, 'searchTransferHouseholds']).as('households.transfer-households.search')
    router.get('/households/:ref', [HouseholdsController, 'show']).as('households.show')

    // ── Registration ───────────────────────────────────────────────────────
    router.get('/registration', [RegistrationController, 'index']).as('registration.index')
    router.get('/registration/search-patient', [RegistrationController, 'searchPatient']).as('registration.search')
    router
      .get('/registration/search-patient/membership', [RegistrationController, 'searchPatientMembership'])
      .as('registration.search.membership')
    router.get('/registration/search-households', [RegistrationController, 'searchHouseholds']).as('registration.households.search')
    router.post('/registration/villages', [RegistrationController, 'addVillage']).as('registration.villages.store')
    router.get('/registration/encounters/:encounter', [RegistrationController, 'showEncounter']).as('registration.encounter')
    router.post('/encounters/start', [RegistrationController, 'start']).as('encounters.start').use(perm('registration.create-encounter'))
    router.post('/encounters/:encounter/queue/triage', [RegistrationController, 'queueToTriage']).as('encounters.queue.triage').use(perm('registration.queue-to-triage'))

    // ── Triage ───────────────────────────────────────────────────────────────
    router.get('/triage/queue', [TriageController, 'queue']).as('triage.queue')
    router.get('/triage/vitals', [TriageController, 'vitals']).as('triage.vitals')
    router.get('/triage/startup-medications', [TriageController, 'startupMedications']).as('triage.startup-medications')
    router.post('/triage/:encounter/receive', [TriageController, 'receive']).as('triage.receive').use(perm('triage.receive'))
    router.get('/triage/:encounter', [TriageController, 'show']).as('triage.show')
    router.post('/triage/:encounter/save-vitals', [TriageController, 'saveVitals']).as('triage.save-vitals').use(perm('triage.record-vitals'))
    router.post('/triage/:encounter/complete', [TriageController, 'complete']).as('triage.complete').use(perm('triage.complete'))
    router.post('/triage/:encounter/assign-ward', [TriageController, 'assignWard']).as('triage.assign-ward').use(perm('triage.manage-ward-assignment|screening.manage-ward-assignment'))
    router.post('/triage/:encounter/admit', [TriageController, 'admitToWard']).as('triage.admit').use(perm('triage.manage-ward-assignment|screening.manage-ward-assignment'))
    router.post('/triage/:encounter/discharge', [TriageController, 'discharge']).as('triage.discharge').use(perm('triage.manage-ward-assignment|screening.manage-ward-assignment'))
    router.post('/triage/:encounter/startup-medications', [TriageController, 'storeStartupMedication']).as('triage.startup-medications.store').use(perm('triage.manage-startup-medications|screening.manage-assessment'))
    router.post('/triage/:encounter/startup-medications/recommend', [TriageController, 'recommendStartupMedication']).as('triage.startup-medications.recommend').use(perm('triage.manage-startup-medications|screening.manage-assessment'))
    router.delete('/triage/startup-medications/:medication', [TriageController, 'destroyStartupMedication']).as('triage.startup-medications.destroy').use(perm('triage.manage-startup-medications|screening.manage-assessment'))
    router.get('/medications/search', [TriageController, 'searchMedications']).as('medications.search')

    // ── Medications (CRUD) ─────────────────────────────────────────────────
    router.get('/medications', [MedicationsController, 'index']).as('medications.index')
    router.get('/medications/create', [MedicationsController, 'create']).as('medications.create')
    router.post('/medications', [MedicationsController, 'store']).as('medications.store')
    router.get('/medications/:medication', [MedicationsController, 'show']).as('medications.show')
    router.get('/medications/:medication/edit', [MedicationsController, 'edit']).as('medications.edit')
    router.put('/medications/:medication', [MedicationsController, 'update']).as('medications.update')
    router.delete('/medications/:medication', [MedicationsController, 'destroy']).as('medications.destroy')

    // ── Medical Dictionary & Library ───────────────────────────────────────
    router.get('/dictionary/search', [MedicalDictionaryController, 'search']).as('dictionary.search')
    router.get('/dictionary/terms/:id', [MedicalDictionaryController, 'show']).as('dictionary.show')
    router.get('/dictionary', [MedicalDictionaryController, 'index']).as('dictionary.index')
    router
      .group(() => {
        router.post('/dictionary', [MedicalDictionaryController, 'store']).as('dictionary.store')
        router.put('/dictionary/:id', [MedicalDictionaryController, 'update']).as('dictionary.update')
        router.delete('/dictionary/:id', [MedicalDictionaryController, 'destroy']).as('dictionary.destroy')
        router.post('/dictionary/sync', [MedicalDictionaryController, 'sync']).as('dictionary.sync')
      })
      .use(perm('settings.manage|medications.write|test-types.write'))

    // ── Units ──────────────────────────────────────────────────────────────
    router.get('/units', [UnitsController, 'index']).as('units.index')
    router.get('/units/search', [UnitsController, 'search']).as('units.search')
    router.get('/units/create', [UnitsController, 'create']).as('units.create')
    router.post('/units', [UnitsController, 'store']).as('units.store')
    router.get('/units/:unit', [UnitsController, 'show']).as('units.show')
    router.get('/units/:unit/edit', [UnitsController, 'edit']).as('units.edit')
    router.put('/units/:unit', [UnitsController, 'update']).as('units.update')
    router.delete('/units/:unit', [UnitsController, 'destroy']).as('units.destroy')

    // ── Wards ────────────────────────────────────────────────────────────────
    router.get('/wards/beds', [WardsController, 'bedsData']).as('wards.beds')
    router.get('/wards/create', [WardsController, 'create']).as('wards.create')
    router.get('/wards', [WardsController, 'index']).as('wards.index')
    router.post('/wards', [WardsController, 'store']).as('wards.store')
    router.get('/wards/:ward/edit', [WardsController, 'edit']).as('wards.edit')
    router.put('/wards/:ward', [WardsController, 'update']).as('wards.update')
    router.delete('/wards/:ward', [WardsController, 'destroy']).as('wards.destroy')
    router.get('/wards/:ward', [WardsController, 'show']).as('wards.show')

    // ── Beds ─────────────────────────────────────────────────────────────────
    router.get('/beds/create', [BedsController, 'create']).as('beds.create')
    router.get('/beds', [BedsController, 'index']).as('beds.index')
    router.post('/beds', [BedsController, 'store']).as('beds.store')
    router.patch('/beds/:bed/status', [BedsController, 'updateStatus']).as('beds.status')
    router.patch('/beds/:bed/move', [BedsController, 'move']).as('beds.move')
    router.post('/beds/:bed/discharge', [BedsController, 'discharge']).as('beds.discharge')
    router.get('/beds/:bed/edit', [BedsController, 'edit']).as('beds.edit')
    router.put('/beds/:bed', [BedsController, 'update']).as('beds.update')
    router.delete('/beds/:bed', [BedsController, 'destroy']).as('beds.destroy')
    router.get('/beds/:bed', [BedsController, 'show']).as('beds.show')

    // ── Bed accessories ──────────────────────────────────────────────────────
    router.get('/accessories', [AccessoriesController, 'index']).as('accessories.index')
    router.get('/accessories/create', [AccessoriesController, 'create']).as('accessories.create')
    router.post('/accessories', [AccessoriesController, 'store']).as('accessories.store')
    router.get('/accessories/:accessory/edit', [AccessoriesController, 'edit']).as('accessories.edit')
    router.put('/accessories/:accessory', [AccessoriesController, 'update']).as('accessories.update')
    router.delete('/accessories/:accessory', [AccessoriesController, 'destroy']).as('accessories.destroy')
    router.post('/accessories/:accessory/attach', [AccessoriesController, 'attach']).as('accessories.attach')
    router.post('/accessories/:accessory/move', [AccessoriesController, 'move']).as('accessories.move')
    router.post('/accessories/:accessory/detach', [AccessoriesController, 'detach']).as('accessories.detach')

    // ── Test types + lab result forms + specimen types ─────────────────────
    router.get('/test-types/forms', [LabResultFormsController, 'index']).as('test-types.forms.index')
    router.get('/test-types/forms/create', [LabResultFormsController, 'create']).as('test-types.forms.create')
    router.post('/test-types/forms', [LabResultFormsController, 'store']).as('test-types.forms.store')
    router.get('/test-types/forms/:labResultForm', [LabResultFormsController, 'show']).as('test-types.forms.show')
    router.get('/test-types/forms/:labResultForm/edit', [LabResultFormsController, 'edit']).as('test-types.forms.edit')
    router.put('/test-types/forms/:labResultForm', [LabResultFormsController, 'update']).as('test-types.forms.update')
    router.delete('/test-types/forms/:labResultForm', [LabResultFormsController, 'destroy']).as('test-types.forms.destroy')
    router.get('/test-types/categories', [TestTypesController, 'categories']).as('test-types.categories')
    router.get('/test-types/possible-results', [PossibleResultsController, 'index']).as('test-types.possible-results.index')
    router.get('/test-types/possible-results/create', [PossibleResultsController, 'create']).as('test-types.possible-results.create')
    router.post('/test-types/possible-results', [PossibleResultsController, 'store']).as('test-types.possible-results.store')
    router.get('/test-types/possible-results/:id/edit', [PossibleResultsController, 'edit']).as('test-types.possible-results.edit')
    router.put('/test-types/possible-results/:id', [PossibleResultsController, 'update']).as('test-types.possible-results.update')
    router.delete('/test-types/possible-results/:id', [PossibleResultsController, 'destroy']).as('test-types.possible-results.destroy')
    router.get('/test-types', [TestTypesController, 'index']).as('test-types.index')
    router.get('/test-types/create', [TestTypesController, 'create']).as('test-types.create')
    router.post('/test-types', [TestTypesController, 'store']).as('test-types.store')
    router.get('/test-types/:testType', [TestTypesController, 'show']).as('test-types.show')
    router.get('/test-types/:testType/edit', [TestTypesController, 'edit']).as('test-types.edit')
    router.put('/test-types/:testType', [TestTypesController, 'update']).as('test-types.update')
    router.delete('/test-types/:testType', [TestTypesController, 'destroy']).as('test-types.destroy')

    // ── Screening ────────────────────────────────────────────────────────────
    router.get('/screening/queue', [ScreeningController, 'queue']).as('screening.queue')
    router.get('/screening/entries', [ScreeningController, 'entries']).as('screening.entries.index')
    router.get('/screening/lab-tests/search', [ScreeningController, 'searchLabTests']).as('screening.lab-tests.search')
    router
      .get('/screening/presumptive-tb/next-case-number', [ScreeningController, 'nextPresumptiveTbCaseNumber'])
      .as('screening.presumptive-tb.next-case-number')
    router.post('/screening/:encounter/receive', [ScreeningController, 'receive']).as('screening.receive').use(perm('screening.receive'))
    router.get('/screening/:encounter/lab-request', [ScreeningController, 'labRequest']).as('screening.lab-request')
    router.post('/screening/:encounter/lab-request', [ScreeningController, 'storeLabRequest']).as('screening.lab-request.store').use(perm('screening.create-lab-request|screening.queue-to-lab'))
    router.post('/screening/:encounter/lab-request/save-items', [ScreeningController, 'saveLabItems']).as('screening.lab-request.save-items').use(perm('screening.create-lab-request'))
    router.get('/screening/:encounter', [ScreeningController, 'show']).as('screening.show')
    router.post('/screening/:encounter/save-draft', [ScreeningController, 'saveDraft']).as('screening.save-draft').use(perm('screening.save-draft'))
    router.post('/screening/:encounter/queue-treatment-room', [ScreeningController, 'queueToTreatmentRoom']).as('screening.queue-treatment-room').use(perm('screening.queue-to-treatment-room|screening.manage-assessment'))
    router.post('/screening/:encounter/queue-triage', [ScreeningController, 'queueToTriage']).as('screening.queue-triage').use(perm('screening.manage-assessment'))
    router.post('/screening/:encounter/vital-recheck', [ScreeningController, 'saveVitalRecheck']).as('screening.vital-recheck').use(perm('screening.manage-assessment'))
    router.post('/screening/:encounter/vital-recheck/autosave', [ScreeningController, 'autosaveVitalRecheck']).as('screening.vital-recheck.autosave').use(perm('screening.manage-assessment'))
    router.post('/screening/:encounter/complete', [ScreeningController, 'complete']).as('screening.complete').use(perm('screening.manage-assessment|screening.queue-to-lab|screening.queue-to-pharmacy'))
    router.post('/screening/:encounter/recommendations/approve-all', [ScreeningController, 'approveAllRecommendations']).as('screening.recommendations.approve-all').use(perm('screening.manage-assessment'))
    router.post('/screening/:encounter/recommendations/decline-all', [ScreeningController, 'declineAllRecommendations']).as('screening.recommendations.decline-all').use(perm('screening.manage-assessment'))
    router.post('/screening/:encounter/recommendations/:recommendation/approve', [ScreeningController, 'approveRecommendation']).as('screening.recommendations.approve').use(perm('screening.manage-assessment'))
    router.post('/screening/:encounter/recommendations/:recommendation/decline', [ScreeningController, 'declineRecommendation']).as('screening.recommendations.decline').use(perm('screening.manage-assessment'))
    router.post('/screening/:encounter/assign-ward', [ScreeningController, 'assignWard']).as('screening.assign-ward').use(perm('screening.manage-ward-assignment'))
    router.post('/screening/:encounter/admit', [ScreeningController, 'admitToWard']).as('screening.admit').use(perm('screening.manage-ward-assignment'))
    router.post('/screening/:encounter/discharge', [ScreeningController, 'discharge']).as('screening.discharge').use(perm('screening.manage-ward-assignment'))

    // ── Lab ────────────────────────────────────────────────────────────────
    router.get('/lab/form-mappings', [LabController, 'formMappings']).as('lab.form-mappings')
    router.get('/lab/queue', [LabController, 'queue']).as('lab.queue')
    router.get('/lab/entries', [LabController, 'entries']).as('lab.entries.index')
    router.get('/lab/specimen-types', [LabSpecimenTypesController, 'index']).as('lab.specimen-types.index')
    router.get('/lab/specimen-types/create', [LabSpecimenTypesController, 'create']).as('lab.specimen-types.create')
    router.post('/lab/specimen-types', [LabSpecimenTypesController, 'store']).as('lab.specimen-types.store')
    router.get('/lab/specimen-types/:labSpecimenType', [LabSpecimenTypesController, 'show']).as('lab.specimen-types.show')
    router.get('/lab/specimen-types/:labSpecimenType/edit', [LabSpecimenTypesController, 'edit']).as('lab.specimen-types.edit')
    router.put('/lab/specimen-types/:labSpecimenType', [LabSpecimenTypesController, 'update']).as('lab.specimen-types.update')
    router.delete('/lab/specimen-types/:labSpecimenType', [LabSpecimenTypesController, 'destroy']).as('lab.specimen-types.destroy')
    router.get('/lab/test-results', [LabController, 'testResults']).as('lab.test-results.index')
    router.post('/lab/:encounter/receive', [LabController, 'receive']).as('lab.receive').use(perm('lab.receive'))
    router.get('/lab/:encounter/add-tests', [LabController, 'addTests']).as('lab.add-tests')
    router.post('/lab/:encounter/add-tests', [LabController, 'storeAddedTests']).as('lab.add-tests.store').use(perm('lab.manage-test-types'))
    router.get('/lab/:encounter/items', [LabController, 'itemsJson']).as('lab.items')
    router.get('/lab/:encounter', [LabController, 'show']).as('lab.show')
    router.get('/lab/:encounter/print', [LabController, 'printResults']).as('lab.print')
    router.post('/lab/:encounter/samples', [LabController, 'samples']).as('lab.samples').use(perm('lab.collect-samples'))
    router.post('/lab/:encounter/results', [LabController, 'results']).as('lab.results').use(perm('lab.record-results'))
    router.post('/lab/:encounter/results/:result/update', [LabController, 'updateResult']).as('lab.results.update').use(perm('lab.update-results'))
    router.post('/lab/:encounter/items/:item/result-meta', [LabController, 'updateResultMeta']).as('lab.results.meta').use(perm('lab.update-results'))
    router.post('/lab/:encounter/complete', [LabController, 'complete']).as('lab.complete').use(perm('lab.complete'))

    // ── Screening review ───────────────────────────────────────────────────
    router.get('/screening-review/queue', [ScreeningReviewController, 'queue']).as('screening-review.queue')
    router.get('/screening-review/entries', [ScreeningReviewController, 'entries']).as('screening-review.entries.index')
    router.post('/screening-review/:encounter/receive', [ScreeningReviewController, 'receive']).as('screening-review.receive').use(perm('screening-review.receive|screening.receive'))
    router.get('/screening-review/:encounter', [ScreeningReviewController, 'show']).as('screening-review.show')
    router.post('/screening-review/:encounter/save-draft', [ScreeningReviewController, 'saveDraft']).as('screening-review.save-draft').use(perm('screening-review.complete|screening.manage-assessment'))
    router.post('/screening-review/:encounter/complete', [ScreeningReviewController, 'complete']).as('screening-review.complete').use(perm('screening-review.complete|screening.manage-assessment'))
    router.post('/screening-review/:encounter/queue-lab', [ScreeningReviewController, 'queueToLab']).as('screening-review.queue-lab').use(perm('screening-review.complete|screening.manage-assessment'))
    router.post('/screening-review/:encounter/queue-treatment-room', [ScreeningReviewController, 'queueToTreatmentRoom']).as('screening-review.queue-treatment-room').use(perm('screening-review.complete|screening.manage-assessment|screening.queue-to-treatment-room'))
    router.post('/screening-review/:encounter/queue-triage', [ScreeningReviewController, 'queueToTriage']).as('screening-review.queue-triage').use(perm('screening-review.complete|screening.manage-assessment'))

    // ── Pharmacy ─────────────────────────────────────────────────────────────
    router.get('/pharmacy/queue', [PharmacyController, 'queue']).as('pharmacy.queue')
    router.get('/pharmacy/prescriptions', [PharmacyController, 'prescriptions']).as('pharmacy.prescriptions.index').use(perm('pharmacy.view-queue'))
    router.post('/pharmacy/:encounter/receive', [PharmacyController, 'receive']).as('pharmacy.receive').use(perm('pharmacy.receive'))
    router.get('/pharmacy/:encounter', [PharmacyController, 'show']).as('pharmacy.show')
    router.get('/pharmacy/:encounter/print', [PharmacyController, 'printPrescription']).as('pharmacy.print')
    router.post('/pharmacy/:encounter/save-draft', [PharmacyController, 'saveDraft']).as('pharmacy.save-draft').use(perm('pharmacy.dispense|pharmacy.manage-prescription'))
    router.post('/pharmacy/:encounter/prescription', [PharmacyController, 'storePrescription']).as('pharmacy.prescription.store').use(perm('pharmacy.manage-prescription'))
    router.post('/pharmacy/:encounter/prescription-items', [PharmacyController, 'appendPrescriptionItems']).as('pharmacy.prescription-items.append').use(perm('pharmacy.manage-prescription'))
    router.post('/pharmacy/:encounter/dispense', [PharmacyController, 'dispense']).as('pharmacy.dispense').use(perm('pharmacy.dispense'))
    router.post('/pharmacy/:encounter/queue-screening', [PharmacyController, 'queueBackToScreening']).as('pharmacy.queue-screening').use(perm('pharmacy.manage-prescription'))
    router.post('/pharmacy/:encounter/queue-treatment-room', [PharmacyController, 'queueToTreatmentRoom']).as('pharmacy.queue-treatment-room').use(perm('pharmacy.dispense|pharmacy.close-encounter'))
    router.post('/pharmacy/:encounter/close', [PharmacyController, 'close']).as('pharmacy.close').use(perm('pharmacy.close-encounter'))

    // ── Treatment room ───────────────────────────────────────────────────────
    router.get('/treatment-room/queue', [TreatmentRoomController, 'queue']).as('treatment-room.queue')
    router.post('/treatment-room/:encounter/receive', [TreatmentRoomController, 'receive']).as('treatment-room.receive').use(perm('treatment-room.receive|pharmacy.receive'))
    router.get('/treatment-room/:encounter', [TreatmentRoomController, 'show']).as('treatment-room.show')
    router.post('/treatment-room/:encounter/save-draft', [TreatmentRoomController, 'saveDraft']).as('treatment-room.save-draft').use(perm('treatment-room.close-encounter|pharmacy.close-encounter'))
    router.post('/treatment-room/:encounter/close', [TreatmentRoomController, 'close']).as('treatment-room.close').use(perm('treatment-room.close-encounter|pharmacy.close-encounter'))
    router.post('/treatment-room/:encounter/queue-screening-review', [TreatmentRoomController, 'queueToScreeningReview']).as('treatment-room.queue-screening-review').use(perm('treatment-room.close-encounter|pharmacy.close-encounter'))

    // ── Encounters ───────────────────────────────────────────────────────────
    router.get('/encounters', [EncountersController, 'index']).as('encounters.index').use(perm('encounter.view-own|encounter.view-all'))
    router.get('/encounters/:encounter/suggestions', [EncountersController, 'suggestions']).as('encounters.suggestions').use(perm('encounter.view-own|encounter.view-all'))
    router.get('/encounters/:encounter', [EncountersController, 'show']).as('encounters.show').use(perm('encounter.view-own|encounter.view-all'))
    router.post('/encounters/:encounter/reopen', [EncountersController, 'reopen']).as('encounters.reopen').use(perm('encounters.reopen'))
    router.post('/encounters/:encounter/reopen-to-stage', [EncountersController, 'reopenToStage']).as('encounters.reopen-to-stage').use(perm('encounters.reopen|pharmacy.close-encounter'))

    // ── Reports ──────────────────────────────────────────────────────────────
    router
      .group(() => {
        router.get('/reports', [ReportController, 'index']).as('reports.index')
        router.get('/reports/preview', [ReportController, 'preview']).as('reports.preview')
        // Export lifecycle. Paths match the report hub Vue page consumers.
        router.post('/reports/queue-export', [ReportController, 'queueExport']).as('reports.queue-export').use(perm('reports.write'))
        router.get('/reports/download-csv', [ReportController, 'downloadCsv']).as('reports.download-csv')
        router.get('/reports/download-pdf', [ReportController, 'downloadPdf']).as('reports.download-pdf')
        router.get('/reports/exports/status', [ReportController, 'exportStatus']).as('reports.exports.status')
        router.get('/reports/exports/:export/download', [ReportController, 'downloadExport']).as('reports.exports.download')
        router.delete('/reports/exports/:export', [ReportController, 'dismissExport']).as('reports.exports.dismiss')

        // Dedicated report pages (own controllers, render their own Inertia page).
        router.get('/reports/gyn-obs', [GynObsReportController, 'index']).as('reports.gyn-obs.index')
        router.get('/reports/presumptive-tb', [PresumptiveTbReportController, 'index']).as('reports.presumptive-tb.index')
        router.get('/reports/opd-register', [OpdRegisterController, 'index']).as('reports.opd-register.index')

        // Shift reports & roster.
        router.get('/reports/shifts', [ShiftReportController, 'index']).as('reports.shifts.index')
        router.get('/reports/shifts/timeline', [ShiftReportController, 'timeline']).as('reports.shifts.timeline')
        router.post('/reports/shifts/roster', [ShiftReportController, 'storeRosterAssignment']).as('reports.shifts.roster.store').use(perm('reports.write'))
        router.post('/reports/shifts/prefill', [ShiftReportController, 'prefillRosterWeek']).as('reports.shifts.prefill').use(perm('reports.write'))
        router.delete('/reports/shifts/roster/:shiftRoster', [ShiftReportController, 'destroyRosterAssignment']).as('reports.shifts.roster.destroy').use(perm('reports.write'))

        // Remaining catalogue shortcuts redirect into the hub with a preset key.
        const reportRedirect = (key: string) => ({ response }: any) =>
          response.redirect().toPath(`/reports?report_key=${key}`)
        router.get('/reports/pnc-register', reportRedirect('pnc_register')).as('reports.pnc-register.index')
        router.get('/reports/anc-register', reportRedirect('anc_register')).as('reports.anc-register.index')
        router.get('/reports/art-register', reportRedirect('art_register')).as('reports.art-register.index')
        router.get('/reports/hia-one-a', reportRedirect('hia_one_a')).as('reports.hia-one-a.index')
        router.get('/reports/hia-one-b', reportRedirect('hia_one_b')).as('reports.hia-one-b.index')
      })
      .use(perm('reports.read'))

    // ── Complaints ───────────────────────────────────────────────────────────
    router.get('/complaints', [PlatformComplaintsController, 'index']).as('complaints.index')
    router.post('/complaints', [PlatformComplaintsController, 'store']).as('complaints.store')

    // ── Notifications ────────────────────────────────────────────────────────
    router.get('/notifications', [NotificationsController, 'index']).as('notifications.index')
    router.post('/notifications/read-all', [NotificationsController, 'markAllRead']).as('notifications.read-all')
    router.post('/notifications/:notification/read', [NotificationsController, 'markRead']).as('notifications.read')
    router.delete('/notifications/:notification', [NotificationsController, 'destroy']).as('notifications.destroy')

    // ── Announcements ──────────────────────────────────────────────────────
    router
      .group(() => {
        router.get('/announcements/manage', [AnnouncementsController, 'manage']).as('announcements.manage')
        router.post('/announcements/manage', [AnnouncementsController, 'store']).as('announcements.store')
      })
      .use(perm('settings.manage'))
    router.get('/announcements/:announcement', [AnnouncementsController, 'show']).as('announcements.show').where('announcement', /^[0-9]+$/)
    router.get('/announcements-widget', [AnnouncementsController, 'widget']).as('announcements.widget')

    // ── Calendar & events ──────────────────────────────────────────────────
    router.get('/calendar', [CalendarController, 'index']).as('calendar.index')
    // NOTE: Laravel gated /calendar/manage with role:super-admin. No `role`
    // named middleware exists in this app; the controller enforces the check.
    router.get('/calendar/manage', [CalendarController, 'adminIndex']).as('calendar.manage')
    router.get('/calendar/events', [CalendarController, 'events']).as('calendar.events')
    router.get('/calendar/events/:event', [CalendarController, 'show']).as('calendar.events.show')
    router.post('/calendar/events', [CalendarController, 'store']).as('calendar.events.store').use(perm('calendar.write'))
    router.put('/calendar/events/:event', [CalendarController, 'update']).as('calendar.events.update').use(perm('calendar.write'))
    router.delete('/calendar/events/:event', [CalendarController, 'destroy']).as('calendar.events.destroy').use(perm('calendar.write'))

    // ── Settings ─────────────────────────────────────────────────────────────
    router
      .group(() => {
        router.get('/settings', [SettingsController, 'index']).as('settings.index')
        router.post('/settings/:group', [SettingsController, 'update']).as('settings.update')
      })
      .use(perm('settings.manage'))

    // ── Users ──────────────────────────────────────────────────────────────
    router
      .group(() => {
        router.get('/users', [UsersController, 'index']).as('users.index')
        router.post('/users', [UsersController, 'store']).as('users.store')
        router.put('/users/:user/roles', [UsersController, 'updateRoles']).as('users.roles.update').use(perm('users.write|settings.manage'))
        router.put('/users/:user/portal-bookable', [UsersController, 'togglePortalBookable']).as('users.portal-bookable.toggle').use(perm('users.write|settings.manage'))
        router.get('/users/:user', [UsersController, 'show']).as('users.show')
        router.get('/users/:user/edit', [UsersController, 'edit']).as('users.edit')
        router
          .post('/users/:user/signature-invite', [StaffSignatureInviteController, 'createForUser'])
          .as('users.signature-invite')
        router
          .delete('/users/:user/signature', [StaffSignatureInviteController, 'destroyForUser'])
          .as('users.signature.destroy')
        router.put('/users/:user', [UsersController, 'update']).as('users.update')
        router.delete('/users/:user', [UsersController, 'destroy']).as('users.destroy')
      })
      .use(perm('users.read|users.write|users.delete'))

    // ── Featured doctors ─────────────────────────────────────────────────────
    router
      .group(() => {
        router.get('/featured-doctors', [FeaturedDoctorsController, 'index']).as('featured-doctors.index')
        router.post('/featured-doctors', [FeaturedDoctorsController, 'store']).as('featured-doctors.store').use(perm('featured_doctors.write|featured_doctors.manage'))
        router.put('/featured-doctors/:featured_doctor', [FeaturedDoctorsController, 'update']).as('featured-doctors.update').use(perm('featured_doctors.write|featured_doctors.manage'))
        router.delete('/featured-doctors/:featured_doctor', [FeaturedDoctorsController, 'destroy']).as('featured-doctors.destroy').use(perm('featured_doctors.manage'))
      })
      .use(perm('featured_doctors.read|featured_doctors.write|featured_doctors.manage'))

    // ── Health tips ──────────────────────────────────────────────────────────
    router
      .group(() => {
        router.get('/health-tips', [HealthTipsController, 'index']).as('health-tips.index')
        router.post('/health-tips', [HealthTipsController, 'store']).as('health-tips.store').use(perm('health_tips.write|health_tips.manage'))
        router.put('/health-tips/:health_tip', [HealthTipsController, 'update']).as('health-tips.update').use(perm('health_tips.write|health_tips.manage'))
        router.delete('/health-tips/:health_tip', [HealthTipsController, 'destroy']).as('health-tips.destroy').use(perm('health_tips.manage'))
      })
      .use(perm('health_tips.read|health_tips.write|health_tips.manage'))

    // ── Emergency services ───────────────────────────────────────────────────
    router
      .group(() => {
        router.get('/emergency-services', [EmergencyServicesController, 'index']).as('emergency-services.index')
        router.post('/emergency-services', [EmergencyServicesController, 'store']).as('emergency-services.store')
        router.put('/emergency-services/:emergencyService', [EmergencyServicesController, 'update']).as('emergency-services.update')
        router.delete('/emergency-services/:emergencyService', [EmergencyServicesController, 'destroy']).as('emergency-services.destroy')
      })
      .use(perm('patients.manage-portal|patients.write'))

    // ── Membership plans ─────────────────────────────────────────────────────
    router
      .group(() => {
        router.get('/memberships', [MembershipPlansController, 'index']).as('memberships.index')
        router.post('/memberships', [MembershipPlansController, 'store']).as('memberships.store').use(perm('memberships.write|memberships.manage'))
        router.put('/memberships/:membership', [MembershipPlansController, 'update']).as('memberships.update').use(perm('memberships.write|memberships.manage'))
        router.delete('/memberships/:membership', [MembershipPlansController, 'destroy']).as('memberships.destroy').use(perm('memberships.manage'))
      })
      .use(perm('memberships.read|memberships.write|memberships.manage'))

    // ── Rate card (service pricing) ──────────────────────────────────────────
    router
      .group(() => {
        router.get('/rate-card', [RateCardController, 'index']).as('rate-card.index')
        router.put('/rate-card/:service', [RateCardController, 'update']).as('rate-card.update').use(perm('rate-card.manage|settings.manage'))
        router.post('/rate-card/sync', [RateCardController, 'sync']).as('rate-card.sync').use(perm('rate-card.manage|settings.manage'))
      })
      .use(perm('rate-card.read|rate-card.manage|settings.manage'))

    // ── Subscriptions ────────────────────────────────────────────────────────
    router
      .group(() => {
        router.get('/subscriptions', [SubscriptionsController, 'index']).as('subscriptions.index')
        router.get('/subscriptions/patients/search', [SubscriptionsController, 'searchPatients']).as('subscriptions.patients.search')
        router.post('/subscriptions', [SubscriptionsController, 'store']).as('subscriptions.store').use(perm('subscriptions.write|subscriptions.manage'))
        router.post('/subscriptions/:subscription/pay', [SubscriptionsController, 'pay']).as('subscriptions.pay').use(perm('subscriptions.write|subscriptions.manage'))
        router.post('/subscriptions/:subscription/cancel', [SubscriptionsController, 'cancel']).as('subscriptions.cancel').use(perm('subscriptions.write|subscriptions.manage'))
      })
      .use(perm('subscriptions.read|subscriptions.write|subscriptions.manage'))

    // ── Corporate membership leads ─────────────────────────────────────────
    router
      .group(() => {
        router.get('/corporate-leads', [CorporateLeadsController, 'index']).as('corporate-leads.index')
        router.post('/corporate-leads/:lead/status', [CorporateLeadsController, 'updateStatus']).as('corporate-leads.status').use(perm('memberships.manage'))
      })
      .use(perm('memberships.read|memberships.manage'))

    // ── Access control (roles & permissions) ───────────────────────────────
    router
      .group(() => {
        router.get('/access-control', [AccessControlController, 'index']).as('access-control.index')
        router.get('/access-control/user-roles', [AccessControlController, 'userRoles']).as('access-control.user-roles')
        router.post('/access-control/roles', [AccessControlController, 'storeRole']).as('access-control.roles.store')
        router.put('/access-control/roles/:role/permissions', [AccessControlController, 'updateRolePermissions']).as('access-control.roles.permissions.update')
        router.delete('/access-control/roles/:role', [AccessControlController, 'destroyRole']).as('access-control.roles.destroy')
        router.put('/access-control/users/:user/roles', [AccessControlController, 'updateUserRoles']).as('access-control.users.roles.update')
      })
      .use(perm('settings.manage'))
  })
  .use([middleware.auth(), middleware.resolveStaffRbac()])
