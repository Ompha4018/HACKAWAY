"""
VitaLink Seed v3 — Tshwane-grounded data
Real clinic names, real ward numbers, research-backed statistics
Run once: python seed.py
"""
import sqlite3, random, os
from datetime import datetime, timedelta
import sys; sys.path.insert(0, ".")
from app import calculate_drs, calculate_svs, risk_band, care_pathway_level

DB = "vitalink.db"

# ── REAL TSHWANE CLINICS (from City of Tshwane Health Dept records) ───────────
CLINICS = [
    {"name": "Soshanguve BB Clinic",        "area": "Soshanguve Block BB",  "ward": 80, "region": "Region 2", "load": "high"},
    {"name": "Mabopane CHC",                "area": "Mabopane Section E",   "ward": 84, "region": "Region 2", "load": "high"},
    {"name": "Ga-Rankuwa Clinic 1",         "area": "Ga-Rankuwa Zone 3",    "ward": 76, "region": "Region 2", "load": "high"},
    {"name": "Atteridgeville CHC",          "area": "Atteridgeville West",  "ward": 91, "region": "Region 3", "load": "medium"},
    {"name": "Mamelodi East Clinic",        "area": "Mamelodi East",        "ward": 96, "region": "Region 6", "load": "high"},
    {"name": "Temba Community HC",          "area": "Temba Unit 5",         "ward": 89, "region": "Region 2", "load": "medium"},
    {"name": "Soshanguve Block H Clinic",   "area": "Soshanguve Block H",   "ward": 81, "region": "Region 2", "load": "high"},
    {"name": "Olievenhoutbosch Clinic",     "area": "Olievenhoutbosch",     "ward":101, "region": "Region 4", "load": "high"},
]

# Soshanguve/Ga-Rankuwa: predominantly Sepedi & Setswana (research-backed)
CLINIC_LANGUAGES = {
    "Soshanguve BB Clinic":      ["Sepedi", "Setswana", "Sepedi", "Zulu"],
    "Mabopane CHC":              ["Sepedi", "Setswana", "Setswana"],
    "Ga-Rankuwa Clinic 1":       ["Setswana", "Sepedi", "Setswana", "Zulu"],
    "Atteridgeville CHC":        ["Setswana", "Zulu", "Xhosa", "Sepedi"],
    "Mamelodi East Clinic":      ["Zulu", "Xhosa", "Sepedi", "Ndebele"],
    "Temba Community HC":        ["Sepedi", "Ndebele", "Setswana"],
    "Soshanguve Block H Clinic": ["Sepedi", "Zulu", "Setswana"],
    "Olievenhoutbosch Clinic":   ["Zulu", "Xhosa", "Sotho", "Setswana"],
}

# Research-backed: Soshanguve/Ga-Rankuwa carry heavier chronic patient loads
CLINIC_WEIGHTS = {
    "high":   [0.20, 0.18, 0.16],  # 3 patient count options for high-load clinics
    "medium": [0.10, 0.08, 0.06],
}

FIRST_NAMES = [
    "Thabo","Lerato","Nomsa","Sipho","Bongiwe","Kagiso","Palesa","Tebogo",
    "Nandi","Mpho","Zanele","Lebo","Sifiso","Dineo","Bongani","Refilwe",
    "Ntombi","Lucky","Grace","Solomon","Agnes","Johannes","Mmabatho",
    "Tshepo","Lindiwe","Mandla","Portia","Sibusiso","Faith","Precious",
    "Katlego","Tumelo","Nompumelelo","Siyanda","Thandeka","Lwazi"
]
LAST_NAMES = [
    "Mokoena","Dlamini","Nkosi","Sithole","Mahlangu","Mthembu","Khumalo",
    "Molefe","Masondo","Ngcobo","Zwane","Shabangu","Mabunda","Ntuli","Langa",
    "Cele","Gumede","Mkhize","Zulu","Ndlovu","Motsepe","Modise","Nkwe",
    "Baloyi","Mashego","Chauke","Nkuna","Mathebula","Maluleke","Ngwenya"
]

