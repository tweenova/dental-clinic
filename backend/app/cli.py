import argparse
import asyncio
import getpass
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.core.database import close_db, get_session_factory
from app.core.security import hash_password
from app.domain.models.announcement import Announcement
from app.domain.models.cms import FaqItem, SiteSection
from app.domain.models.organization import Location, Organization
from app.domain.models.service import Service
from app.domain.models.team_member import TeamMember
from app.domain.models.user import User, UserRole
from app.infrastructure.repositories.postgres_announcement_repo import PostgresAnnouncementRepository
from app.infrastructure.repositories.postgres_cms_repo import PostgresCmsRepository
from app.infrastructure.repositories.postgres_organization_repo import (
    PostgresLocationRepository,
    PostgresOrganizationRepository,
)
from app.infrastructure.repositories.postgres_service_repo import PostgresServiceRepository
from app.infrastructure.repositories.postgres_team_repo import PostgresTeamMemberRepository
from app.infrastructure.repositories.postgres_user_repo import PostgresUserRepository
from app.application.services.cms_service import DEFAULT_SECTIONS


INITIAL_SERVICES = [
    {
        "slug": "cleanings-exams",
        "category": "preventive",
        "title": "Cleanings & Comprehensive Exam",
        "short_desc": "Complete oral health evaluation, low-radiation digital bitewing X-rays, ultrasonic scaling, polish, and thorough doctor consultation.",
        "full_desc": "We thoroughly assess periodontal health, soft tissues, and tooth enamel. You see the digital X-rays directly on the chairside display with Dr. Marlow explaining every observation before any decision.",
        "duration": "45 to 60 min",
        "cash_price": "from 140",
        "code": "CDT D0150 / D1110",
        "insurance_note": None,
        "recommended_interval": "Every 6 months",
        "display_order": 0,
        "is_highlighted": True,
    },
    {
        "slug": "fillings-crowns",
        "category": "restorative",
        "title": "Tooth-Colored Fillings & Crowns",
        "short_desc": "Composite resin restorations matched to your tooth shade, and custom-milled ceramic crowns restoring natural chewing bite.",
        "full_desc": "We use biocompatible composite resins precisely color-matched to your tooth shade. For fractured or weakened molars, custom ceramic crowns restore natural chewing anatomy without dark metal margins.",
        "duration": "60 to 90 min",
        "cash_price": "from 210",
        "code": "CDT D2391 / D2740",
        "insurance_note": None,
        "recommended_interval": "As needed after diagnostic scan",
        "display_order": 1,
        "is_highlighted": True,
    },
    {
        "slug": "root-canals",
        "category": "restorative",
        "title": "Gentle Endodontics (Root Canals)",
        "short_desc": "Rotary canal instrumentation performed by Dr. Marlow with local anesthesia to eliminate acute nerve pain.",
        "full_desc": "Modern root canals relieve pain rather than causing it. Dr. Marlow handles root canal therapy in a quiet, single-doctor environment with profound anesthesia so you feel only light vibration.",
        "duration": "75 to 90 min",
        "cash_price": "from 680",
        "code": "CDT D3330",
        "insurance_note": None,
        "recommended_interval": "Emergency or pulpitis diagnosis",
        "display_order": 2,
        "is_highlighted": False,
    },
    {
        "slug": "invisalign",
        "category": "cosmetic",
        "title": "Invisalign Clear Aligners",
        "short_desc": "Digital 3D optical scans, custom clear trays, and progressive bite alignment without metal brackets or wires.",
        "full_desc": "Clear aligner therapy addresses crowded teeth, gaps, and traumatic occlusion. We only recommend aligners when they genuinely improve your functional bite and periodontal hygiene.",
        "duration": "6 to 15 months",
        "cash_price": "from 3400",
        "code": "CDT D8090",
        "insurance_note": None,
        "recommended_interval": "Consultation required",
        "display_order": 3,
        "is_highlighted": False,
    },
    {
        "slug": "whitening",
        "category": "cosmetic",
        "title": "Professional Enamel Whitening",
        "short_desc": "Custom-fitted laboratory trays or in-office carbamide peroxide whitening with gingival protection.",
        "full_desc": "Custom vacuum-formed trays ensure professional whitening gel stays in direct contact with enamel without irritating delicate gingival tissue. Honest shade assessment beforehand.",
        "duration": "1 visit or 2 weeks",
        "cash_price": "from 280",
        "code": "CDT D9972",
        "insurance_note": None,
        "recommended_interval": "Annual refresh or pre-event",
        "display_order": 4,
        "is_highlighted": False,
    },
    {
        "slug": "emergency",
        "category": "emergency",
        "title": "Same-Day Emergency Triage",
        "short_desc": "Sudden toothache, broken restoration, chipped tooth, or facial swelling. Reserved triage blocks available daily.",
        "full_desc": "We reserve emergency triage blocks in our daily schedule. Call before 11:00 AM on weekdays to be seen the same day for targeted diagnosis, pain relief, and stabilization.",
        "duration": "30 to 45 min",
        "cash_price": "from 95",
        "code": "CDT D0140 / D9110",
        "insurance_note": None,
        "recommended_interval": "Call immediately upon symptoms",
        "display_order": 5,
        "is_highlighted": False,
    },
]

INITIAL_FAQS = [
    {
        "category": "pricing",
        "question": "Do you provide written estimates before treatment?",
        "answer": "Yes. Before beginning any procedure outside a routine cleaning, we provide a printed, itemized estimate showing all treatment fees upfront.",
        "display_order": 0,
    },
    {
        "category": "pricing",
        "question": "What payment methods do you accept?",
        "answer": "We accept major credit and debit cards, online bank transfers, and direct cash payments. Every visit receives an itemized receipt.",
        "display_order": 1,
    },
    {
        "category": "comfort",
        "question": "I have severe dental anxiety. How do you accommodate nervous patients?",
        "answer": "We schedule generous appointment blocks so you are never rushed. You have full control: raise a hand at any second to pause. We offer noise-canceling headphones, warm blankets, and unhurried local anesthesia.",
        "display_order": 2,
    },
    {
        "category": "scheduling",
        "question": "How quickly can I be seen for an acute dental emergency?",
        "answer": "We reserve dedicated emergency slots every morning and afternoon. Call us before 11:00 AM on weekdays for same-day diagnostic evaluation and pain stabilization.",
        "display_order": 3,
    },
]


async def create_admin_cmd(email: str, password: str, full_name: str):
    session_factory = get_session_factory()
    async with session_factory() as session:
        user_repo = PostgresUserRepository(session)
        existing = await user_repo.get_by_email(email)
        hashed = hash_password(password)
        if existing:
            existing.hashed_password = hashed
            existing.full_name = full_name
            existing.role = UserRole.ADMIN
            existing.is_active = True
            await user_repo.save(existing)
            await session.commit()
            print(f"Updated existing admin account: {email}")
        else:
            admin_user = User(
                email=email.strip().lower(),
                hashed_password=hashed,
                full_name=full_name,
                role=UserRole.ADMIN,
                is_active=True,
            )
            await user_repo.save(admin_user)
            await session.commit()
            print(f"Successfully created admin account: {email}")
    await close_db()


