from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class FaqCreateRequest(BaseModel):
    """Schema for adding an FAQ item."""
    category: str = Field(..., min_length=2, max_length=50)
    question: str = Field(..., min_length=5)
    answer: str = Field(..., min_length=5)
    displayOrder: int = 0
    isActive: bool = True

    model_config = ConfigDict(extra="ignore")


class FaqUpdateRequest(BaseModel):
    """Schema for updating an FAQ item."""
    category: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    displayOrder: Optional[int] = None
    isActive: Optional[bool] = None

    model_config = ConfigDict(extra="ignore")


class FaqResponse(BaseModel):
    """Full representation of an FAQ item."""
    id: UUID
    category: str
    question: str
    answer: str
    displayOrder: int
    isActive: bool
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(from_attributes=True)


class GeneralSectionDTO(BaseModel):
    """CMS General section configuration."""
    practiceName: str = "Marlow Dental"
    tagline: str = "Comprehensive, unhurried dental care."
    logoUrl: Optional[str] = None
    faviconUrl: Optional[str] = None
    phone: str = "+92 300 1234567"
    email: str = "care@marlowdental.com"
    address: str = "123 Healthcare Boulevard, Medical District"
    emergencyPhone: Optional[str] = "+92 300 7654321"

    model_config = ConfigDict(extra="ignore")


class HomepageSectionDTO(BaseModel):
    """CMS Homepage section configuration."""
    heroEyebrow: str = "Independent Dental Practice · Modern Clinical Care"
    heroHeading: str = "Modern, unhurried dental care."
    heroDescription: str = "Comprehensive exams, gentle restorations, and transparent fee schedules from a dedicated clinical team."
    heroCtaText: str = "Request an appointment"
    heroCtaLink: str = "/book"
    heroSecondaryCtaText: str = "View treatment fees"
    heroSecondaryCtaLink: str = "#services"
    heroImageUrl: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class AboutSectionDTO(BaseModel):
    """CMS About section configuration."""
    eyebrow: str = "Meet Your Dental Team"
    title: str = "We opened this practice to offer unhurried, conservative care."
    storyParagraphs: List[str] = Field(default_factory=lambda: [
        "After graduating from top dental programs, our clinicians established Marlow Dental with a single standard: patient-first continuity from start to finish.",
        "When you sit in our chair, we will never recommend aggressive treatments or unneeded cosmetic procedures. If a tooth can be maintained conservatively with diligent care, that is exactly what we advise.",
    ])
    imageUrl: Optional[str] = None
    licensureText: str = "Registered & Verified Clinical Licensure. BLS/CPR Certified."

    model_config = ConfigDict(extra="ignore")


class ContactSectionDTO(BaseModel):
    """CMS Contact section configuration."""
    phone: str = "+92 300 1234567"
    email: str = "care@marlowdental.com"
    addressLine1: str = "123 Healthcare Boulevard"
    addressLine2: str = "Suite 300, Medical District"
    transitNote: str = "Convenient transit access and dedicated patient parking available on site."
    hoursSummary: str = "Monday – Thursday: 8:00 AM – 6:00 PM\nFriday: 8:00 AM – 2:00 PM (Emergency triage only)\nSaturday – Sunday: Closed"
    emergencyNote: str = "Reserved triage blocks available daily. Call before 11:00 AM for same-day evaluation."

    model_config = ConfigDict(extra="ignore")


class FooterSectionDTO(BaseModel):
    """CMS Footer section configuration."""
    tagline: str = "Independent, ethical dental care."
    copyrightNotice: str = "Marlow Dental Practice. All rights reserved."
    cancellationPolicy: str = "We request 48 hours notice for appointment rescheduling."

    model_config = ConfigDict(extra="ignore")


class SeoSectionDTO(BaseModel):
    """CMS SEO configuration."""
    siteTitle: str = "Marlow Dental — Unhurried Dentistry"
    metaDescription: str = "Independent dental practice offering gentle exams, ceramic restorations, and transparent pricing."
    ogImageUrl: Optional[str] = None

    model_config = ConfigDict(extra="ignore")


class PublicCmsResponse(BaseModel):
    """Public aggregated CMS configuration for frontend rendering."""
    general: GeneralSectionDTO
    homepage: HomepageSectionDTO
    about: AboutSectionDTO
    contact: ContactSectionDTO
    footer: FooterSectionDTO
    seo: SeoSectionDTO
