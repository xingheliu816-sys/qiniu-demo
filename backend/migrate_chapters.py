import psycopg2
import config

project_ref = config.SUPABASE_URL.replace('https://', '').split('.')[0]
host = f'db.{project_ref}.supabase.co'
password = config.SUPABASE_SERVICE_KEY

try:
    conn = psycopg2.connect(
        host=host, port=5432, dbname='postgres',
        user='postgres', password=password, connect_timeout=5
    )
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("ALTER TABLE chapters ADD COLUMN IF NOT EXISTS parse_status VARCHAR(20) NOT NULL DEFAULT 'not_parsed';")
    print('parse_status column added')

    cur.execute('ALTER TABLE chapters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();')
    print('updated_at column added')

    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'chapters' ORDER BY ordinal_position;")
    cols = [row[0] for row in cur.fetchall()]
    print('chapters columns:', cols)

    cur.close()
    conn.close()
except Exception as e:
    print(f'Error: {e}')
