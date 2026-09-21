mixin AuditTrail {
  void record(String eventName) {
    debugPrint('audit: $eventName');
  }
}

void debugPrint(String message) {}
