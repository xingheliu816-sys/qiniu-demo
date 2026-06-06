from src.db import get_db
db = get_db()

# 把小说 8 的状态改为 parsed
result = db.table('novels').update({
    'status': 'parsed',
    'chapter_count': 1
}).eq('id', 8).execute()

print('更新结果:', result.data)

# 验证
novel = db.table('novels').select('id,title,status,chapter_count').eq('id',8).execute()
print('当前小说状态:', novel.data)
