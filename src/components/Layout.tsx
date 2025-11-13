import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BarChart3, FileText, LayoutDashboard, Brain } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="text-2xl font-bold text-primary">
              Evaluate-Yourself
            </Link>
            
            <div className="flex items-center gap-6">
              <Link
                to="/dashboard"
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  isActive("/dashboard")
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link
                to="/reports"
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  isActive("/reports")
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Reports
              </Link>
              <Link
                to="/resume"
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  isActive("/resume")
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="w-4 h-4" />
                Resume
              </Link>
              <Link
                to="/self-insight"
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  isActive("/self-insight")
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Brain className="w-4 h-4" />
                Self Insight
              </Link>
              <SignedIn>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8",
                    },
                  }}
                />
              </SignedIn>
              <SignedOut>
                <Link to="/sign-in">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
              </SignedOut>
            </div>
          </div>
        </div>
      </nav>
      
      <main>{children}</main>
    </div>
  );
};
