import { EnTetePublique } from "./EnTetePublique";
import { PiedDePage } from "./PiedDePage";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EnTetePublique />
      <main>{children}</main>
      <PiedDePage />
    </>
  );
}
