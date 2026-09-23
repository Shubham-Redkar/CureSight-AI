const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  // Always include credentials to send HTTP-only cookie
  const mergedOptions: RequestInit = {
    ...options,
    credentials: "include",
  };

  // If endpoint is a full URL, use it directly, otherwise prepend API_URL
  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;
  const response = await fetch(url, mergedOptions);

  if (response.status === 401) {
    // Dispatch a custom event to notify the application that authentication failed
    window.dispatchEvent(new Event("auth_unauthorized"));
  }

  return response;
};
