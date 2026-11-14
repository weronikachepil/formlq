import { Suspense } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginModal() {
  return (
    <AuthModal label="Вхід">
      <Suspense>
        <LoginForm modal />
      </Suspense>
    </AuthModal>
  );
}
