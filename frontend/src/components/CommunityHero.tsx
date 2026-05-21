import { CommunityMark } from "./CommunityMark";

type CommunityHeroProps = {
  title: string;
  description: string;
  isLibrarySelected: boolean;
  memberCount?: number;
  copyCount?: number;
};

export function CommunityHero({
  title,
  description,
  isLibrarySelected,
  memberCount,
  copyCount,
}: CommunityHeroProps) {
  return (
    <div className="community-hero-shell">
      <div className="community-hero-copy">
        <span className="community-hero-kicker">
          <span className="community-hero-mark">
            <CommunityMark />
          </span>
          Comunidad
        </span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="community-hero-pills">
          <span className="community-hero-pill community-hero-pill-soft">
            {isLibrarySelected ? "Club de lectura activo" : "Selecciona una biblioteca compartida"}
          </span>
          {typeof memberCount === "number" ? (
            <span className="community-hero-pill">{memberCount} miembros</span>
          ) : null}
          {typeof copyCount === "number" ? (
            <span className="community-hero-pill">{copyCount} ejemplares</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
