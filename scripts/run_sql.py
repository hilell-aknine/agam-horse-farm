# run_sql.py - מריץ קובץ SQL על מסד החווה דרך Management API (המסד משותף, לכן לא supabase db push).
# הרצה: python scripts/run_sql.py supabase/sql/001_farm_core.sql
import json, sys, urllib.request, urllib.error

ENV = r'C:\Users\saraa\.secrets\agam-horse-farm.env'
REF = 'xgqetnlsesgwiypufodf'

def token():
    for line in open(ENV, encoding='utf-8'):
        if line.startswith('SUPABASE_ACCESS_TOKEN='):
            return line.split('=', 1)[1].strip()
    raise SystemExit('no SUPABASE_ACCESS_TOKEN')

sys.stdout.reconfigure(encoding='utf-8')
sql = open(sys.argv[1], encoding='utf-8').read()
req = urllib.request.Request(
    f'https://api.supabase.com/v1/projects/{REF}/database/query',
    data=json.dumps({'query': sql}).encode(), method='POST',
    headers={'Authorization': f'Bearer {token()}', 'Content-Type': 'application/json',
             'User-Agent': 'Mozilla/5.0'})   # בלי UA של דפדפן Cloudflare מחזיר 403/1010
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        print(r.status, r.read().decode()[:2000])
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode()[:2000])
    sys.exit(1)
