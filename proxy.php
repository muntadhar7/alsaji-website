<?php
// proxy.php - CORS Proxy for Odoo API
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Only allow POST requests for security
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit(0);
}

// Get the JSON data from the request
$input = file_get_contents('php://input');
if (empty($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'No data received']);
    exit(0);
}

// Validate JSON
$data = json_decode($input, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON: ' . json_last_error_msg()]);
    exit(0);
}

// Odoo endpoint (you can make this configurable if needed)
$odoo_url = 'https://alsajigroup-staging-24665929.dev.odoo.com/jsonrpc';

// Prepare the request to Odoo
$options = [
    'http' => [
        'header'  => [
            'Content-Type: application/json',
            'User-Agent: AlSaji-Website/1.0',
            'Accept: application/json'
        ],
        'method'  => 'POST',
        'content' => $input,
        'timeout' => 30, // 30 second timeout
        'ignore_errors' => true // Don't fail on HTTP error codes
    ],
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false
    ]
];

// Create context and make the request
$context = stream_context_create($options);
$response = @file_get_contents($odoo_url, false, $context);

if ($response === FALSE) {
    // Get the error details
    $error = error_get_last();
    http_response_code(500);
    echo json_encode([
        'error' => 'Proxy request failed',
        'details' => $error['message'] ?? 'Unknown error'
    ]);
    exit(0);
}

// Get the HTTP response code
if (isset($http_response_header[0])) {
    preg_match('/HTTP\/[0-9\.]+\s+([0-9]+)/', $http_response_header[0], $matches);
    $http_code = $matches[1] ?? 200;

    // Forward the HTTP status code
    http_response_code((int)$http_code);
}

// Return the Odoo response
echo $response;
?>