// import { NavLink } from "react-router-dom";
// import { User, ChevronDown } from "lucide-react";

// interface ScheduleNavbarProps {
//   className?: string;
// }

// // Page-scoped tokens are provided by the layout wrapper via CSS variables
// export const ScheduleNavbar: React.FC<ScheduleNavbarProps> = ({
//   className,
// }) => {
//   const baseItem =
//     "px-3 py-2 rounded-md text-sm font-medium text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--inoc-blue-dark))]";
//   const activeItem = "bg-[hsl(var(--inoc-blue-dark))]";

//   return (
//     <nav
//       className={`fixed top-0 inset-x-0 z-50 h-14 bg-[hsl(var(--inoc-blue))] shadow-sm ${
//         className ?? ""
//       }`}
//       aria-label="Primary"
//     >
//       <div className="mx-auto max-w-7xl h-full px-4 flex items-center justify-between">
//         {/* Left: Logo + Title */}
//         <div className="flex items-center gap-3">
//           <div className="h-8 w-8 rounded-md bg-[hsl(var(--nav-foreground))] text-[hsl(var(--inoc-blue))] flex items-center justify-center font-bold select-none">
//             sT
//           </div>
//           <span className="text-white font-semibold">INOC Duty Roster</span>
//         </div>

//         {/* Right: Profile */}
//         <div className="flex items-center gap-3">
//           <div className="h-8 w-8 rounded-full bg-[hsl(var(--inoc-blue-dark))] flex items-center justify-center text-white">
//             <User className="h-4 w-4" />
//           </div>
//           <button
//             className="md:hidden text-white/90 hover:text-white"
//             aria-label="Open menu"
//           >
//             <ChevronDown className="h-5 w-5" />
//           </button>
//         </div>
//       </div>
//     </nav>
//   );
// };

// import { NavLink } from "react-router-dom";
// import { User, ChevronDown } from "lucide-react";
// import telecomLogo from "../../assets/telecom.png"; // Make sure the path is correct

// interface ScheduleNavbarProps {
//   className?: string;
// }

// // Page-scoped tokens are provided by the layout wrapper via CSS variables
// export const ScheduleNavbar: React.FC<ScheduleNavbarProps> = ({
//   className,
// }) => {
//   const baseItem =
//     "px-3 py-2 rounded-md text-sm font-medium text-[hsl(var(--nav-foreground))] hover:bg-[hsl(var(--inoc-blue-dark))]";
//   const activeItem = "bg-[hsl(var(--inoc-blue-dark))]";

//   return (
//     <nav
//       className={`fixed top-0 inset-x-0 z-50 h-14 bg-[hsl(var(--inoc-blue))] shadow-sm ${
//         className ?? ""
//       }`}
//       aria-label="Primary"
//     >
//       <div className="mx-auto max-w-7xl h-full px-4 flex items-center justify-between">
//         {/* Left: Logo + Title */}
//         <div className="flex items-center gap-3">
//           <div className="h-full w-24 rounded-md overflow-hidden flex items-center justify-center">
//             <img
//               src={telecomLogo}
//               alt="Logo"
//               className="h-full w-full object-cover"
//             />
//           </div>
//           <span className="text-white font-semibold">INOC Duty Roster</span>
//         </div>

//         {/* Right: Profile */}
//         <div className="flex items-center gap-3">
//           <div className="h-8 w-8 rounded-full bg-[hsl(var(--inoc-blue-dark))] flex items-center justify-center text-white">
//             <User className="h-4 w-4" />
//           </div>
//           <button
//             className="md:hidden text-white/90 hover:text-white"
//             aria-label="Open menu"
//           >
//             <ChevronDown className="h-5 w-5" />
//           </button>
//         </div>
//       </div>
//     </nav>
//   );
// };
// src/components/ScheduleNavbar/ScheduleNavbar.tsx
import React from "react";

interface ScheduleNavbarProps {
  className?: string;
}

export const ScheduleNavbar: React.FC<ScheduleNavbarProps> = ({
  className,
  children,
}) => {
  return (
    <div className={className}>
      {children} {/* Render only whatever you pass inside ScheduleNavbar */}
    </div>
  );
};
