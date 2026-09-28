<?php
declare(strict_types=1);
ini_set('display_errors', '0');

try {
    // Document root: server/php/public. Secrets and rate limits stay one level above.
    require dirname(__DIR__) . '/newsletter.php';
    $config = require dirname(__DIR__) . '/config.php';
    $body = file_get_contents('php://input', false, null, 0, 4097);
    $response = tpr_newsletter($_SERVER, $body === false ? '' : $body, $config);
    http_response_code($response['status']);
    foreach ($response['headers'] as $name => $value) {
        header($name . ': ' . $value);
    }
    echo $response['body'];
} catch (Throwable $error) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo '{"success":false}';
}
