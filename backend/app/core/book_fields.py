from __future__ import annotations

import unicodedata

AUTHOR_SEX_VALUES = ("male", "female", "non_binary", "unknown")
LITERARY_GENRE_VALUES = ("narrativo", "lírico", "dramático", "didáctico")

_AUTHOR_SEX_ALIASES = {
    "male": "male",
    "m": "male",
    "man": "male",
    "hombre": "male",
    "masculino": "male",
    "female": "female",
    "f": "female",
    "woman": "female",
    "mujer": "female",
    "femenino": "female",
    "non_binary": "non_binary",
    "non-binary": "non_binary",
    "non binary": "non_binary",
    "nonbinary": "non_binary",
    "no_binario": "non_binary",
    "no-binario": "non_binary",
    "no binario": "non_binary",
    "nobinario": "non_binary",
    "unknown": "unknown",
    "desconocido": "unknown",
    "sin dato": "unknown",
    "sin_dato": "unknown",
}

_LITERARY_GENRE_ALIASES = {
    "narrativo": "narrativo",
    "lirico": "lírico",
    "lírico": "lírico",
    "dramatico": "dramático",
    "dramático": "dramático",
    "didactico": "didáctico",
    "didáctico": "didáctico",
}


def _normalize_lookup_key(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFKD", value.strip().casefold())
        if not unicodedata.combining(char)
    )


def normalize_author_sex(
    value: str | None,
    *,
    invalid_fallback: str | None = None,
) -> str | None:
    if value is None:
        return None

    normalized = value.strip().casefold()
    if not normalized:
        return None

    canonical = _AUTHOR_SEX_ALIASES.get(normalized)
    if canonical is not None:
        return canonical

    if invalid_fallback is not None:
        return invalid_fallback

    valid_values = ", ".join(AUTHOR_SEX_VALUES)
    raise ValueError(
        f"Sexo de autor no valido. Usa uno de: {valid_values}.",
    )


def normalize_literary_genre(
    value: str | None,
    *,
    invalid_fallback: str | None = None,
) -> str | None:
    if value is None:
        return None

    normalized = _normalize_lookup_key(value)
    if not normalized:
        return None

    canonical = _LITERARY_GENRE_ALIASES.get(normalized)
    if canonical is not None:
        return canonical

    if invalid_fallback is not None:
        return invalid_fallback

    valid_values = ", ".join(LITERARY_GENRE_VALUES)
    raise ValueError(
        f"Género literario no válido. Usa uno de: {valid_values}.",
    )
