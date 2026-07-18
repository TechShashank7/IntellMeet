import { SignIn } from '@clerk/clerk-react';
import AuthLayout from '../layouts/AuthLayout';

const SignInPage = () => {
  return (
    <AuthLayout>
      <SignIn
        routing="path"
        path="/login"
        fallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: 'mx-auto w-full',
            card: 'shadow-none bg-transparent border-none sm:shadow-none sm:bg-transparent w-full',
            cardBox: 'shadow-none border-none',
            headerTitle: 'text-2xl font-bold text-zinc-900',
            headerSubtitle: 'text-zinc-500',
            socialButtonsBlockButton:
              'border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium transition-colors',
            socialButtonsBlockButtonText: 'font-medium',
            dividerLine: 'bg-zinc-200',
            dividerText: 'text-zinc-400 font-medium',
            formFieldLabel: 'text-zinc-700 font-medium',
            formFieldInput:
              'bg-zinc-50/50 border-zinc-200 focus:ring-primary focus:border-primary transition-all text-zinc-900 rounded-lg',
            formButtonPrimary:
              'bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20 transition-all font-medium py-2.5 rounded-lg',
            footerActionText: 'text-zinc-500',
            footerActionLink: 'text-primary hover:text-primary/80 font-medium hover:underline',
            identityPreviewText: 'text-zinc-700',
            identityPreviewEditButton: 'text-primary hover:text-primary/80',
          },
        }}
      />
    </AuthLayout>
  );
};

export default SignInPage;