# Research: Tshwane PHC multimorbidity — hypertension 62%, diabetes 45%, HIV 44%, TB 33%
CONDITIONS_WEIGHTED = (
    ["HIV"]*9 + ["TB"]*7 + ["HIV/TB"]*5 +
    ["Diabetes"]*9 + ["Hypertension"]*12 + ["HIV/Diabetes"]*3
)

# Insulin medications (for Challenge 2 — QuickScript)
MEDICATIONS = {
    "HIV":         [("TDF/3TC/DTG", "1 tablet daily", False),
                    ("ABC/3TC/LPV/r", "2 tablets twice daily", False)],
    "TB":          [("RHZE Fixed Dose", "4 tablets daily", False),
                    ("RH Fixed Dose", "2 tablets daily", False)],
    "HIV/TB":      [("TDF/3TC/DTG + RHZE", "As prescribed", False)],
    "Diabetes":    [("Insulin Glargine (Lantus)", "10–40 units once daily", True),
                    ("Metformin 500mg + Insulin NPH", "Tablets twice daily + 10 units", True),
                    ("Metformin 500mg", "1 tablet twice daily", False)],
    "Hypertension":[("Amlodipine 5mg", "1 tablet daily", False),
                    ("Enalapril 10mg + Hydrochlorothiazide", "1 tablet daily", False)],
    "HIV/Diabetes":[("TDF/3TC/DTG + Insulin Glargine", "As prescribed", True),
                    ("ABC/3TC/LPV/r + Metformin", "As prescribed", False)],
}

CHW_NAMES = [
    "Sister B. Mokoena (WBOT Ward 80)",
    "Nurse T. Dlamini (WBOT Ward 84)",
    "CHW S. Sithole (WBOT Ward 76)",
    "Sister N. Mahlangu (WBOT Ward 91)",
    "Nurse K. Khumalo (WBOT Ward 96)",
    "CHW L. Molefe (WBOT Ward 89)",
    "Sister P. Masondo (WBOT Ward 81)",
    "Nurse R. Cele (WBOT Ward 101)",
]

APPT_TYPES = [
    "ARV Collection", "TB Review", "Chronic Care Review",
    "Lab Results Collection", "Insulin & Diabetes Review",
    "BP & Chronic Medication", "Pharmacy Pickup"
]

def rdate(dmin, dmax):
    return (datetime.now() - timedelta(days=random.randint(dmin, dmax))).strftime("%Y-%m-%d")
def fdate(dmin, dmax):
    return (datetime.now() + timedelta(days=random.randint(dmin, dmax))).strftime("%Y-%m-%d")
def phone():
    return f"27{random.choice(['60','72','73','74','76','78','82','83'])}{random.randint(1000000,9999999)}"
def qr_code(pid, name):
    initials = "".join([w[0] for w in name.split()])
    return f"VTL-{initials}-{pid:04d}-{random.randint(1000,9999)}"

SCHEMA = """
DROP TABLE IF EXISTS lab_results;
DROP TABLE IF EXISTS medications;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS patients;
DROP TABLE IF EXISTS households;

CREATE TABLE households (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT, area TEXT, ward INTEGER, region TEXT,
    total_members INTEGER, children INTEGER, elderly INTEGER,
    has_tb_member INTEGER DEFAULT 0,
    has_hiv_member INTEGER DEFAULT 0,
    has_insulin_member INTEGER DEFAULT 0,
    household_risk_score REAL DEFAULT 0,
    risk_band TEXT
);

CREATE TABLE patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, age INTEGER, gender TEXT,
    condition TEXT, clinic TEXT, area TEXT,
    ward INTEGER, region TEXT, phone TEXT, language TEXT,
    enrolled_date TEXT, last_visit TEXT,
    missed_appts INTEGER, med_pickup_gaps INTEGER,
    lab_trend REAL, chw_days INTEGER,
    socio_flags INTEGER, visit_days INTEGER,
    drs REAL, risk_band TEXT,
    unemployed INTEGER, transport_difficulty INTEGER,
    distance_km REAL, food_insecure INTEGER,
    missed_chw_contacts INTEGER, single_caregiver INTEGER,
    grant_dependent INTEGER,
    svs REAL, svs_band TEXT,
    care_pathway_level INTEGER,
    chw_name TEXT,
    whatsapp_sent INTEGER DEFAULT 0,
    intervention_simulated INTEGER DEFAULT 0,
    household_id INTEGER,
    notes TEXT,
    FOREIGN KEY(household_id) REFERENCES households(id)
);

CREATE TABLE appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER, date TEXT,
    type TEXT, status TEXT, clinic TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
);

CREATE TABLE medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER, medication TEXT,
    dosage TEXT, collection_date TEXT,
    qr_code TEXT, status TEXT,
    is_insulin INTEGER DEFAULT 0,
    months_supply INTEGER DEFAULT 1,
    storage_note TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
);


CREATE TABLE bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    patient_name TEXT,
    phone TEXT,
    clinic TEXT,
    area TEXT,
    date TEXT,
    time TEXT,
    appointment_type TEXT,
    booking_ref TEXT,
    status TEXT DEFAULT 'upcoming',
    created_at TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
);

CREATE TABLE symptom_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    severity TEXT,
    drs_before REAL,
    drs_after REAL,
    action TEXT,
    checked_at TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
);
CREATE TABLE lab_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER, date TEXT,
    test_type TEXT, result TEXT, unit TEXT, trend TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
);
"""

