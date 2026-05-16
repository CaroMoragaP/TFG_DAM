import type { ReactNode } from "react";

type DashboardHeroIcon =
  | "book"
  | "list"
  | "library"
  | "reading"
  | "stats"
  | "community";

type DashboardHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon?: DashboardHeroIcon;
  actions?: ReactNode;
};

type HeroActionButtonProps = {
  children: string;
  disabled?: boolean;
  emphasis?: "primary" | "secondary";
  icon: "upload" | "download" | "plus";
  onClick: () => void;
};

function BookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M6.25 4A2.25 2.25 0 0 1 8.5 1.75h8.25A2.25 2.25 0 0 1 19 4v13.25a.75.75 0 0 1-1.23.57l-2.33-1.88a1 1 0 0 0-1.26 0l-1.55 1.24a1 1 0 0 1-1.25 0l-1.55-1.24a1 1 0 0 0-1.26 0l-2.33 1.88A.75.75 0 0 1 5 17.25V5.25A1.25 1.25 0 0 1 6.25 4Z"
        fill="currentColor"
      />
      <path
        d="M4 6.25a.75.75 0 0 0-1.5 0v11A4 4 0 0 0 6.5 21.25H15a.75.75 0 0 0 0-1.5H6.5A2.5 2.5 0 0 1 4 17.25v-11Z"
        fill="currentColor"
        opacity="0.42"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M7 6.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0 5.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm-1.25 4.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"
        fill="currentColor"
      />
      <path
        d="M9.75 5.5a.75.75 0 0 1 .75-.75h8a.75.75 0 0 1 0 1.5h-8a.75.75 0 0 1-.75-.75Zm0 5.75a.75.75 0 0 1 .75-.75h8a.75.75 0 0 1 0 1.5h-8a.75.75 0 0 1-.75-.75Zm.75 5h8a.75.75 0 0 1 0 1.5h-8a.75.75 0 0 1 0-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M4.75 4A1.75 1.75 0 0 1 6.5 2.25h2A1.75 1.75 0 0 1 10.25 4v16A1.75 1.75 0 0 1 8.5 21.75h-2A1.75 1.75 0 0 1 4.75 20V4Zm4.5.75h.5V19.25h-.5V4.75Z"
        fill="currentColor"
      />
      <path
        d="M11.75 5A1.75 1.75 0 0 1 13.5 3.25h2A1.75 1.75 0 0 1 17.25 5v15A1.75 1.75 0 0 1 15.5 21.75h-2A1.75 1.75 0 0 1 11.75 20V5Zm4.5.75h-.5V19.25h.5V5.75Z"
        fill="currentColor"
        opacity="0.8"
      />
      <path
        d="M18.75 7A1.75 1.75 0 0 1 20.5 5.25a.75.75 0 0 1 .75.75V20a1.75 1.75 0 0 1-1.75 1.75h-1.25a.75.75 0 0 1 0-1.5h1.25a.25.25 0 0 0 .25-.25V7.75a.75.75 0 0 0-.75-.75.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
        opacity="0.58"
      />
    </svg>
  );
}

function ReadingIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5.75 3.25A2.75 2.75 0 0 0 3 6v11.5a.75.75 0 0 0 1.14.64A6.22 6.22 0 0 1 7.4 17.25h9.1A3.5 3.5 0 0 0 20 13.75V6a2.75 2.75 0 0 0-2.75-2.75H5.75Zm11.5 12.5H7.4c-.99 0-1.95.2-2.9.58V6c0-.69.56-1.25 1.25-1.25h11.5c.69 0 1.25.56 1.25 1.25v7.75c0 1.1-.9 2-2 2Z"
        fill="currentColor"
      />
      <path
        d="M8 7.75A.75.75 0 0 1 8.75 7h5.5a.75.75 0 0 1 0 1.5h-5.5A.75.75 0 0 1 8 7.75Zm0 3.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
        opacity="0.64"
      />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M4 18.25A.75.75 0 0 1 4.75 17.5h14.5a.75.75 0 0 1 0 1.5H4.75a.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
      />
      <path
        d="M7 10.75A1.75 1.75 0 0 1 8.75 9h.5A1.75 1.75 0 0 1 11 10.75v4.5A1.75 1.75 0 0 1 9.25 17h-.5A1.75 1.75 0 0 1 7 15.25v-4.5Zm6-4A1.75 1.75 0 0 1 14.75 5h.5A1.75 1.75 0 0 1 17 6.75v8.5A1.75 1.75 0 0 1 15.25 17h-.5A1.75 1.75 0 0 1 13 15.25v-8.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M8.5 11a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Zm7 1.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z"
        fill="currentColor"
      />
      <path
        d="M3.5 18.25A4.75 4.75 0 0 1 8.25 13.5h.5A4.75 4.75 0 0 1 13.5 18.25a.75.75 0 0 1-.75.75h-8.5a.75.75 0 0 1-.75-.75Zm10.25.75a.75.75 0 0 1-.75-.75 4.7 4.7 0 0 0-1.11-3.02 4.12 4.12 0 0 1 2.36-.73h.5a4.75 4.75 0 0 1 4.75 4.75.75.75 0 0 1-.75.75h-5Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M11.25 14.75V6.56L8.53 9.28a.75.75 0 1 1-1.06-1.06l4-4a.75.75 0 0 1 1.06 0l4 4a.75.75 0 1 1-1.06 1.06l-2.72-2.72v8.19a.75.75 0 0 1-1.5 0Z"
        fill="currentColor"
      />
      <path
        d="M5 14.75A2.75 2.75 0 0 1 7.75 12h1.5a.75.75 0 0 1 0 1.5h-1.5A1.25 1.25 0 0 0 6.5 14.75v2.5A1.25 1.25 0 0 0 7.75 18.5h8.5a1.25 1.25 0 0 0 1.25-1.25v-2.5a1.25 1.25 0 0 0-1.25-1.25h-1.5a.75.75 0 0 1 0-1.5h1.5A2.75 2.75 0 0 1 19 14.75v2.5A2.75 2.75 0 0 1 16.25 20h-8.5A2.75 2.75 0 0 1 5 17.25v-2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 4.5a.75.75 0 0 1 .75.75v8.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 1 1 1.06-1.06l2.72 2.72V5.25A.75.75 0 0 1 12 4.5Z"
        fill="currentColor"
      />
      <path
        d="M5 14.75A2.75 2.75 0 0 1 7.75 12h1.5a.75.75 0 0 1 0 1.5h-1.5A1.25 1.25 0 0 0 6.5 14.75v2.5A1.25 1.25 0 0 0 7.75 18.5h8.5a1.25 1.25 0 0 0 1.25-1.25v-2.5a1.25 1.25 0 0 0-1.25-1.25h-1.5a.75.75 0 0 1 0-1.5h1.5A2.75 2.75 0 0 1 19 14.75v2.5A2.75 2.75 0 0 1 16.25 20h-8.5A2.75 2.75 0 0 1 5 17.25v-2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M12 5.25a.75.75 0 0 1 .75.75v5.25H18a.75.75 0 0 1 0 1.5h-5.25V18a.75.75 0 0 1-1.5 0v-5.25H6a.75.75 0 0 1 0-1.5h5.25V6a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getHeroIcon(icon: DashboardHeroIcon) {
  switch (icon) {
    case "list":
      return ListIcon;
    case "library":
      return LibraryIcon;
    case "reading":
      return ReadingIcon;
    case "stats":
      return StatsIcon;
    case "community":
      return CommunityIcon;
    default:
      return BookIcon;
  }
}

export function HeroActionButton({
  children,
  disabled = false,
  emphasis = "secondary",
  icon,
  onClick,
}: HeroActionButtonProps) {
  const Icon = icon === "upload" ? UploadIcon : icon === "download" ? DownloadIcon : PlusIcon;

  return (
    <button
      className={`dashboard-hero-action dashboard-hero-action-${emphasis}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="dashboard-hero-action-icon">
        <Icon />
      </span>
      <span>{children}</span>
    </button>
  );
}

export function DashboardHero({
  eyebrow,
  title,
  description,
  icon = "book",
  actions,
}: DashboardHeroProps) {
  const Icon = getHeroIcon(icon);

  return (
    <div className="dashboard-catalog-hero">
      <div className="dashboard-catalog-hero-copy">
        <span className="dashboard-catalog-hero-eyebrow">
          <span className="dashboard-catalog-hero-mark">
            <Icon />
          </span>
          {eyebrow}
        </span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {actions ? <div className="dashboard-catalog-hero-actions">{actions}</div> : null}
    </div>
  );
}
