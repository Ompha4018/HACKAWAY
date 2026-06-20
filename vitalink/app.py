from flask import Flask, render_template, jsonify, request
import sqlite3, os, random
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='templates', static_url_path='/static')
DB = "vitalink.db"

# ── DRS ENGINE ─────────────────────────────────────────────────────────────
def calculate_drs(missed_appts, med_pickup_gaps, lab_trend, chw_days, visit_days):
    missed_score = min(missed_appts * 20, 100)
    pickup_score = min(med_pickup_gaps * 25, 100)
    lab_score    = lab_trend * 100
    chw_score    = min(chw_days / 90 * 100, 100)
    visit_score  = min(visit_days / 60 * 100, 100)
    drs = (missed_score*0.35 + pickup_score*0.25 + lab_score*0.15 +
           chw_score*0.15 + visit_score*0.10)
    return round(min(drs, 100), 1)

# ── SVS ENGINE ─────────────────────────────────────────────────────────────
def calculate_svs(unemployed, transport_difficulty, distance_km,
                  food_insecure, missed_chw, single_caregiver, grant_dependent):
    unemp    = 100 if unemployed else 0
    transport= min(transport_difficulty * 33.3, 100)
    dist     = min(distance_km / 15 * 100, 100)
    food     = 100 if food_insecure else 0
    chw_m    = min(missed_chw / 5 * 100, 100)
    care     = 100 if single_caregiver else 0
    grant    = 100 if grant_dependent else 0
    svs = (unemp*0.25 + transport*0.20 + dist*0.18 +
           food*0.15 + chw_m*0.12 + care*0.06 + grant*0.04)
    return round(min(svs, 100), 1)

def risk_band(score):
    if score >= 75: return "CRITICAL"
    if score >= 65: return "HIGH"
    if score >= 40: return "MEDIUM"
    return "LOW"

def care_pathway_level(drs, svs):
    combined = (drs * 0.6) + (svs * 0.4)
    if combined >= 80: return 5
    if combined >= 70: return 4
    if combined >= 55: return 3
    if combined >= 40: return 2
    return 1

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

# ── PAGE ROUTES ────────────────────────────────────────────────────────────
@app.route("/")
def dashboard(): return render_template("index.html")

@app.route("/patient/<int:pid>")
def patient(pid): return render_template("patient.html", pid=pid)

@app.route("/chw")
def chw(): return render_template("chw.html")

@app.route("/pharmacy")
def pharmacy(): return render_template("pharmacy.html")

@app.route("/households")
def households(): return render_template("households.html")

@app.route("/impact")
def impact(): return render_template("impact.html")

@app.route("/register")
def register(): return render_template("register.html")

# ── API: PATIENTS ──────────────────────────────────────────────────────────
@app.route("/api/patients")
def api_patients():
    db = get_db()
    rows = db.execute("""
        SELECT p.*,
               COUNT(DISTINCT a.id) as total_appts,
               SUM(CASE WHEN a.status='missed' THEN 1 ELSE 0 END) as missed_count
        FROM patients p
        LEFT JOIN appointments a ON a.patient_id = p.id
        GROUP BY p.id ORDER BY p.drs DESC
    """).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/patient/<int:pid>")
def api_patient(pid):
    db = get_db()
    p      = db.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
    if not p: return jsonify({"error":"Not found"}), 404
    appts  = db.execute("SELECT * FROM appointments WHERE patient_id=? ORDER BY date DESC LIMIT 10",(pid,)).fetchall()
    meds   = db.execute("SELECT * FROM medications WHERE patient_id=?",(pid,)).fetchall()
    labs   = db.execute("SELECT * FROM lab_results WHERE patient_id=? ORDER BY date DESC LIMIT 6",(pid,)).fetchall()
    hh     = db.execute("SELECT * FROM households WHERE id=?", (p["household_id"],)).fetchone() if p["household_id"] else None
    hh_mem = db.execute("SELECT id,name,age,condition,drs,svs,risk_band FROM patients WHERE household_id=? AND id!=?",(p["household_id"],pid)).fetchall() if p["household_id"] else []
    db.close()
    return jsonify({
        "patient":      dict(p),
        "appointments": [dict(a) for a in appts],
        "medications":  [dict(m) for m in meds],
        "labs":         [dict(l) for l in labs],
        "household":    dict(hh) if hh else None,
        "hh_members":   [dict(m) for m in hh_mem],
    })

