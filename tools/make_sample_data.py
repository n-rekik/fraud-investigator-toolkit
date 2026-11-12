"""Generate the fake sample files in /sample-data.

Every name, bank account, address and number here is invented. Each file has
red flags planted on purpose so the tests have something to find; they are
listed in sample-data/README.md.

Run from the repository root:  python3 tools/make_sample_data.py
"""
import csv
import math
import random
from datetime import date, datetime, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "sample-data"
OUT.mkdir(exist_ok=True)
rng = random.Random(2026)

VENDORS = [
    ("V1001", "Northwind Office Supplies"), ("V1002", "Harbor Logistics BV"), ("V1003", "Acme Ltd"),
    ("V1004", "Bluepeak IT Services"), ("V1005", "Greenfield Catering"), ("V1006", "Summit Facility Management"),
    ("V1007", "Orion Print & Media"), ("V1008", "Delta Security Group"), ("V1009", "Crestline Engineering"),
    ("V1010", "Meridian Travel"), ("V1011", "Atlas Cleaning Services"), ("V1012", "Pinecrest Legal"),
    ("V1013", "Brightline Consulting"), ("V1014", "Riverside Packaging"), ("V1015", "Quantum Energy Supply"),
    ("V1016", "Silverline Telecom"), ("V1017", "Keystone Recruitment"), ("V1018", "Evergreen Landscaping"),
    ("V1019", "Nova Lab Equipment"), ("V1020", "Lighthouse Marketing"),
]


def write(name, header, rows):
    with open(OUT / name, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"{name}: {len(rows)} rows")


def benford_amount(low=10, high=250_000):
    # Log-uniform amounts follow Benford's Law closely.
    return round(10 ** rng.uniform(math.log10(low), math.log10(high)), 2)


# ---------- 1. Benford: AP payments ----------
def make_benford():
    rows = []
    start = date(2026, 1, 1)
    for i in range(3000):
        vid, vname = rng.choice([v for v in VENDORS if v[0] != "V1013"])
        rows.append([f"PAY-{100000 + i}", (start + timedelta(days=rng.randrange(273))).isoformat(), vname, f"INV-{rng.randrange(10000, 99999)}", f"{benford_amount():.2f}"])
    # Planted: 140 payments just under a 5,000 approval limit, all from one vendor.
    for i in range(140):
        rows.append([f"PAY-{103000 + i}", (start + timedelta(days=rng.randrange(273))).isoformat(), "Brightline Consulting", f"BLC-{2000 + i}", f"{rng.uniform(4800, 4999):.2f}"])
    rng.shuffle(rows)
    write("benford-ap-payments.csv", ["Payment ID", "Payment Date", "Vendor Name", "Invoice Number", "Amount"], rows)


# ---------- 2. Duplicate payments ----------
def make_duplicates():
    rows = []
    start = date(2026, 1, 5)
    pay = 500000
    def add(vid, vname, inv, d, amount):
        nonlocal pay
        pay += 1
        rows.append([vid, vname, inv, d.isoformat(), f"{amount:.2f}", (d + timedelta(days=rng.randint(14, 45))).isoformat(), f"P{pay}"])
    for i in range(780):
        vid, vname = rng.choice(VENDORS)
        add(vid, vname, f"INV-{rng.randrange(1000, 99999)}", start + timedelta(days=rng.randrange(260)), benford_amount(50, 90_000))
    # Monthly rent: same amount every month (a legitimate recurring payment, 30 days apart).
    for m in range(1, 10):
        add("V1006", "Summit Facility Management", f"RENT-2026-{m:02d}", date(2026, m, 1), 12_500.00)
    # Planted duplicates.
    add("V1009", "Crestline Engineering", "CE-88120", date(2026, 3, 10), 18_250.00)          # test 1: exact
    add("V1009", "Crestline Engineering", "CE-88120", date(2026, 3, 10), 18_250.00)
    add("V1004", "Bluepeak IT Services", "INV-4471", date(2026, 4, 2), 7_340.50)              # test 1: formatting
    add("V1004", "Bluepeak IT Services", "INV4471", date(2026, 4, 2), 7_340.50)
    add("V1007", "Orion Print & Media", "PO 7781", date(2026, 5, 14), 12_000.00)              # test 2: swapped digits
    add("V1007", "Orion Print & Media", "PO 7718", date(2026, 5, 16), 12_000.00)
    add("V1015", "Quantum Energy Supply", "QE-20391", date(2026, 6, 3), 3_900.00)             # test 2: one character
    add("V1015", "Quantum Energy Supply", "QE-20891", date(2026, 6, 20), 3_900.00)
    add("V1003", "Acme Ltd", "A-5512", date(2026, 7, 1), 9_875.00)                            # test 3: second vendor record
    add("V1021", "ACME Limited", "5512", date(2026, 7, 1), 9_875.00)
    add("V1010", "Meridian Travel", "MT-1190", date(2026, 8, 11), 2_430.75)                   # test 4: close dates
    add("V1010", "Meridian Travel", "MT-1204", date(2026, 8, 18), 2_430.75)
    # A credit note (excluded from the test).
    add("V1009", "Crestline Engineering", "CN-88120", date(2026, 3, 30), -18_250.00)
    rng.shuffle(rows)
    write("duplicate-payments-invoices.csv", ["Vendor ID", "Vendor Name", "Invoice Number", "Invoice Date", "Amount", "Payment Date", "Payment Number"], rows)


