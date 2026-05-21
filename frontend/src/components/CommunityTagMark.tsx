type CommunityTagMarkProps = {
  label: string;
  className?: string;
};

export function CommunityTagMark({ label, className }: CommunityTagMarkProps) {
  return <span className={className}>{label}</span>;
}
