import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/providers/auth_provider.dart';
import 'package:mobile/models/user_model.dart';

void main() {
  group('AuthState and Routing Logic tests', () {
    test('initial state has isInitializing = false (default constructor)', () {
      const state = AuthState();
      expect(state.isInitializing, false);
      expect(state.isLoading, false);
      expect(state.isAuthenticated, false);
    });

    test('isAuthenticated is true when user is present', () {
      final state = AuthState(
        user: UserModel(id: '1', username: 'test', role: 'DOCTOR'),
      );
      expect(state.isAuthenticated, true);
    });

    test('copyWith updates properties correctly', () {
      const state = AuthState();
      final newState = state.copyWith(isInitializing: true, isLoading: true);
      
      expect(newState.isInitializing, true);
      expect(newState.isLoading, true);
      expect(newState.isAuthenticated, false);
    });
  });
}
