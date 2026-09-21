import 'package:flutter/material.dart';

import '../models/order.dart';

class OrderDetailsPage extends StatefulWidget {
  const OrderDetailsPage({
    super.key,
    required this.orderId,
  });

  final String orderId;

  @override
  State<OrderDetailsPage> createState() => _OrderDetailsPageState();
}

class _OrderDetailsPageState extends State<OrderDetailsPage> {
  late Future<Order> _order;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _order = _loadOrder();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Order details · München'),
        actions: [
          IconButton(
            tooltip: 'Save order',
            onPressed: _saving ? null : _save,
            icon: const Icon(Icons.save_outlined),
          ),
        ],
      ),
      body: FutureBuilder<Order>(
        future: _order,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return ErrorPanel(
              message: 'Could not load this order',
              onRetry: _refresh,
            );
          }

          final order = snapshot.data!;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: <Widget>[
                OrderSummary(order: order),
                const SizedBox(height: 16),
                if (order.isPaid) const PaidBanner(),
                for (final note in order.notes)
                  NoteCard(note: note),
                ...order.items.map(
                  (item) => OrderLineTile(
                    item: item,
                    onTap: () => _openProduct(item.productId),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<Order> _loadOrder() async {
    return OrderRepository.instance.fetch(widget.orderId);
  }

  Future<void> _refresh() async {
    setState(() {
      _order = _loadOrder();
    });
    await _order;
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await OrderRepository.instance.save(widget.orderId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Order saved')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Save failed')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _openProduct(String productId) {
    Navigator.of(context).pushNamed('/products/$productId');
  }
}
