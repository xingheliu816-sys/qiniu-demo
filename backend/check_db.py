from src.db import get_db
db = get_db()

# 查看liufuyu的小说详情
novel = db.table('novels').select('*').eq('id',8).execute()
print('=== 小说 8 详情 ===')
print(novel.data)

# 查看章节
chapters = db.table('chapters').select('id,novel_id,chapter_index,title,word_count').eq('novel_id',8).execute()
print('\n=== 章节列表 ===')
for c in chapters.data:
    print(c)

# 查看章节内容长度
ch = db.table('chapters').select('id, content').eq('novel_id',8).execute()
for c in ch.data:
    content_len = len(c['content'])
    print(f'章节 {c["id"]} 内容长度: {content_len}')
    print(f'前100字: {c["content"][:100]}')

# 检查记载的历史记录
records = db.table('chapter_parse_records').select('*').eq('novel_id',8).execute()
print('\n=== 解析记录 ===')
for r in records.data:
    print(r)

# 检查 novel_extractions
ext = db.table('novel_extractions').select('*').eq('novel_id',8).execute()
print('\n=== 提炼记录 ===')
print(ext.data)
