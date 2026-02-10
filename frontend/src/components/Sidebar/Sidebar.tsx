import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Home,
  Calendar,
  Users,
  BarChart3,
  Settings,
  ClipboardList,
  Clock,
  FileText,
  ChevronDown,
  ShieldAlert,
  Mail,
  Building2,
  Landmark
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ROUTES } from '@/utils/constants';
import { NavItem } from '@/types';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, UserCircle } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navigationItems: (NavItem & { permission?: string })[] = [
  {
    title: 'Dashboard',
    href: ROUTES.DASHBOARD,
    icon: 'Home'
  },
  // {
  //   title: 'Duty Chart',
  //   href: ROUTES.DUTY_CHART,
  //   icon: 'Calendar',
  //   permission: 'duties.view_chart'
  // },

  {
    title: 'Duty Schedule Template',
    href: ROUTES.TEMPLATE_SCHEDULE,
    icon: 'ClipboardList',
    permission: 'schedule_templates.view'
  },

  {
    title: 'Office Duty Schedule',
    href: ROUTES.DUTY_SCHEDULE,
    icon: 'FileText',
    permission: 'schedules.view_office_schedule'
  },

  {
    title: 'Duty Calendar',
    href: ROUTES.DUTY_CALENDAR,
    icon: 'Calendar',
    permission: 'duties.view_chart'
  },
  {
    title: 'Employees',
    href: ROUTES.EMPLOYEES,
    icon: 'Users',
    permission: 'users.view_employee'
  },
  {
    title: 'Organization',
    icon: 'Building2',
    children: [
      {
        title: 'Directorates',
        href: ROUTES.DIRECTORATES,
        icon: 'Building2',
        permission: 'org.view_directorate',
      },
      {
        title: 'Accounting Offices',
        href: ROUTES.ACCOUNTING_OFFICES,
        icon: 'Landmark',
        permission: 'org.view_accounting_office',
      },
      {
        title: 'CC Offices',
        href: ROUTES.CC_OFFICES,
        icon: 'Landmark',
        permission: 'org.view_cc_office',
      },
    ]
  },
  {
    title: 'Reports',
    icon: 'BarChart3',
    permission: 'duties.view_chart',
    children: [

      {
        title: 'Duty Report (अनुसूची-२)',
        href: ROUTES.ANNEX_II_REPORT,
        icon: 'FileText'
      }
    ]
  },
  {
    title: 'Settings',
    href: ROUTES.SETTINGS,
    icon: 'Settings',
    permission: 'system.view_settings'
  }
];

const iconMap = {
  Home,
  Calendar,
  Users,
  BarChart3,
  Settings,
  ClipboardList,
  Clock,
  FileText,
  Building2,
  Landmark
};

