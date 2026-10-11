from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Set
from uuid import UUID, uuid4


# --- Tooth identifiers (Universal Numbering System) ---

PERMANENT_TEETH: Set[str] = {str(n) for n in range(1, 33)}  # 1-32
PRIMARY_TEETH: Set[str] = set("ABCDEFGHIJKLMNOPQRST")  # A-T
VALID_TEETH: Set[str] = PERMANENT_TEETH | PRIMARY_TEETH

# Anterior teeth (incisors and canines): permanent 6-11 & 22-27; primary C-H & M-P.
PERMANENT_ANTERIOR_TEETH: Set[str] = {str(n) for n in (6, 7, 8, 9, 10, 11, 22, 23, 24, 25, 26, 27)}
PRIMARY_ANTERIOR_TEETH: Set[str] = set("CDEFGHMNOP")
ANTERIOR_TEETH: Set[str] = PERMANENT_ANTERIOR_TEETH | PRIMARY_ANTERIOR_TEETH

# Maxillary (upper) arch teeth: permanent 1-16; primary A-J.
PERMANENT_MAXILLARY_TEETH: Set[str] = {str(n) for n in range(1, 17)}
PRIMARY_MAXILLARY_TEETH: Set[str] = set("ABCDEFGHIJ")
MAXILLARY_TEETH: Set[str] = PERMANENT_MAXILLARY_TEETH | PRIMARY_MAXILLARY_TEETH


def is_valid_tooth(tooth: str) -> bool:
    """Returns True when the tooth identifier is a valid Universal Numbering value (1-32 or A-T)."""
    return tooth in VALID_TEETH


def is_posterior_tooth(tooth: str) -> bool:
    return is_valid_tooth(tooth) and tooth not in ANTERIOR_TEETH


def is_anterior_tooth(tooth: str) -> bool:
    return tooth in ANTERIOR_TEETH


def is_maxillary_tooth(tooth: str) -> bool:
    return tooth in MAXILLARY_TEETH


class ToothSurface(str, Enum):
    """
    Valid dental chart surfaces.
    M = Mesial, D = Distal, O = Occlusal, I = Incisal,
    B = Buccal, F = Facial, L = Lingual, P = Palatal.
    """
    MESIAL = "M"
    DISTAL = "D"
    OCCLUSAL = "O"
    INCISAL = "I"
    BUCCAL = "B"
    FACIAL = "F"
    LINGUAL = "L"
    PALATAL = "P"


VALID_SURFACE_VALUES: Set[str] = {s.value for s in ToothSurface}


def valid_surfaces_for_tooth(tooth: str) -> Set[str]:
    """
    Clinical validation rules for surfaces per tooth (documented MVP scope):

    - O (Occlusal) is only valid on posterior teeth (molars and premolars).
    - I (Incisal) is only valid on anterior teeth (incisors and canines).
    - P (Palatal) is only valid on maxillary (upper) teeth.
    - M, D, B, F, L are valid on all teeth.
    """
    if not is_valid_tooth(tooth):
        return set()

    allowed = {ToothSurface.MESIAL.value, ToothSurface.DISTAL.value, ToothSurface.BUCCAL.value,
               ToothSurface.FACIAL.value, ToothSurface.LINGUAL.value}
    if is_posterior_tooth(tooth):
        allowed.add(ToothSurface.OCCLUSAL.value)
    if is_anterior_tooth(tooth):
        allowed.add(ToothSurface.INCISAL.value)
    if is_maxillary_tooth(tooth):
        allowed.add(ToothSurface.PALATAL.value)
    return allowed


def validate_surfaces(tooth: str, surfaces: List[str]) -> List[str]:
    """
    Validates and normalizes a surface list for a tooth.
    Returns the sorted, de-duplicated valid surface list.
    Raises ValueError on unknown surfaces or surfaces invalid for the tooth.
    """
    if not is_valid_tooth(tooth):
        raise ValueError(f"'{tooth}' is not a valid tooth identifier. Use 1-32 (permanent) or A-T (primary).")

    allowed = valid_surfaces_for_tooth(tooth)
    cleaned = []
    for s in surfaces:
        s = (s or "").strip().upper()
        if s not in VALID_SURFACE_VALUES:
            raise ValueError(f"'{s}' is not a valid tooth surface. Valid surfaces: {sorted(VALID_SURFACE_VALUES)}")
        if s not in allowed:
            raise ValueError(
                f"Surface '{s}' is not valid for tooth '{tooth}'. Valid surfaces for this tooth: {sorted(allowed)}"
            )
        cleaned.append(s)
    return sorted(set(cleaned))


class FindingCondition(str, Enum):
    """
    MVP clinical finding condition catalog. Codes are stable domain values;
    labels are exposed to the UI via CONDITION_CATALOG so the backend remains
    the single source of truth.
    """
    CARIES = "caries"
    RESTORATION = "restoration"
    CROWN = "crown"
    ROOT_CANAL_TREATED = "root_canal_treated"
    MISSING = "missing"
    FRACTURED = "fractured"
    IMPACTED = "impacted"
    ABSCESS = "abscess"
    DISCOLORATION = "discoloration"
    OTHER = "other"