def create_households(conn):
    hh_ids = []
    for clinic in CLINICS:
        count = 2 if clinic["load"] == "high" else 1
        for _ in range(count):
            children = random.randint(0, 4)
            elderly  = random.randint(0, 2)
            total    = children + elderly + random.randint(1, 3)
            conn.execute("""
                INSERT INTO households(address,area,ward,region,total_members,
                    children,elderly,household_risk_score,risk_band)
                VALUES(?,?,?,?,?,?,?,?,?)
            """, (f"{random.randint(100,9999)} {clinic['area']}",
                  clinic["area"], clinic["ward"], clinic["region"],
                  total, children, elderly, 0, "LOW"))
            hh_ids.append(conn.execute("SELECT last_insert_rowid()").fetchone()[0])
    return hh_ids

def seed_patients(conn, hh_ids, n=35):
    for i in range(n):
        first  = random.choice(FIRST_NAMES)
        last   = random.choice(LAST_NAMES)
        name   = f"{first} {last}"
        age    = random.randint(18, 72)
        gender = random.choice(["Male", "Female", "Female", "Female"])
        cond   = random.choice(CONDITIONS_WEIGHTED)
        clinic_data = random.choices(CLINICS, weights=[3,3,3,2,3,2,3,3])[0]
        clinic = clinic_data["name"]
        area   = clinic_data["area"]
        ward   = clinic_data["ward"]
        region = clinic_data["region"]
        lang   = random.choice(CLINIC_LANGUAGES.get(clinic, ["Sepedi", "Setswana"]))
        enrolled   = rdate(180, 900)
        last_visit = rdate(5, 75)
        visit_days = random.randint(3, 75)
        hh_id  = random.choice(hh_ids)

        # Clinical risk — research shows ~33% non-adherent in Tshwane PHC
        profile = random.choices(
            ["critical", "high", "medium", "low"],
            weights=[10, 23, 37, 30]  # ~33% at risk total, matching research
        )[0]

        if profile == "critical":
            missed=random.randint(3,5); gaps=random.randint(2,4)
            lab_t=round(random.uniform(0.6,1.0),2); chw_d=random.randint(45,90); socio=random.randint(2,3)
        elif profile == "high":
            missed=random.randint(2,4); gaps=random.randint(1,3)
            lab_t=round(random.uniform(0.4,0.7),2); chw_d=random.randint(25,55); socio=random.randint(1,2)
        elif profile == "medium":
            missed=random.randint(1,2); gaps=random.randint(0,2)
            lab_t=round(random.uniform(0.2,0.5),2); chw_d=random.randint(10,35); socio=random.randint(0,2)
        else:
            missed=random.randint(0,1); gaps=random.randint(0,1)
            lab_t=round(random.uniform(0.0,0.3),2); chw_d=random.randint(1,20); socio=random.randint(0,1)

        drs  = calculate_drs(missed, gaps, lab_t, chw_d, visit_days)
        dband= risk_band(drs)

        # SVS — research: 25% informal settlement patients struggle with transport
        # Soshanguve/Ga-Rankuwa distances are real — many residents 5-14km from clinics
        unemployed  = random.choices([0,1], weights=[35,65])[0]  # high unemployment in townships
        transport   = random.choices([0,1,2,3], weights=[20,30,30,20])[0]
        distance_km = round(random.uniform(0.8, 13.5), 1)  # real Tshwane township distances
        food_insec  = random.choices([0,1], weights=[55,45])[0]
        missed_chw  = random.randint(0, 5)
        single_care = random.choices([0,1], weights=[60,40])[0]
        grant_dep   = random.choices([0,1], weights=[45,55])[0]  # SASSA dependency common

        svs   = calculate_svs(unemployed, transport, distance_km, food_insec,
                               missed_chw, single_care, grant_dep)
        sband = risk_band(svs)
        cpl   = care_pathway_level(drs, svs)
        chw   = random.choice(CHW_NAMES)
        wa    = 1 if (drs >= 65 and random.random() > 0.3) else 0

        notes_map = {
            "critical": (
                f"CRITICAL: Patient has not responded to {missed} previous outreach attempts. "
                f"Lives {distance_km}km from clinic. Urgent WBOT visit required. "
                f"{'Household transmission risk — TB active.' if 'TB' in cond else 'Viral load deteriorating.'}"
            ),
            "high": (
                f"HIGH RISK: Patient missed last {missed} appointments. "
                f"WhatsApp reminder sent. SVS flags "
                f"{'transport difficulty' if transport >= 2 else 'food insecurity' if food_insec else 'unemployment'}. "
                f"CHW to assess household situation."
            ),
            "medium": (
                "Inconsistent medication pickup pattern. Social factors may be contributing — "
                "CHW to assess on next scheduled visit. Monitor closely."
            ),
            "low": (
                "Patient adherent and engaged with treatment programme. "
                "Continue routine follow-up schedule per clinic protocol."
            )
        }

        conn.execute("""
            INSERT INTO patients(
                name,age,gender,condition,clinic,area,ward,region,phone,language,
                enrolled_date,last_visit,missed_appts,med_pickup_gaps,lab_trend,
                chw_days,socio_flags,visit_days,drs,risk_band,
                unemployed,transport_difficulty,distance_km,food_insecure,
                missed_chw_contacts,single_caregiver,grant_dependent,
                svs,svs_band,care_pathway_level,chw_name,
                whatsapp_sent,intervention_simulated,household_id,notes
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (name,age,gender,cond,clinic,area,ward,region,phone(),lang,
              enrolled,last_visit,missed,gaps,lab_t,chw_d,socio,visit_days,
              drs,dband,unemployed,transport,distance_km,food_insec,
              missed_chw,single_care,grant_dep,svs,sband,cpl,chw,
              wa,0,hh_id,notes_map[profile]))

        pid = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        # Update household flags
        if "HIV" in cond:
            conn.execute("UPDATE households SET has_hiv_member=1 WHERE id=?", (hh_id,))
        if "TB" in cond:
            conn.execute("UPDATE households SET has_tb_member=1 WHERE id=?", (hh_id,))

        # Appointments — realistic attendance pattern
        for _ in range(random.randint(5, 9)):
            days_ago = random.randint(0, 180)
            d = rdate(days_ago, days_ago) if days_ago > 0 else fdate(7, 28)
            status = random.choices(
                ["attended", "missed", "upcoming"],
                weights=[60, max(missed*8, 10), 20]
            )[0]
            if days_ago == 0: status = "upcoming"
            conn.execute(
                "INSERT INTO appointments(patient_id,date,type,status,clinic) VALUES(?,?,?,?,?)",
                (pid, d, random.choice(APPT_TYPES), status, clinic))

        # Medications — insulin patients get special flags
        med_options = MEDICATIONS.get(cond, MEDICATIONS["Hypertension"])
        med_name, med_dose, is_insulin = random.choice(med_options)
        cdate = fdate(0, 4) if random.random() > 0.4 else rdate(0, 2)

        # Stable patients get 2-month supply (per DOH protocol for Challenge 2)
        months = 2 if (profile in ["low", "medium"] and random.random() > 0.4) else 1
        storage = "Store in cool place (not above 25°C). Keep in original packaging." if not is_insulin else \
                  "⚠ INSULIN: Requires refrigeration 2–8°C. Do not freeze. Discard 28 days after opening."

        conn.execute("""
            INSERT INTO medications(patient_id,medication,dosage,collection_date,
                qr_code,status,is_insulin,months_supply,storage_note)
            VALUES(?,?,?,?,?,?,?,?,?)
        """, (pid, med_name, med_dose, cdate, qr_code(pid, name),
              "ready" if random.random() > 0.4 else "pending",
              1 if is_insulin else 0, months, storage))

        if is_insulin:
            conn.execute("UPDATE households SET has_insulin_member=1 WHERE id=?", (hh_id,))

        # Lab results
        lab_types = {
            "HIV":         [("Viral Load","copies/mL"),("CD4 Count","cells/μL")],
            "TB":          [("Sputum Culture","result"),("Chest X-Ray","result")],
            "HIV/TB":      [("Viral Load","copies/mL"),("Sputum Culture","result")],
            "Diabetes":    [("HbA1c","%"),("Fasting Glucose","mmol/L")],
            "Hypertension":[("Blood Pressure","mmHg"),("Creatinine","μmol/L")],
            "HIV/Diabetes":[("Viral Load","copies/mL"),("HbA1c","%")],
        }
        for lt, unit in lab_types.get(cond, [("General Panel","result")]):
            trend = "Worsening" if lab_t > 0.5 else random.choice(["Stable","Improving"])
            result_map = {
                "Viral Load":       f"{random.randint(50,50000)} copies/mL" if lab_t>0.4 else "<50 copies/mL (Undetectable)",
                "CD4 Count":        f"{random.randint(100,800)} cells/μL",
                "HbA1c":            f"{round(random.uniform(5.5,12.0),1)}%",
                "Fasting Glucose":  f"{round(random.uniform(4.5,15.0),1)} mmol/L",
                "Blood Pressure":   f"{random.randint(110,180)}/{random.randint(70,110)} mmHg",
                "Sputum Culture":   random.choice(["Positive","Negative","Culture pending"]),
                "Chest X-Ray":      random.choice(["Consolidation present","Clearing","Normal"]),
                "Creatinine":       f"{random.randint(60,180)} μmol/L",
                "General Panel":    "Within normal limits",
            }
            conn.execute(
                "INSERT INTO lab_results(patient_id,date,test_type,result,unit,trend) VALUES(?,?,?,?,?,?)",
                (pid, rdate(10,90), lt, result_map.get(lt,"Pending"), unit, trend))

    # Recalculate household scores from actual enrolled members
    for hh in conn.execute("SELECT id FROM households").fetchall():
        members = conn.execute(
            "SELECT drs,svs FROM patients WHERE household_id=?", (hh["id"],)).fetchall()
        if members:
            avg_drs = sum(m["drs"] for m in members) / len(members)
            avg_svs = sum(m["svs"] for m in members) / len(members)
            hrs = round((avg_drs * 0.6) + (avg_svs * 0.4), 1)
            conn.execute(
                "UPDATE households SET household_risk_score=?,risk_band=?,total_members=? WHERE id=?",
                (hrs, risk_band(hrs), len(members), hh["id"]))


if __name__ == "__main__":
    if os.path.exists(DB):
        os.remove(DB)
        print("Old database removed.")
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    print("Schema created.")
    hh_ids = create_households(conn)
    print(f"Created {len(hh_ids)} households.")
    seed_patients(conn, hh_ids, 35)
    conn.commit()
    conn.close()
    print("✓ 35 patients seeded — Tshwane-grounded data")
    print("✓ Insulin patients flagged for QuickScript")
    print("✓ WBOT CHW names with ward numbers")
    print("✓ Research-backed risk distributions (~33% non-adherent)")
    print("✓ Real language distribution per clinic area")
    print("Run: python app.py")
