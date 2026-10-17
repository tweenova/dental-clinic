from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, status as http_status

from app.domain.models.clinical_note_template import ClinicalNoteTemplate
from app.domain.repositories.clinical_note_repo import ClinicalNoteRepository
from app.domain.repositories.clinical_note_template_repo import ClinicalNoteTemplateRepository
from app.infrastructure.repositories.postgres_activity_repo import (
    PostgresActivityLogRepository,
    record_activity,
)

DEFAULT_NEUTRAL_TEMPLATES = [
    {
        "name": "check-up",
        "subjective": (
            "Reason for Visit: [Routine Examination / Specific Concern]\n"
            "Symptoms / Pain Scale (0-10): [None / Mild / Moderate / Severe]\n"
            "Medical History Updates: [None / Noted Changes]"
        ),
        "objective": (
            "Extra-oral Examination: [Within normal limits / Findings]\n"
            "Intra-oral Soft Tissues: [Healthy / Findings]\n"
            "Periodontal Screening: [BPE / Pocketing]\n"
            "Hard Tissue Findings: [Caries / Restorations / Wear]"
        ),
        "assessment": (
            "Diagnostic Summary: [Diagnosis / Findings]\n"
            "Risk Factors: [Caries Risk: Low/Medium/High, Perio Risk: Low/Medium/High]"
        ),
        "plan": (
            "Treatment Discussed: [Prophylaxis / Restorations / Monitoring]\n"
            "Patient Preference / Agreed Next Steps: [Agreed steps]\n"
            "Recall Interval: [6 months / Other]"
        ),
    },
    {
        "name": "filling",
        "subjective": (
            "Presenting Tooth / Area: [Tooth #]\n"
            "Pre-operative Symptoms: [Asymptomatic / Sensitivity to cold/sweet / Food packing]\n"
            "Anaesthetic History: [No known adverse reactions]"
        ),
        "objective": (
            "Tooth & Surface: [Tooth #, Class / Surfaces]\n"
            "Pre-op Status: [Primary caries / Defective restoration / Fracture]\n"
            "Radiographic Correlation: [Bitewing / Periapical confirmation]"
        ),
        "assessment": (
            "Diagnosis: [Dental Caries / Defective Restoration / Tooth Fracture]\n"
            "Prognosis: [Good / Fair]"
        ),
        "plan": (
            "Anaesthesia Administered: [Agent, Concentration, Volume, Technique]\n"
            "Isolation Technique: [Rubber Dam / Cotton rolls & suction]\n"
            "Restorative Material: [Composite / GIC / Amalgam, Shade]\n"
            "Liner / Base Used: [None / Calcium hydroxide / GIC base]\n"
            "Occlusion & Polish: [Checked with articulating paper, adjusted and polished]\n"
            "Post-op Instructions Given: [Avoid hard food until numbness subsides, sensitivity warnings]"
        ),
    },
    {
        "name": "extraction",
        "subjective": (
            "Presenting Complaint: [Tooth #, Unrestorable / Severe pain / Orthodontic referral]\n"
            "Medical Alert Verification: [Anticoagulants / Bisphosphonates / Allergies verified]\n"
            "Pre-op Discussion: [Risks, benefits, and alternatives discussed]"
        ),
        "objective": (
            "Tooth Position & Mobility: [Tooth #, Grade 0-3 mobility]\n"
            "Soft Tissue Condition: [Healthy / Periapical inflammation / Swelling]\n"
            "Radiographic Assessment: [Root morphology, relationship to adjacent structures verified]"
        ),
        "assessment": (
            "Indication for Extraction: [Grossly carious unrestorable / Severe periodontitis / Failed endodontic / Orthodontic]"
        ),
        "plan": (
            "Informed Consent: [Written consent confirmed prior to procedure]\n"
            "Anaesthesia: [Agent, Volume, Block / Infiltration]\n"
            "Procedure Performed: [Simple forceps extraction / Surgical sectioning]\n"
            "Haemostasis Achieved: [Pressure gauze / Gelatamp / Suture]\n"
            "Post-operative Instructions: [Bite on pack 20m, no spitting/rinsing for 24h, warm salt water after 24h, pain management]\n"
            "Emergency Contact: [Clinic emergency line provided]"
        ),
    },
    {
        "name": "root canal visit",
        "subjective": (
            "Presenting Tooth: [Tooth #]\n"
            "Symptoms between visits: [Asymptomatic / Mild percussion tenderness / Spontaneous pain]\n"
            "Analgesic Usage: [None / Occasional / Regular]"
        ),
        "objective": (
            "Tooth # & Isolation: [Tooth #, Rubber dam isolation verified]\n"
            "Access Cavity / Canal Identification: [Canals located: MB, DB, P / ML, Distal]\n"
            "Working Lengths: [Apex locator / Radiograph confirmation, canal lengths]\n"
            "Instrumentation & Irrigation: [Rotary / Hand files, NaOCl %, EDTA]"
        ),
        "assessment": (
            "Stage of Endodontic Therapy: [Visit 1: Extirpation & Chemo-mechanical preparation / Visit 2: Obturation]\n"
            "Canal Status: [Dry / Exudate / Odour free]"
        ),
        "plan": (
            "Medicament / Dressing Placed: [Calcium hydroxide / Ledermix]\n"
            "Obturation Details (if final visit): [Warm vertical / Single cone, Sealer type, Master cone verification]\n"
            "Temporary Restoration: [Cavit / GIC, thickness verified]\n"
            "Definitive Restoration Plan: [Core build-up & crown recommended]\n"
            "Next Appointment / Review: [Obturation visit / Recall in 6 months]"
        ),
    },
]


