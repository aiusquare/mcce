<?php
if (!defined('BASEPATH')) exit('No direct script access allowed');

class CorsHook {
    public function enable_cors() {
        if (!isset($_SERVER['REQUEST_METHOD'])) {
            return;
        }
        // Clean output buffer to ensure headers are sent
        if (ob_get_length()) {
            ob_clean();
        }
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
        $allowed_origins = array(
            'http://localhost:8080',
            'https://aacas-ft.web.app',
            'https://mcce.org.ng',
            'https://www.mcce.org.ng',
            'http://mcce.org.ng',
            'http://www.mcce.org.ng'
        );

        if ($origin && in_array($origin, $allowed_origins, true)) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
        } else {
            header('Access-Control-Allow-Origin: *');
        }
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, PATCH, DELETE');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Vary: Origin');
        // For preflighted requests
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit();
        }
    }
}
