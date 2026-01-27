import { Footer } from "@/components/Footer";
import { ScheduleNavbar } from "@/components/ScheduleNavbar";

interface ScheduleLayoutProps {
  children: React.ReactNode;
}

export const ScheduleLayout: React.FC<ScheduleLayoutProps> = ({ children }) => {
  return (
    <div
      className="min-h-full w-full"
      style={{
        // Page-scoped semantic tokens in HSL triplets
        // Brand blues
        // #0D6EFD -> hsl(216 98% 52%), #0B5ED7 -> hsl(216 88% 45%)
        // Grays and text
        // #F3F4F6, #E5E7EB, #D1D5DB, #374151, #111827, #6B7280
        // Networks
        // A: #DBEAFE/#1E3A8A, B: #D1FAE5/#065F46, C: #EDE9FE/#5B21B6
        ["--inoc-blue" as any]: "216 98% 52%",
        ["--inoc-blue-dark" as any]: "216 88% 45%",
        ["--nav-foreground" as any]: "0 0% 100%",
        ["--page-bg" as any]: "0 0% 100%", // White background
        ["--title" as any]: "222 47% 11%", // #111827
        ["--muted-text" as any]: "215 20% 65%", // #6B7280
        ["--card-bg" as any]: "0 0% 100%",
        ["--gray-200" as any]: "220 14% 94%", // #E5E7EB
        ["--gray-300" as any]: "220 9% 87%", // #D1D5DB
        ["--gray-400" as any]: "220 9% 70%",
        ["--gray-700" as any]: "215 19% 35%", // #374151
        ["--blue-200" as any]: "213 97% 85%", // ring blue-200
        ["--net-a-bg" as any]: "217 91% 91%",
        ["--net-a-text" as any]: "221 83% 27%",
        ["--net-b-bg" as any]: "152 76% 90%",
        ["--net-b-text" as any]: "162 88% 20%",
        ["--net-c-bg" as any]: "258 100% 95%",
        ["--net-c-text" as any]: "262 83% 34%",
      }}
    >
      <div className="bg-[hsl(var(--page-bg))] min-h-full w-full">
        {children}
      </div>
    </div>
  );
};
