import { Link, useLocation } from "wouter";
import { ThemeToggle } from "./theme-toggle";
import { ShieldAlert, Activity, LayoutDashboard, Brain } from "lucide-react";

export function Navbar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Overview", icon: Activity },
    { href: "/predict", label: "Analyze", icon: Brain },
    { href: "/dashboard", label: "Intelligence", icon: LayoutDashboard },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center px-4 justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-foreground transition-colors hover:text-primary">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <span>Veritas<span className="text-muted-foreground font-mono font-medium ml-1">v1.0</span></span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 transition-colors hover:text-primary ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
          <div className="pl-4 border-l border-border/50">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
