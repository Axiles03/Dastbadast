import { SoftShell } from "@/components/SoftShell";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SoftShell>{children}</SoftShell>;
}
