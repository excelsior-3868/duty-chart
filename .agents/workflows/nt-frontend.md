---
name: nt-frontend
description: >-
  Strict coding guidelines, visual standards, design tokens, and components for the Nepal Telecom React+TypeScript+Tailwind CSS frontend. Use this skill whenever building or modifying frontend code for Nepal Telecom projects.
---

# Skillset: nt-frontend
## Nepal Telecom (NT) Frontend Style & Development Guidelines

This skillset defines the strict coding guidelines, visual standards, design tokens, component specifications, and local standards for the Nepal Telecom Procurement Management System (NT-PMS) React+TypeScript+Tailwind CSS frontend.

---

## 1. Domain & Scope
This skillset applies to all frontend files, including:
- Components (`src/components/**/*.tsx`, `src/components/**/*.ts`)
- Pages (`src/pages/**/*.tsx`)
- Utilities (`src/utils/**/*.ts`, `src/utils/**/*.tsx`)
- Hooks (`src/hooks/**/*.ts`)
- Configs (`tailwind.config.ts`, `postcss.config.js`)

---

## 2. Technology Stack
- **Framework**: React 18 (Vite, TypeScript)
- **Styling**: Tailwind CSS v3 & Tailwind CSS Animate, HSL theme variables
- **Icons**: `lucide-react` exclusively (e.g., standard icons like `Menu`, `Settings`, `Sun`, `Moon`, `Users`, `LogOut`)
- **Components & Primitives**: Radix UI Primitives (Accordion, Dialog, Popover, Select, etc.), Shadcn UI components, Framer Motion for premium micro-animations
- **State Management & Fetching**: TanStack Query (React Query) v5, Axios for API clients

---

## 3. Light & Dark Theme Design System

The system operates in standard responsive Light and Dark modes. Tailwind variables must adapt dynamically inside a `.dark` scope. Never hardcode static color classes without respect to theme changes.

### A. Design Tokens
| Token Role | Light Mode Value (Root) | Dark Mode Value (`.dark`) | Tailwind class |
|---|---|---|---|
| **Background** | `hsl(0 0% 100%)` | `hsl(224 71% 4%)` | `bg-background` |
| **Foreground** | `hsl(222.2 84% 4.9%)` | `hsl(213 31% 91%)` | `text-foreground` |
| **Primary** | `hsl(209 100% 32%)` (NT Blue) | `hsl(210 40% 98%)` | `bg-primary` / `text-primary` |
| **Primary Hover** | `hsl(209 100% 28%)` (Darker Blue) | `—` | `hover:bg-primary-hover` |
| **Primary Foreground**| `hsl(0 0% 98%)` | `hsl(222.2 47.4% 11.2%)` | `text-primary-foreground` |
| **NT Gold** | `#E6B646` (Brand Gold) | `#E6B646` (Brand Gold) | `text-[#E6B646]` |
| **Secondary** | `hsl(210 40% 96.1%)` | `hsl(222.2 47.4% 11.2%)` | `bg-secondary` |
| **Secondary Foreground**| `hsl(222.2 47.4% 11.2%)`| `hsl(210 40% 98%)` | `text-secondary-foreground` |
| **Muted** | `hsl(210 40% 96.1%)` | `hsl(223 47% 11%)` | `bg-muted` |
| **Muted Foreground** | `hsl(215.4 16.3% 46.9%)`| `hsl(215.4 16.3% 46.9%)` | `text-muted-foreground` |
| **Accent** | `hsl(209 100% 32%)` (NT Blue) | `hsl(216 34% 17%)` | `bg-accent` |
| **Accent Foreground** | `hsl(0 0% 98%)` | `hsl(210 40% 98%)` | `text-accent-foreground` |
| **Destructive** | `hsl(0 84.2% 60.2%)` | `hsl(0 63% 31%)` | `bg-destructive` |
| **Destructive Foreground**| `hsl(210 40% 98%)` | `hsl(210 40% 98%)` | `text-destructive-foreground` |
| **Border / Input** | `hsl(214.3 31.8% 91.4%)`| `hsl(216 34% 17%)` | `border-border` / `border-input` |
| **Ring** | `hsl(209 100% 32%)` | `hsl(216 34% 17%)` | `ring-ring` |

### B. Global Dark Mode Layout Customization
To ensure consistent branding and dark mode aesthetics, the following style behaviors must be supported:
- **Table Headers (`thead`, `th`)**:
  - Light Mode: `bg-primary` (NT Blue background) with white bold text (`color: white !important`).
  - Dark Mode: Automatically shifts table header background to card color: `background-color: hsl(var(--card)) !important` with high-contrast text.
