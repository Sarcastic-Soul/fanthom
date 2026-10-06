import { Nav } from "@/components/nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="app">
      <Nav />
      <main className="min-w-0">{children}</main>
    </div>
  );
}
