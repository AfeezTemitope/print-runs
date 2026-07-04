import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '../register/AuthForm';

export const metadata: Metadata = { title: 'Login' };

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
