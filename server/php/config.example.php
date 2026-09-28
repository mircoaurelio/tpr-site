<?php
declare(strict_types=1);

// Copy to config.php on the server, outside the document root. Never commit the key.
return [
    'brevo_api_key' => getenv('BREVO_API_KEY') ?: '',
    'allowed_origins' => [
        'https://mircoaurelio.github.io',
        'https://thepeoplesroom.it',
        'https://www.thepeoplesroom.it',
    ],
    'rate_limit_file' => __DIR__ . '/rate-limit.json',
];
