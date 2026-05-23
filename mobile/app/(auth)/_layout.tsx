import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="splash" />
      <Stack.Screen name="login" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="faq" />
      <Stack.Screen name="contact-admin" />
      <Stack.Screen name="privacy-policy" />
    </Stack>
  );
}

