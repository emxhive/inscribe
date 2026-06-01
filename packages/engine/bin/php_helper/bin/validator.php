<?php

declare(strict_types=1);

use PhpParser\Error;
use PhpParser\Lexer;
use PhpParser\ParserFactory;

require dirname(__DIR__) . '/vendor/autoload.php';

if ($argc < 2) {
    fwrite(STDERR, "Usage: validator.php <file_path>\n");
    exit(1);
}

$filePath = $argv[1];
$content = @file_get_contents($filePath);
if ($content === false) {
    fwrite(STDERR, "ERROR_READING_FILE: {$filePath}\n");
    exit(1);
}

$parser = (new ParserFactory())->create(
    ParserFactory::PREFER_PHP7,
    new Lexer([
        'usedAttributes' => [
            'startFilePos',
            'endFilePos',
            'startLine',
        ],
    ])
);

try {
    $parser->parse($content);
    print_json(['status' => 'VALID']);
} catch (Error $error) {
    print_json([
        'status' => 'INVALID',
        'message' => "line {$error->getStartLine()}: {$error->getRawMessage()}",
    ]);
}

function print_json(array $payload): void
{
    echo json_encode($payload, JSON_UNESCAPED_SLASHES) . PHP_EOL;
}