@app.route("/api/stats")
def api_stats():
    db = get_db()
    total    = db.execute("SELECT COUNT(*) as c FROM patients").fetchone()["c"]
    critical = db.execute("SELECT COUNT(*) as c FROM patients WHERE drs>=75").fetchone()["c"]
    high     = db.execute("SELECT COUNT(*) as c FROM patients WHERE drs>=65 AND drs<75").fetchone()["c"]
    alerted  = db.execute("SELECT COUNT(*) as c FROM patients WHERE whatsapp_sent=1").fetchone()["c"]
    hh_risk  = db.execute("SELECT COUNT(*) as c FROM households WHERE household_risk_score>=65").fetchone()["c"]
    insulin  = db.execute("SELECT COUNT(*) as c FROM patients WHERE condition LIKE '%Diabetes%'").fetchone()["c"]
    db.close()
    return jsonify({"total":total,"critical":critical,"high":high,
                    "alerted":alerted,"retained":total-critical-high,
                    "households_at_risk":hh_risk,"insulin_patients":insulin})

@app.route("/api/chw_alerts")
def api_chw_alerts():
    db = get_db()
    rows = db.execute("SELECT * FROM patients WHERE drs>=65 ORDER BY drs DESC").fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

@app.route("/api/households")
def api_households():
    db = get_db()
    hhs = db.execute("SELECT * FROM households ORDER BY household_risk_score DESC").fetchall()
    result = []
    for hh in hhs:
        members = db.execute("SELECT id,name,age,condition,drs,svs,risk_band FROM patients WHERE household_id=?",(hh["id"],)).fetchall()
        d = dict(hh); d["members"] = [dict(m) for m in members]
        result.append(d)
    db.close()
    return jsonify(result)

@app.route("/api/impact")
def api_impact():
    db = get_db()
    total    = db.execute("SELECT COUNT(*) as c FROM patients").fetchone()["c"]
    critical = db.execute("SELECT COUNT(*) as c FROM patients WHERE drs>=75").fetchone()["c"]
    high     = db.execute("SELECT COUNT(*) as c FROM patients WHERE drs>=65 AND drs<75").fetchone()["c"]
    alerted  = db.execute("SELECT COUNT(*) as c FROM patients WHERE whatsapp_sent=1").fetchone()["c"]
    hh_total = db.execute("SELECT COUNT(*) as c FROM households").fetchone()["c"]
    hh_risk  = db.execute("SELECT COUNT(*) as c FROM households WHERE household_risk_score>=65").fetchone()["c"]
    conds    = db.execute("SELECT condition, COUNT(*) as c FROM patients GROUP BY condition").fetchall()
    clinics  = db.execute("SELECT clinic, COUNT(*) as c FROM patients GROUP BY clinic ORDER BY c DESC").fetchall()
    db.close()
    retained = total - critical - high
    return jsonify({
        "total_patients":total,"retained_in_care":retained,
        "critical":critical,"high":high,"whatsapp_sent":alerted,
        "appointments_prevented":alerted*3,"chw_interventions":high+critical,
        "cost_saving_rands":retained*28000,"households_monitored":hh_total,
        "households_at_risk":hh_risk,"lives_impacted":total*4,
        "conditions":[dict(c) for c in conds],"clinics":[dict(c) for c in clinics],
    })

@app.route("/api/pharmacy_queue")
def pharmacy_queue():
    db = get_db()
    rows = db.execute("""
        SELECT p.id,p.name,p.condition,p.clinic,p.phone,p.age,
               m.medication,m.dosage,m.collection_date,m.qr_code,m.status,m.id as med_id
        FROM patients p JOIN medications m ON m.patient_id=p.id
        WHERE m.collection_date <= date('now','+3 days')
        ORDER BY m.collection_date ASC, p.condition ASC
    """).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

# ── API: WHATSAPP ALERT ────────────────────────────────────────────────────
@app.route("/api/send_whatsapp/<int:pid>", methods=["POST"])
def send_whatsapp(pid):
    db = get_db()
    p = db.execute("SELECT * FROM patients WHERE id=?",(pid,)).fetchone()
    db.execute("UPDATE patients SET whatsapp_sent=1 WHERE id=?",(pid,))
    db.commit(); db.close()
    return jsonify({"status":"sent","patient":p["name"],"phone":p["phone"]})

