import 'dart:async';

import 'package:meta/meta.dart';

typedef CartListener = void Function(CartEvent event);

@immutable
abstract class CartController extends ChangeNotifier {
  const CartController.empty({
    this.items = const <CartItem>[],
    this.currency = 'EUR',
  });

  @visibleForTesting
  factory CartController.restore(
    List<CartItem> items, {
    String currency = 'EUR',
  }) = _RestoredCartController;

  final List<CartItem> items;
  final String currency;

  @protected
  Future<Receipt> submit({required String customerId}) async {
    if (items.isEmpty) {
      throw const CheckoutError('Cannot submit an empty cart');
    }

    if (currency != 'EUR') {
      throw CheckoutError('Unsupported currency: $currency');
    }

    var total = 0.0;
    for (final item in items) {
      total += item.total;
    }

    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        return await CheckoutApi.commit(
          customerId: customerId,
          total: total,
        );
      } on TimeoutException {
        if (attempt == 1) rethrow;
        await Future<void>.delayed(const Duration(milliseconds: 40));
      }
    }

    throw StateError('Unreachable submit state');
  }

  Stream<CartEvent> events() async* {
    yield const CartEvent('cart-opened');
    await Future<void>.delayed(const Duration(milliseconds: 5));
    yield const CartEvent('cart-ready');
  }

  void registerCallbacks(CartListener listener) {
    final onEvent = (CartEvent event) {
      if (event.name == 'checkout-failed') {
        notifyListeners();
      }
      listener(event);
    };

    void localAudit(CartEvent event) {
      if (event.name.isNotEmpty) {
        debugPrint('cart event: ${event.name}');
      }
    }

    localAudit(const CartEvent('registered'));
    onEvent(const CartEvent('registered'));
  }
}

class _RestoredCartController extends CartController {
  _RestoredCartController(List<CartItem> items, {String currency = 'EUR'})
      : super.empty(items: items, currency: currency);
}

@visibleForTesting
Future<Cart> loadSavedCart(Storage storage, String customerId) async {
  final saved = await storage.read('cart/$customerId.json');
  return Cart.fromJson(saved);
}

extension MoneyFormatting on Money {
  String get display => '${symbol ?? '€'}${amount.toStringAsFixed(2)}';
}

class CartItem {
  const CartItem(this.sku, this.total);

  final String sku;
  final double total;
}

class CartEvent {
  const CartEvent(this.name);

  final String name;
}

class Receipt {
  const Receipt(this.id);

  final String id;
}

class Cart {
  Cart.fromJson(String source) : raw = source;

  final String raw;
}

class Money {
  const Money(this.amount, {this.symbol});

  final double amount;
  final String? symbol;
}

enum PaymentState { pending, captured, failed }

class CheckoutError implements Exception {
  const CheckoutError(this.message);

  final String message;
}

class Storage {
  Future<String> read(String key) async => key;
}

class CheckoutApi {
  static Future<Receipt> commit({required String customerId, required double total}) async {
    return Receipt('$customerId-${total.toStringAsFixed(2)}');
  }
}

class ChangeNotifier {
  const ChangeNotifier();

  void notifyListeners() {}
}

void debugPrint(String message) {}
