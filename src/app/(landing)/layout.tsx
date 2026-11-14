/**
 * The landing page plus a `modal` slot: following «Увійти» / «Зареєструватись» from the
 * landing opens the form over the blurred page (intercepted /login and /register). Opening
 * those URLs directly still renders the full pages in src/app/login and src/app/register.
 */
export default function LandingLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
