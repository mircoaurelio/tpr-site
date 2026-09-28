<?php
declare(strict_types=1);
require __DIR__ . '/newsletter.php';

$checks = 0;
function check(bool $condition, string $description): void
{
    global $checks;
    if (!$condition) {
        throw new RuntimeException($description);
    }
    ++$checks;
}
$config = ['brevo_api_key' => 'test-secret', 'allowed_origins' => ['https://mircoaurelio.github.io']];
$request = ['HTTP_ORIGIN' => 'https://mircoaurelio.github.io', 'REQUEST_METHOD' => 'POST', 'CONTENT_TYPE' => 'application/json', 'REMOTE_ADDR' => '192.0.2.1'];
$valid = json_encode(['email' => ' Test@Example.com ', 'consent' => true, 'website' => '', 'listIds' => [999], 'attributes' => ['FONTE' => 'Other']]);
$calls = 0;
$transport = static function ($key, $payload) use (&$calls): int {
    ++$calls;
    check($key === 'test-secret', 'The provider receives the server key');
    check($payload === ['email' => 'test@example.com', 'listIds' => [2], 'attributes' => ['FONTE' => 'Landing'], 'updateEnabled' => true], 'List and source are fixed on the server');
    return $calls === 1 ? 201 : 204;
};
$allow = static fn($ip): bool => true;
foreach ([1, 2] as $iteration) {
    $result = tpr_newsletter($request, $valid, $config, $transport, $allow);
    check($result['status'] === 200 && $result['body'] === '{"success":true}', 'Creation and existing-contact update succeed');
    check($result['headers']['Access-Control-Allow-Origin'] === $request['HTTP_ORIGIN'], 'Allowed origin is echoed exactly');
    check($result['headers']['Cache-Control'] === 'no-store', 'Responses are not cached');
}
$never = static function (): int { throw new RuntimeException('Unexpected provider call'); };
foreach ([
    ['email' => 'bad', 'consent' => true],
    ['email' => 'test@example.com', 'consent' => false],
    ['email' => 'test@example.com', 'consent' => 'true'],
    ['email' => 'test@example.com', 'consent' => true, 'website' => 'spam'],
    ['email' => 'test@example.com', 'consent' => true, 'website' => null],
    ['email' => ['test@example.com'], 'consent' => true],
    ['email' => str_repeat('a', 250) . '@example.com', 'consent' => true],
] as $data) {
    check(tpr_newsletter($request, json_encode($data), $config, $never, $allow)['status'] === 400, 'Invalid input is rejected before Brevo');
}
foreach (['[1,2]', 'null', '{broken'] as $invalidJson) {
    check(tpr_newsletter($request, $invalidJson, $config, $never, $allow)['status'] === 400, 'Malformed or wrong-shape JSON is rejected');
}
check(tpr_newsletter(array_replace($request, ['HTTP_ORIGIN' => 'https://evil.example']), $valid, $config, $never, $allow)['status'] === 403, 'Untrusted origins are blocked');
$preflight = tpr_newsletter(array_replace($request, ['REQUEST_METHOD' => 'OPTIONS']), '', $config, $never, $allow);
check($preflight['status'] === 204 && $preflight['body'] === '', 'CORS preflight has no response body');
check(tpr_newsletter(array_replace($request, ['REQUEST_METHOD' => 'GET']), '', $config, $never, $allow)['status'] === 405, 'Only POST accepts subscriptions');
check(tpr_newsletter($request, $valid, array_replace($config, ['brevo_api_key' => '']), $never, $allow)['status'] === 503, 'Missing key fails closed');
check(tpr_newsletter(array_replace($request, ['CONTENT_TYPE' => 'text/plain']), $valid, $config, $never, $allow)['status'] === 415, 'Only JSON accepted');
check(tpr_newsletter($request, str_repeat('x', 4097), $config, $never, $allow)['status'] === 413, 'Actual body size is bounded');
check(tpr_newsletter(array_replace($request, ['CONTENT_LENGTH' => 4097]), '', $config, $never, $allow)['status'] === 413, 'Content length is bounded');
check(tpr_newsletter($request, $valid, $config, $never, static fn($ip): bool => false)['status'] === 429, 'Local rate limit rejects');
foreach ([400, 401, 500] as $status) {
    $result = tpr_newsletter($request, $valid, $config, static fn() => $status, $allow);
    check($result['status'] === 503 && $result['body'] === '{"success":false}', 'Provider failure never reports success');
}
check(tpr_newsletter($request, $valid, $config, static fn() => 429, $allow)['status'] === 429, 'Provider rate limit is preserved');
check(tpr_newsletter($request, $valid, $config, $never, $allow)['status'] === 503, 'Transport exception stays private');

$rateFile = tempnam(sys_get_temp_dir(), 'tpr-test-');
try {
    for ($i = 0; $i < 30; ++$i) {
        check(tpr_rate_limit($rateFile, '192.0.2.1', 'test-secret', 100), 'First 30 requests accepted');
    }
    check(!tpr_rate_limit($rateFile, '192.0.2.1', 'test-secret', 100), '31st request rejected');
    check(tpr_rate_limit($rateFile, '192.0.2.2', 'test-secret', 100), 'Clients have independent limits');
    check(!str_contains(file_get_contents($rateFile), '192.0.2.'), 'Raw IP is not persisted');
    check(tpr_rate_limit($rateFile, '192.0.2.1', 'test-secret', 700), 'Expired limit is cleared');
} finally {
    unlink($rateFile);
}
echo "$checks checks passed\n";