# Conditions that describe the whole tooth and must NOT carry surfaces.
TOOTH_LEVEL_ONLY_CONDITIONS: Set[str] = {
    FindingCondition.MISSING.value,
    FindingCondition.CROWN.value,
    FindingCondition.ROOT_CANAL_TREATED.value,
    FindingCondition.IMPACTED.value,
}

# Conditions that REQUIRE at least one surface.
SURFACE_REQUIRED_CONDITIONS: Set[str] = {
    FindingCondition.CARIES.value,
    FindingCondition.RESTORATION.value,
}

CONDITION_LABELS: Dict[str, str] = {
    FindingCondition.CARIES.value: "Caries",
    FindingCondition.RESTORATION.value: "Restoration (filling)",
    FindingCondition.CROWN.value: "Crown",
    FindingCondition.ROOT_CANAL_TREATED.value: "Root canal treated",
    FindingCondition.MISSING.value: "Missing tooth",
    FindingCondition.FRACTURED.value: "Fracture",
    FindingCondition.IMPACTED.value: "Impacted",
    FindingCondition.ABSCESS.value: "Abscess",
    FindingCondition.DISCOLORATION.value: "Discoloration",
    FindingCondition.OTHER.value: "Other",
}

CONDITION_CATALOG: List[Dict[str, object]] = [
    {
        "value": code,
        "label": label,
        "requiresSurfaces": code in SURFACE_REQUIRED_CONDITIONS,
        "toothLevelOnly": code in TOOTH_LEVEL_ONLY_CONDITIONS,
    }
    for code, label in CONDITION_LABELS.items()
]


def validate_finding_surfaces(tooth: str, condition: str, surfaces: List[str]) -> List[str]:
    """
    Validates a finding's condition and surfaces together per the documented clinical rules:
    - tooth-level-only conditions must carry no surfaces.
    - caries and restoration require at least one surface.
    - all other conditions allow zero or more valid surfaces for the tooth.
    """
    if condition not in CONDITION_LABELS:
        raise ValueError(
            f"'{condition}' is not a valid finding condition. Valid conditions: {sorted(CONDITION_LABELS)}"
        )

    normalized = validate_surfaces(tooth, surfaces or [])

    if condition in TOOTH_LEVEL_ONLY_CONDITIONS and normalized:
        raise ValueError(f"Condition '{condition}' applies to the whole tooth and must not include surfaces.")
    if condition in SURFACE_REQUIRED_CONDITIONS and not normalized:
        raise ValueError(f"Condition '{condition}' requires at least one surface.")
    return normalized


def surfaces_to_key(surfaces: List[str]) -> str:
    """Canonical comma-joined surface key used for duplicate detection and DB uniqueness."""
    return ",".join(surfaces)


class FindingStatus(str, Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"


@dataclass
class DentalChartFinding:
    """
    Pure domain representation of a tooth-level or surface-level clinical finding.
    Findings are never hard-deleted; corrections are made in place with an audit trail,
    and resolution is a status transition preserving who resolved it and when.
    """
    patient_id: UUID
    encounter_id: UUID
    author_id: UUID  # FK to team_members.id (server-derived from authenticated identity)
    tooth: str
    condition: str
    surfaces: List[str] = field(default_factory=list)
    status: str = FindingStatus.ACTIVE.value
    clinic_id: Optional[UUID] = None
    notes: Optional[str] = None
    correction_reason: Optional[str] = None
    corrected_by_id: Optional[UUID] = None
    corrected_at: Optional[datetime] = None
    resolved_by_id: Optional[UUID] = None
    resolved_at: Optional[datetime] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class ProcedureStatus(str, Enum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# Documented permitted procedure lifecycle transitions:
#   planned -> in_progress -> completed
#   planned -> cancelled
#   in_progress -> cancelled
# completed and cancelled are terminal states.
ALLOWED_PROCEDURE_TRANSITIONS: Dict[ProcedureStatus, Set[ProcedureStatus]] = {
    ProcedureStatus.PLANNED: {ProcedureStatus.IN_PROGRESS, ProcedureStatus.CANCELLED},
    ProcedureStatus.IN_PROGRESS: {ProcedureStatus.COMPLETED, ProcedureStatus.CANCELLED},
    ProcedureStatus.COMPLETED: set(),
    ProcedureStatus.CANCELLED: set(),
}


@dataclass
class DentalProcedureRecord:
    """
    Pure domain representation of a planned or performed dental procedure.
    Referenced treatment catalog comes from the existing services table via service_id.
    A procedure being added to a treatment plan never marks it completed.
    """
    patient_id: UUID
    encounter_id: UUID
    recorded_by_id: UUID  # FK to team_members.id (server-derived)
    tooth: str
    service_id: UUID  # FK to services.id (existing clinic service catalog)
    status: str = ProcedureStatus.PLANNED.value
    clinic_id: Optional[UUID] = None
    surfaces: List[str] = field(default_factory=list)
    notes: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    completed_by_id: Optional[UUID] = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))