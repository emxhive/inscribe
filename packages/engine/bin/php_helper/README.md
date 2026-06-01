# PHP Helper for Inscribe

This directory contains PHP utilities used by the Inscribe engine for structural PHP parsing.

## Setup

Install dependencies before using PHP `replace_symbol` support:

```sh
composer install
```

The helper requires PHP 8.1 or newer and `nikic/php-parser`. The engine invokes these scripts with the local `php` executable and does not commit `vendor/`.

## Utilities

- `bin/resolver.php`: resolves a supported declaration to byte offsets using `nikic/php-parser`.
- `bin/validator.php`: validates PHP candidate syntax using the same parser dependency.
