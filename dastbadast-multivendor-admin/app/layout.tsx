import "./globals.css";
import { ApolloProviderClient } from "@/lib/apollo-provider";
import { AuthProvider } from "@/lib/auth-context";
import { TopBar } from "@/components/TopBar";

export const metadata = { title: "Dastbadast · Admin" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="bg-soft-bg text-soft-text min-h-screen antialiased">
        <ApolloProviderClient>
          <AuthProvider>
            <TopBar />
            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
              {children}
            </main>
          </AuthProvider>
        </ApolloProviderClient>
      </body>
    </html>
  );
}
