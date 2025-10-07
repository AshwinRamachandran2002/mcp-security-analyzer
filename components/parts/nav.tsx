"use client";

// Component Imports
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ModeToggle } from "@/components/parts/mode-toggle";
import { LucideProps } from "lucide-react";

// Image Imports
import Logo from "@/public/logo.svg";

// Icon Imports
import { BarChart, Shield, Database, Zap, Search, FileSearch } from "lucide-react";

const links = [
  { href: "/", text: "Dashboard", icon: BarChart },
  { href: "/discovery", text: "Discovery", icon: Search },
  { href: "/analysis", text: "Analysis", icon: FileSearch },
  // { href: "/resources", text: "Visibility", icon: Database },
  // { href: "/generate-attacks", text: "Detections", icon: Zap },
  { href: "/attack-triage", text: "Attack Vectors", icon: Shield },
];

const otherLinks: typeof links = [];

export default function Nav() {

  return (
    <nav className="p-4 flex flex-col gap-4 justify-between h-screen">
      <div className="border bg-muted/50 rounded-lg flex flex-col justify-between p-6 h-full">
        <div className="flex flex-col gap-8">
          <div className="grid gap-2">
            {links.map((link) => (
              <NavLink key={link.href} icon={link.icon} href={link.href}>
                {link.text}
              </NavLink>
            ))}
            {otherLinks.map((link) => (
              <NavLink key={link.href} icon={link.icon} href={link.href}>
                {link.text}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-8">
          <div className="flex justify-between items-center gap-2">
            <ModeToggle />
            <p className="text-xs text-muted-foreground opacity-50">
              &copy; Agent Red Team, 2024
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  icon: React.ComponentType<LucideProps>;
  className?: string;
}

const NavLink = ({ href, children, icon: Icon, className }: NavLinkProps) => {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      className={`flex items-center gap-2 group p-2 rounded-md -ml-2 transition-all ${
        isActive 
          ? "bg-accent text-accent-foreground font-medium" 
          : "hover:bg-accent/50"
      } ${className}`}
      href={href}
    >
      <Icon
        className={`${
          isActive 
            ? "text-accent-foreground" 
            : "text-muted-foreground group-hover:text-foreground"
        } transition-all`}
        size={20}
      />
      {children}
    </Link>
  );
};
