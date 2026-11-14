import { Suspense } from "react";
import { AuthModal } from "@/components/auth/AuthModal";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterModal() {
  return (
    <AuthModal label="Реєстрація">
      <Suspense>
        <RegisterForm modal />
      </Suspense>
    </AuthModal>
  );
}
