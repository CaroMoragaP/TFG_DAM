from __future__ import annotations

from dataclasses import dataclass
import re
import unicodedata

MAX_THEMES_PER_BOOK = 3


@dataclass(frozen=True, slots=True)
class ThemeCatalogEntry:
    slug: str
    label: str
    aliases: tuple[str, ...] = ()


THEME_CATALOG: tuple[ThemeCatalogEntry, ...] = (
    ThemeCatalogEntry("fantasia", "Fantas\u00eda", ("fantasy",)),
    ThemeCatalogEntry("ficcion_historica", "Ficci\u00f3n hist\u00f3rica", ("historical fiction",)),
    ThemeCatalogEntry("terror", "Terror", ("horror",)),
    ThemeCatalogEntry("humor", "Humor", ("comedy", "funny stories")),
    ThemeCatalogEntry(
        "literatura",
        "Literatura",
        ("literature", "narrativa", "narrativo", "fiction", "classic", "classics", "clasico", "clasicos"),
    ),
    ThemeCatalogEntry("magia", "Magia", ("magic",)),
    ThemeCatalogEntry(
        "misterio_detectives",
        "Misterio e historias de detectives",
        (
            "mystery",
            "mysteries",
            "detective",
            "detectives",
            "detective fiction",
            "detective and mystery stories",
            "mystery and detective stories",
        ),
    ),
    ThemeCatalogEntry("obras_teatro", "Obras de teatro", ("plays", "play", "drama")),
    ThemeCatalogEntry("poesia", "Poes\u00eda", ("poetry", "poems")),
    ThemeCatalogEntry("romantica", "Rom\u00e1ntica", ("romance", "romantic fiction", "love stories")),
    ThemeCatalogEntry("ciencia_ficcion", "Ciencia ficci\u00f3n", ("science fiction", "sci-fi", "scifi", "cyberpunk")),
    ThemeCatalogEntry("historias_cortas", "Historias cortas", ("short stories", "short story")),
    ThemeCatalogEntry("suspense", "Suspense", ("thriller", "suspense fiction")),
    ThemeCatalogEntry("juvenil", "Juvenil", ("young adult", "ya fiction")),
    ThemeCatalogEntry("infantil", "Infantil", ("children", "childrens stories", "juvenile fiction", "childrens stories")),
    ThemeCatalogEntry("historia", "Historia", ("history",)),
    ThemeCatalogEntry("biografia", "Biograf\u00eda", ("biography", "biographies", "memoir", "memoirs")),
    ThemeCatalogEntry("ciencias_sociales", "Ciencias sociales", ("social sciences", "sociology", "politics")),
    ThemeCatalogEntry("salud_bienestar", "Salud y bienestar", ("health", "wellness", "self-help", "well being")),
    ThemeCatalogEntry("artes", "Artes", ("arts", "art")),
    ThemeCatalogEntry("ciencia_matematicas", "Ciencia y matem\u00e1ticas", ("science", "mathematics", "math", "stem")),
    ThemeCatalogEntry("negocios_finanzas", "Negocios y finanzas", ("business", "finance", "economics")),
    ThemeCatalogEntry("idiomas", "Idiomas", ("language", "languages", "linguistics")),
)

_NON_ALNUM_RE = re.compile(r"[^0-9a-z]+")


def _normalize_lookup_key(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFKD", value.strip().casefold())
        if not unicodedata.combining(char)
    )


def _normalize_theme_lookup(value: str) -> str:
    normalized = _normalize_lookup_key(value)
    normalized = _NON_ALNUM_RE.sub(" ", normalized)
    return " ".join(normalized.split())


_THEME_LOOKUP: dict[str, str] = {}

for entry in THEME_CATALOG:
    for candidate in (entry.slug, entry.label, *entry.aliases):
        _THEME_LOOKUP[_normalize_theme_lookup(candidate)] = entry.label


def list_theme_labels() -> list[str]:
    return [entry.label for entry in THEME_CATALOG]


def normalize_theme(
    value: str | None,
    *,
    invalid_fallback: str | None = None,
) -> str | None:
    if value is None:
        return None

    normalized = _normalize_theme_lookup(value)
    if not normalized:
        return None

    canonical = _THEME_LOOKUP.get(normalized)
    if canonical is not None:
        return canonical

    if invalid_fallback is not None:
        return invalid_fallback

    raise ValueError("Tema no valido. Usa uno de los temas del catalogo.")


def normalize_theme_list(
    values: list[str] | None,
    *,
    limit: int = MAX_THEMES_PER_BOOK,
) -> list[str]:
    if values is None:
        return []

    seen: set[str] = set()
    normalized_values: list[str] = []

    for value in values:
        canonical = normalize_theme(value)
        if canonical is None:
            continue

        key = canonical.casefold()
        if key in seen:
            continue

        seen.add(key)
        normalized_values.append(canonical)

    if len(normalized_values) > limit:
        raise ValueError(f"Selecciona como maximo {limit} temas.")

    return normalized_values


def map_theme_candidates(
    values: list[str] | None,
    *,
    limit: int = MAX_THEMES_PER_BOOK,
) -> list[str]:
    if values is None:
        return []

    seen: set[str] = set()
    normalized_values: list[str] = []

    for value in values:
        canonical = normalize_theme(value, invalid_fallback="__invalid__")
        if canonical in (None, "__invalid__"):
            continue

        key = canonical.casefold()
        if key in seen:
            continue

        seen.add(key)
        normalized_values.append(canonical)
        if len(normalized_values) >= limit:
            break

    return normalized_values
