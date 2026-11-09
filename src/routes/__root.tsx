import { useEffect, type ReactNode } from "react";
import {
  Outlet,
  Link,
  useRouter,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/app/globals.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WoPhoto | Management Platform" },
      {
        name: "description",
        content:
          "Management and workflow tracking for photography and multimedia teams",
      },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  return (
    <RootDocument>
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">404 - Page Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page you were looking for does not exist.</p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </RootDocument>
  );
}

function RootComponent() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __TSR_ROUTER__?: typeof router }).__TSR_ROUTER__ = router;
    }
  }, [router]);

  return (
    <RootDocument>
      <ThemeProvider>
        <TooltipProvider>
          <Outlet />
        </TooltipProvider>
      </ThemeProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="antialiased font-sans">
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