- **Brand Headers (`.brand-header`)**:
  - Light Mode: `background-color: hsl(209 100% 32%)` (NT Primary Blue) with white text.
  - Dark Mode: Shifts to dark card color: `background-color: hsl(224 71% 4%) !important` with white text and deep border: `border-b border-slate-800`.
- **Glassmorphism (`.glass-card`)**:
  - Light Mode: `background: rgba(255, 255, 255, 0.8)` with blur `backdrop-blur-lg border border-white/20`.
  - Dark Mode: `background: rgba(15, 23, 42, 0.6) !important` with blur `backdrop-blur-12` and a dark border: `border: 1px solid rgba(255, 255, 255, 0.1) !important`.
- **Utility Overrides**: Global utility classes like `bg-white`, `bg-slate-50`, `text-slate-800`, `border-slate-200` must respect dark mode by mapping to semantic CSS variables inside `.dark` selector (e.g. `.dark .bg-white { background-color: hsl(var(--card)) !important; }`).

---

## 4. Sidebar Layout & Collapsible Navigation Items

The NT-PMS interface utilizes a high-premium collapsible sidebar system anchored to the main layout.

### A. Sidebar Shell Implementation
- **Positioning & Sizing**: The main sidebar (`CollapsibleAppSidebar`) is set to `collapsible="icon"` and styled as:
  `className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex-shrink-0 top-[60px] h-[calc(100vh-60px)] z-30 shadow-sm"`
- **Content Wrap**: Includes a custom scroll area wrapped inside `SidebarContent` using a `ScrollArea` component.
- **Dynamic Theme Coloring**:
  - Light Mode: Background maps to `--sidebar-background: 0 0% 98%` and border maps to `--sidebar-border: 220 13% 91%`.
  - Dark Mode: Background maps to `--sidebar-background: 224 71% 4%` and border maps to `--sidebar-border: 216 34% 17%`.
- **Dynamic Paddings**:
  - Expanded Sidebar: Uses `px-4 pt-6 pb-6` padding.
  - Collapsed Sidebar: Uses `px-2 pt-6 pb-6` padding.
- **Sidebar Footer**: Spaced with custom wrapper class `py-3 border-t border-sidebar-border bg-sidebar` with dynamic padding `px-4` (expanded) or `px-1` (collapsed) for the user account menu.

### B. Sidebar Navigation Items (`CollapsibleNavItem`)
Individual navigation elements inside the sidebar are built using `SidebarMenuItem` and `SidebarMenuButton` primitives and must comply with the following structure:
- **Interactive Button Wrapper**:
  - CSS Classes: `h-auto rounded-md transition-all duration-200 group relative overflow-hidden cursor-pointer`
  - Collapsed State: `py-2 px-0 w-full flex justify-center`
  - Expanded State: `py-2 px-3`
  - **Active State**: Styled with a 10% opacity primary brand blue background and blue text: `bg-primary/10 text-primary hover:text-primary font-medium` (translates to `bg-sidebar-accent text-sidebar-accent-foreground` inside native variables).
  - **Inactive State**: Styled with sidebar-specific foreground text and hover background transition: `text-[hsl(var(--sidebar-foreground))] hover:bg-primary/10 hover:text-primary font-medium`
- **Dynamic Icon Wrapper**:
  - The icon is nested in a relative, flexible flex container with class `relative flex items-center justify-center rounded-lg transition-all duration-200`.
  - Icon Wrapper Size: `w-9 h-9` if collapsed, `w-5 h-5` if expanded.
  - Core Icon Element: `flex-shrink-0 transition-transform duration-200 h-5 w-5 text-sidebar-foreground` (or `text-primary` if active).
- **Label Text**:
  - Class: `whitespace-nowrap truncate text-sm relative z-10 ml-2 flex-1 text-left`
  - Must be hidden when sidebar collapsed state is active (`!isCollapsed && ...`).

### C. Collapsible Toggle Trigger
- **Location**: Anchored in the top header component (`Header.tsx`).
- **Icon element**: strictly uses the **`Menu`** icon from `lucide-react`.
- **Trigger button properties**:
  - Classes: `text-[hsl(var(--header-foreground))] hover:bg-white/10 group active:scale-95 transition-all`
  - Variant: `ghost`, Size: `icon`.
- **Sliding Animation/Rotate Effect**:
  - The `Menu` icon must transition with rotation depending on whether the sidebar is collapsed or expanded:
    - Expanded Sidebar (`isCollapsed === false`): Icon has **180-degree rotation** styling: `rotate-180`.
    - Collapsed Sidebar (`isCollapsed === true`): Icon has no rotation styling: `rotate-0`.
    - CSS Class: `"h-5 w-5 transition-transform duration-300 ease-in-out"`

