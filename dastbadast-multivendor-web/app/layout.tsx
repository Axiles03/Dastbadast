import "./globals.css";
import { ApolloProviderClient } from "@/lib/apollo-provider";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";

export const metadata = { title: "Dastbadast" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="bg-soft-bg text-soft-text antialiased">
        <ApolloProviderClient>
          <AuthProvider>
            <CartProvider>{children}</CartProvider>
          </AuthProvider>
        </ApolloProviderClient>
      </body>
    </html>
  );
}