# ---------- 3. Vendor and employee master files ----------
FIRST = ["Anna", "Pieter", "Sara", "Tom", "Lisa", "Mark", "Eva", "Daan", "Noor", "Luca", "Emma", "Sam", "Julia", "Ravi", "Fatima", "Omar", "Chen", "Maria", "Jonas", "Leila"]
LAST = ["de Vries", "Bakker", "Visser", "Smit", "Meijer", "Mulder", "Bos", "Vos", "Peters", "Hendriks", "Dekker", "Brouwer", "Kramer", "Willems", "Hoekstra", "Koster", "Prins", "Huisman", "Verbeek", "Kuipers", "Okafor", "Haddad", "Novak", "Rossi", "Lindqvist"]
STREETS = ["Willow Road", "Station Street", "Harbour Lane", "Mill Avenue", "Church Street", "Park Lane", "Canal Road", "Market Square", "Oak Drive", "Bridge Street", "Garden Place", "King Street"]
CITIES = ["Amsterdam", "Utrecht", "Rotterdam", "Haarlem", "Leiden", "Delft"]


def fake_iban(n):
    return f"NL{(n % 89) + 10:02d}FAKE{n:010d}"


def make_masters():
    employees = []
    used_names = set()
    for i in range(120):
        while True:
            name = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
            if name not in used_names:
                used_names.add(name)
                break
        employees.append({
            "id": f"E{2001 + i}", "name": name,
            "bank": fake_iban(700000 + i),
            "address": f"{rng.randint(1, 220)} {rng.choice(STREETS)}", "postcode": f"{rng.randint(1000, 9999)} {rng.choice(['AB', 'CD', 'EF', 'GH', 'JK'])}",
            "phone": f"+31 6 {rng.randint(1000, 9999)} {rng.randint(1000, 9999)}",
            "email": f"{name.lower().replace(' ', '.')}@mailbox-example.com",
        })
    vendors = []
    for i in range(150):
        vendors.append({
            "id": f"V{3001 + i}", "name": f"{rng.choice(['Alpha', 'Beacon', 'Cedar', 'Dune', 'Ember', 'Fjord', 'Granite', 'Horizon', 'Iris', 'Juniper', 'Kestrel', 'Lumen'])} {rng.choice(['Supplies', 'Services', 'Trading', 'Solutions', 'Partners', 'Works', 'Systems', 'Logistics'])} {rng.choice(['BV', 'Ltd', 'BV', 'Group', ''])}".strip(),
            "bank": fake_iban(100000 + i),
            "address": f"{rng.randint(1, 400)} {rng.choice(['Industrial Road', 'Business Park', 'Trade Avenue', 'Port Street', 'Commerce Lane'])}", "postcode": f"{rng.randint(1000, 9999)} {rng.choice(['LM', 'NP', 'RS', 'TV', 'WX'])}",
            "phone": f"+31 20 {rng.randint(100, 999)} {rng.randint(1000, 9999)}",
            "email": f"accounts@vendor{3001 + i}-example.com",
            "created": (date(2023, 1, 1) + timedelta(days=rng.randrange(1300))).isoformat(),
            "createdBy": rng.choice(["mvos", "lbakker", "tsmit", "procure01"]),
        })
    # Planted links.
    e = employees
    vendors[10].update(bank=e[5]["bank"].replace("FAKE", " FAKE ").replace("00", "00 "), created="2026-02-11", createdBy="lbakker")   # HIGH: same IBAN, written with spaces
    vendors[25].update(address=e[17]["address"].replace("Road", "Rd.").replace("Street", "St.").replace("Avenue", "Ave"), postcode=e[17]["postcode"], created="2026-05-30")  # MEDIUM: same address
    vendors[40].update(phone="06-" + e[33]["phone"][6:].replace(" ", ""))  # MEDIUM: same phone, local format
    vendors[55].update(email=e[48]["email"].upper())  # MEDIUM: same email
    surname = e[60]["name"].split(" ")[-1]
    vendors[70].update(name=f"{surname} Installatie BV")  # LOW: surname in vendor name
    vendors[88].update(bank=e[90]["bank"], address=e[90]["address"], postcode=e[90]["postcode"], name="Swift Advisory Services", created="2026-08-04", createdBy="lbakker")  # HIGH: bank + address
    write("vendor-master.csv", ["Vendor ID", "Vendor Name", "IBAN", "Address", "Postcode", "Phone", "Email", "Created On", "Created By"],
          [[v["id"], v["name"], v["bank"], v["address"], v["postcode"], v["phone"], v["email"], v["created"], v["createdBy"]] for v in vendors])
    write("employee-master.csv", ["Employee ID", "Employee Name", "IBAN", "Home Address", "Postcode", "Mobile", "Personal Email"],
          [[x["id"], x["name"], x["bank"], x["address"], x["postcode"], x["phone"], x["email"]] for x in employees])