---

## 5. Login Page & Brand Customization (Forced Light Mode)

The NT-PMS login system employs a highly polished landing page optimized for professional brand guidelines and 2FA OTP integration.

### A. Forced Light Mode Security
- The login interface is strictly designed to ignore the dark mode context using the `.forced-light` theme scope.
- **Immune Theme Overrides**: The wrapper forces specific light-theme color variables:
  - NT Blue Primary: `--primary: 209 100% 32%` / `--ring: 209 100% 32%`
  - Input Borders: `--border: 214.3 31.8% 91.4%`
  - Neutral Background: `--background: 0 0% 100%`
- **Solid White Immunes**: All input tags and card overlays must explicitly enforce white backgrounds to prevent dark-mode transparency:
  `forced-light .bg-white, forced-light .bg-white/90 { background-color: white !important; color: #0f172a !important; }`

### B. Sliding Animated Gradient Background (`.gradient-background`)
The background for the login wrapper utilizes a vibrant, modern 4-color sliding diagonal linear gradient:
- **Gradient Variables**:
  - `--gradient-color-1: 209 100% 32%` (Primary Brand Blue)
  - `--gradient-color-2: 209 100% 28%` (Darker Brand Blue)
  - `--gradient-color-3: 210 50% 93%` (Soft Blue-Grey `#e8f1f9`)
- **Gradient Styling**:
  ```css
  .gradient-background {
    background: linear-gradient(-45deg,
        hsl(var(--gradient-color-1)),
        hsl(var(--gradient-color-2)),
        hsl(var(--gradient-color-3)),
        hsl(var(--gradient-color-2)));
    background-size: 400% 400%;
    animation: gradientShift 15s ease infinite;
  }
  ```
- **Shift Keyframes**:
  ```css
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  ```

### C. Branding Submit Button (`.btn-nt-primary`)
To preserve Nepal Telecom official brand aesthetics, the login submit button uses a dedicated static color button (`.btn-nt-primary`) which **strictly disables any hover transition** or opacity adjustments:
```css
.forced-light .btn-nt-primary {
  background-color: hsl(209, 100%, 32%) !important;
  color: white !important;
  font-weight: 500 !important;
  transition: none !important;
}
.forced-light .btn-nt-primary:hover {
  background-color: hsl(209, 100%, 32%) !important;
  opacity: 1 !important;
}
```

---

## 6. Footer Layout & Branding

The NT-PMS layout features a clean, responsive footer pinned to the bottom of page containers.

### A. Footer Layout & Positioning
- **Flex Pinned bottom**: The footer component utilizes Tailwind utility positioning to stay pinned at the bottom of standard pages:
  `className="border-t bg-background py-4 w-full mt-auto"` (the parent flex layout must declare a full viewport height configuration and flex column to ensure `mt-auto` pushes the footer to the bottom).
- **Responsive Wrapper**: Nested wrapper utilizes standard container spacing:
  `className="container mx-auto px-6 flex flex-col items-center justify-center gap-1.5 text-sm text-muted-foreground"`

### B. Standard Brand Copy & Attributions
All page footprints must display the official attributions:
- **Copyright Statement (Centered & Medium weight)**:
  `&copy; {currentYear} Procurement Management System - Nepal Telecom. All rights reserved.`
- **ITD Developer Attribution (Centered, Extra Small Font)**:
  `Developed By: <span className="text-primary font-bold">ITD , Software and Security Wing</span>`
  (Uses Primary NT brand blue for strong ITD branding hierarchy).

---

## 7. Local Domain Standards (Nepali Calendar & BS Date System)

Nepal Telecom uses **Bikram Sambat (BS)** as its primary calendar, alongside the Gregorian **Anno Domini (AD)** calendar. The system integrates both dates across all procurement pipelines.

### A. Core Date Utilities
Always import and use these date formatting helpers from `@/utils/nepaliDate` and `@/utils/dateFormatter`:

1. **`formatBS(date)`**:
   - Returns only the Nepali (BS) date string (e.g., `2080-12-16`).
   - Use this inside list items, input tags, and standard badges.
2. **`formatADBS(date, adFormat?, showTime?)`**:
   - Returns a React element with multi-line displays (AD on top in bold, BS on bottom in smaller muted font).
   - Use inside tables, cards, and metadata grids.
3. **`formatADBSString(date, adFormat?)`**:
   - Returns a single-line string representation: `Mar 28, 2026 (2082-12-15)`.
   - Ideal for documents, PDF exports, and single-line headers.
4. **`formatDateWithSuperscript(dateString)`**:
   - Formats a date with superscripted ordinal suffixes (e.g., `March 28th, 2026`) and automatically displays the BS conversion in tiny muted text directly underneath.
   - Standard helper for large timeline logs, stage details, and review panels.

