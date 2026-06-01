# Dart Helper for Inscribe

This directory contains Dart utilities used by the Inscribe engine for structural code manipulation of Dart files.

## Utilities

- `bin/resolver.dart`: Finds the character range of a given symbol (class, function, method, etc.) in a Dart file using the `analyzer` package.
- `bin/validator.dart`: Performs a fast syntax validation of a Dart file.

## Setup

These utilities require the Dart SDK to be installed on the system.

Before use, run:
```bash
dart pub get
```

The Inscribe engine will attempt to run these using `dart run bin/resolver.dart` by default. For better performance, they can be compiled to native binaries:

```bash
mkdir -p bin
dart compile exe bin/resolver.dart -o bin/resolver
dart compile exe bin/validator.dart -o bin/validator
```
