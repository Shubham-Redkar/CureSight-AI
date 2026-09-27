import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final String currentRoute = GoRouterState.of(context).uri.path;

    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          DrawerHeader(
            decoration: const BoxDecoration(color: Color(0xFF0D9488)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: const [
                Text('CureSight AI', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                SizedBox(height: 8),
                Text('Clinical System', style: TextStyle(color: Colors.white70)),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.dashboard),
            title: const Text('Dashboard'),
            selected: currentRoute == '/dashboard',
            selectedColor: const Color(0xFF0D9488),
            selectedTileColor: const Color(0x1A0D9488),
            onTap: () {
              Navigator.pop(context); // Close drawer
              if (currentRoute != '/dashboard') {
                context.go('/dashboard'); // Reset stack to Dashboard
              }
            },
          ),
          ListTile(
            leading: const Icon(Icons.people),
            title: const Text('Patients'),
            selected: currentRoute.startsWith('/patients'),
            selectedColor: const Color(0xFF0D9488),
            selectedTileColor: const Color(0x1A0D9488),
            onTap: () {
              Navigator.pop(context);
              if (!currentRoute.startsWith('/patients')) {
                context.push('/patients');
              }
            },
          ),
          ListTile(
            leading: const Icon(Icons.assessment),
            title: const Text('Reports'),
            selected: currentRoute == '/reports',
            selectedColor: const Color(0xFF0D9488),
            selectedTileColor: const Color(0x1A0D9488),
            onTap: () {
              Navigator.pop(context);
              if (currentRoute != '/reports') {
                context.push('/reports');
              }
            },
          ),
        ],
      ),
    );
  }
}