---

## 8. Premium UX, Theme Switching & Accessibility

1. **Micro-Animations**: All tabs, card overlays, and list entries should leverage Framer Motion or Tailwind's default entrance animations (`animate-in fade-in duration-500`) to elevate the user experience.
2. **Theme Switcher Animation**:
   - The dark mode toggle uses absolute positioned overlay icons of **`Sun`** and **`Moon`** from `lucide-react` that rotate and scale smoothly:
     - Sun Icon Style: `transition-all duration-300` and `isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50"`.
     - Moon Icon Style: `transition-all duration-300` and `isDark ? "opacity-0 -rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"`.
3. **Interactive States**:
   - Avoid instant state changes; always apply smooth transition classes (`transition-all duration-200` or `duration-300`).
   - Provide high-visibility focus states (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`).
4. **Responsive Scaling**: Verify clean display across standard resolutions: 375px (mobile), 768px (tablet), 1024px (laptop), and 1440px+ (desktop). Avoid fixed overflow or hidden components without fallback scrolling.

---

## 9. Code Snippets & Best Practices

### Dynamic Sidebar Toggle (Menu Rotation):
```tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

export const SidebarToggle = ({ isCollapsed, onToggle }) => (
  <Button
    variant="ghost"
    size="icon"
    className="text-white hover:bg-white/10 active:scale-95 transition-all"
    onClick={onToggle}
  >
    <Menu className={cn(
      "h-5 w-5 transition-transform duration-300 ease-in-out",
      isCollapsed ? "" : "rotate-180"
    )} />
  </Button>
);
```

### Sun & Moon Theme Toggle Layout:
```tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ThemeToggle = ({ isDark, onToggle }) => (
  <Button
    variant="ghost"
    size="icon"
    className="relative overflow-hidden"
    onClick={onToggle}
  >
    <span className={cn(
      "absolute inset-0 flex items-center justify-center transition-all duration-300",
      isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50"
    )}>
      <Sun className="h-5 w-5" />
    </span>
    <span className={cn(
      "absolute inset-0 flex items-center justify-center transition-all duration-300",
      isDark ? "opacity-0 -rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
    )}>
      <Moon className="h-5 w-5" />
    </span>
  </Button>
);
```

### Table Rendering with Responsive Container:
```tsx
import React from 'react';
import { cn } from '@/lib/utils';

export const StandardTable = ({ headers, rows }) => (
  <div className="w-full overflow-x-auto rounded-md border border-border">
    <table className="w-full border-collapse text-sm">
      <thead className="bg-primary text-primary-foreground dark:bg-card">
        <tr>
          {headers.map((h, i) => (
            <th key={i} className="p-4 text-left font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-border hover:bg-muted/50 transition-colors">
            <td className="p-4 font-semibold text-slate-800 dark:text-foreground">{row.name}</td>
            <td className="p-4">{row.date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
```

### Standard Footer Layout:
```tsx
import React from 'react';

export const StandardFooter = ({ appVersion }) => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t bg-background py-4 w-full mt-auto">
      <div className="container mx-auto px-6 flex flex-col items-center justify-center gap-1.5 text-sm text-muted-foreground">
        <p className="text-center font-medium">
          &copy; {currentYear} Procurement Management System - Nepal Telecom. All rights reserved.
        </p>
        <p className="text-xs text-center">
          Developed By: <span className="text-primary font-bold">ITD , Software and Security Wing</span>
        </p>
      </div>
    </footer>
  );
};
```

---

## 10. Strictly Forbidden Anti-patterns (Do NOT Use)
* ❌ **Emojis as Icons**: Never use standard emojis (like 📂, ✅, ❌) for interface controls or status indicators. Use Lucide icons exclusively.
* ❌ **Hex Colors**: Do not hardcode static hex values (e.g. `#0055ff` or `#ff0000`). Always reference dynamic Tailwind variables (`bg-primary`, `hsl(var(--primary))` or `bg-destructive`) to preserve theme integrity.
* ❌ **Low Contrast Elements**: Never use light grey text on light backgrounds. Ensure a minimum 4.5:1 contrast ratio.
* ❌ **Layout-shifting transforms**: Do not use hover size scales that shift adjacent DOM layout.
* ❌ **Missing pointer**: Clicking should never feel ambiguous. Ensure interactive wrappers use `cursor-pointer`.
* ❌ **Hardcoded fiscal years**: Avoid hardcoding static fiscal years like `"2080/81"`. Use `getCurrentFiscalYear()` or `generateFiscalYears()` dynamic options.
