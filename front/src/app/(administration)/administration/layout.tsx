import { RailAdministration } from "./RailAdministration";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="espace">
      <RailAdministration />
      <main>{children}</main>
    </div>
  );
}
