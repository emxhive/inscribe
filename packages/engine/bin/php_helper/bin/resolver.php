<?php

declare(strict_types=1);

use PhpParser\Error;
use PhpParser\Lexer;
use PhpParser\Node;
use PhpParser\ParserFactory;

require dirname(__DIR__) . '/vendor/autoload.php';

if ($argc < 3) {
    fwrite(STDERR, "Usage: resolver.php <file_path> <symbol_name>\n");
    exit(1);
}

$filePath = $argv[1];
$symbolName = $argv[2];
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
            'comments',
        ],
    ])
);

try {
    $stmts = $parser->parse($content) ?? [];
} catch (Error $error) {
    print_json([
        'status' => 'PARSE_ERROR',
        'message' => format_parse_error($error),
    ]);
    exit(0);
}

$matches = [];
collect_declaration_matches($stmts, $symbolName, '', null, $matches);

if (count($matches) === 0) {
    print_json(['status' => 'NOT_FOUND']);
    exit(0);
}

if (count($matches) > 1) {
    print_json([
        'status' => 'AMBIGUOUS',
        'matches' => array_map(static fn (array $match): string => $match['description'], $matches),
    ]);
    exit(0);
}

$match = $matches[0];
print_json([
    'status' => 'SUCCESS',
    'startByte' => $match['startByte'],
    'endByte' => $match['endByte'],
    'description' => $match['description'],
]);

function collect_declaration_matches(array $stmts, string $query, string $namespace, ?array $classContext, array &$matches): void
{
    foreach ($stmts as $stmt) {
        if ($stmt instanceof Node\Stmt\Namespace_) {
            $nextNamespace = $stmt->name?->toString() ?? '';
            collect_declaration_matches($stmt->stmts ?? [], $query, $nextNamespace, null, $matches);
            continue;
        }

        if ($stmt instanceof Node\Stmt\Function_) {
            $shortName = $stmt->name->toString();
            $fullName = qualify_name($namespace, $shortName);
            if (matches_named_declaration($query, $shortName, $fullName)) {
                $matches[] = build_match($stmt, "Function {$fullName}");
            }
            continue;
        }

        if ($stmt instanceof Node\Stmt\Class_
            || $stmt instanceof Node\Stmt\Interface_
            || $stmt instanceof Node\Stmt\Trait_
            || $stmt instanceof Node\Stmt\Enum_
        ) {
            $shortName = $stmt->name?->toString();
            $fullName = $shortName === null ? null : qualify_name($namespace, $shortName);

            if ($shortName !== null && $fullName !== null && matches_named_declaration($query, $shortName, $fullName)) {
                $matches[] = build_match($stmt, class_kind($stmt) . " {$fullName}");
            }

            $nextContext = [
                'shortName' => $shortName,
                'fullName' => $fullName,
                'kind' => class_kind($stmt),
            ];
            foreach ($stmt->stmts as $member) {
                if ($member instanceof Node\Stmt\ClassMethod) {
                    $methodName = $member->name->toString();
                    if (matches_method_declaration($query, $methodName, $nextContext)) {
                        $owner = $fullName ?? 'anonymous class';
                        $matches[] = build_match($member, "{$nextContext['kind']} method {$owner}::{$methodName}");
                    }
                }
            }
        }
    }
}

function matches_named_declaration(string $query, string $shortName, string $fullName): bool
{
    $normalizedQuery = ltrim($query, '\\');
    return $query === $shortName || $normalizedQuery === $fullName;
}

function matches_method_declaration(string $query, string $methodName, array $classContext): bool
{
    $normalizedQuery = ltrim($query, '\\');
    if ($query === $methodName) {
        return true;
    }

    $shortName = $classContext['shortName'];
    $fullName = $classContext['fullName'];

    return ($shortName !== null && $normalizedQuery === "{$shortName}::{$methodName}")
        || ($fullName !== null && $normalizedQuery === "{$fullName}::{$methodName}");
}

function qualify_name(string $namespace, string $shortName): string
{
    return $namespace === '' ? $shortName : "{$namespace}\\{$shortName}";
}

function class_kind(Node $node): string
{
    if ($node instanceof Node\Stmt\Interface_) {
        return 'Interface';
    }
    if ($node instanceof Node\Stmt\Trait_) {
        return 'Trait';
    }
    if ($node instanceof Node\Stmt\Enum_) {
        return 'Enum';
    }
    return 'Class';
}

function build_match(Node $node, string $description): array
{
    $start = declaration_start($node);
    $end = $node->getEndFilePos();

    if ($start < 0 || $end < 0) {
        fwrite(STDERR, "Missing parser file-position attributes.\n");
        exit(1);
    }

    return [
        'startByte' => $start,
        'endByte' => $end + 1,
        'description' => "{$description} at line {$node->getStartLine()}",
    ];
}

function declaration_start(Node $node): int
{
    $start = $node->getStartFilePos();

    foreach ($node->attrGroups ?? [] as $attributeGroup) {
        $attributeStart = $attributeGroup->getStartFilePos();
        if ($attributeStart >= 0) {
            $start = min($start, $attributeStart);
        }
    }

    $docComment = $node->getDocComment();
    if ($docComment !== null && $docComment->getStartFilePos() >= 0) {
        $start = min($start, $docComment->getStartFilePos());
    }

    return $start;
}

function format_parse_error(Error $error): string
{
    return "line {$error->getStartLine()}: {$error->getRawMessage()}";
}

function print_json(array $payload): void
{
    echo json_encode($payload, JSON_UNESCAPED_SLASHES) . PHP_EOL;
}
