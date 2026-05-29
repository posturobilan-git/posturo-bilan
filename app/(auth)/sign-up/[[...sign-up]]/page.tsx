import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      {/* Renders the invitation-acceptance flow when a __clerk_ticket is present,
          then sends the new account to the dashboard. */}
      <SignUp forceRedirectUrl="/dashboard" signInUrl="/sign-in" />
    </div>
  );
}
