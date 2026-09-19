String paymentLabel(PaymentState state) => switch (state) {
      PaymentState.pending => 'pending',
      PaymentState.captured => 'captured',
      PaymentState.failed => 'failed',
    };

enum PaymentState { pending, captured, failed }
