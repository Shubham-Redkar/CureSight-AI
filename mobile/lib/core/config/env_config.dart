class EnvConfig {
  // Use http://127.0.0.1:5000 via ADB reverse proxy for physical Android devices
  // ADB command: adb reverse tcp:5000 tcp:5000
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://curesight-ai.onrender.com/api',
  );
}
