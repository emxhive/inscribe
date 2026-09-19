import 'package:flutter/material.dart';

class CatalogSummaryCard extends StatelessWidget {
  const CatalogSummaryCard({
    super.key,
    required this.product,
    required this.onOpen,
  });

  final CatalogProduct product;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    final badges = <Widget>[
      if (product.isFeatured) const FeaturedBadge(),
      for (final tag in product.tags) TagChip(label: tag),
    ];

    return Card(
      child: InkWell(
        onTap: () => onOpen(product.id),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(product.name, style: Theme.of(context).textTheme.titleMedium),
                    Text(product.priceLabel),
                    Wrap(spacing: 4, children: badges),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}

class CatalogProduct {
  const CatalogProduct(this.id, this.name, this.priceLabel, this.tags, {this.isFeatured = false});

  final String id;
  final String name;
  final String priceLabel;
  final List<String> tags;
  final bool isFeatured;
}

class FeaturedBadge extends StatelessWidget {
  const FeaturedBadge({super.key});

  @override
  Widget build(BuildContext context) => const Chip(label: Text('Featured'));
}

class TagChip extends StatelessWidget {
  const TagChip({required this.label, super.key});

  final String label;

  @override
  Widget build(BuildContext context) => Chip(label: Text(label));
}
