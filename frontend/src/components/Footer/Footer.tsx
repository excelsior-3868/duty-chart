export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background py-6 w-full mt-auto">
      <div className="container mx-auto px-6 flex flex-col items-center justify-center gap-1.5 text-sm text-muted-foreground">
        {/* Line 1: Centered Copyright (Static) */}
        <p className="text-center font-medium">
          &copy; {currentYear} Duty Chart Management System. All rights reserved.
        </p>

        {/* Line 2: Centered Developer Attribution (Static) */}
        <p className="text-xs text-center">
          Developed By: <span className="text-primary font-bold">Software and Security Wing</span>
        </p>
      </div>
    </footer>
  );
};
