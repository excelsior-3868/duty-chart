import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon: Icon, iconColor }) => {
  return (
    <header>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          {Icon && <Icon className={cn("h-[29px] w-[29px]", iconColor)} />}
          <h1 className="text-[17px] md:text-[23px] font-semibold text-primary tracking-tight">{title}</h1>
        </div>
        {subtitle && (
          <p className={cn(
            "text-sm text-muted-foreground font-medium",
            Icon ? "ml-[43px]" : "ml-0"
          )}>
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
};
