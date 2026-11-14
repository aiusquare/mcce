<?php
defined('BASEPATH') OR exit('No direct script access allowed');

/*
| -------------------------------------------------------------------------
| URI ROUTING
| -------------------------------------------------------------------------
| This file lets you re-map URI requests to specific controller functions.
|
| Typically there is a one-to-one relationship between a URL string
| and its corresponding controller class/method. The segments in a
| URL normally follow this pattern:
|
|	example.com/class/method/id/
|
| In some instances, however, you may want to remap this relationship
| so that a different class/function is called than the one
| corresponding to the URL.
|
| Please see the user guide for complete details:
|
|	https://codeigniter.com/userguide3/general/routing.html
|
| -------------------------------------------------------------------------
| RESERVED ROUTES
| -------------------------------------------------------------------------
|
| There are three reserved routes:
|
|	$route['default_controller'] = 'welcome';
|
| This route indicates which controller class should be loaded if the
| URI contains no data. In the above example, the "welcome" class
| would be loaded.
|
|	$route['404_override'] = 'errors/page_missing';
|
| This route will tell the Router which controller/method to use if those
| provided in the URL cannot be matched to a valid route.
|
|	$route['translate_uri_dashes'] = FALSE;
|
| This is not exactly a route, but allows you to automatically route
| controller and method names that contain dashes. '-' isn't a valid
| class or method name character, so it requires translation.
| When you set this option to TRUE, it will replace ALL dashes in the
| controller and method URI segments.
|
| Examples:	my-controller/index	-> my_controller/index
|		my-controller/my-method	-> my_controller/my_method
*/
$route['default_controller'] = 'welcome';
$route['api/auth/register'] = 'auth/register';
$route['api/auth/login'] = 'auth/login';
$route['api/admin/login'] = 'auth/login';
$route['api/admin/me'] = 'auth/me';
$route['api/admin/change-password'] = 'auth/change_password';
$route['api/admin/account'] = 'auth/update_admin_account';
$route['api/auth/logout'] = 'auth/logout';
$route['api/student/profile'] = 'student/profile';
$route['api/student/profile/update'] = 'student/profile';
$route['api/student/progress'] = 'student/progress';
$route['api/student/application'] = 'student/application';
$route['api/student/application/pdf'] = 'student/application_pdf';
$route['api/student/notifications'] = 'student/notifications';
$route['api/salary/upload'] = 'salary/upload_csv';
$route['api/salary/list'] = 'salary/list';
$route['api/salary/by-grade'] = 'salary/by_grade';
$route['api/salary/export'] = 'salary/export_csv';
$route['api/salary/update'] = 'salary/update';
$route['api/responsibility/upload'] = 'responsibilityallowance/upload_csv';
$route['api/responsibility/list'] = 'responsibilityallowanceview/list';
$route['api/responsibility/export'] = 'responsibilityallowance/export_csv';
$route['api/staff/upload'] = 'staff/upload_csv';
$route['api/staff/list'] = 'staff/list';
$route['api/staff/export'] = 'staff/export_csv';
$route['api/staff/update-effective'] = 'staff/update_effective';
$route['api/staff/history'] = 'staff/history';
$route['api/monthly-salary/list'] = 'monthlysalary/list';
$route['api/monthly-salary/generate'] = 'monthlysalary/generate';
$route['api/monthly-salary/export'] = 'monthlysalary/list';
$route['api/accounts/groups'] = 'accounts/groups';
$route['api/accounts/controls'] = 'accounts/controls';
$route['api/accounts/list'] = 'accounts/list';
$route['api/accounts/find'] = 'accounts/find';
$route['api/accounts/create'] = 'accounts/create';
$route['api/accounts/control/create'] = 'accounts/create_control';
$route['api/receipts/list'] = 'receipts/list';
$route['api/receipts/create'] = 'receipts/create';
$route['api/vouchers/list'] = 'vouchers/list';
$route['api/vouchers/create'] = 'vouchers/create';
$route['api/student/admission-status'] = 'student/admission_status';
$route['api/student/application-fee/verify'] = 'student/verify_application_fee_payment';
$route['api/student/acceptance-fee/mark-paid'] = 'student/mark_acceptance_fee_paid';
$route['api/student/payments'] = 'student/payments';
$route['api/student/payments/pay'] = 'student/pay_invoice';
$route['api/student/wallet/top-up'] = 'student/top_up_wallet';
$route['api/student/course-registration'] = 'student/course_registration';
$route['api/student/course-registration/submit'] = 'student/submit_course_registration';
$route['api/student/course-registration/template'] = 'student/course_registration_template';
$route['api/student/programmes'] = 'student/programmes';
$route['api/admin/get-users'] = 'admin/get_users';
$route['api/admin/create-user'] = 'admin/create_user';
$route['api/admin/assign-role'] = 'admin/assign_role';
$route['api/admin/remove-role'] = 'admin/remove_role';
$route['api/admin/delete-user'] = 'admin/delete_user';
$route['api/admin/get-roles'] = 'admin/get_roles';
$route['api/admin/create-role'] = 'admin/create_role';
$route['api/admin/get-resources'] = 'admin/get_resources';
$route['api/admin/get-permissions'] = 'admin/get_permissions';
$route['api/admin/assign-permission'] = 'admin/assign_permission';
$route['api/admin/get-courses'] = 'admin/get_courses';
$route['api/admin/get-course'] = 'admin/get_course';
$route['api/admin/create-course'] = 'admin/create_course';
$route['api/admin/bulk-upload-courses'] = 'admin/bulk_upload_courses';
$route['api/admin/update-course'] = 'admin/update_course';
$route['api/admin/delete-course'] = 'admin/delete_course';
$route['api/admin/get-departments'] = 'admin/get_departments';
$route['api/admin/create-department'] = 'admin/create_department';
$route['api/admin/update-department'] = 'admin/update_department';
$route['api/admin/get-programmes'] = 'admin/get_programmes';
$route['api/admin/create-programme'] = 'admin/create_programme';
$route['api/admin/update-programme'] = 'admin/update_programme';
$route['api/admin/update-programme-status'] = 'admin/update_programme_status';
$route['api/admin/delete-department'] = 'admin/delete_department';
$route['api/admin/delete-programme'] = 'admin/delete_programme';
$route['api/admin/get-sessions'] = 'admin/get_sessions';
$route['api/admin/create-session'] = 'admin/create_session';
$route['api/admin/update-session'] = 'admin/update_session';
$route['api/admin/delete-session'] = 'admin/delete_session';
$route['api/admin/archive-session'] = 'admin/archive_session';
$route['api/admin/set-active-session'] = 'admin/set_active_session';
$route['api/admin/get-semesters'] = 'admin/get_semesters';
$route['api/admin/dashboard'] = 'admin/dashboard';
$route['api/admin/students/export'] = 'admin/export_students_csv';
$route['api/admin/students'] = 'admin/get_students';
$route['api/admin/students/profile'] = 'admin/get_student_profile';
$route['api/admin/students/update'] = 'admin/update_student';
$route['api/admin/students/delete'] = 'admin/delete_students';
$route['api/admin/students/bulk-onboard-csv'] = 'admin/bulk_onboard_students_csv';
$route['api/admin/students/fix-encoding'] = 'admin/fix_encoding';
$route['api/admin/fees/summary'] = 'admin/fee_summary';
$route['api/admin/fees/session-settings'] = 'admin/session_fee_settings';
$route['api/public/fees/session-settings'] = 'public_fees/session_fee_settings';
$route['api/admin/fees/students'] = 'admin/fee_students';
$route['api/admin/fees/export'] = 'admin/export_fee_invoices_csv';
$route['api/admin/payments/export'] = 'admin/export_payments_csv';
$route['api/admin/payments/status'] = 'admin/update_payment_status';
$route['api/admin/payments/(:any)/status'] = 'admin/update_payment_status/$1';
$route['api/admin/payments'] = 'admin/payments';
$route['api/admin/fees/invoices/(:any)/publish'] = 'admin/publish_fee_invoice/$1';
$route['api/admin/fees/invoices/(:any)'] = 'admin/fee_invoice/$1';
$route['api/admin/fees/invoices'] = 'admin/fee_invoices';
$route['api/admin/invoices/(:any)/publish'] = 'admin/publish_fee_invoice/$1';
$route['api/admin/invoices/(:any)'] = 'admin/fee_invoice/$1';
$route['api/admin/invoices'] = 'admin/fee_invoices';
$route['api/admin/get-invoices'] = 'admin/fee_invoices';
$route['api/admin/create-invoice'] = 'admin/create_fee_invoice';
$route['api/admin/update-invoice'] = 'admin/update_fee_invoice';
$route['api/admin/delete-invoice'] = 'admin/delete_fee_invoice';
$route['api/admin/publish-invoice'] = 'admin/publish_fee_invoice';
$route['api/admin/fee-summary'] = 'admin/fee_summary';
$route['api/admin/applications'] = 'admin/get_applications';
$route['api/admin/applications/export-csv'] = 'admin/export_applications_csv';
$route['api/admin/applications/update-status'] = 'admin/update_application_status';
$route['api/admin/applications/bulk-admit-csv'] = 'admin/bulk_admit_from_csv';
$route['migration/add_nin'] = 'migration/add_nin';
$route['404_override'] = '';
$route['translate_uri_dashes'] = FALSE;
$route['api/admin/results/batches'] = 'admin_results/get_batches';
$route['api/admin/results/batches/create'] = 'admin_results/create_batch';
$route['api/admin/results/batches/update-status'] = 'admin_results/update_batch_status';
$route['api/admin/results/batch'] = 'admin_results/delete_batch';
$route['api/admin/results/broadsheet'] = 'admin_results/get_broadsheet';
$route['api/admin/results/debug'] = 'admin_results/debug_data';
$route['api/admin/results/student-history'] = 'admin_results/student_history';
$route['api/admin/results/statement'] = 'admin_results/statement';
$route['api/admin/results/cgpa-list'] = 'admin_results/cgpa_list';
$route['api/admin/results/attempts'] = 'admin_results/get_attempts';
$route['api/admin/results/attempts/save'] = 'admin_results/save_attempts';
$route['api/admin/results/gpa'] = 'admin_results/get_gpa';
$route['api/admin/results/configuration/grading-scheme'] = 'admin_results/get_grading_scheme';
$route['api/admin/results/configuration/grading-scheme/save'] = 'admin_results/save_grading_scheme';
$route['api/admin/results/configuration/grading-scheme/recalculate'] = 'admin_results/recalculate_all_grades';
$route['api/admin/results/configuration/assessment-structure'] = 'admin_results/get_assessment_structure';
$route['api/admin/results/configuration/assessment-structure/save'] = 'admin_results/save_assessment_structure';
$route['api/admin/results/assessment-structure'] = 'admin_results/get_assessment_structure';
$route['api/admin/results/assessment-structure/save'] = 'admin_results/save_assessment_structure';
$route['api/admin/results/policy'] = 'admin_results/policy';