# ── API: REGISTER NEW PATIENT ──────────────────────────────────────────────
@app.route("/api/register_patient", methods=["POST"])
def register_patient():
    data = request.get_json()
    try:
        # Calculate scores from form data
        drs = calculate_drs(
            int(data.get("missed_appts", 0)),
            int(data.get("med_pickup_gaps", 0)),
            float(data.get("lab_trend", 0.0)),
            int(data.get("chw_days", 0)),
            int(data.get("visit_days", 0))
        )
        svs = calculate_svs(
            int(data.get("unemployed", 0)),
            int(data.get("transport_difficulty", 0)),
            float(data.get("distance_km", 0)),
            int(data.get("food_insecure", 0)),
            int(data.get("missed_chw", 0)),
            int(data.get("single_caregiver", 0)),
            int(data.get("grant_dependent", 0))
        )
        dband = risk_band(drs)
        sband = risk_band(svs)
        cpl   = care_pathway_level(drs, svs)

        db = get_db()

        # Handle household
        hh_id = None
        if data.get("household_address"):
            hh_id = db.execute("""
                INSERT INTO households(address,area,ward,total_members,children,elderly,
                                       has_tb_member,has_hiv_member,household_risk_score,risk_band)
                VALUES(?,?,?,?,?,?,?,?,?,?)
            """,(data.get("household_address",""),
                 data.get("area",""),
                 int(data.get("ward",0)),
                 int(data.get("hh_total",1)),
                 int(data.get("hh_children",0)),
                 int(data.get("hh_elderly",0)),
                 1 if "TB" in data.get("condition","") else 0,
                 1 if "HIV" in data.get("condition","") else 0,
                 round((drs*0.6)+(svs*0.4),1),
                 dband)).lastrowid

        today = datetime.now().strftime("%Y-%m-%d")
        pid = db.execute("""
            INSERT INTO patients(name,age,gender,condition,clinic,area,ward,phone,language,
                enrolled_date,last_visit,missed_appts,med_pickup_gaps,lab_trend,chw_days,
                socio_flags,visit_days,drs,risk_band,unemployed,transport_difficulty,
                distance_km,food_insecure,missed_chw_contacts,single_caregiver,
                grant_dependent,svs,svs_band,care_pathway_level,chw_name,
                whatsapp_sent,household_id,notes)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,(data.get("name"),
             int(data.get("age",0)),
             data.get("gender",""),
             data.get("condition",""),
             data.get("clinic",""),
             data.get("area",""),
             int(data.get("ward",0)),
             data.get("phone",""),
             data.get("language",""),
             today, today,
             int(data.get("missed_appts",0)),
             int(data.get("med_pickup_gaps",0)),
             float(data.get("lab_trend",0.0)),
             int(data.get("chw_days",0)),
             int(data.get("transport_difficulty",0)),
             int(data.get("visit_days",0)),
             drs, dband,
             int(data.get("unemployed",0)),
             int(data.get("transport_difficulty",0)),
             float(data.get("distance_km",0)),
             int(data.get("food_insecure",0)),
             int(data.get("missed_chw",0)),
             int(data.get("single_caregiver",0)),
             int(data.get("grant_dependent",0)),
             svs, sband, cpl,
             data.get("chw_name","Unassigned"),
             0, hh_id,
             data.get("notes","New patient registered via VitaLink.")
        )).lastrowid

        # Add medication if provided
        if data.get("medication"):
            collection = data.get("collection_date", today)
            qr_code = f"VTL-{''.join([w[0] for w in data['name'].split()])}-{pid:04d}-{random.randint(1000,9999)}"
            db.execute("""INSERT INTO medications(patient_id,medication,dosage,collection_date,qr_code,status)
                          VALUES(?,?,?,?,?,?)""",
                       (pid, data["medication"], data.get("dosage","As prescribed"),
                        collection, qr_code, "pending"))

        # Add initial appointment if provided
        if data.get("next_appointment"):
            db.execute("""INSERT INTO appointments(patient_id,date,type,status,clinic)
                          VALUES(?,?,?,?,?)""",
                       (pid, data["next_appointment"], "Initial Assessment", "upcoming", data.get("clinic","")))

        db.commit(); db.close()
        return jsonify({
            "success": True,
            "patient_id": pid,
            "drs": drs, "drs_band": dband,
            "svs": svs, "svs_band": sband,
            "care_pathway_level": cpl,
            "message": f"Patient registered. DRS: {drs} ({dband}). SVS: {svs} ({sband})."
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400



# ── BOOKING ROUTES ─────────────────────────────────────────────────────────
@app.route("/book")
def book(): return render_template("book.html")

@app.route("/checkin")
def checkin(): return render_template("checkin.html")

# ── API: AVAILABLE SLOTS ───────────────────────────────────────────────────
@app.route("/api/available_slots")
def available_slots():
    """Returns available appointment slots for the next 14 days."""
    area = request.args.get("area", "")
    condition = request.args.get("condition", "")

    # Clinic proximity map — Tshwane areas to nearest clinics
    CLINIC_PROXIMITY = {
        "Soshanguve": [
            "Soshanguve BB Clinic",
            "Soshanguve Block H Clinic",
            "Mabopane CHC",
        ],
        "Ga-Rankuwa": [
            "Ga-Rankuwa Clinic 1",
            "Ga-Rankuwa Zone 4 Clinic",
            "Mabopane CHC",
        ],
        "Mabopane": [
            "Mabopane CHC",
            "Ga-Rankuwa Clinic 1",
            "Temba Community HC",
        ],
        "Atteridgeville": [
            "Atteridgeville CHC",
            "Ga-Rankuwa Clinic 1",
            "Mabopane CHC",
        ],
        "Mamelodi": [
            "Mamelodi East Clinic",
            "Atteridgeville CHC",
            "Temba Community HC",
        ],
        "Temba": [
            "Temba Community HC",
            "Mabopane CHC",
            "Soshanguve BB Clinic",
        ],
    }

    # Find nearest clinics based on area keyword
    matched_clinics = []
    for key, clinics in CLINIC_PROXIMITY.items():
        if key.lower() in area.lower():
            matched_clinics = clinics
            break
    if not matched_clinics:
        matched_clinics = [
            "Ga-Rankuwa Clinic 1",
            "Soshanguve BB Clinic",
            "Mabopane CHC",
        ]

    # Generate slots for next 14 days
    slots = []
    today = datetime.now()
    for day_offset in range(2, 16):
        date = today + timedelta(days=day_offset)
        # Skip Sundays
        if date.weekday() == 6:
            continue
        date_str = date.strftime("%Y-%m-%d")
        day_name = date.strftime("%A")
        is_saturday = date.weekday() == 5

        # Saturday clinics open 08:00–13:00
        # Weekday clinics open 07:30–16:00
        if is_saturday:
            times = ["08:00", "08:30", "09:00", "09:30",
                     "10:00", "10:30", "11:00", "11:30", "12:00"]
        else:
            times = ["07:30", "08:00", "08:30", "09:00", "09:30",
                     "10:00", "10:30", "11:00", "13:00", "13:30",
                     "14:00", "14:30", "15:00", "15:30"]

        for clinic in matched_clinics[:2]:  # Show top 2 nearest clinics
            # Simulate some slots being taken
            available_times = [t for t in times
                                if random.random() > 0.35]
            if available_times:
                slots.append({
                    "date": date_str,
                    "day": day_name,
                    "is_saturday": is_saturday,
                    "clinic": clinic,
                    "times": available_times,
                    "nearest": clinic == matched_clinics[0],
                })

    return jsonify({
        "slots": slots,
        "nearest_clinics": matched_clinics[:3],
        "area_detected": area,
    })

# ── API: BOOK APPOINTMENT ──────────────────────────────────────────────────
@app.route("/api/book_appointment", methods=["POST"])
def book_appointment():
    data = request.get_json()
    db = get_db()

    # Check if patient exists by phone
    patient = db.execute(
        "SELECT * FROM patients WHERE phone LIKE ?",
        (f"%{data.get('phone','').replace(' ','').replace('+27','0')[-9:]}%",)
    ).fetchone()

    booking_ref = f"VTL-BK-{random.randint(10000,99999)}"

    if patient:
        # Add appointment to existing patient
        db.execute("""
            INSERT INTO appointments(patient_id, date, type, status, clinic)
            VALUES (?,?,?,?,?)
        """, (patient["id"], data["date"],
              data.get("appointment_type", "Chronic Care"),
              "upcoming", data["clinic"]))
        pid = patient["id"]
        patient_name = patient["name"]
    else:
        pid = None
        patient_name = data.get("name", "New Patient")

    # Save booking to VitaLink bookings table for clinic tracking
    today_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    db.execute(
        """INSERT INTO bookings(patient_id,patient_name,phone,clinic,area,date,time,
                              appointment_type,booking_ref,status,created_at)
           VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
        (pid, patient_name, data.get('phone',''),
         data['clinic'], data.get('area',''),
         data['date'], data['time'],
         data.get('appointment_type','Chronic Care'),
         booking_ref, 'upcoming', today_str))
    db.commit()
    db.close()

    # Discreet notification message — no disease names
    discreet_msg = (
        f"Your health appointment is confirmed for "
        f"{data['date']} at {data['time']} at {data['clinic']}. "
        f"Reference: {booking_ref}. "
        f"Reply CANCEL to reschedule. — VitaLink Health"
    )

    return jsonify({
        "success": True,
        "booking_ref": booking_ref,
        "patient_id": pid,
        "patient_name": patient_name,
        "clinic": data["clinic"],
        "date": data["date"],
        "time": data["time"],
        "discreet_message": discreet_msg,
        "message": "Appointment booked. A discreet reminder will be sent 24 hours before."
    })

