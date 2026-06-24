export interface ChangelogFeature {
  title: string;
  type: "feature" | "enhancement" | "security" | "bugfix";
  badgeText: string;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  badgeClass?: string;
  iconName: "bell" | "sliders" | "layers" | "shield" | "wrench";
  bullets: string[];
}

export interface ChangelogRelease {
  version: string;
  releaseDate: string;
  features: ChangelogFeature[];
}

export const changelogData: ChangelogRelease[] = [
  {
    version: "v2.3.0",
    releaseDate: "2026-06-24",
    features: [
      {
        title: "Interactive Notification Bell",
        type: "feature",
        badgeText: "New Feature",
        badgeVariant: "outline",
        badgeClass: "border-blue-200 text-blue-700 bg-blue-50/50",
        iconName: "bell",
        bullets: [
          "Added a real-time Notification Bell in the header to show unread system alerts and duty assignments.",
          "Added an interactive notifications dropdown panel allowing users to mark notifications as read individually or all at once.",
          "Integrated a backend endpoint to fetch live unread notification counts."
        ]
      },
      {
        title: "Office-Specific Custom Notifications",
        type: "feature",
        badgeText: "New Feature",
        badgeVariant: "outline",
        badgeClass: "border-indigo-200 text-indigo-700 bg-indigo-50/50",
        iconName: "sliders",
        bullets: [
          "Added fine-grained control over SMS and system notifications via the new Notification Settings dashboard.",
          "Offices can now customize advance reminders (in minutes/days) and toggle notification types based on local preferences."
        ]
      },
      {
        title: "Sub-Office / Child Office Support",
        type: "enhancement",
        badgeText: "New Feature",
        badgeVariant: "outline",
        badgeClass: "border-indigo-200 text-indigo-700 bg-indigo-50/50",
        iconName: "layers",
        bullets: [
          "Allowed Office Admin to create and manage duty charts for child offices.",
          "Enhanced office hierarchy structure, allowing seamless tracking of sub-office duties."
        ]
      }
    ]
  }
];
