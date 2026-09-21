import 'package:flutter/material.dart';

import '../models/activity.dart';

class ActivityFeedPage extends StatefulWidget {
  const ActivityFeedPage({super.key});

  @override
  State<ActivityFeedPage> createState() => _ActivityFeedPageState();
}

class _ActivityFeedPageState extends State<ActivityFeedPage> {
  late Stream<List<Activity>> _activities;

  @override
  void initState() {
    super.initState();
    _activities = ActivityRepository.instance.watch();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Activity feed')),
      body: StreamBuilder<List<Activity>>(
        stream: _activities,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return RetryPanel(onRetry: _retry);
          }

          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }

          final activities = snapshot.data!;
          return ListView.builder(
            itemCount: activities.length,
            itemBuilder: (context, index) {
              final activity = activities[index];
              return ActivityTile(
                activity: activity,
                onTap: () => _openActivity(activity.id),
                trailing: activity.isUnread
                    ? const Icon(Icons.circle, size: 10)
                    : null,
              );
            },
          );
        },
      ),
    );
  }

  Future<void> _retry() async {
    setState(() {
      _activities = ActivityRepository.instance.watch(forceRefresh: true);
    });
  }

  void _openActivity(String activityId) {
    Navigator.of(context).pushNamed('/activity/$activityId');
  }
}
