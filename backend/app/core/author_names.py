from __future__ import annotations

from dataclasses import dataclass
import re
import unicodedata


_MULTISPACE_RE = re.compile(r"\s+")
_PLACEHOLDER_AUTHOR_VALUES = {
    "v/a",
    "va",
    "varios",
    "varias",
    "varios autores",
    "autor anonimo",
    "autor anónimo",
    "anonimo",
    "anónimo",
}


@dataclass(frozen=True)
class StructuredAuthorName:
    first_name: str | None
    last_name: str | None
    display_name: str | None


def normalize_person_text(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = _MULTISPACE_RE.sub(" ", value.strip())
    return normalized or None


def normalize_author_lookup_key(value: str | None) -> str | None:
    normalized = normalize_person_text(value)
    if normalized is None:
        return None

    without_accents = "".join(
        char
        for char in unicodedata.normalize("NFKD", normalized)
        if not unicodedata.combining(char)
    )
    return without_accents.casefold()


def is_placeholder_author(value: str | None) -> bool:
    normalized = normalize_author_lookup_key(value)
    return normalized in _PLACEHOLDER_AUTHOR_VALUES


def build_structured_author_name(
    *,
    first_name: str | None = None,
    last_name: str | None = None,
    display_name: str | None = None,
) -> StructuredAuthorName:
    normalized_first_name = normalize_person_text(first_name)
    normalized_last_name = normalize_person_text(last_name)
    normalized_display_name = normalize_person_text(display_name)

    if normalized_display_name is None:
        parts = [
            part
            for part in (normalized_first_name, normalized_last_name)
            if part is not None and not is_placeholder_author(part)
        ]
        normalized_display_name = " ".join(parts) if parts else None

    if normalized_display_name is None or is_placeholder_author(normalized_display_name):
        return StructuredAuthorName(
            first_name=None,
            last_name=None,
            display_name=None,
        )

    return StructuredAuthorName(
        first_name=normalized_first_name,
        last_name=normalized_last_name,
        display_name=normalized_display_name,
    )


def split_author_name_heuristic(value: str | None) -> StructuredAuthorName:
    normalized = normalize_person_text(value)
    if normalized is None or is_placeholder_author(normalized):
        return StructuredAuthorName(first_name=None, last_name=None, display_name=None)

    if "," in normalized:
        last_name, first_name = [part.strip() for part in normalized.split(",", 1)]
        return build_structured_author_name(
            first_name=first_name,
            last_name=last_name,
            display_name=normalized,
        )

    parts = normalized.split(" ")
    if len(parts) == 2:
        return build_structured_author_name(
            first_name=parts[0],
            last_name=parts[1],
        )

    return build_structured_author_name(display_name=normalized)