$route['api/admin/settings'] = 'admin_settings/get_settings';
$route['api/admin/settings/update'] = 'admin_settings/update_settings';

// Course Registration
$route['api/admin/course-registration/credit-rules']['get'] = 'admin_course_registration/get_credit_rules';
$route['api/admin/course-registration/credit-rules']['post'] = 'admin_course_registration/save_credit_rules';
$route['api/admin/course-registration/settings'] = 'admin_course_registration/get_settings';
$route['api/admin/course-registration/settings/save'] = 'admin_course_registration/save_settings';
$route['api/admin/course-registration/dump-schema'] = 'admin_course_registration/dump_schema';
$route['api/student/course-registration/context'] = 'student_course_registration/get_context';
$route['api/student/course-registration/save'] = 'student_course_registration/save';
$route['api/admin/course-registration/registrations'] = 'admin_course_registration/get_registrations';
$route['api/admin/course-registration/registrations/details'] = 'admin_course_registration/get_registration_details';
$route['api/admin/course-registration/registrations/process'] = 'admin_course_registration/process_approval';
$route['api/admin/course-registration/registrations/delete'] = 'admin_course_registration/delete_registrations';
$route['api/admin/course-registration/registrations/amend-courses'] = 'admin_course_registration/amend_registrations_courses';
$route['api/admin/course-registration/class-list'] = 'admin_course_registration/get_class_list';
$route['api/admin/course-registration/registered-courses'] = 'admin_course_registration/get_registered_courses';
$route['api/admin/course-registration/bulk/preview'] = 'admin_course_registration/bulk_preview';
$route['api/admin/course-registration/bulk/process'] = 'admin_course_registration/bulk_process';
$route['api/admin/course-registration/course-roster'] = 'admin_course_registration/get_course_roster';
$route['api/admin/course-registration/course-roster/update'] = 'admin_course_registration/update_course_roster';
$route['api/admin/course-registration/backfill-envelopes'] = 'admin_course_registration/backfill_academic_session_envelopes';

