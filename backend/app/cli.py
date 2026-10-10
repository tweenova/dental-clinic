import argparse
import asyncio
import getpass
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

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
from app.infrastructure.database.orm_models import RoleORM, PermissionORM, RolePermissionORM
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
        "cash_price": "from $140",
        "code": "CDT D0150 / D1110",
        "insurance_note": "Typically 100% covered by dental PPO plans twice per calendar year.",
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
        "cash_price": "from $210",
        "code": "CDT D2391 / D2740",
        "insurance_note": "Typically 50% to 80% covered by PPO plans with pre-treatment estimate.",
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
        "cash_price": "from $680",
        "code": "CDT D3330",
        "insurance_note": "Covered under major restorative benefits on most insurance policies.",
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
        "cash_price": "from $3,400",
        "code": "CDT D8090",
        "insurance_note": "Many PPO plans include $1,000 to $2,000 lifetime orthodontic coverage.",
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
        "cash_price": "from $280",
        "code": "CDT D9972",
        "insurance_note": "Elective cosmetic care. 6-month zero-interest financing available.",
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
        "cash_price": "from $95",
        "code": "CDT D0140 / D9110",
        "insurance_note": "Emergency diagnostics and palliative care covered by most plans.",
        "recommended_interval": "Call immediately upon symptoms",
        "display_order": 5,
        "is_highlighted": False,
    },
]

INITIAL_FAQS = [
    {
        "category": "pricing",
        "question": "Do you provide written estimates before treatment?",
        "answer": "Yes. Before beginning any procedure outside a routine cleaning, we provide a printed, itemized estimate showing both our cash fee and your estimated insurance copay.",
        "display_order": 0,
    },
    {
        "category": "insurance",
        "question": "Which PPO dental insurance plans do you accept?",
        "answer": "We accept and bill most major PPO dental plans, including Delta Dental, Cigna, MetLife, Guardian, and Aetna. We do not participate in HMO or Medicaid plans.",
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
                tagline="Comprehensive, unhurried dental care in Lincoln Park, Chicago.",
                description="Independent dental practice focused on doctor continuity and transparent cash fee schedules.",
                contact_email="care@marlowdental.com",
                contact_phone="(312) 555-0147",
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
                name="Lincoln Park Practice Facility",
                address_line1="214 Alder Street, Suite 3",
                city="Chicago",
                state="Illinois",
                postal_code="60614",
                country="US",
                phone="(312) 555-0147",
                email="care@marlowdental.com",
                hours_info="Monday – Thursday: 8:00 AM – 6:00 PM\nFriday: 8:00 AM – 2:00 PM (Emergency only)\nSaturday – Sunday: Closed",
                is_primary=True,
                display_order=0,
            )
            primary_loc = await loc_repo.save(primary_loc)
            print("Seeded Primary Location: Lincoln Park Practice Facility")

        if len(locations) < 2:
            west_loop_loc = Location(
                organization_id=org.id,
                name="West Loop Dental Studio",
                address_line1="930 West Fulton Market, Suite 400",
                city="Chicago",
                state="Illinois",
                postal_code="60607",
                country="US",
                phone="(312) 555-0188",
                email="westloop@marlowdental.com",
                hours_info="Monday – Friday: 9:00 AM – 7:00 PM\nSaturday: 9:00 AM – 3:00 PM\nSunday: Closed",
                is_primary=False,
                display_order=1,
            )
            await loc_repo.save(west_loop_loc)
            print("Seeded Location: West Loop Dental Studio")

            gold_coast_loc = Location(
                organization_id=org.id,
                name="Gold Coast Specialty Suite",
                address_line1="1120 North State Street, Suite 5B",
                city="Chicago",
                state="Illinois",
                postal_code="60610",
                country="US",
                phone="(312) 555-0199",
                email="goldcoast@marlowdental.com",
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
                license_state="Illinois",
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
                license_state="Illinois",
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
                license_state="Illinois",
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
                license_state="Illinois",
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
                "Now welcoming new patients across all Chicago dental facility locations",
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
            ("BK-2026-1002", today, "10:00 AM", "checked_in", patients[1], "fillings-crowns", "Patient arrived at 9:55 AM. Waiting in lounge."),
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
            ("Call Eleanor Pemberton for insurance card verification", "urgent", "pending"),
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

    # bootstrap
    boot_parser = subparsers.add_parser("bootstrap", help="Seed data and create admin account in one operation")
    boot_parser.add_argument("--email", required=True, help="Administrator email address")
    boot_parser.add_argument("--password", help="Administrator password (prompts if omitted)")
    boot_parser.add_argument("--name", default="Practice Administrator", help="Administrator full name")

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

    elif args.command == "bootstrap":
        pwd = args.password
        if not pwd:
            pwd = getpass.getpass("Enter administrator password: ")
        asyncio.run(seed_data_cmd())
        asyncio.run(create_admin_cmd(args.email, pwd, args.name))


if __name__ == "__main__":
    main()