export const Sidebar = ({ isOpen = true, onClose }: SidebarProps) => {
  const { hasPermission, isLoading, user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = (name?: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  const roleLabel = (role?: string) => {
    switch (role) {
      case "SUPERADMIN": return "Superadmin";
      case "OFFICE_ADMIN": return "Office Admin";
      case "USER": return "User";
      default: return role || "";
    }
  };
  const roleColor = (role?: string) => {
    switch (role) {
      case "SUPERADMIN": return "text-primary";
      case "OFFICE_ADMIN": return "text-primary";
      default: return "text-muted-foreground";
    }
  };

  const filteredItems = navigationItems.filter(item => {
    if (isLoading) return false;

    // Check parent permission
    if (item.permission && !hasPermission(item.permission)) return false;

    // Check children visibility
    if (item.children && item.children.length > 0) {
      const hasVisibleChild = item.children.some((child) =>
        !child.permission || hasPermission(child.permission)
      );
      if (!hasVisibleChild) return false;
    }

    return true;
  });

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 transform border-r bg-[hsl(var(--sidebar-bg))] transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <ScrollArea className="flex-1 px-4 py-6">
        <nav className="space-y-2">
          {filteredItems.map((item) => {
            const IconComponent = iconMap[item.icon as keyof typeof iconMap];

            if (item.children) {
              return (
                <Accordion type="single" collapsible key={item.title}>
                  <AccordionItem value={item.title} className="border-none">
                    <AccordionTrigger
                      className={cn(
                        "w-full text-[hsl(var(--sidebar-foreground))] hover:bg-primary/10 hover:text-primary px-3 py-2 rounded-md transition-all hover:no-underline",
                        "flex items-center"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {IconComponent && <IconComponent className="h-5 w-5" />}
                        <span className="text-sm font-medium">{item.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0 pt-1 pl-6 space-y-1">
                      {item.children.map((child) => {
                        // Check child permission if present
                        if (child.permission && !hasPermission(child.permission)) return null;

                        const ChildIcon = iconMap[child.icon as keyof typeof iconMap];
                        return (
                          <Button
                            key={child.href}
                            variant="ghost"
                            asChild
                            className="w-full justify-start gap-3 text-[hsl(var(--sidebar-foreground))] hover:bg-primary/10 hover:text-primary h-9"
                            onClick={onClose}
                          >
                            <NavLink
                              to={child.href}
                              className={({ isActive }) =>
                                cn(
                                  'flex w-full items-center gap-3 px-2 py-1.5 rounded-md text-sm',
                                  isActive && 'bg-primary/10 text-primary'
                                )
                              }
                            >
                              {ChildIcon && <ChildIcon className="h-4 w-4" />}
                              {child.title}
                            </NavLink>
                          </Button>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              );
            }

            return (
              <Button
                key={item.href}
                variant="ghost"
                asChild
                className="w-full justify-start gap-3 text-[hsl(var(--sidebar-foreground))] hover:bg-primary/10 hover:text-primary"
                onClick={onClose}
              >
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      'flex w-full items-center gap-3 px-2 py-2 rounded-md',
                      isActive && 'bg-primary/10 text-primary'
                    )
                  }
                >
                  {IconComponent && <IconComponent className="h-5 w-5" />}
                  {item.title}
                </NavLink>
              </Button>
            );
          })}


          {user?.role === 'SUPERADMIN' && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="logs" className="border-none">
                <AccordionTrigger
                  className={cn(
                    "w-full text-[hsl(var(--sidebar-foreground))] hover:bg-primary/10 hover:text-primary px-3 py-2 rounded-md transition-all hover:no-underline",
                    "flex items-center"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5" />
                    <span className="text-sm font-medium">Logs</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0 pt-1 pl-6 space-y-1">
                  <Button
                    variant="ghost"
                    asChild
                    className="w-full justify-start gap-3 text-[hsl(var(--sidebar-foreground))] hover:bg-primary/10 hover:text-primary h-9"
                    onClick={onClose}
                  >
                    <NavLink
                      to={ROUTES.AUDIT_LOGS}
                      className={({ isActive }) =>
                        cn(
                          'flex w-full items-center gap-3 px-2 py-1.5 rounded-md text-sm',
                          isActive && 'bg-primary/10 text-primary'
                        )
                      }
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Audit Logs
                    </NavLink>
                  </Button>
                  <Button
                    variant="ghost"
                    asChild
                    className="w-full justify-start gap-3 text-[hsl(var(--sidebar-foreground))] hover:bg-primary/10 hover:text-primary h-9"
                    onClick={onClose}
                  >
                    <NavLink
                      to={ROUTES.SMS_LOGS}
                      className={({ isActive }) =>
                        cn(
                          'flex w-full items-center gap-3 px-2 py-1.5 rounded-md text-sm',
                          isActive && 'bg-primary/10 text-primary'
                        )
                      }
                    >
                      <Mail className="h-4 w-4" />
                      SMS Logs
                    </NavLink>
                  </Button>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

        </nav>


      </ScrollArea>


      {/* Profile Section */}
      <div className="p-4 border-t mt-auto">
        {isLoading ? (
          <div className="w-full flex items-center gap-3 rounded-lg bg-primary/5 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="w-full flex items-center gap-3 rounded-lg bg-primary/5 p-3 hover:bg-primary/10 transition-colors cursor-pointer">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={(user as any)?.image || (user as any)?.avatar_url || (user as any)?.profile_image} alt={user?.full_name || "User"} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {initials(user?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">{user?.full_name || "User"}</p>
                  <p className={`text-xs truncate ${roleColor(user?.role)}`}>{roleLabel(user?.role)}</p>
                </div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-48">
              <DropdownMenuItem onClick={() => navigate(ROUTES.PROFILE)} className="cursor-pointer">
                <UserCircle className="mr-2 h-4 w-4" />
                User Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => logout()}
                className="cursor-pointer text-primary focus:bg-primary focus:text-primary-foreground"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </aside>
  );
};