$route['api/admin/results/reconciliation'] = 'admin_results/reconciliation';
$route['api/admin/results/reconciliation/action'] = 'admin_results/reconciliation_action';
$route['api/admin/results/reconciliation/export'] = 'admin_results/export_reconciliation_csv';

$route['api/admin/results/snapshots'] = 'admin_results/list_snapshots';
$route['api/admin/results/snapshots/create'] = 'admin_results/create_snapshot';
$route['api/admin/results/snapshots/item'] = 'admin_results/get_snapshot';
$route['api/admin/results/snapshots/sign-off'] = 'admin_results/sign_off_snapshot';
$route['api/public/verify-broadsheet/(:any)'] = 'admin_results/verify_broadsheet/$1';
$route['api/public/verify-broadsheet'] = 'admin_results/verify_broadsheet';

// Graduation Management
$route['api/admin/graduation/list'] = 'admin_graduation/get_list';
$route['api/admin/graduation/config']['get'] = 'admin_graduation/get_config';
$route['api/admin/graduation/config']['post'] = 'admin_graduation/save_config';
$route['api/admin/graduation/save-config'] = 'admin_graduation/save_config';
$route['api/admin/graduation/student-audit'] = 'admin_graduation/student_audit';
$route['api/admin/graduation/export'] = 'admin_graduation/export_csv';