# ── API: SIDE EFFECT CHECK-IN ──────────────────────────────────────────────
@app.route("/api/symptom_checkin/<int:pid>", methods=["POST"])
def symptom_checkin(pid):
    """
    Patient reports symptoms via 3-button check-in.
    If severe — DRS is automatically raised and clinic is notified.
    """
    data = request.get_json()
    severity = data.get("severity", "fine")  # fine | mild | severe

    db = get_db()
    p = db.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
    if not p:
        return jsonify({"error": "Not found"}), 404

    drs_increase = 0
    action = ""
    alert_clinic = False

    if severity == "mild":
        drs_increase = 8
        action = "Mild side effects noted. CHW check-in scheduled for 3 days."
    elif severity == "severe":
        drs_increase = 26
        action = "Severe symptoms reported. DRS elevated. Clinic automatically notified. Nurse will call within 24 hours."
        alert_clinic = True

    new_drs = round(min(p["drs"] + drs_increase, 100), 1)
    new_band = risk_band(new_drs)

    checked_at = datetime.now().strftime('%Y-%m-%d %H:%M')
    db.execute(
        """INSERT INTO symptom_checkins(patient_id,severity,drs_before,drs_after,action,checked_at)
           VALUES(?,?,?,?,?,?)""",
        (pid, severity, p['drs'], new_drs, action, checked_at))
    if drs_increase > 0:
        db.execute(
            "UPDATE patients SET drs=?, risk_band=? WHERE id=?",
            (new_drs, new_band, pid)
        )
    db.commit()
    db.close()

    return jsonify({
        "success": True,
        "severity": severity,
        "drs_before": p["drs"],
        "drs_after": new_drs,
        "band": new_band,
        "alert_clinic": alert_clinic,
        "action": action,
        "education_message": get_education_message(p["condition"], severity),
    })

