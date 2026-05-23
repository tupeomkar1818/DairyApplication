import { Redirect } from 'expo-router';

// Route everything through the branded auth splash first.
export default function Index() {
  return <Redirect href="/(auth)/splash" />;
}

