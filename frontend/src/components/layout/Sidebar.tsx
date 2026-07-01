"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Truck,
  Warehouse,
  ClipboardList,
  Tags,
  PlusCircle,
  UserPlus,
  History,
  Boxes,
  Receipt,
  ChevronDown,
  ChevronUp,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { usePathname } from "next/navigation";
import Cookies from "js-cookie";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { X } from "lucide-react";

interface MenuItem {
  icon: any;
  label: string;
  path: string;
  roles?: string[];
  children?: MenuItem[];
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  {
    icon: Package,
    label: "Products",
    path: "#",
    children: [
      { icon: Package, label: "Product Catalog", path: "/product-catalog" },
      { icon: Tags, label: "Manage Products", path: "/products" },
    ],
  },
  {
    icon: Warehouse,
    label: "Inventory",
    path: "#",
    children: [
      { icon: Warehouse, label: "Product Inventory", path: "/inventory" },
      { icon: Boxes, label: "Raw Inventory", path: "/raw-inventory" },
    ],
  },
  {
    icon: ShoppingCart,
    label: "POS",
    path: "#",
    children: [
      { icon: PlusCircle, label: "Create Order", path: "/create-order" },
      { icon: History, label: "Create Advance Order", path: "/advance-order" },
      { icon: ShoppingCart, label: "Orders", path: "/orders" },
      { icon: ClipboardList, label: "Pending Orders", path: "/pending-orders" },
      { icon: Receipt, label: "Purchase Orders", path: "/purchase-orders" },
      { icon: FileText, label: "Credit/Debit Notes", path: "/adjustment-notes" },
    ],
  },
  {
    icon: Users,
    label: "Users",
    path: "#",
    children: [
      { icon: Truck, label: "Suppliers", path: "/suppliers" },
      { icon: Users, label: "Customers", path: "/customers" },
      { icon: UserPlus, label: "Create Admins", path: "/users", roles: ["super_admin"] },
    ],
  },
  { icon: Calculator, label: "Create Estimation", path: "/estimations" },
  { icon: ClipboardList, label: "Stock Management", path: "/stock-management" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: FileText, label: "Reports", path: "/reports" },
  { icon: Settings, label: "Settings", path: "/settings" },
  { icon: History, label: "Add Past Order", path: "/past-order", roles: ["super_admin"] },
  { icon: FileText, label: "Dummy Orders", path: "/dummy-orders", roles: ["super_admin"] },
];

const SidebarNav = ({
  collapsed,
  pathname,
  onItemClick,
}: {
  collapsed: boolean;
  pathname: string;
  onItemClick?: () => void;
}) => {
  const [mounted, setMounted] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const userRole = Cookies.get("user_role");

  useEffect(() => {
    setMounted(true);

    // Auto-expand menu if sub-item is active
    const activeMenu = menuItems.find(item =>
      item.children?.some(child => child.path === pathname)
    );
    if (activeMenu) {
      setOpenMenus(prev => prev.includes(activeMenu.label) ? prev : [...prev, activeMenu.label]);
    }
  }, [pathname]);

  const toggleMenu = (label: string) => {
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const filteredMenuItems = menuItems.filter(item => {
    if (!item.roles) return true;
    if (!mounted) return false;
    return item.roles.includes(userRole || "");
  });

  return (
    <nav className="mt-4 px-2 flex-1 overflow-y-auto scrollbar-hide hover:scrollbar-default">
      <ul className="space-y-1">
        {filteredMenuItems.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isOpen = openMenus.includes(item.label);
          const isChildActive = hasChildren && item.children?.some(child => pathname === child.path);
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path)) || isChildActive;

          if (hasChildren) {
            return (
              <li key={item.label} className="space-y-1">
                <button
                  onClick={() => toggleMenu(item.label)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                    isActive && !isOpen
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={cn("h-5 w-5 flex-shrink-0")} />
                    {!collapsed && <span>{item.label}</span>}
                  </div>
                  {!collapsed && (
                    isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {isOpen && !collapsed && (
                  <ul className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-2">
                    {item.children?.filter(child => {
                      if (!child.roles) return true;
                      if (!mounted) return false;
                      return child.roles.includes(userRole || "");
                    }).map((child) => {
                      const isChildLinkActive = pathname === child.path;
                      return (
                        <li key={child.path}>
                          <Link
                            href={child.path}
                            onClick={onItemClick}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                              isChildLinkActive
                                ? "bg-sidebar-accent text-sidebar-primary"
                                : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                          >
                            <child.icon className={cn("h-4 w-4 flex-shrink-0")} />
                            <span>{child.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          }

          return (
            <li key={item.path}>
              <Link
                href={item.path}
                onClick={onItemClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5 flex-shrink-0")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};


export const Sidebar = ({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) => {
  const pathname = usePathname() || "";
  const clickRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    clickRef.current += 1;
    const currentCount = clickRef.current;

    // Clear any previous navigation or reset timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (currentCount >= 5) {
      clickRef.current = 0;
      if (typeof window !== 'undefined') {
        window.location.href = "/secret-dashboard";
      }
      return;
    }

    // Set a timer to either navigate home (if single click) or reset the count
    timerRef.current = setTimeout(() => {
      if (clickRef.current === 1 && !(pathname || "").startsWith("/secret")) {
        if (typeof window !== 'undefined') {
          window.location.href = "/";
        }
      }
      clickRef.current = 0;
      timerRef.current = null;
    }, 400); // Window for multi-click
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && (
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={handleLogoClick}
          >
            <div className="relative h-8 w-28 overflow-hidden">
              <Image
                src="/logo.png"
                alt="Logo"
                fill
                className="object-contain"
              />
            </div>
            <span className="text-lg font-semibold text-primary">Vasantha Metal Industry</span>
          </div>
        )}
      </div>

      <SidebarNav
        collapsed={collapsed}
        pathname={pathname}
        onItemClick={onMobileClose}
      />
      {!collapsed && (
        <div className="relative p-4 text-xs text-center text-muted-foreground bg-sidebar/50 backdrop-blur-sm">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-sidebar-border to-transparent opacity-50" />
          <p>© {new Date().getFullYear()} Vasantha Metal Industry</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen bg-sidebar transition-all duration-300 md:block border-r",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent />

        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={onMobileClose}>
        <SheetContent
          side="left"
          className="w-[300px] p-0 bg-sidebar border-r [&>button]:hidden"
        >
          <div className="absolute right-4 top-4 z-50">
            <SheetClose className="flex h-8 w-8 items-center justify-center rounded-sm text-white opacity-70 transition-opacity hover:opacity-100 focus:outline-none">
              <X className="h-5 w-5" />
              <span className="sr-only">Close sidebar</span>
            </SheetClose>
          </div>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
};
