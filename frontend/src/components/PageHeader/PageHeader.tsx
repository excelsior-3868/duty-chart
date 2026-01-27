interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle }) => {
  return (
    <header className="pt-8 pb-4 px-6">
      <h1 className="text-xl font-bold text-[hsl(var(--title))]">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm text-[hsl(var(--muted-text))]">{subtitle}</p>
      )}
    </header>
  );
};