def get_education_message(condition, severity):
    messages = {
        "HIV": {
            "mild": "Feeling nauseous or tired in the first few weeks is normal with ARVs. Please do not stop taking your medication — this usually improves. Contact your clinic if it continues.",
            "severe": "Severe symptoms need attention. Your clinic has been notified. Please do not stop your ARVs before speaking to a nurse.",
            "fine": "You're doing great. Taking your ARVs every day keeps your viral load undetectable and protects your family.",
        },
        "TB": {
            "mild": "Mild side effects from TB medication are common in the first 2 weeks. Even if you feel better, TB bacteria may still be active. Please continue your treatment.",
            "severe": "Your symptoms have been flagged. A nurse will contact you. Do not stop your TB tablets — stopping early can cause drug resistance.",
            "fine": "Great job staying on treatment. Completing all TB medication is the only way to ensure the infection is fully cleared.",
        },
        "Diabetes": {
            "mild": "Mild nausea with Metformin is common when starting. Taking it with food usually helps. Contact your clinic if it persists.",
            "severe": "Please attend your clinic as soon as possible. If you use insulin, check your glucose level now.",
            "fine": "Well done. Consistent medication and a low-sugar diet are your most powerful tools.",
        },
    }
    # Match partial condition names
    for key in messages:
        if key in condition:
            return messages[key].get(severity, messages[key]["fine"])
    return "Thank you for checking in. Your health team has been informed of your update."