class ClinicalNoteTemplateService:
    def __init__(
        self,
        template_repo: ClinicalNoteTemplateRepository,
        clinical_note_repo: Optional[ClinicalNoteRepository] = None,
        activity_repo: Optional[PostgresActivityLogRepository] = None,
    ):
        self.template_repo = template_repo
        self.clinical_note_repo = clinical_note_repo
        self.activity_repo = activity_repo

    async def seed_default_templates(self) -> List[ClinicalNoteTemplate]:
        seeded = []
        for t_data in DEFAULT_NEUTRAL_TEMPLATES:
            existing = await self.template_repo.get_by_name(t_data["name"])
            if not existing:
                tmpl = ClinicalNoteTemplate(
                    name=t_data["name"],
                    subjective=t_data["subjective"],
                    objective=t_data["objective"],
                    assessment=t_data["assessment"],
                    plan=t_data["plan"],
                    active=True,
                )
                saved = await self.template_repo.save(tmpl)
                seeded.append(saved)
            else:
                seeded.append(existing)
        return seeded

    async def list_templates(self, active_only: bool = True) -> List[ClinicalNoteTemplate]:
        # Ensure default templates are seeded
        templates = await self.template_repo.list_templates(active_only=active_only)
        if not templates:
            await self.seed_default_templates()
            templates = await self.template_repo.list_templates(active_only=active_only)
        return templates

    async def get_template_by_id(self, template_id: UUID) -> ClinicalNoteTemplate:
        template = await self.template_repo.get_by_id(template_id)
        if not template:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Note template not found.",
            )
        return template

    async def create_template(
        self,
        name: str,
        subjective: str,
        objective: str,
        assessment: str,
        plan: str,
        active: bool = True,
        user_id: Optional[UUID] = None,
    ) -> ClinicalNoteTemplate:
        if not name or not name.strip():
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Template name is required.",
            )

        existing = await self.template_repo.get_by_name(name.strip())
        if existing:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail=f"Template with name '{name.strip()}' already exists.",
            )

        template = ClinicalNoteTemplate(
            name=name.strip(),
            subjective=subjective.strip() if subjective else "",
            objective=objective.strip() if objective else "",
            assessment=assessment.strip() if assessment else "",
            plan=plan.strip() if plan else "",
            active=active,
        )
        saved = await self.template_repo.save(template)

        await record_activity(
            self.activity_repo,
            action="note_template_create",
            entity_type="clinical_note_template",
            entity_id=saved.id,
            user_id=user_id,
            details={"name": saved.name},
        )
        return saved

    async def update_template(
        self,
        template_id: UUID,
        name: Optional[str] = None,
        subjective: Optional[str] = None,
        objective: Optional[str] = None,
        assessment: Optional[str] = None,
        plan: Optional[str] = None,
        active: Optional[bool] = None,
        user_id: Optional[UUID] = None,
    ) -> ClinicalNoteTemplate:
        template = await self.get_template_by_id(template_id)

        if name is not None and name.strip() and name.strip() != template.name:
            dup = await self.template_repo.get_by_name(name.strip())
            if dup and dup.id != template.id:
                raise HTTPException(
                    status_code=http_status.HTTP_409_CONFLICT,
                    detail=f"Another template with name '{name.strip()}' already exists.",
                )
            template.name = name.strip()

        if subjective is not None:
            template.subjective = subjective
        if objective is not None:
            template.objective = objective
        if assessment is not None:
            template.assessment = assessment
        if plan is not None:
            template.plan = plan
        if active is not None:
            template.active = active

        saved = await self.template_repo.save(template)

        await record_activity(
            self.activity_repo,
            action="note_template_update",
            entity_type="clinical_note_template",
            entity_id=saved.id,
            user_id=user_id,
            details={"name": saved.name, "active": saved.active},
        )
        return saved

    async def apply_template_to_draft_note(
        self,
        template_id: UUID,
        note_id: UUID,
        user_id: UUID,
        overwrite_confirmed: bool = False,
    ) -> Dict[str, Any]:
        """
        Applies a template to an existing draft note.
        STRICT RULES:
        1. Signed notes are NEVER changed by templates.
        2. If draft already has content, overwrite_confirmed must be True.
        """
        if not self.clinical_note_repo:
            raise HTTPException(
                status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Clinical note repository is not configured.",
            )

        note = await self.clinical_note_repo.get_by_id(note_id)
        if not note:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Clinical note not found.",
            )

        # 1. Signed notes immutable
        if getattr(note, "is_signed", False) or getattr(note, "signed_at", None) is not None:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Signed clinical notes are immutable and cannot be modified by note templates.",
            )

        template = await self.get_template_by_id(template_id)

        # Check existing non-empty content
        has_existing = bool(
            (note.subjective and note.subjective.strip())
            or (note.objective and note.objective.strip())
            or (note.assessment and note.assessment.strip())
            or (note.plan and note.plan.strip())
        )

        if has_existing and not overwrite_confirmed:
            raise HTTPException(
                status_code=http_status.HTTP_409_CONFLICT,
                detail="Note already contains text. Overwrite confirmation is required.",
            )

        note.subjective = template.subjective
        note.objective = template.objective
        note.assessment = template.assessment
        note.plan = template.plan
        saved_note = await self.clinical_note_repo.save(note)

        await record_activity(
            self.activity_repo,
            action="note_template_apply",
            entity_type="clinical_note",
            entity_id=saved_note.id,
            user_id=user_id,
            details={
                "template_id": str(template.id),
                "template_name": template.name,
                "note_id": str(saved_note.id),
            },
        )

        return {
            "noteId": saved_note.id,
            "templateName": template.name,
            "subjective": saved_note.subjective,
            "objective": saved_note.objective,
            "assessment": saved_note.assessment,
            "plan": saved_note.plan,
        }