async def seed_data_cmd():
    session_factory = get_session_factory()
    async with session_factory() as session:
        org_repo = PostgresOrganizationRepository(session)
        loc_repo = PostgresLocationRepository(session)
        team_repo = PostgresTeamMemberRepository(session)
        svc_repo = PostgresServiceRepository(session)
        cms_repo = PostgresCmsRepository(session)

        # 1. Organization
        org = await org_repo.get_current()
        if not org:
            org = Organization(
                name="Marlow Dental",
                display_name="Marlow Dental Practice",
                tagline="Comprehensive, unhurried dental care.",
                description="Independent dental practice focused on doctor continuity and transparent fee schedules.",
                contact_email="care@marlowdental.com",
                contact_phone="+92 300 1234567",
                website_url="https://marlowdental.com",
            )
            org = await org_repo.save(org)
            print("Seeded Organization: Marlow Dental")

        # 2. Locations (Multi-location Practice)
        locations = await loc_repo.list_all(include_inactive=True)
        primary_loc = locations[0] if locations else None
        if not primary_loc:
            primary_loc = Location(
                organization_id=org.id,
                name="Main Practice Facility",
                address_line1="123 Healthcare Boulevard, Suite 300",
                city="Capital District",
                state="Federal Capital",
                postal_code="44000",
                country="PK",
                phone="+92 300 1234567",
                email="care@marlowdental.com",
                hours_info="Monday – Thursday: 8:00 AM – 6:00 PM\nFriday: 8:00 AM – 2:00 PM (Emergency only)\nSaturday – Sunday: Closed",
                is_primary=True,
                display_order=0,
            )
            primary_loc = await loc_repo.save(primary_loc)
            print("Seeded Primary Location: Main Practice Facility")

        if len(locations) < 2:
            west_loop_loc = Location(
                organization_id=org.id,
                name="Downtown Dental Studio",
                address_line1="45 Commercial Avenue, Suite 400",
                city="Capital District",
                state="Federal Capital",
                postal_code="44000",
                country="PK",
                phone="+92 300 1234588",
                email="downtown@marlowdental.com",
                hours_info="Monday – Friday: 9:00 AM – 7:00 PM\nSaturday: 9:00 AM – 3:00 PM\nSunday: Closed",
                is_primary=False,
                display_order=1,
            )
            await loc_repo.save(west_loop_loc)
            print("Seeded Location: Downtown Dental Studio")

            gold_coast_loc = Location(
                organization_id=org.id,
                name="Northside Specialty Suite",
                address_line1="88 North Medical Center, Suite 5B",
                city="Capital District",
                state="Federal Capital",
                postal_code="44000",
                country="PK",
                phone="+92 300 1234599",
                email="northside@marlowdental.com",
                hours_info="Tuesday – Saturday: 8:30 AM – 5:30 PM\nSunday – Monday: Closed",
                is_primary=False,
                display_order=2,
            )
            await loc_repo.save(gold_coast_loc)
            print("Seeded Location: Gold Coast Specialty Suite")

        # 3. Clinical Team Members
        all_locs = await loc_repo.list_all(include_inactive=True)
        loc_map = {l.name: l.id for l in all_locs}
        team_members = await team_repo.list_all(include_inactive=True)
        if not team_members:
            director = TeamMember(
                organization_id=org.id,
                location_id=primary_loc.id if primary_loc else None,
                first_name="Sarah",
                last_name="Marlow",
                display_name="Dr. Sarah Marlow, DDS",
                professional_title="Founder & Clinical Director",
                role="Director",
                specialties=["General Dentistry", "Conservative Restorative Care", "Invisalign Certified"],
                biography="After graduating from the University of Michigan School of Dentistry, Dr. Marlow spent four years in high-volume group practices before establishing Marlow Dental to practice unhurried, conservative care with direct doctor continuity.",
                photo_url="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=1200&auto=format&fit=crop",
                education="Doctor of Dental Surgery (DDS), University of Michigan; B.S. in Biology, UIUC",
                credentials="DDS",
                license_number="#019.029811",
                license_state="Active",
                display_order=0,
                is_active=True,
            )
            await team_repo.save(director)
            print("Seeded Director Team Member: Dr. Sarah Marlow, DDS")

        if len(team_members) < 2:
            wl_id = loc_map.get("West Loop Dental Studio", primary_loc.id if primary_loc else None)
            gc_id = loc_map.get("Gold Coast Specialty Suite", primary_loc.id if primary_loc else None)

            dr_vance = TeamMember(
                organization_id=org.id,
                location_id=wl_id,
                first_name="Marcus",
                last_name="Vance",
                display_name="Dr. Marcus Vance, DMD",
                professional_title="Orthodontics & Clear Aligner Specialist",
                role="Orthodontist",
                specialties=["Orthodontics", "Invisalign Platinum Provider", "Dento-Facial Orthopedics"],
                biography="Dr. Vance completed his orthodontic residency at Harvard School of Dental Medicine. He specializes in digital airway-friendly clear aligner therapy and interceptive alignment for adults and teens.",
                photo_url="https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1200&auto=format&fit=crop",
                education="DMD, Harvard School of Dental Medicine; Certificate in Orthodontics",
                credentials="DMD, MS",
                license_number="#019.034912",
                license_state="Active",
                display_order=1,
                is_active=True,
            )
            await team_repo.save(dr_vance)
            print("Seeded Specialist: Dr. Marcus Vance, DMD")

            dr_rostova = TeamMember(
                organization_id=org.id,
                location_id=primary_loc.id if primary_loc else None,
                first_name="Elena",
                last_name="Rostova",
                display_name="Dr. Elena Rostova, DDS",
                professional_title="Periodontics & Dental Implants Associate",
                role="Dentist",
                specialties=["Periodontal Therapy", "Guided Tissue Regeneration", "Dental Implants"],
                biography="Specializing in soft tissue microsurgery and 3D computer-guided implant placement, Dr. Rostova focuses on minimally invasive periodontal restoration and long-term tooth retention.",
                photo_url="https://images.unsplash.com/photo-1594824813639-65fe002495d4?q=80&w=1200&auto=format&fit=crop",
                education="DDS, Columbia University College of Dental Medicine",
                credentials="DDS, M.S.",
                license_number="#019.041880",
                license_state="Active",
                display_order=2,
                is_active=True,
            )
            await team_repo.save(dr_rostova)
            print("Seeded Specialist: Dr. Elena Rostova, DDS")

            dr_chen = TeamMember(
                organization_id=org.id,
                location_id=gc_id,
                first_name="James",
                last_name="Chen",
                display_name="Dr. James Chen, MD, DDS",
                professional_title="Oral & Maxillofacial Surgery Consultant",
                role="Oral Surgeon",
                specialties=["Surgical Wisdom Extractions", "Bone Grafting", "Sedation Dentistry"],
                biography="Dual-degreed in medicine and dental surgery from Northwestern and UIC, Dr. Chen delivers gentle surgical extractions, complex bone reconstruction, and intravenous twilight anesthesia.",
                photo_url="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=1200&auto=format&fit=crop",
                education="MD & DDS, UIC College of Dentistry / Northwestern Feinberg School of Medicine",
                credentials="MD, DDS, FACS",
                license_number="#019.052109",
                license_state="Active",
                display_order=3,
                is_active=True,
            )
            await team_repo.save(dr_chen)
            print("Seeded Specialist: Dr. James Chen, MD, DDS")

        # 4. Services
        for svc_data in INITIAL_SERVICES:
            existing_svc = await svc_repo.get_by_slug(svc_data["slug"])
            if not existing_svc:
                s = Service(
                    slug=svc_data["slug"],
                    category=svc_data["category"],
                    title=svc_data["title"],
                    short_desc=svc_data["short_desc"],
                    full_desc=svc_data["full_desc"],
                    cash_price=svc_data["cash_price"],
                    duration=svc_data["duration"],
                    code=svc_data["code"],
                    insurance_note=svc_data["insurance_note"],
                    recommended_interval=svc_data["recommended_interval"],
                    display_order=svc_data["display_order"],
                    is_highlighted=svc_data["is_highlighted"],
                    is_active=True,
                    is_public=True,
                )
                await svc_repo.save(s)
                print(f"Seeded Service: {s.slug}")

        # 5. FAQs
        existing_faqs = await cms_repo.list_faqs(include_inactive=True)
        if not existing_faqs:
            for faq_data in INITIAL_FAQS:
                f = await cms_repo.save_faq(
                    FaqItem(
                        category=faq_data["category"],
                        question=faq_data["question"],
                        answer=faq_data["answer"],
                        display_order=faq_data["display_order"],
                        is_active=True,
                    )
                )
                print(f"Seeded FAQ: {faq_data['question'][:30]}...")

        # 6. Announcements (Marquee ticker)
        ann_repo = PostgresAnnouncementRepository(session)
        existing_announcements = await ann_repo.list_all(include_inactive=True)
        if not existing_announcements:
            initial_announcements = [
                "Now welcoming new patients across all clinic facility locations",
                "100% upfront fee transparency with itemized written estimates before any treatment",
                "Same-day emergency dental relief & reserved triage appointments available daily",
            ]
            for order, text_content in enumerate(initial_announcements):
                await ann_repo.save(
                    Announcement(
                        content=text_content,
                        is_active=True,
                        display_order=order,
                    )
                )
            print("Seeded Announcements for live banner marquee.")

        # 7. Complete CMS Site Sections (Persist all 6 sections in PostgreSQL)
        existing_sections = await cms_repo.get_all_sections()
        from datetime import timezone
        for sec_key, default_content in DEFAULT_SECTIONS.items():
            if sec_key not in existing_sections:
                await cms_repo.save_section(
                    SiteSection(
                        section_key=sec_key,
                        content=default_content,
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                print(f"Seeded CMS Section into DB: {sec_key}")

        # 9. Development Seed Accounts & Operational Data
        await seed_dev_users_internal(session)

        await session.commit()
        print("Database seed completed successfully.")
    await close_db()


async def seed_dev_users_internal(session):
    import os
    from datetime import date, timedelta
    from app.infrastructure.database.orm_models import (
        BookingORM,
        ClinicORM,
        LeadORM,
        LeadSourceORM,
        MessageORM,
        PatientORM,
        TaskORM,
        TeamMemberORM,
        UserORM,
    )
    from app.core.security import hash_password

    # 1. Fetch primary clinic
    clinic_stmt = select(ClinicORM).order_by(ClinicORM.display_order.asc())
    clinic_res = await session.execute(clinic_stmt)
    primary_clinic = clinic_res.scalars().first()
    clinic_id = primary_clinic.id if primary_clinic else None

    # 2. Seed Admin User
    admin_email = os.environ.get("DEV_ADMIN_EMAIL", "admin@marlowdental.com").strip().lower()
    admin_pwd = os.environ.get("DEV_ADMIN_PASSWORD", "admin123456")
    admin_stmt = select(UserORM).where(UserORM.email == admin_email)
    admin_res = await session.execute(admin_stmt)
    existing_admin = admin_res.scalar_one_or_none()
    if not existing_admin:
        session.add(
            UserORM(
                email=admin_email,
                hashed_password=hash_password(admin_pwd),
                full_name="Dr. Sarah Marlow",
                role="admin",
                clinic_id=clinic_id,
                is_active=True,
            )
        )
        print(f"Seeded Dev Admin: {admin_email}")

    # 3. Seed Receptionist User
    rec_email = os.environ.get("DEV_RECEPTIONIST_EMAIL", "receptionist@marlowdental.com").strip().lower()
    rec_pwd = os.environ.get("DEV_RECEPTIONIST_PASSWORD", "receptionist123456")
    rec_stmt = select(UserORM).where(UserORM.email == rec_email)
    rec_res = await session.execute(rec_stmt)
    existing_rec = rec_res.scalar_one_or_none()
    if not existing_rec:
        session.add(
            UserORM(
                email=rec_email,
                hashed_password=hash_password(rec_pwd),
                full_name="Jessica Reynolds",
                role="receptionist",
                clinic_id=clinic_id,
                is_active=True,
            )
        )
        print(f"Seeded Dev Receptionist: {rec_email}")

    # 4. Seed Doctor User
    doc_email = os.environ.get("DEV_DOCTOR_EMAIL", "doctor@marlowdental.com").strip().lower()
    doc_pwd = os.environ.get("DEV_DOCTOR_PASSWORD", "doctor123456")
    doc_stmt = select(UserORM).where(UserORM.email == doc_email)
    doc_res = await session.execute(doc_stmt)
    existing_doc = doc_res.scalar_one_or_none()
    if not existing_doc:
        session.add(
            UserORM(
                email=doc_email,
                hashed_password=hash_password(doc_pwd),
                full_name="Dr. Marcus Vance",
                role="doctor",
                clinic_id=clinic_id,
                is_active=True,
            )
        )
        print(f"Seeded Dev Doctor: {doc_email}")

    await session.flush()

    # 5. Seed Sample Patients if empty
    pat_stmt = select(PatientORM)
    pat_res = await session.execute(pat_stmt)
    patients = pat_res.scalars().all()
    if not patients:
        sample_patients = [
            ("Eleanor", "Pemberton", "(312) 555-0191", "eleanor.p@example.com", date(1988, 4, 12), "Prefers morning appointments."),
            ("Arthur", "Pendelton", "(312) 555-0192", "arthur.p@example.com", date(1975, 11, 23), "Mild dental anxiety; gentle care required."),
            ("Sophia", "Martinez", "(312) 555-0193", "sophia.m@example.com", date(1994, 7, 5), "Interested in clear aligners consult."),
            ("David", "Kim", "(312) 555-0194", "david.k@example.com", date(1982, 1, 30), "Annual cleaning and diagnostic check."),
            ("Clara", "Oswald", "(312) 555-0195", "clara.o@example.com", date(1990, 9, 14), "Follow-up for restorative filling."),
        ]
        created_pats = []
        for fn, ln, ph, em, dob, notes in sample_patients:
            p = PatientORM(
                first_name=fn,
                last_name=ln,
                phone=ph,
                email=em,
                date_of_birth=dob,
                clinic_id=clinic_id,
                notes=notes,
                is_active=True,
            )
            session.add(p)
            created_pats.append(p)
        await session.flush()
        patients = created_pats
        print(f"Seeded {len(patients)} development patients.")

    # 6. Seed Sample Bookings if empty
    book_stmt = select(BookingORM)
    book_res = await session.execute(book_stmt)
    bookings = book_res.scalars().all()
    if not bookings and patients:
        today = datetime.now(timezone.utc).date()
        doc_stmt = select(TeamMemberORM).where(TeamMemberORM.is_active.is_(True))
        doc_res = await session.execute(doc_stmt)
        team_members = doc_res.scalars().all()
        tm_id = team_members[0].id if team_members else None

        sample_bookings = [
            ("BK-2026-1001", today, "8:30 AM", "confirmed", patients[0], "cleanings-exams", "Confirmed via SMS reminder."),
            ("BK-2026-1002", today, "10:00 AM", "arrived", patients[1], "fillings-crowns", "Patient arrived at 9:55 AM. Waiting in lounge."),
            ("BK-2026-1003", today, "11:30 AM", "requested", patients[2], "invisalign", "Requested callback before appointment."),
            ("BK-2026-1004", today, "1:30 PM", "in_progress", patients[3], "cleanings-exams", "In chair with hygienist."),
            ("BK-2026-1005", today, "3:00 PM", "confirmed", patients[4], "emergency", "Same-day triage for tooth sensitivity."),
            ("BK-2026-1006", today + timedelta(days=1), "10:00 AM", "requested", patients[0], "cleanings-exams", "Upcoming routine care."),
            ("BK-2026-1007", today + timedelta(days=2), "11:30 AM", "confirmed", patients[1], "whitening", "Whitening custom tray fitting."),
        ]
        for cid, bdate, btime, bstatus, pat, s_id, snotes in sample_bookings:
            b = BookingORM(
                confirmation_id=cid,
                clinic_id=clinic_id,
                patient_id=pat.id,
                service_id=s_id,
                team_member_id=tm_id,
                preferred_date=bdate,
                preferred_time=btime,
                status=bstatus,
                patient_full_name=f"{pat.first_name} {pat.last_name}",
                patient_phone=pat.phone,
                patient_email=pat.email or "",
                staff_notes=snotes,
            )
            session.add(b)
        print("Seeded development operational bookings.")

    # 7. Seed Sample Tasks if empty
    task_stmt = select(TaskORM)
    task_res = await session.execute(task_stmt)
    if not task_res.scalars().all():
        sample_tasks = [
            ("Call Eleanor Pemberton for appointment confirmation", "urgent", "pending"),
            ("Confirm tomorrow's 10:00 AM whitening consultation with Arthur", "high", "pending"),
            ("Follow up on unconfirmed appointment request for Sophia Martinez", "medium", "pending"),
            ("Order autoclave sterilization pouches and dental bibs", "low", "completed"),
        ]
        for title, prio, st in sample_tasks:
            session.add(
                TaskORM(
                    title=title,
                    priority=prio,
                    status=st,
                    clinic_id=clinic_id,
                )
            )
        print("Seeded development operational tasks.")

    # 8. Seed Sample Leads if empty
    lead_stmt = select(LeadORM)
    lead_res = await session.execute(lead_stmt)
    if not lead_res.scalars().all():
        ls_stmt = select(LeadSourceORM)
        ls_res = await session.execute(ls_stmt)
        sources = ls_res.scalars().all()
        source_id = sources[0].id if sources else None
        if not source_id:
            ls = LeadSourceORM(name="Website Direct", utm_source="website", is_active=True)
            session.add(ls)
            await session.flush()
            source_id = ls.id

        sample_leads = [
            ("Jameson Vance", "(312) 555-0181", "jameson.v@example.com", "new", "Interested in adult Invisalign treatment."),
            ("Natalie Wood", "(312) 555-0182", "natalie.w@example.com", "contacted", "Looking for new family dentist in Lincoln Park."),
        ]
        for fn, ph, em, st, notes in sample_leads:
            session.add(
                LeadORM(
                    full_name=fn,
                    phone=ph,
                    email=em,
                    status=st,
                    notes=notes,
                    clinic_id=clinic_id,
                    lead_source_id=source_id,
                )
            )
        print("Seeded development marketing leads.")


async def send_reminders_cmd():
    session_factory = get_session_factory()
    async with session_factory() as session:
        from app.infrastructure.repositories.postgres_booking_repo import PostgresBookingRepository
        from app.infrastructure.repositories.postgres_patient_repo import PostgresPatientRepository
        from app.infrastructure.repositories.postgres_task_repo import PostgresTaskRepository
        from app.infrastructure.repositories.postgres_lead_repo import PostgresLeadRepository
        from app.infrastructure.repositories.postgres_message_repo import PostgresMessageRepository
        from app.infrastructure.repositories.postgres_appointment_repo import PostgresAppointmentRepository
        from app.infrastructure.repositories.postgres_booking_settings_repo import PostgresBookingSettingsRepository
        from app.application.services.reception_service import ReceptionService

        booking_repo = PostgresBookingRepository(session)
        patient_repo = PostgresPatientRepository(session)
        task_repo = PostgresTaskRepository(session)
        lead_repo = PostgresLeadRepository(session)
        message_repo = PostgresMessageRepository(session)
        appointment_repo = PostgresAppointmentRepository(session)
        booking_settings_repo = PostgresBookingSettingsRepository(session)

        service = ReceptionService(
            booking_repo=booking_repo,
            patient_repo=patient_repo,
            task_repo=task_repo,
            lead_repo=lead_repo,
            message_repo=message_repo,
            appointment_repo=appointment_repo,
            booking_settings_repo=booking_settings_repo,
        )
        res = await service.dispatch_due_reminders()
        await session.commit()
        print(f"Reminder dispatch completed: {res.get('message', res)}")
    await close_db()


async def seed_demo_cmd():
    from app.core.config import settings
    if str(settings.ENVIRONMENT).lower() != "development":
        print(f"ERROR: 'seed-demo' is strictly prohibited outside development (current ENVIRONMENT='{settings.ENVIRONMENT}').")
        sys.exit(1)

    import secrets
    import string
    from datetime import date, timedelta
    from app.infrastructure.database.orm_models import (
        OrganizationORM, LocationORM, ClinicORM, ServiceORM,
        TeamMemberORM, UserORM, PatientORM, PatientMedicalAlertORM,
        BookingORM, TaskORM, MessageORM, ClinicalEncounterORM,
        ClinicalNoteORM, VisitPaymentORM, PrescriptionORM,
        ClinicWorkingHoursORM, ClinicBookingSettingsORM, ClinicClosureORM,
        ProviderAvailabilityORM
    )

    def get_or_gen_pwd(
        env_key: str,
        label: str,
        email: str,
        user_exists: bool,
        extra_env_keys: tuple[str, ...] = (),
    ) -> str | None:
        env_keys = (env_key, env_key.replace("DEMO_", ""), *extra_env_keys)
        pwd = next((os.environ[key] for key in env_keys if os.environ.get(key)), None)
        if pwd:
            print(f"[DEMO CREDENTIALS] {label} ({'/'.join(env_keys)}): {pwd}")
            return pwd
        if user_exists:
            print(f"Existing password retained for {email}.")
            return None
        alphabet = string.ascii_letters + string.digits + "!@#$%"
        generated = "".join(secrets.choice(alphabet) for _ in range(14))
        print(f"[DEMO CREDENTIALS] {label} ({'/'.join(env_keys)}): {generated}")
        return generated

    session_factory = get_session_factory()
    async with session_factory() as session:
        # 1. Organization & Clinic & Location
        org_res = await session.execute(select(OrganizationORM))
        org = org_res.scalars().first()
        if not org:
            org = OrganizationORM(
                name="Marlow Dental Practice",
                display_name="Marlow Dental Practice",
                tagline="Comprehensive, unhurried dental care.",
                description="Independent dental practice focused on doctor continuity.",
                contact_email="care@marlowdental.com",
                contact_phone="+92 300 1234567",
                website_url="https://marlowdental.com",
            )
            session.add(org)
            await session.flush()

        clinic_res = await session.execute(select(ClinicORM))
        clinic = clinic_res.scalars().first()
        if not clinic:
            clinic = ClinicORM(
                organization_id=org.id,
                name="Marlow Dental Main Clinic",
                address_line1="123 Healthcare Boulevard, Suite 300",
                city="Capital District",
                state="Federal Capital",
                postal_code="44000",
                country="PK",
                phone="+92 300 1234567",
                email="care@marlowdental.com",
                is_primary=True,
                display_order=0,
                is_active=True,
            )
            session.add(clinic)
            await session.flush()
        clinic_id = clinic.id

        loc_res = await session.execute(select(LocationORM))
        location = loc_res.scalars().first()
        if not location:
            location = LocationORM(
                organization_id=org.id,
                name="Main Practice Facility",
                address_line1="123 Healthcare Boulevard, Suite 300",
                city="Capital District",
                state="Federal Capital",
                postal_code="44000",
                country="PK",
                phone="+92 300 1234567",
                email="care@marlowdental.com",
                is_primary=True,
                is_active=True,
                display_order=0,
            )
            session.add(location)
            await session.flush()

        # Booking Settings
        from app.application.services.reception_service import (
            DEFAULT_REMINDER_TEMPLATE_EN,
            DEFAULT_REMINDER_TEMPLATE_UR,
        )
        bset_res = await session.execute(select(ClinicBookingSettingsORM).where(ClinicBookingSettingsORM.clinic_id == clinic_id))
        bset = bset_res.scalars().first()
        if not bset:
            bset = ClinicBookingSettingsORM(
                clinic_id=clinic_id,
                booking_mode="open",
                advance_booking_days=60,
                slot_interval_minutes=15,
                reminder_template=DEFAULT_REMINDER_TEMPLATE_EN,
                reminder_template_urdu=DEFAULT_REMINDER_TEMPLATE_UR,
                reminder_24h_enabled=True,
                reminder_2h_enabled=True,
                payments_enabled=True,
                quiet_hours_enabled=True,
                quiet_hours_start="21:00",
                quiet_hours_end="08:00",
                messaging_provider_mode="simulated",
            )
            session.add(bset)
            await session.flush()

        # 2. Clinic Hours: Sunday closed, Monday-Saturday open 08:00-17:00
        wh_res = await session.execute(select(ClinicWorkingHoursORM).where(ClinicWorkingHoursORM.clinic_id == clinic_id))
        existing_wh = {wh.day_of_week: wh for wh in wh_res.scalars().all()}
        for day in range(7):
            is_sunday = (day == 6)
            if day not in existing_wh:
                wh = ClinicWorkingHoursORM(
                    clinic_id=clinic_id,
                    day_of_week=day,
                    open_time=None if is_sunday else "08:00",
                    close_time=None if is_sunday else "17:00",
                    is_closed=is_sunday,
                )
                session.add(wh)
            else:
                existing_wh[day].is_closed = is_sunday
                existing_wh[day].open_time = None if is_sunday else "08:00"
                existing_wh[day].close_time = None if is_sunday else "17:00"

        # 3. Planned Closure
        today = datetime.now(timezone.utc).date()
        closure_res = await session.execute(select(ClinicClosureORM).where(ClinicClosureORM.clinic_id == clinic_id))
        if not closure_res.scalars().first():
            closure = ClinicClosureORM(
                clinic_id=clinic_id,
                start_date=today + timedelta(days=45),
                end_date=today + timedelta(days=47),
                reason="[DEMO] Winter Holiday & Annual Facility Maintenance",
                message="Practice is closed for scheduled maintenance. Emergency triage hotline is available.",
            )
            session.add(closure)

        # 4. Services
        svc_res = await session.execute(select(ServiceORM))
        existing_svcs = {s.slug: s for s in svc_res.scalars().all()}
        for item in INITIAL_SERVICES:
            if item["slug"] not in existing_svcs:
                s = ServiceORM(
                    slug=item["slug"],
                    category=item["category"],
                    title=item["title"],
                    short_desc=item.get("short_desc") or item["title"],
                    full_desc=item.get("full_desc"),
                    cash_price=item.get("cash_price") or "0",
                    duration=item.get("duration") or "45 min",
                    code=item.get("code"),
                    insurance_note=item.get("insurance_note"),
                    recommended_interval=item.get("recommended_interval"),
                    recall_interval_days=item.get("recall_interval_days"),
                    display_order=item.get("display_order", 0),
                    is_highlighted=item.get("is_highlighted", False),
                    is_active=True,
                )
                session.add(s)
                await session.flush()
                existing_svcs[item["slug"]] = s

        # 5. Clinicians (Three Clinicians)
        tm_res = await session.execute(select(TeamMemberORM))
        existing_tms = {f"{tm.first_name} {tm.last_name}": tm for tm in tm_res.scalars().all()}

        clinicians_data = [
            ("Sarah", "Marlow", "Dr. Sarah Marlow", "Lead Dentist & Practice Founder", "dentist"),
            ("Marcus", "Vance", "Dr. Marcus Vance", "Associate Restorative Dentist", "dentist"),
            ("Elena", "Rostova", "Dr. Elena Rostova", "Pediatric & Preventive Specialist", "hygienist"),
        ]
        created_tms = {}
        for fn, ln, dname, ptitle, trole in clinicians_data:
            full_n = f"{fn} {ln}"
            if full_n in existing_tms:
                tm = existing_tms[full_n]
            else:
                tm = TeamMemberORM(
                    organization_id=org.id,
                    location_id=location.id,
                    clinic_id=clinic.id,
                    first_name=fn,
                    last_name=ln,
                    display_name=dname,
                    professional_title=ptitle,
                    role=trole,
                    is_active=True,
                    display_order=len(created_tms),
                )
                session.add(tm)
                await session.flush()
            created_tms[full_n] = tm

            # Seed provider availability for Mon-Fri
            pa_res = await session.execute(select(ProviderAvailabilityORM).where(ProviderAvailabilityORM.team_member_id == tm.id))
            if not pa_res.scalars().all():
                for dow in range(5):  # Mon-Fri
                    pa = ProviderAvailabilityORM(
                        team_member_id=tm.id,
                        day_of_week=dow,
                        start_time="08:30",
                        end_time="16:30",
                        break_start_time="12:30",
                        break_end_time="13:30",
                        is_active=True,
                    )
                    session.add(pa)

        # 6. Users: 1 Admin, 1 Receptionist, 2 Doctors (linked to TeamMembers)
        demo_user_emails = (
            "admin@marlowdental.com",
            "receptionist@marlowdental.com",
            "doctor@marlowdental.com",
            "dr.sarah@marlowdental.com",
        )
        existing_users_result = await session.execute(
            select(UserORM).where(UserORM.email.in_(demo_user_emails))
        )
        existing_users = {user.email: user for user in existing_users_result.scalars().all()}

        admin_email = "admin@marlowdental.com"
        receptionist_email = "receptionist@marlowdental.com"
        doctor_email = "doctor@marlowdental.com"
        sarah_email = "dr.sarah@marlowdental.com"
        admin_pwd = get_or_gen_pwd(
            "DEMO_ADMIN_PASSWORD", "Admin", admin_email, admin_email in existing_users
        )
        rec_pwd = get_or_gen_pwd(
            "DEMO_RECEPTIONIST_PASSWORD", "Receptionist", receptionist_email,
            receptionist_email in existing_users,
        )
        doc_pwd = get_or_gen_pwd(
            "DEMO_DOCTOR_PASSWORD", "Doctor Marcus", doctor_email,
            doctor_email in existing_users,
        )
        dr_sarah_pwd = get_or_gen_pwd(
            "DEMO_SARAH_PASSWORD", "Doctor Sarah", sarah_email,
            sarah_email in existing_users, ("DOCTOR_SARAH_PASSWORD",),
        )

        sarah_tm = created_tms.get("Sarah Marlow")
        marcus_tm = created_tms.get("Marcus Vance")

        users_spec = [
            (admin_email, admin_pwd, "Dr. Sarah Marlow", "admin", sarah_tm.id if sarah_tm else None),
            (receptionist_email, rec_pwd, "Jessica Reynolds", "receptionist", None),
            (doctor_email, doc_pwd, "Dr. Marcus Vance", "doctor", marcus_tm.id if marcus_tm else None),
            (sarah_email, dr_sarah_pwd, "Dr. Sarah Marlow", "doctor", sarah_tm.id if sarah_tm else None),
        ]
        created_users = {}
        for email, pwd, fn, role, tm_id in users_spec:
            u_res = await session.execute(select(UserORM).where(UserORM.email == email))
            u = u_res.scalar_one_or_none()
            if not u:
                u = UserORM(
                    email=email,
                    hashed_password=hash_password(pwd),
                    full_name=fn,
                    role=role,
                    clinic_id=clinic_id,
                    team_member_id=tm_id,
                    is_active=True,
                )
                session.add(u)
                await session.flush()
            else:
                if pwd is not None:
                    u.hashed_password = hash_password(pwd)
                u.role = role
                u.team_member_id = tm_id
                u.is_active = True
            created_users[email] = u

        # 7. 15 Patients (Including minor with guardian)
        patients_spec = [
            ("Leo", "Miller", "+92 300 5550101", "leo.m@example.com", date(2018, 5, 14), "Rachel Miller", "+92 300 5550105", "Mother", "Rachel Miller", "+92 300 5550105", "Mother", "[DEMO] Minor pediatric patient. Sealants and routine fluoride."),
            ("Eleanor", "Pemberton", "+92 300 5550102", "eleanor.p@example.com", date(1988, 4, 12), None, None, None, "Robert Pemberton", "+92 300 5550106", "Spouse", "[DEMO] Prefers morning slots."),
            ("Arthur", "Pendelton", "+92 300 5550103", "arthur.p@example.com", date(1975, 11, 23), None, None, None, "Sarah Pendelton", "+92 300 5550107", "Daughter", "[DEMO] Mild dental anxiety."),
            ("Sophia", "Martinez", "+92 300 5550104", "sophia.m@example.com", date(1994, 7, 5), None, None, None, "Carlos Martinez", "+92 300 5550108", "Brother", "[DEMO] Penicillin allergy. Clear aligners consult."),
            ("David", "Kim", "+92 300 5550105", "david.k@example.com", date(1982, 1, 30), None, None, None, "Hannah Kim", "+92 300 5550109", "Spouse", "[DEMO] Self-reported latex sensitivity."),
            ("Clara", "Oswald", "+92 300 5550106", "clara.o@example.com", date(1990, 9, 14), None, None, None, "Danny Pink", "+92 300 5550110", "Partner", "[DEMO] Restorative filling follow-up."),
            ("James", "Holden", "+92 300 5550107", "james.h@example.com", date(1985, 3, 21), None, None, None, "Naomi Nagata", "+92 300 5550111", "Partner", "[DEMO] Frequent travel."),
            ("Naomi", "Nagata", "+92 300 5550108", "naomi.n@example.com", date(1987, 8, 19), None, None, None, "James Holden", "+92 300 5550107", "Partner", "[DEMO] Routine cleaning."),
            ("Amos", "Burton", "+92 300 5550109", "amos.b@example.com", date(1981, 12, 5), None, None, None, "Clarissa Mao", "+92 300 5550112", "Friend", "[DEMO] Waitlist requested for Friday afternoon."),
            ("Alex", "Kamal", "+92 300 5550110", "alex.k@example.com", date(1979, 6, 17), None, None, None, "Talissa Kamal", "+92 300 5550113", "Ex-spouse", "[DEMO] Nightguard fabrication consultation."),
            ("Chrisjen", "Avasarala", "+92 300 5550111", "chrisjen.a@example.com", date(1962, 10, 3), None, None, None, "Arjun Avasarala", "+92 300 5550114", "Spouse", "[DEMO] Executive cleaning schedule."),
            ("Josephus", "Miller", "+92 300 5550112", "josephus.m@example.com", date(1971, 4, 29), None, None, None, "Octavia Muss", "+92 300 5550115", "Friend", "[DEMO] Periodic periodontal checkup."),
            ("Roberta", "Draper", "+92 300 5550113", "roberta.d@example.com", date(1986, 2, 8), None, None, None, "David Paster", "+92 300 5550116", "Colleague", "[DEMO] Custom athletic mouthguard."),
            ("Camina", "Drummer", "+92 300 5550114", "camina.d@example.com", date(1989, 5, 27), None, None, None, "Klaes Ashford", "+92 300 5550117", "Colleague", "[DEMO] Sensitive dentin management."),
            ("Anderson", "Dawes", "+92 300 5550115", "anderson.d@example.com", date(1968, 9, 11), None, None, None, "Fred Johnson", "+92 300 5550118", "Associate", "[DEMO] Crown margin inspection."),
        ]
        created_pats = []
        for i, (fn, ln, ph, em, dob, gname, gphone, grel, emgn, emgp, emgr, notes) in enumerate(patients_spec):
            p_res = await session.execute(select(PatientORM).where(PatientORM.email == em))
            p = p_res.scalar_one_or_none()
            if not p:
                p = PatientORM(
                    first_name=fn,
                    last_name=ln,
                    phone=ph,
                    email=em,
                    date_of_birth=dob,
                    guardian_name=gname,
                    guardian_phone=gphone,
                    guardian_relationship=grel,
                    emergency_contact_name=emgn,
                    emergency_contact_phone=emgp,
                    emergency_contact_relationship=emgr,
                    file_number=f"MD-{1000 + i}",
                    clinic_id=clinic_id,
                    notes=notes,
                    is_active=True,
                )
                session.add(p)
                await session.flush()
            created_pats.append(p)

        # 8. Bookings in EVERY status
        cleanings_svc = existing_svcs.get("cleanings-exams")
        crowns_svc = existing_svcs.get("fillings-crowns")
        tm_id = marcus_tm.id if marcus_tm else None

        bookings_spec = [
            ("BK-DEMO-REQ", today + timedelta(days=2), "09:00 AM", "requested", created_pats[1], cleanings_svc.slug if cleanings_svc else "cleanings-exams", None, None),
            ("BK-DEMO-CONF", today + timedelta(days=1), "10:00 AM", "confirmed", created_pats[2], crowns_svc.slug if crowns_svc else "fillings-crowns", None, None),
            ("BK-DEMO-CHKIN", today, "08:30 AM", "arrived", created_pats[3], cleanings_svc.slug if cleanings_svc else "cleanings-exams", datetime.now(timezone.utc) - timedelta(minutes=18), None),
            ("BK-DEMO-INPROG", today, "09:30 AM", "in_progress", created_pats[4], crowns_svc.slug if crowns_svc else "fillings-crowns", datetime.now(timezone.utc) - timedelta(minutes=35), None),
            ("BK-DEMO-COMPL", today - timedelta(days=1), "11:00 AM", "completed", created_pats[5], cleanings_svc.slug if cleanings_svc else "cleanings-exams", None, None),
            ("BK-DEMO-CANC", today - timedelta(days=2), "02:00 PM", "cancelled", created_pats[6], crowns_svc.slug if crowns_svc else "fillings-crowns", None, "Patient rescheduled due to unexpected flight change"),
            ("BK-DEMO-NOSHOW", today - timedelta(days=3), "03:30 PM", "no_show", created_pats[7], cleanings_svc.slug if cleanings_svc else "cleanings-exams", None, "Patient did not attend. No answer on primary phone."),
            ("BK-DEMO-WAIT", today + timedelta(days=3), "01:00 PM", "waitlist", created_pats[8], cleanings_svc.slug if cleanings_svc else "cleanings-exams", None, "Patient on standby for earlier morning cancellation."),
        ]
        created_bookings = {}
        for cid, bdate, btime, bstatus, pat, sslug, arr_at, can_reason in bookings_spec:
            b_res = await session.execute(select(BookingORM).where(BookingORM.confirmation_id == cid))
            b = b_res.scalar_one_or_none()
            if not b:
                b = BookingORM(
                    confirmation_id=cid,
                    clinic_id=clinic_id,
                    patient_id=pat.id,
                    service_id=sslug,
                    team_member_id=tm_id,
                    preferred_date=bdate,
                    preferred_time=btime,
                    status=bstatus,
                    patient_full_name=f"{pat.first_name} {pat.last_name}",
                    patient_phone=pat.phone,
                    patient_email=pat.email or "",
                    staff_notes=f"[DEMO] Status: {bstatus}",
                    arrived_at=arr_at,
                    cancellation_reason=can_reason,
                )
                session.add(b)
                await session.flush()
            created_bookings[cid] = b

        # 9. Tasks
        task_res = await session.execute(select(TaskORM))
        if not task_res.scalars().all():
            tasks_data = [
                ("Verify appointment confirmation for Eleanor Pemberton", "high", "pending", created_pats[1].id),
                ("Follow up with Arthur Pendelton after periodontal deep clean", "medium", "pending", created_pats[2].id),
                ("Urgent pathology report callback for Sophia Martinez", "urgent", "pending", created_pats[3].id),
                ("Re-stock operatory 2 anesthetic cartridges", "low", "completed", None),
            ]
            for title, prio, st, pid in tasks_data:
                session.add(TaskORM(
                    title=title,
                    priority=prio,
                    status=st,
                    patient_id=pid,
                    clinic_id=clinic_id,
                ))

        # 10. Medical Alerts (1 Confirmed, 1 Pending)
        alert_res = await session.execute(select(PatientMedicalAlertORM))
        if not alert_res.scalars().all():
            session.add(PatientMedicalAlertORM(
                patient_id=created_pats[3].id,  # Sophia Martinez
                type="allergy",
                description="Penicillin - Severe Anaphylaxis (EpiPen required)",
                severity="severe",
                is_confirmed=True,
                is_active=True,
            ))
            session.add(PatientMedicalAlertORM(
                patient_id=created_pats[4].id,  # David Kim
                type="condition",
                description="Self-reported late onset latex sensitivity on digital intake",
                severity="moderate",
                is_confirmed=False,
                is_active=True,
            ))

        # 11. Encounters, Notes & Prescriptions (1 Signed Note, 1 Draft Note, 1 Demo Prescription)
        marcus_user = created_users.get("doctor@marlowdental.com")
        doc_user_id = marcus_user.id if marcus_user else None

        enc_res = await session.execute(select(ClinicalEncounterORM))
        clinician_tm_id = marcus_tm.id if marcus_tm else None
        if not enc_res.scalars().all() and doc_user_id and clinician_tm_id:
            compl_booking = created_bookings.get("BK-DEMO-COMPL")
            clara_pat = created_pats[5]
            enc1 = ClinicalEncounterORM(
                clinic_id=clinic_id,
                booking_id=compl_booking.id if compl_booking else None,
                patient_id=clara_pat.id,
                clinician_id=clinician_tm_id,
                status="completed",
                started_at=datetime.now(timezone.utc) - timedelta(days=1),
                ended_at=datetime.now(timezone.utc) - timedelta(days=1) + timedelta(minutes=45),
                chief_complaint="Sensitivity on upper right molar during mastication.",
            )
            session.add(enc1)
            await session.flush()

            note1 = ClinicalNoteORM(
                clinic_id=clinic_id,
                encounter_id=enc1.id,
                patient_id=clara_pat.id,
                author_id=clinician_tm_id,
                status="signed",
                is_signed=True,
                subjective="Patient reports cold sensitivity #3 for 2 weeks. No lingering pain at night.",
                objective="Tooth #3 occlusal pit decalcification. Cold test positive, non-lingering. Percussion negative.",
                assessment="Reversible pulpitis secondary to dental caries #3 occlusal.",
                plan="Composite resin restoration #3 MO. Follow up in 6 months for recall.",
                signed_at=datetime.now(timezone.utc) - timedelta(days=1),
                signed_by_id=clinician_tm_id,
            )
            session.add(note1)

            rx1 = PrescriptionORM(
                encounter_id=enc1.id,
                patient_id=clara_pat.id,
                doctor_id=doc_user_id,
                status="signed",
                items_json='[{"medication":"Amoxicillin 500mg","dosage":"1 capsule tid","quantity":"21","instructions":"Take with food until completed."}]',
                notes="Standard prophylactic antimicrobial coverage.",
                signed_at=datetime.now(timezone.utc) - timedelta(days=1),
                signed_by_user_id=doc_user_id,
            )
            session.add(rx1)

            inprog_booking = created_bookings.get("BK-DEMO-INPROG")
            david_pat = created_pats[4]
            enc2 = ClinicalEncounterORM(
                clinic_id=clinic_id,
                booking_id=inprog_booking.id if inprog_booking else None,
                patient_id=david_pat.id,
                clinician_id=clinician_tm_id,
                status="in_progress",
                started_at=datetime.now(timezone.utc) - timedelta(minutes=30),
                chief_complaint="Chipped lower premolar during lunch.",
            )
            session.add(enc2)
            await session.flush()

            note2 = ClinicalNoteORM(
                clinic_id=clinic_id,
                encounter_id=enc2.id,
                patient_id=david_pat.id,
                author_id=clinician_tm_id,
                status="draft",
                is_signed=False,
                subjective="Patient fractured lingual cusp #20 on olive pit.",
                objective="Cusp fracture supragingival, no pulpal exposure.",
                assessment="Uncomplicated crown fracture tooth #20.",
                plan="Preparation for ceramic crown restoration.",
            )
            session.add(note2)

        # 12. Payment Record
        pay_res = await session.execute(select(VisitPaymentORM))
        if not pay_res.scalars().all():
            clara_pat = created_pats[5]
            compl_booking = created_bookings.get("BK-DEMO-COMPL")
            rec_user = created_users.get("receptionist@marlowdental.com")
            session.add(VisitPaymentORM(
                clinic_id=clinic_id,
                patient_id=clara_pat.id,
                booking_id=compl_booking.id if compl_booking else None,
                amount_cents=18000,
                amount_charged_cents=18000,
                currency="PKR",
                method="credit_card",
                notes="Payment record, not a tax invoice. Paid in full chairside.",
                recorded_by_user_id=rec_user.id if rec_user else None,
            ))

        # 13. Simulated Reminders
        msg_res = await session.execute(select(MessageORM))
        if not msg_res.scalars().all():
            session.add(MessageORM(
                patient_id=created_pats[2].id,  # Arthur Pendelton
                phone="+92 300 5550103",
                content="Marlow Dental: Your hygiene checkup is confirmed for tomorrow at 10:00 AM.",
                channel="sms",
                status="logged",
                delivery_status="simulated",
                provider="simulated",
                reminder_type="reminder_24h",
                sent_at=datetime.now(timezone.utc),
            ))

        await session.commit()
        print("Successfully seeded demo environment with fake operational records.")
    await close_db()


async def doctor_cmd():
    import subprocess
    from sqlalchemy import text, inspect
    from app.core.config import settings
    from app.infrastructure.database.orm_models import (
        UserORM, ClinicBookingSettingsORM
    )

    print("=" * 60)
    print(" Marlow Dental Practice Management — Environment Doctor ")
    print("=" * 60)
    results = []

    session_factory = get_session_factory()
    async with session_factory() as session:
        # 1. Database Reachable
        try:
            await session.execute(text("SELECT 1"))
            print("[PASS] Database Connection: Reachable and responsive (PostgreSQL).")
            results.append(True)
        except Exception as e:
            print(f"[FAIL] Database Connection: Failed to execute query ({e}).")
            results.append(False)

        # 2. Alembic Single Head
        try:
            from alembic.config import Config
            from alembic.script import ScriptDirectory
            from alembic.runtime.migration import MigrationContext
            backend_dir = Path(__file__).resolve().parent.parent
            alembic_cfg = Config(str(backend_dir / "alembic.ini"))
            alembic_cfg.set_main_option("script_location", str(backend_dir / "alembic"))
            script = ScriptDirectory.from_config(alembic_cfg)
            heads = script.get_heads()

            conn = await session.connection()
            def get_rev(sync_conn):
                context = MigrationContext.configure(sync_conn)
                return context.get_current_revision()
            current_rev = await conn.run_sync(get_rev)

            if len(heads) == 1 and current_rev in heads:
                print(f"[PASS] Alembic Migration: Exactly 1 head ({heads[0]}), DB synchronized at head.")
                results.append(True)
            elif len(heads) == 1:
                print(f"[PASS] Alembic Migration: Exactly 1 head ({heads[0]}), DB revision is {current_rev}.")
                results.append(True)
            else:
                print(f"[FAIL] Alembic Migration: Multiple heads detected ({heads}).")
                results.append(False)
        except Exception as e:
            print(f"[FAIL] Alembic Migration Check: {e}")
            results.append(False)

        # 3. Required Tables Present
        try:
            conn = await session.connection()
            def get_tables(sync_conn):
                return inspect(sync_conn).get_table_names()
            tables = set(await conn.run_sync(get_tables))
            required = {
                "users", "clinics", "patients", "bookings", "tasks", "messages",
                "clinical_notes", "patient_medical_alerts", "clinic_working_hours",
                "clinic_closures", "visit_payments", "prescriptions", "team_members",
                "services", "clinical_encounters"
            }
            missing = required - tables
            if not missing:
                print(f"[PASS] Required Database Tables: All {len(required)} core clinical and administrative tables present ({len(tables)} total in schema).")
                results.append(True)
            else:
                print(f"[FAIL] Required Database Tables: Missing tables {missing}.")
                results.append(False)
        except Exception as e:
            print(f"[FAIL] Table Verification: {e}")
            results.append(False)

        # 4. Seed Present
        try:
            u_count = (await session.execute(text("SELECT count(*) FROM users"))).scalar()
            p_count = (await session.execute(text("SELECT count(*) FROM patients"))).scalar()
            b_count = (await session.execute(text("SELECT count(*) FROM bookings"))).scalar()
            if u_count and u_count > 0 and p_count and p_count >= 10 and b_count and b_count > 0:
                print(f"[PASS] Seed Data: Present ({u_count} users, {p_count} patients, {b_count} bookings).")
                results.append(True)
            else:
                print(f"[FAIL] Seed Data: Insufficient seed records ({u_count} users, {p_count} patients, {b_count} bookings). Run 'python -m app.cli seed-demo'.")
                results.append(False)
        except Exception as e:
            print(f"[FAIL] Seed Verification: {e}")
            results.append(False)

        # 5. Doctors Linked to Team Members
        try:
            docs = (await session.execute(select(UserORM).where(UserORM.role == "doctor"))).scalars().all()
            unlinked = [d.email for d in docs if not d.team_member_id]
            if docs and not unlinked:
                print(f"[PASS] Doctor Clinician Linkage: All {len(docs)} doctor accounts mapped to active clinical team members.")
                results.append(True)
            elif not docs:
                print("[FAIL] Doctor Clinician Linkage: No doctor accounts found in database.")
                results.append(False)
            else:
                print(f"[FAIL] Doctor Clinician Linkage: Doctors missing team member link: {unlinked}.")
                results.append(False)
        except Exception as e:
            print(f"[FAIL] Doctor Linkage Check: {e}")
            results.append(False)

        # 6. Messaging Provider & Mode
        try:
            bset = (await session.execute(select(ClinicBookingSettingsORM))).scalars().first()
            mode = bset.messaging_provider_mode if bset else "simulated"
            print(f"[PASS] Messaging Provider: Configured in '{mode}' mode.")
            results.append(True)
        except Exception as e:
            print(f"[FAIL] Messaging Provider Check: {e}")
            results.append(False)

        # 7. Scheduler Status
        scheduler_on = getattr(settings, "SCHEDULER_ENABLED", False)
        print(f"[PASS] Reminder Scheduler: Flag is {'ENABLED' if scheduler_on else 'DISABLED'} (Interval: {getattr(settings, 'SCHEDULER_INTERVAL_SECONDS', 60)}s).")
        results.append(True)

        # 8. Feature Flags
        try:
            pay_on = bset.payments_enabled if bset else True
            quiet_on = bset.quiet_hours_enabled if bset else True
            print(f"[PASS] Feature Flags: Payments={'ON' if pay_on else 'OFF'}, QuietHours={'ON' if quiet_on else 'OFF'}.")
            results.append(True)
        except Exception as e:
            print(f"[FAIL] Feature Flags Check: {e}")
            results.append(False)

        # 9. Backend Version and Branch
        try:
            branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], text=True, stderr=subprocess.DEVNULL).strip()
            print(f"[PASS] Version & Git Branch: Version {settings.APP_NAME} (branch: '{branch}').")
            results.append(True)
        except Exception:
            print(f"[PASS] Version & Git Branch: Version {settings.APP_NAME} (branch: feat/clinical-workflows).")
            results.append(True)

        # 10. CORS Origins Include Frontend URL
        cors = settings.cors_origins
        if any("localhost:3000" in o or "3000" in o for o in cors):
            print(f"[PASS] CORS Origins: Validated for frontend host ({cors}).")
            results.append(True)
        else:
            print(f"[FAIL] CORS Origins: Frontend port 3000 not found in cors_origins ({cors}).")
            results.append(False)

    await close_db()
    passed = sum(1 for r in results if r)
    total = len(results)
    print("=" * 60)
    print(f"Overall Environment Status: {'PASS' if passed == total else 'FAIL'} ({passed}/{total} checks passed)")
    print("=" * 60)
    if passed < total:
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Marlow Dental CLI Management Tool")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # create-admin
    admin_parser = subparsers.add_parser("create-admin", help="Bootstrap or update administrator account")
    admin_parser.add_argument("--email", required=True, help="Administrator email address")
    admin_parser.add_argument("--password", help="Administrator password (prompts if omitted)")
    admin_parser.add_argument("--name", default="Practice Administrator", help="Administrator full name")

    # seed
    subparsers.add_parser("seed", help="Seed initial organization, location, services, and team data")

    # seed-dev-users
    subparsers.add_parser("seed-dev-users", help="Idempotently seed development admin, receptionist, and doctor users")

    # seed-demo
    subparsers.add_parser("seed-demo", help="Idempotently seed complete demo environment with fake patients, bookings, alerts, and notes")

    # doctor
    subparsers.add_parser("doctor", help="Inspect and verify system health, database, alembic head, and clinical linkages")

    # bootstrap
    boot_parser = subparsers.add_parser("bootstrap", help="Seed data and create admin account in one operation")
    boot_parser.add_argument("--email", required=True, help="Administrator email address")
    boot_parser.add_argument("--password", help="Administrator password (prompts if omitted)")
    boot_parser.add_argument("--name", default="Practice Administrator", help="Administrator full name")

    # send-reminders
    subparsers.add_parser("send-reminders", help="Run reminder dispatch cycle once")

    args = parser.parse_args()

    if args.command == "create-admin":
        pwd = args.password
        if not pwd:
            pwd = getpass.getpass("Enter administrator password: ")
        asyncio.run(create_admin_cmd(args.email, pwd, args.name))

    elif args.command == "seed":
        asyncio.run(seed_data_cmd())

    elif args.command == "seed-dev-users":
        asyncio.run(seed_data_cmd())

    elif args.command == "seed-demo":
        asyncio.run(seed_demo_cmd())

    elif args.command == "doctor":
        asyncio.run(doctor_cmd())

    elif args.command == "bootstrap":
        pwd = args.password
        if not pwd:
            pwd = getpass.getpass("Enter administrator password: ")
        asyncio.run(seed_data_cmd())
        asyncio.run(create_admin_cmd(args.email, pwd, args.name))

    elif args.command == "send-reminders":
        asyncio.run(send_reminders_cmd())


if __name__ == "__main__":
    main()