# ── API: INTERVENTION SIMULATION ──────────────────────────────────────────
@app.route("/api/simulate_intervention/<int:pid>", methods=["POST"])
def simulate_intervention(pid):
    db = get_db()
    p = db.execute("SELECT * FROM patients WHERE id=?", (pid,)).fetchone()
    if not p:
        return jsonify({"error": "Not found"}), 404

    old_drs = p["drs"]
    new_missed = max(p["missed_appts"] - 1, 0)
    new_gaps   = max(p["med_pickup_gaps"] - 1, 0)
    new_lab    = max(round(p["lab_trend"] - 0.12, 2), 0.0)
    new_chw    = max(p["chw_days"] - 35, 1)
    new_visit  = max(p["visit_days"] - 14, 1)

    new_drs  = calculate_drs(new_missed, new_gaps, new_lab, new_chw, new_visit)
    new_band = risk_band(new_drs)
    today    = datetime.now().strftime("%Y-%m-%d")

    db.execute("""
        INSERT INTO appointments(patient_id, date, type, status, clinic)
        VALUES (?,?,?,?,?)
    """, (pid, today, "Follow-Up After Intervention", "attended", p["clinic"]))

    db.execute("""
        UPDATE patients SET drs=?, risk_band=?, chw_days=?,
        missed_appts=?, last_visit=?, whatsapp_sent=1
        WHERE id=?
    """, (new_drs, new_band, new_chw, new_missed, today, pid))

    db.commit()
    db.close()

    return jsonify({
        "success": True,
        "old_drs": old_drs,
        "new_drs": new_drs,
        "old_band": p["risk_band"],
        "new_band": new_band,
        "reduction": round(old_drs - new_drs, 1),
        "message": (
            f"Intervention successful. DRS dropped from {old_drs} "
            f"to {new_drs}. Risk band: {p['risk_band']} → {new_band}. "
            f"Patient re-engaged and follow-up appointment recorded."
        )
    })

# ── API: BOOKINGS TRACKER (VitaLink sees all patient portal bookings) ──────
@app.route("/api/bookings")
def api_bookings():
    db = get_db()
    rows = db.execute("""
        SELECT b.*, p.drs, p.risk_band, p.condition
        FROM bookings b
        LEFT JOIN patients p ON p.id = b.patient_id
        ORDER BY b.date ASC, b.time ASC
    """).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

# ── API: SYMPTOM CHECKINS TRACKER ─────────────────────────────────────────
@app.route("/api/checkins")
def api_checkins():
    db = get_db()
    rows = db.execute("""
        SELECT sc.*, p.name, p.condition, p.clinic, p.risk_band
        FROM symptom_checkins sc
        LEFT JOIN patients p ON p.id = sc.patient_id
        ORDER BY sc.checked_at DESC LIMIT 50
    """).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])

# ── API: COMBINED ACTIVITY FEED (for VitaLink dashboard) ──────────────────
@app.route("/api/activity")
def api_activity():
    db = get_db()
    bookings = db.execute("""
        SELECT 'booking' as type, b.created_at as ts,
               b.patient_name as name, b.clinic,
               b.date || ' ' || b.time as detail,
               b.booking_ref as ref, b.appointment_type as extra,
               p.drs, p.risk_band, p.id as patient_id
        FROM bookings b LEFT JOIN patients p ON p.id=b.patient_id
        ORDER BY b.created_at DESC LIMIT 20
    """).fetchall()
    checkins = db.execute("""
        SELECT 'checkin' as type, sc.checked_at as ts,
               p.name, p.clinic,
               sc.severity as detail,
               '' as ref, sc.action as extra,
               p.drs, p.risk_band, p.id as patient_id
        FROM symptom_checkins sc
        LEFT JOIN patients p ON p.id=sc.patient_id
        ORDER BY sc.checked_at DESC LIMIT 20
    """).fetchall()
    db.close()
    combined = [dict(r) for r in list(bookings) + list(checkins)]
    combined.sort(key=lambda x: x.get('ts','') or '', reverse=True)
    return jsonify(combined[:30])

if __name__ == "__main__":
    if not os.path.exists(DB):
        print("Run: python seed.py first")
    app.run(debug=True, port=5000)
