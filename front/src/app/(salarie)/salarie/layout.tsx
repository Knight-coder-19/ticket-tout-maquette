import { RailSalarie } from "./RailSalarie";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="espace">
      <RailSalarie />
      <main>{children}</main>
    </div>
  );
}
