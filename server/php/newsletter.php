<?php
declare(strict_types=1);

// Keep this file and config.php outside the public document root.
function tpr_rate_limit(string $path, string $client, string $secret, ?int $now = null): bool
{
    $now ??= time();
    $file = fopen($path, 'c+');
    if ($file === false) {
        throw new RuntimeException('Rate limit storage unavailable');
    }
    try {
        if (!flock($file, LOCK_EX)) {
            throw new RuntimeException('Rate limit lock unavailable');
        }
        $raw = stream_get_contents($file, 1500001);
        if ($raw === false || strlen($raw) > 1500000) {
            throw new RuntimeException('Rate limit storage invalid');
        }
        $entries = $raw === '' ? [] : json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($entries)) {
            throw new RuntimeException('Rate limit storage invalid');
        }
        foreach ($entries as $key => $entry) {
            if ($entry['expires'] <= $now) {
                unset($entries[$key]);
            }
        }
        // Persist a keyed hash, never the raw IP address or email.
        $key = hash_hmac('sha256', $client, $secret);
        $entry = $entries[$key] ?? ['count' => 0, 'expires' => $now + 600];
        $allowed = $entry['count'] < 30 && (isset($entries[$key]) || count($entries) < 10000);
        if ($allowed) {
            ++$entry['count'];
            $entries[$key] = $entry;
        }
        $encoded = json_encode($entries, JSON_THROW_ON_ERROR);
        rewind($file);
        if (!ftruncate($file, 0) || fwrite($file, $encoded) !== strlen($encoded) || !fflush($file)) {
            throw new RuntimeException('Rate limit storage write failed');
        }
        return $allowed;
    } finally {
        flock($file, LOCK_UN);
        fclose($file);
    }
}

function tpr_brevo_request(string $key, array $payload): int
{
    $curl = curl_init('https://api.brevo.com/v3/contacts');
    if ($curl === false) {
        throw new RuntimeException('Provider unavailable');
    }
    try {
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['api-key: ' . $key, 'Content-Type: application/json', 'Accept: application/json'],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_THROW_ON_ERROR),
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            // Discard provider bodies: only the status is needed.
            CURLOPT_WRITEFUNCTION => static fn($handle, string $chunk): int => strlen($chunk),
        ]);
        if (curl_exec($curl) === false) {
            throw new RuntimeException('Provider unavailable');
        }
        return (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    } finally {
        curl_close($curl);
    }
}

function tpr_newsletter(array $server, string $body, array $config, ?callable $transport = null, ?callable $limiter = null): array
{
    $headers = [
        'Content-Type' => 'application/json; charset=utf-8',
        'Cache-Control' => 'no-store',
        'X-Content-Type-Options' => 'nosniff',
        'Vary' => 'Origin',
    ];
    $origin = $server['HTTP_ORIGIN'] ?? '';
    $allowed = $origin !== '' && in_array($origin, $config['allowed_origins'] ?? [], true);
    if ($allowed) {
        $headers['Access-Control-Allow-Origin'] = $origin;
    }
    $reply = static fn(int $status, bool $success = false, array $extra = []): array => [
        'status' => $status,
        'headers' => array_merge($headers, $extra),
        'body' => $status === 204 ? '' : json_encode(['success' => $success]),
    ];
    if (!$allowed) {
        return $reply(403);
    }
    $method = $server['REQUEST_METHOD'] ?? '';
    if ($method === 'OPTIONS') {
        return $reply(204, false, [
            'Access-Control-Allow-Methods' => 'POST, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type',
            'Access-Control-Max-Age' => '600',
        ]);
    }
    if ($method !== 'POST') {
        return $reply(405, false, ['Allow' => 'POST, OPTIONS']);
    }
    $key = $config['brevo_api_key'] ?? '';
    if (!is_string($key) || $key === '') {
        return $reply(503);
    }
    if (!preg_match('~^application/json(?:\s*;|$)~i', $server['CONTENT_TYPE'] ?? '')) {
        return $reply(415);
    }
    if ((int) ($server['CONTENT_LENGTH'] ?? 0) > 4096 || strlen($body) > 4096) {
        return $reply(413);
    }
    try {
        $limiter ??= static fn(string $client): bool => tpr_rate_limit($config['rate_limit_file'], $client, $key);
        // REMOTE_ADDR must come from the server's trusted proxy configuration.
        if (!$limiter($server['REMOTE_ADDR'] ?? 'unknown')) {
            return $reply(429, false, ['Retry-After' => '600']);
        }
    } catch (Throwable $error) {
        return $reply(503);
    }
    try {
        $data = json_decode($body, false, 8, JSON_THROW_ON_ERROR);
    } catch (Throwable $error) {
        return $reply(400);
    }
    if (!is_object($data)) {
        return $reply(400);
    }
    $email = is_string($data->email ?? null) ? strtolower(trim($data->email)) : '';
    if (($data->consent ?? null) !== true || strlen($email) > 254
        || !preg_match('~^[^\s@]+@[^\s@]+\.[^\s@]+$~', $email)
        || (property_exists($data, 'website') && $data->website !== '')) {
        return $reply(400);
    }
    try {
        $transport ??= 'tpr_brevo_request';
        $status = $transport($key, [
            'email' => $email,
            'listIds' => [2],
            'attributes' => ['FONTE' => 'Landing'],
            'updateEnabled' => true,
        ]);
        if (in_array($status, [200, 201, 204], true)) {
            return $reply(200, true);
        }
        if ($status === 429) {
            return $reply(429, false, ['Retry-After' => '60']);
        }
    } catch (Throwable $error) {
        // Never expose provider details or credentials to the visitor or logs.
    }
    return $reply(503);
}
