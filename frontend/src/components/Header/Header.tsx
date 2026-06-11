// import { useState } from "react";
// import { NavLink, useNavigate } from "react-router-dom";
// import { Button } from "@/components/ui/button";
// import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
//   DropdownMenuSeparator,
// } from "@/components/ui/dropdown-menu";
// import { Menu, Bell, User, Settings, LogOut, UserCircle } from "lucide-react";
// import { COMPANY_NAME, APP_NAME, ROUTES } from "@/utils/constants";

// interface HeaderProps {
//   onMenuClick?: () => void;
// }

// export const Header = ({ onMenuClick }: HeaderProps) => {
//   const [isNotificationOpen, setIsNotificationOpen] = useState(false);
//   const navigate = useNavigate();

//   const handleLogout = () => {
//     localStorage.removeItem("auth");
//     navigate("/");
//   };

//   return (
//     <header className="sticky top-0 z-50 w-full border-b bg-[hsl(var(--header-bg))] text-[hsl(var(--header-foreground))]">
//       <div className="flex h-16 items-center justify-between px-4 md:px-6">
//         {/* Left side - Logo */}
//         <div className="flex items-center gap-3">
//           <Button
//             variant="ghost"
//             size="icon"
//             className="text-[hsl(var(--header-foreground))] hover:bg-[hsl(var(--primary-hover))] lg:hidden"
//             onClick={onMenuClick}
//           >
//             <Menu className="h-5 w-5" />
//           </Button>

//           <div className="flex items-center gap-3">
//             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--header-foreground))] text-[hsl(var(--header-bg))] font-bold">
//               NT
//             </div>
//             <div className="hidden sm:block">
//               <h1 className="text-lg font-semibold">INOC Duty Roster</h1>
//               <p className="text-xs opacity-90">{COMPANY_NAME}</p>
//             </div>
//           </div>
//         </div>

//         {/* Right side - Actions */}
//         <div className="flex items-center gap-2">
//           <Button
//             variant="ghost"
//             size="icon"
//             className="text-[hsl(var(--header-foreground))] hover:bg-[hsl(var(--primary-hover))]"
//             onClick={() => setIsNotificationOpen(!isNotificationOpen)}
//           >
//             <Bell className="h-5 w-5" />
//           </Button>

//           <Button
//             variant="ghost"
//             size="icon"
//             className="text-[hsl(var(--header-foreground))] hover:bg-[hsl(var(--primary-hover))]"
//           >
//             <Settings className="h-5 w-5" />
//           </Button>

//           <DropdownMenu>
//             <DropdownMenuTrigger asChild>
//               <Button
//                 variant="ghost"
//                 size="icon"
//                 className="text-[hsl(var(--header-foreground))] hover:bg-[hsl(var(--primary-hover))]"
//               >
//                 <User className="h-5 w-5" />
//               </Button>
//             </DropdownMenuTrigger>
//             <DropdownMenuContent align="end" className="w-48">
//               <DropdownMenuItem className="cursor-pointer">
//                 <UserCircle className="mr-2 h-4 w-4" />
//                 View Profile
//               </DropdownMenuItem>
//               <DropdownMenuSeparator />
//               <DropdownMenuItem
//                 className="cursor-pointer text-red-600 focus:text-red-600"
//                 onClick={handleLogout}
//               >
//                 <LogOut className="mr-2 h-4 w-4" />
//                 Logout
//               </DropdownMenuItem>
//             </DropdownMenuContent>
//           </DropdownMenu>
//         </div>
//       </div>
//     </header>
//   );
// };

import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Menu } from "lucide-react";
import { COMPANY_NAME, APP_NAME, ROUTES } from "@/utils/constants";
import logo from "../../assets/telecom.png"; // Adjust path if needed
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick?: () => void;
  isCollapsed?: boolean;
}

export const Header = ({ onMenuClick, isCollapsed = true }: HeaderProps) => {
  const { logout } = useAuth();
  const [appVersion, setAppVersion] = useState<string>(
    localStorage.getItem("app_version") || import.meta.env.VITE_APP_VERSION || "v1.0.0-dev"
  );

  useEffect(() => {
    api.get("system-settings/")
      .then(res => {
        if (res.data.image_version) {
          setAppVersion(res.data.image_version);
          localStorage.setItem("app_version", res.data.image_version);
        }
      })
      .catch(err => console.error("Failed to fetch system version in Header", err));
  }, []);

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b bg-[hsl(var(--header-bg))] text-[hsl(var(--header-foreground))]">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left side - Logo */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-[hsl(var(--header-foreground))] hover:bg-white/10 group active:scale-95 transition-all lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className={cn("h-5 w-5 transition-transform duration-300 ease-in-out", isCollapsed ? "rotate-0" : "rotate-180")} />
          </Button>

          <div className="flex items-center gap-3">
            {/* Logo container */}
            <div className="h-10 w-10 flex items-center justify-center rounded-lg overflow-hidden">
              <img
                src={logo}
                alt="Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="hidden sm:flex flex-col justify-center">
              <h1 className="text-base font-semibold leading-tight">Duty Chart Management System</h1>
              <p className="text-[10px] opacity-90 leading-tight mt-0.5">{COMPANY_NAME}</p>
              <p className="text-[9px] opacity-75 font-mono leading-tight mt-0.5">{appVersion}</p>
            </div>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          {/* Profile button removed (moved to sidebar profile section) */}
        </div>
      </div>
    </header>
  );
};
