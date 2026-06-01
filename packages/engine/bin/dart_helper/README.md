# Dart Helper for Inscribe

This directory contains Dart utilities used by the Inscribe engine for structural code manipulation of Dart files.

## Utilities

- `bin/resolver.dart`: Finds the character range of one supported declaration using the `analyzer` package.
- `bin/validator.dart`: Performs syntax validation of a Dart candidate file.

## Setup

These utilities require the Dart SDK to be installed on the system.

Before use, run:

```sh
dart pub get
```

The engine compiles these scripts to cached Dart kernel files under the OS temp directory and then runs the cached kernels. Native helper binaries are not committed or required.

Supported resolver targets are top-level functions, classes, mixins, enums, named extensions, typedefs, methods, constructors addressed as `ClassName.new` or `ClassName.named`, and single-variable top-level or field declarations. Multi-variable declarations are intentionally unsupported because replacing one name would replace sibling declarations too.
