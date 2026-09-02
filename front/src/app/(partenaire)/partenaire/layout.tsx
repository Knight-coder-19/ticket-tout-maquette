import { RailPartenaire } from "./RailPartenaire";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="espace">
      <RailPartenaire />
      <main>{children}</main>
    </div>
  );
}
