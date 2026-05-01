from __future__ import annotations

AUTHOR_SEX_VALUES = ("male", "female", "non_binary", "unknown")

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