# ---------- 4. Journal entries ----------
ACCOUNTS = {
    "1000": "Cash at bank", "1100": "Accounts receivable", "1200": "Inventory", "1500": "Fixed assets",
    "2000": "Accounts payable", "2100": "Accrued liabilities", "2900": "Suspense account",
    "4000": "Revenue", "5000": "Cost of sales", "6000": "Salaries", "6100": "Rent", "6200": "Travel", "6900": "Miscellaneous expense",
}
TEMPLATES = [  # (debit, credit, description)
    ("1100", "4000", "Customer invoice"), ("1000", "1100", "Customer receipt"), ("5000", "1200", "Cost of goods sold"),
    ("1200", "2000", "Goods received"), ("2000", "1000", "Supplier payment"), ("6000", "1000", "Monthly payroll"),
    ("6100", "2000", "Office rent"), ("6200", "2000", "Travel expenses"), ("6900", "2100", "Accrual for services"),
]
USERS = ["jdekker", "smulder", "akoster", "rprins", "batch_sap"]


def make_journals():
    rows = []
    n = 0

    def entry(posting, entered, user, lines, source, desc):
        nonlocal n
        n += 1
        eid = f"JE{260000 + n}"
        for acct, dr, cr in lines:
            rows.append([eid, posting.isoformat(), entered.strftime("%Y-%m-%d %H:%M"), user, acct, ACCOUNTS[acct], f"{dr:.2f}" if dr else "", f"{cr:.2f}" if cr else "", desc, source])
        return eid

    day = date(2026, 1, 2)
    while day <= date(2026, 9, 30):
        if day.weekday() < 5:
            for _ in range(rng.randint(5, 9)):
                dr, cr, desc = rng.choice(TEMPLATES)
                amount = benford_amount(100, 60_000)
                manual = rng.random() < 0.3
                user = rng.choice(USERS[:4]) if manual else "batch_sap"
                hour = rng.randint(8, 17) if manual else rng.randint(1, 4)
                entered = datetime(day.year, day.month, day.day, hour, rng.randint(0, 59))
                entry(day, entered, user, [(dr, amount, 0), (cr, 0, amount)], "MANUAL" if manual else "AUTO", desc)
        day += timedelta(days=1)

    # Planted red flags.
    entry(date(2026, 3, 29), datetime(2026, 3, 29, 23, 47), "admin01",          # Sunday night, rare user, suspense, round
          [("2900", 85_000, 0), ("4000", 0, 85_000)], "MANUAL", "Reclass as instructed")
    eid = entry(date(2026, 6, 30), datetime(2026, 6, 30, 21, 15), "fin.director",  # quarter end top-side, reversed next month
                [("2100", 250_000, 0), ("4000", 0, 250_000)], "MANUAL", "Revenue adjustment per CFO")
    entry(date(2026, 7, 2), datetime(2026, 7, 2, 9, 5), "fin.director",
          [("2100", 0, 250_000), ("4000", 250_000, 0)], "MANUAL", f"Reverse {eid}")
    entry(date(2026, 9, 30), datetime(2026, 9, 30, 19, 40), "rprins",           # period end, no description, round
          [("6900", 40_000, 0), ("2900", 0, 40_000)], "MANUAL", "")
    entry(date(2026, 5, 16), datetime(2026, 5, 16, 11, 2), "smulder",           # Saturday
          [("6200", 3_480.20, 0), ("2000", 0, 3_480.20)], "MANUAL", "Travel expenses")
    # An unbalanced entry (export problem).
    entry(date(2026, 8, 14), datetime(2026, 8, 14, 10, 30), "akoster",
          [("6900", 1_250, 0), ("2000", 0, 1_205)], "MANUAL", "Consulting fee")
    write("journal-entries.csv", ["Entry Number", "Posting Date", "Entered On", "User", "Account", "Account Name", "Debit", "Credit", "Description", "Source"], rows)


if __name__ == "__main__":
    make_benford()
    make_duplicates()
    make_masters()
    make_journals()
