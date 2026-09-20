import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  createFlutterLanguageAdapter,
  createLanguageRegistry,
  FLUTTER_STRUCTURAL_KINDS,
} from '../../src/v2/languages';
import { createAdapterStructuralResolver } from '../../src/v2/structural/resolveStructuralTarget';

const CORE_WASM = path.resolve(__dirname, '../../../../node_modules/web-tree-sitter/tree-sitter.wasm');
const DART_WASM = path.resolve(__dirname, '../../assets/tree-sitter-dart.wasm');
const ASSETS = {
  coreWasmPath: CORE_WASM,
  languageWasmPaths: { dart: DART_WASM },
};

const orderDetails = fs.readFileSync(
  path.resolve(__dirname, '../../benchmarks/v2-structural-conformance/fixtures/flutter/order_details_page.dart'),
  'utf8',
);
const activityFeed = fs.readFileSync(
  path.resolve(__dirname, '../../benchmarks/v2-structural-conformance/fixtures/flutter/activity_feed_page.dart'),
  'utf8',
);

const resolver = createAdapterStructuralResolver(
  createLanguageRegistry([createFlutterLanguageAdapter(ASSETS)]),
);

describe('Flutter structural adapter', () => {
  it('publishes only the semantic Flutter capability vocabulary', () => {
    expect(createFlutterLanguageAdapter(ASSETS).structural.supportedKinds).toEqual([
      'class',
      'constructor',
      'method',
      'function',
      'for_statement',
      'while_statement',
      'switch_statement',
      'if_statement',
      ...FLUTTER_STRUCTURAL_KINDS,
    ]);
  });

  it('targets widget declarations while retaining ordinary Dart class semantics', async () => {
    const match = await resolver({
      source: orderDetails,
      filePath: 'lib/order_details_page.dart',
      selector: { path: [{ kind: 'widget', name: 'OrderDetailsPage' }] },
    });

    expect(orderDetails.slice(match.start, match.end)).toContain('extends StatefulWidget');
    expect(orderDetails.slice(match.start, match.end)).not.toContain('class _OrderDetailsPageState');

    const ordinaryClass = await resolver({
      source: orderDetails,
      filePath: 'lib/order_details_page.dart',
      selector: { path: [{ kind: 'class', name: '_OrderDetailsPageState' }] },
    });
    expect(orderDetails.slice(ordinaryClass.start, ordinaryClass.end)).toContain('extends State');

    await expect(resolver({
      source: orderDetails,
      filePath: 'lib/order_details_page.dart',
      selector: { path: [{ kind: 'widget', name: '_OrderDetailsPageState' }] },
    })).rejects.toThrow('TARGET_NOT_FOUND');
  });

  it('isolates builder callbacks and their conditional UI branches', async () => {
    const callback = await resolver({
      source: orderDetails,
      filePath: 'lib/order_details_page.dart',
      selector: {
        path: [
          { kind: 'class', name: '_OrderDetailsPageState' },
          { kind: 'method', name: 'build' },
          { kind: 'builder_callback', name: 'builder' },
        ],
      },
    });
    expect(orderDetails.slice(callback.start, callback.end)).toMatch(/^\(context, snapshot\) \{/);
    expect(orderDetails.slice(callback.start, callback.end)).not.toContain('builder:');

    const branch = await resolver({
      source: orderDetails,
      filePath: 'lib/order_details_page.dart',
      selector: {
        path: [
          { kind: 'class', name: '_OrderDetailsPageState' },
          { kind: 'method', name: 'build' },
          { kind: 'builder_callback', name: 'builder' },
          { kind: 'builder_branch' },
        ],
        startsWith: 'if (snapshot.hasError)',
      },
    });
    expect(orderDetails.slice(branch.start, branch.end)).toMatch(/^if \(snapshot\.hasError\)/);
  });

  it('targets collection control-flow entries and widget subtrees independently', async () => {
    const collectionIf = await resolver({
      source: orderDetails,
      filePath: 'lib/order_details_page.dart',
      selector: {
        path: [
          { kind: 'class', name: '_OrderDetailsPageState' },
          { kind: 'method', name: 'build' },
          { kind: 'builder_callback', name: 'builder' },
          { kind: 'collection_if' },
        ],
        startsWith: 'if (order.isPaid)',
      },
    });
    expect(orderDetails.slice(collectionIf.start, collectionIf.end)).toBe(
      'if (order.isPaid) const PaidBanner()',
    );

    const collectionFor = await resolver({
      source: orderDetails,
      filePath: 'lib/order_details_page.dart',
      selector: {
        path: [
          { kind: 'class', name: '_OrderDetailsPageState' },
          { kind: 'method', name: 'build' },
          { kind: 'builder_callback', name: 'builder' },
          { kind: 'collection_for' },
        ],
        startsWith: 'for (final note in order.notes)',
      },
    });
    expect(orderDetails.slice(collectionFor.start, collectionFor.end)).toContain('NoteCard(note: note)');

    const subtree = await resolver({
      source: orderDetails,
      filePath: 'lib/order_details_page.dart',
      selector: {
        path: [
          { kind: 'class', name: '_OrderDetailsPageState' },
          { kind: 'method', name: 'build' },
          { kind: 'builder_callback', name: 'builder' },
          { kind: 'widget_subtree', name: 'ListView' },
        ],
      },
    });
    expect(orderDetails.slice(subtree.start, subtree.end)).toMatch(/^ListView\(/);
    expect(orderDetails.slice(subtree.start, subtree.end)).toContain('OrderLineTile');
  });

  it('isolates list builders and event callbacks without absorbing the row widget', async () => {
    const itemBuilder = await resolver({
      source: activityFeed,
      filePath: 'lib/activity_feed_page.dart',
      selector: {
        path: [
          { kind: 'class', name: '_ActivityFeedPageState' },
          { kind: 'method', name: 'build' },
          { kind: 'builder_callback', name: 'builder' },
          { kind: 'builder_callback', name: 'itemBuilder' },
        ],
      },
    });
    expect(activityFeed.slice(itemBuilder.start, itemBuilder.end)).toMatch(/^\(context, index\) \{/);

    const eventCallback = await resolver({
      source: activityFeed,
      filePath: 'lib/activity_feed_page.dart',
      selector: {
        path: [
          { kind: 'class', name: '_ActivityFeedPageState' },
          { kind: 'method', name: 'build' },
          { kind: 'builder_callback', name: 'builder' },
          { kind: 'builder_callback', name: 'itemBuilder' },
          { kind: 'event_callback', name: 'onTap' },
        ],
      },
    });
    expect(activityFeed.slice(eventCallback.start, eventCallback.end)).toBe(
      '() => _openActivity(activity.id)',
    );
    expect(activityFeed.slice(eventCallback.start, eventCallback.end)).not.toContain('ActivityTile(');
  });

  it('recognizes arbitrary custom widget names from Flutter construction context', async () => {
    const source = `import 'package:flutter/widgets.dart';

class CheckoutPage extends StatelessWidget {
  const CheckoutPage({super.key});

  @override
  Widget build(BuildContext context) {
    final ignored = SomeService.create();
    final ignoredObject = SomeService();
    final ignoredDate = DateTime.now();
    return Column(
      children: <Widget>[
        ProfileHeader(user: user),
        UserAvatar(user: user),
        CheckoutSummary(total: total),
        EmptyState(),
        ProductGrid(items: items),
        Image.network(imageUrl),
        Image.asset(assetPath),
        Text.rich(TextSpan(text: title)),
        OrderOverview.compact(order: order),
        Padding(
          padding: EdgeInsets.all(8),
          child: Text(title),
        ),
        Text(title, style: Theme.of(context).textTheme.titleMedium),
      ],
    );
  }
}`;

    for (const name of ['ProfileHeader', 'UserAvatar', 'CheckoutSummary', 'EmptyState', 'ProductGrid']) {
      const match = await resolver({
        source,
        filePath: 'lib/checkout_page.dart',
        selector: {
          path: [
            { kind: 'class', name: 'CheckoutPage' },
            { kind: 'method', name: 'build' },
            { kind: 'widget_subtree', name },
          ],
        },
      });
      expect(source.slice(match.start, match.end)).toMatch(new RegExp(`^${name}\\(`));
    }

    for (const member of ['network', 'asset']) {
      const match = await resolver({
        source,
        filePath: 'lib/checkout_page.dart',
        selector: {
          path: [
            { kind: 'class', name: 'CheckoutPage' },
            { kind: 'method', name: 'build' },
            { kind: 'widget_subtree', name: 'Image' },
          ],
          startsWith: `Image.${member}`,
        },
      });
      expect(source.slice(match.start, match.end)).toMatch(new RegExp(`^Image\\.${member}\\(`));
    }

    const richText = await resolver({
      source,
      filePath: 'lib/checkout_page.dart',
      selector: {
        path: [
          { kind: 'class', name: 'CheckoutPage' },
          { kind: 'method', name: 'build' },
          { kind: 'widget_subtree', name: 'Text' },
        ],
        startsWith: 'Text.rich',
      },
    });
    expect(source.slice(richText.start, richText.end)).toMatch(/^Text\.rich\(/);

    const namedCustom = await resolver({
      source,
      filePath: 'lib/checkout_page.dart',
      selector: {
        path: [
          { kind: 'class', name: 'CheckoutPage' },
          { kind: 'method', name: 'build' },
          { kind: 'widget_subtree', name: 'OrderOverview' },
        ],
      },
    });
    expect(source.slice(namedCustom.start, namedCustom.end)).toMatch(/^OrderOverview\.compact\(/);

    await expect(resolver({
      source,
      filePath: 'lib/checkout_page.dart',
      selector: {
        path: [
          { kind: 'class', name: 'CheckoutPage' },
          { kind: 'method', name: 'build' },
          { kind: 'widget_subtree', name: 'SomeService' },
        ],
      },
    })).rejects.toThrow('TARGET_NOT_FOUND');

    await expect(resolver({
      source,
      filePath: 'lib/checkout_page.dart',
      selector: {
        path: [
          { kind: 'class', name: 'CheckoutPage' },
          { kind: 'method', name: 'build' },
          { kind: 'widget_subtree', name: 'DateTime' },
        ],
      },
    })).rejects.toThrow('TARGET_NOT_FOUND');

    for (const name of ['EdgeInsets', 'Theme', 'TextSpan']) {
      await expect(resolver({
        source,
        filePath: 'lib/checkout_page.dart',
        selector: {
          path: [
            { kind: 'class', name: 'CheckoutPage' },
            { kind: 'method', name: 'build' },
            { kind: 'widget_subtree', name },
          ],
        },
      })).rejects.toThrow('TARGET_NOT_FOUND');
    }
  });

  it('does not let widget context cross an event callback ownership boundary', async () => {
    const source = `import 'package:flutter/widgets.dart';

class CallbackPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: () => SomeService.create(),
        child: ProfileHeader(),
      );
}`;

    await expect(resolver({
      source,
      filePath: 'lib/callback_page.dart',
      selector: {
        path: [
          { kind: 'class', name: 'CallbackPage' },
          { kind: 'method', name: 'build' },
          { kind: 'widget_subtree', name: 'SomeService' },
        ],
      },
    })).rejects.toThrow('TARGET_NOT_FOUND');
  });

  it('requires direct widget expressions in expression-bodied builds and builders', async () => {
    const source = `import 'package:flutter/widgets.dart';

class SlotPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) => FutureBuilder(
        builder: (context, snapshot) => Padding(
          padding: EdgeInsets.all(8),
          child: Text.rich(TextSpan(text: snapshot.data)),
        ),
      );
}`;

    const buildResult = await resolver({
      source,
      filePath: 'lib/slot_page.dart',
      selector: {
        path: [
          { kind: 'class', name: 'SlotPage' },
          { kind: 'method', name: 'build' },
          { kind: 'widget_subtree', name: 'FutureBuilder' },
        ],
      },
    });
    expect(source.slice(buildResult.start, buildResult.end)).toMatch(/^FutureBuilder\(/);

    const builderResult = await resolver({
      source,
      filePath: 'lib/slot_page.dart',
      selector: {
        path: [
          { kind: 'class', name: 'SlotPage' },
          { kind: 'method', name: 'build' },
          { kind: 'builder_callback', name: 'builder' },
          { kind: 'widget_subtree', name: 'Padding' },
        ],
      },
    });
    expect(source.slice(builderResult.start, builderResult.end)).toMatch(/^Padding\(/);

    for (const name of ['EdgeInsets', 'TextSpan']) {
      await expect(resolver({
        source,
        filePath: 'lib/slot_page.dart',
        selector: {
          path: [
            { kind: 'class', name: 'SlotPage' },
            { kind: 'method', name: 'build' },
            { kind: 'widget_subtree', name },
          ],
        },
      })).rejects.toThrow('TARGET_NOT_FOUND');
    }
  });

  it('restricts collection control flow to widget-valued collections', async () => {
    const source = `import 'package:flutter/widgets.dart';

class CollectionPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final values = <int>[
      if (hasValues) 1,
      for (final value in values) value,
    ];
    final List<Widget> typedValues = [
      if (showTyped) ProfileHeader(),
    ];
    return Column(
      children: <Widget>[
        if (showHeader) ProfileHeader(),
        for (final profile in profiles) UserAvatar(profile: profile),
      ],
    );
  }
}`;

    const widgetIf = await resolver({
      source,
      filePath: 'lib/collection_page.dart',
      selector: {
        path: [
          { kind: 'class', name: 'CollectionPage' },
          { kind: 'method', name: 'build' },
          { kind: 'collection_if' },
        ],
        startsWith: 'if (showHeader)',
      },
    });
    expect(source.slice(widgetIf.start, widgetIf.end)).toContain('ProfileHeader()');

    const widgetFor = await resolver({
      source,
      filePath: 'lib/collection_page.dart',
      selector: {
        path: [
          { kind: 'class', name: 'CollectionPage' },
          { kind: 'method', name: 'build' },
          { kind: 'collection_for' },
        ],
        startsWith: 'for (final profile in profiles)',
      },
    });
    expect(source.slice(widgetFor.start, widgetFor.end)).toContain('UserAvatar(profile: profile)');

    const explicitlyTypedWidgetIf = await resolver({
      source,
      filePath: 'lib/collection_page.dart',
      selector: {
        path: [
          { kind: 'class', name: 'CollectionPage' },
          { kind: 'method', name: 'build' },
          { kind: 'collection_if' },
        ],
        startsWith: 'if (showTyped)',
      },
    });
    expect(source.slice(explicitlyTypedWidgetIf.start, explicitlyTypedWidgetIf.end)).toContain(
      'ProfileHeader()',
    );

    await expect(resolver({
      source,
      filePath: 'lib/collection_page.dart',
      selector: {
        path: [
          { kind: 'class', name: 'CollectionPage' },
          { kind: 'method', name: 'build' },
          { kind: 'collection_if' },
        ],
        startsWith: 'if (hasValues)',
      },
    })).rejects.toThrow('TARGET_QUALIFIER_NOT_MATCHED');

    await expect(resolver({
      source,
      filePath: 'lib/collection_page.dart',
      selector: {
        path: [
          { kind: 'class', name: 'CollectionPage' },
          { kind: 'method', name: 'build' },
          { kind: 'collection_for' },
        ],
        startsWith: 'for (final value in values)',
      },
    })).rejects.toThrow('TARGET_QUALIFIER_NOT_MATCHED');
  });

  it('proves local widget inheritance transitively without resolving imported bases', async () => {
    const source = `import 'package:flutter/widgets.dart';

class LocalBase extends StatelessWidget {
  @override
  Widget build(BuildContext context) => const Placeholder();
}

class Middle extends LocalBase {}
class Leaf extends Middle {}
class ImportedDerived extends ExternalBaseWidget {}`;

    for (const name of ['LocalBase', 'Middle', 'Leaf']) {
      const match = await resolver({
        source,
        filePath: 'lib/inheritance.dart',
        selector: { path: [{ kind: 'widget', name }] },
      });
      expect(source.slice(match.start, match.end)).toContain(`class ${name}`);
    }

    await expect(resolver({
      source,
      filePath: 'lib/inheritance.dart',
      selector: { path: [{ kind: 'widget', name: 'ImportedDerived' }] },
    })).rejects.toThrow('TARGET_NOT_FOUND');
  });

  it('does not activate Flutter selectors for ordinary Dart source', async () => {
    const source = `class PlainThing {\n  void run() {}\n}\n`;
    await expect(resolver({
      source,
      filePath: 'lib/plain_thing.dart',
      selector: { path: [{ kind: 'widget', name: 'PlainThing' }] },
    })).rejects.toThrow('TARGET_NOT_FOUND');

    const unknownBase = `class ImportedStyleThing extends ExternalPageWidget {}`;
    await expect(resolver({
      source: unknownBase,
      filePath: 'lib/imported_style_thing.dart',
      selector: { path: [{ kind: 'widget', name: 'ImportedStyleThing' }] },
    })).rejects.toThrow('TARGET_NOT_FOUND');
  });
});
