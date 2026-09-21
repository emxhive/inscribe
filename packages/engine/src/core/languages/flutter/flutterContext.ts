import Parser from 'web-tree-sitter';
import { getDartStructuralMatch } from '../dartAdapter';
import { getSuperclassName } from './flutterAst';

export interface FlutterSourceContext {
  readonly localClassBases: ReadonlyMap<string, string>;
}

export const FLUTTER_WIDGET_BASE_NAMES = new Set([
  'Widget',
  'StatelessWidget',
  'StatefulWidget',
  'InheritedWidget',
  'ProxyWidget',
  'ParentDataWidget',
  'RenderObjectWidget',
  'LeafRenderObjectWidget',
  'SingleChildRenderObjectWidget',
  'MultiChildRenderObjectWidget',
]);

export function collectFlutterSourceContext(
  rootNode: Parser.SyntaxNode,
  source: string,
): FlutterSourceContext {
  const localClassBases = new Map<string, string>();

  const visit = (node: Parser.SyntaxNode): void => {
    if (node.type === 'class_definition') {
      const classMatch = getDartStructuralMatch(node, source, 'class');
      const baseName = getSuperclassName(node);
      if (classMatch?.name && baseName) {
        localClassBases.set(classMatch.name, baseName);
      }
    }

    for (let index = 0; index < node.namedChildCount; index++) {
      const child = node.namedChild(index);
      if (child) visit(child);
    }
  };

  visit(rootNode);
  return { localClassBases };
}

export function isFlutterWidgetSuperclass(
  node: Parser.SyntaxNode,
  context: FlutterSourceContext,
): boolean {
  const baseName = getSuperclassName(node);
  if (!baseName) return false;
  return isFlutterWidgetBaseName(baseName) || isLocallyWidgetDerived(baseName, context.localClassBases);
}

export function isFlutterWidgetBaseName(name: string): boolean {
  return FLUTTER_WIDGET_BASE_NAMES.has(name);
}

function isLocallyWidgetDerived(
  name: string,
  localClassBases: ReadonlyMap<string, string>,
  visiting = new Set<string>(),
): boolean {
  const baseName = localClassBases.get(name);
  if (!baseName || visiting.has(name)) return false;
  if (isFlutterWidgetBaseName(baseName)) return true;
  visiting.add(name);
  return isLocallyWidgetDerived(baseName, localClassBases, visiting);
}

