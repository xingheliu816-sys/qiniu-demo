import copy
import json
import re
import traceback
from datetime import datetime

from src.db import get_db
from src.ai_client import call_ai, get_provider, get_model_name, TASK_TYPE


EMPTY_RESULT = {
    "core_story": {},
    "story_overview": {},
    "chapter_summaries": [],
    "characters": [],
    "relationships": [],
    "locations": [],
    "key_events": [],
    "timeline": {},
    "causal_chain": [],
    "dramatic_conflicts": [],
    "high_value_scenes": [],
    "foreshadowing": [],
    "information_reveal": [],
    "inner_externalization": [],
    "dialogue_candidates": [],
    "visual_motifs": [],
    "theme_questions": [],
    "structure_outline": {},
    "cut_and_merge_suggestions": [],
    "adaptation_risks": [],
    "adaptation_strategy": {},
    "narrative_perspective": {},
    "world_rules": [],
    "factions": [],
    "uncertain_items": [],
}


def empty_result():
    return copy.deepcopy(EMPTY_RESULT)


def get_extraction(novel_id, user_id):
    db = get_db()
    result = db.table('novel_extractions').select(
        'id, status, ai_result_json, user_result_json, error_message, created_at, updated_at'
    ).eq('novel_id', novel_id).eq('user_id', user_id).execute()
    return result.data[0] if result.data else None


def upsert_extraction(novel_id, user_id, status, ai_result_json=None, user_result_json=None, error_message=None):
    db = get_db()
    now = datetime.now().isoformat()
    existing = get_extraction(novel_id, user_id)
    payload = {
        'status': status,
        'updated_at': now,
        'error_message': error_message,
    }
    if ai_result_json is not None:
        payload['ai_result_json'] = ai_result_json
    if user_result_json is not None:
        payload['user_result_json'] = user_result_json

    if existing:
        db.table('novel_extractions').update(payload).eq('id', existing['id']).execute()
        return existing['id']
    payload['novel_id'] = novel_id
    payload['user_id'] = user_id
    payload['created_at'] = now
    result = db.table('novel_extractions').insert(payload).execute()
    return result.data[0]['id']


def save_user_result(novel_id, user_id, user_result_json):
    return upsert_extraction(
        novel_id=novel_id,
        user_id=user_id,
        status='confirmed',
        user_result_json=user_result_json,
        error_message=None,
    )


def log_ai_call(user_id, novel_id, status, request_summary, response_summary, error_message=None):
    db = get_db()
    db.table('ai_call_records').insert({
        'user_id': user_id,
        'novel_id': novel_id,
        'task_type': TASK_TYPE,
        'provider': get_provider(),
        'model_name': get_model_name(),
        'request_summary': (request_summary or '')[:500],
        'response_summary': (response_summary or '')[:500],
        'status': status,
        'error_message': error_message[:500] if error_message else None,
    }).execute()


def fetch_chapters(novel_id, user_id):
    db = get_db()
    result = db.table('chapters').select(
        'id, chapter_index, title, content, word_count'
    ).eq('novel_id', novel_id).eq('user_id', user_id).order('chapter_index').execute()
    return result.data


def fetch_novel_meta(novel_id, user_id):
    db = get_db()
    result = db.table('novels').select(
        'id, title, status, chapter_count'
    ).eq('id', novel_id).eq('user_id', user_id).execute()
    return result.data[0] if result.data else None


def build_extraction_prompt(novel_title, chapters):
    chapter_blocks = []
    for ch in chapters:
        chapter_blocks.append(
            f"### 章节 {ch['chapter_index']} | id={ch['id']} | 标题: {ch['title']}\n{ch['content']}"
        )
    chapter_text = "\n\n".join(chapter_blocks)

    fields = list(EMPTY_RESULT.keys())
    field_list = "\n".join(f"- {k}" for k in fields)

    schema_hint = json.dumps(EMPTY_RESULT, ensure_ascii=False, indent=2)

    return f"""你是一位资深的小说改编顾问。请阅读下面的小说全文，按照「事实层 / 戏剧层 / 改编层」三个维度，提炼出可用于后续生成 YAML 剧本草稿的故事骨干。

# 输出要求

1. 只输出 **一个合法的 JSON 对象**，不要加任何 Markdown 围栏（```json）、解释文字或前后空白行。
2. JSON 顶层必须严格包含以下 25 个字段，顺序可不同，缺字段就给空对象 {{}} 或空数组 []：

{field_list}

3. 每个字段的语义如下：
   - core_story: {{ "protagonist": "", "goal": "", "obstacle": "", "cost": "", "irreversible_change": "", "summary": "" }}
   - story_overview: {{ "summary": "" }}
   - chapter_summaries: 数组，每项 {{ "chapter_index": int, "chapter_id": int, "title": "", "summary": "", "key_events": [], "characters": [], "locations": [], "dramatic_function": "" }}
   - characters: 数组，每项 {{ "name": "", "identity": "", "story_function": "", "surface_goal": "", "deep_need": "", "fatal_flaw": "", "arc": "", "key_relations": [], "source_refs": [] }}
   - relationships: 数组，每项 {{ "from": "", "to": "", "type": "", "evolution": "", "debt_or_secret": "", "source_refs": [] }}
   - locations: 数组，每项 {{ "name": "", "description": "", "appears_in_chapters": [], "dramatic_role": "", "suitable_as_scene": true, "source_refs": [] }}
   - key_events: 数组，每项 {{ "name": "", "summary": "", "chapter_id": int, "characters": [], "cause": "", "effect": "", "impact_on_main": "", "suitable_as_scene": true, "source_refs": [] }}
   - timeline: {{ "narrative_order": [], "story_order": [], "notes": "" }}
   - causal_chain: 数组，每项 {{ "from": "", "to": "", "logic": "" }}
   - dramatic_conflicts: 数组，每项 {{ "parties": [], "desire_collision": "", "loss_if_choose": "", "source_refs": [] }}
   - high_value_scenes: 数组，每项 {{ "title": "", "summary": "", "entry_state": "", "in_scene_goal": "", "in_scene_conflict": "", "exit_state": "", "change": "", "source_refs": [] }}
   - foreshadowing: 数组，每项 {{ "setup_chapter": int, "payoff_chapter": int, "content": "", "keep_in_script": true, "source_refs": [] }}
   - information_reveal: 数组，每项 {{ "info": "", "known_by_protagonist": true, "known_by_audience": true, "known_by_antagonist": false, "suggested_reveal_timing": "" }}
   - inner_externalization: 数组，每项 {{ "inner_state": "", "external_form": "" }}
   - dialogue_candidates: 数组，每项 {{ "speaker": "", "context": "", "subtext": "", "surface_line": "", "real_intent": "" }}
   - visual_motifs: 数组，每项 {{ "motif": "", "meaning": "", "appears_in": [] }}
   - theme_questions: 数组，每项 {{ "question": "", "character_answers": [], "expressed_in": "" }}
   - structure_outline: {{ "ignite": "", "confront": "", "escalate": "", "collapse": "", "choice": "", "aftermath": "" }}
   - cut_and_merge_suggestions: 数组，每项 {{ "type": "cut|merge|compress|keep", "target": "", "reason": "" }}
   - adaptation_risks: 数组，每项 {{ "risk": "", "reason": "", "suggestion": "" }}
   - adaptation_strategy: {{ "recommended_form": "电影|剧集|短剧|舞台剧|广播剧", "style": "", "pace": "", "must_keep": [], "must_compress": [], "must_strengthen": [] }}
   - narrative_perspective: {{ "use_voiceover": false, "use_flashback": false, "multi_line": false, "audience_knows_more": false }}
   - world_rules: 数组，每项 {{ "rule": "", "scope": "", "source_refs": [] }}
   - factions: 数组，每项 {{ "name": "", "goal": "", "members": [], "relations_with_others": [] }}
   - uncertain_items: 数组，每项 {{ "type": "", "content": "", "reason": "", "source_refs": [] }}
4. 涉及具体情节的字段必须尽量带上 `source_refs`，每个 source_ref 形如：
   {{ "chapter_id": int, "chapter_title": "", "start_offset": int, "end_offset": int, "excerpt_preview": "" }}
   chapter_id 必须从下面给出的章节列表中选，不要编造。
5. **禁止**输出 `confidence` 字段。不确定的内容请放进 `uncertain_items` 数组。
6. JSON 中的中文、引号、转义必须合法可解析。

# 参考结构（仅作 schema 提示，不要照抄字面值，请基于下面的小说重新填写）

{schema_hint}

# 小说标题
《{novel_title}》

# 小说全文（按章节）

{chapter_text}

请直接开始输出 JSON：
"""


def parse_ai_response(text):
    if not text:
        return empty_result()
    cleaned = text.strip()

    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL | re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1)

    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            merged = empty_result()
            merged.update(data)
            return merged
    except json.JSONDecodeError:
        pass

    start = cleaned.find('{')
    if start == -1:
        fallback = empty_result()
        fallback["story_overview"] = {"summary": cleaned[:2000]}
        return fallback

    depth = 0
    end = -1
    in_string = False
    escape = False
    for i in range(start, len(cleaned)):
        ch = cleaned[i]
        if escape:
            escape = False
            continue
        if ch == '\\':
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i
                break

    if end != -1:
        candidate = cleaned[start:end + 1]
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                merged = empty_result()
                merged.update(data)
                return merged
        except json.JSONDecodeError:
            pass

    fallback = empty_result()
    fallback["story_overview"] = {"summary": cleaned[:2000]}
    return fallback


def run_extraction(novel_id, user_id):
    novel = fetch_novel_meta(novel_id, user_id)
    if not novel:
        return False, "小说项目不存在或无权访问", None

    chapters = fetch_chapters(novel_id, user_id)
    if not chapters:
        return False, "未找到章节内容，请先新增并识别章节", None

    db = get_db()
    parsed_count_res = db.table('chapters').select('id', count='exact').eq(
        'novel_id', novel_id
    ).eq('user_id', user_id).eq('parse_status', 'parsed').execute()
    parsed_count = parsed_count_res.count or 0
    if parsed_count == 0:
        return False, "请先至少识别一个章节后再进行 AI 提炼", None

    upsert_extraction(novel_id, user_id, status='extracting', error_message=None)
    prompt = build_extraction_prompt(novel['title'], chapters)
    request_summary = f"title={novel['title']} chapter_count={len(chapters)} prompt_len={len(prompt)}"

    success, text_or_err, response_summary = call_ai(prompt)

    if not success:
        log_ai_call(user_id, novel_id, status='failed',
                    request_summary=request_summary,
                    response_summary=response_summary,
                    error_message=text_or_err)
        upsert_extraction(novel_id, user_id, status='failed', error_message=text_or_err)
        return False, text_or_err, None

    ai_result = parse_ai_response(text_or_err)
    log_ai_call(user_id, novel_id, status='success',
                request_summary=request_summary,
                response_summary=response_summary)
    upsert_extraction(novel_id, user_id, status='extracted',
                      ai_result_json=ai_result, error_message=None)
    return True, "提炼完成", ai_result


def get_source_ref(novel_id, user_id, chapter_id, start_offset, end_offset):
    db = get_db()
    result = db.table('chapters').select(
        'id, title, content'
    ).eq('id', chapter_id).eq('novel_id', novel_id).eq('user_id', user_id).execute()
    if not result.data:
        return None
    chapter = result.data[0]
    content = chapter['content'] or ''
    s = max(0, int(start_offset or 0))
    e = int(end_offset or 0)
    if e <= s:
        e = min(len(content), s + 200)
    e = min(len(content), e)
    return {
        'chapter_id': chapter['id'],
        'chapter_title': chapter['title'],
        'start_offset': s,
        'end_offset': e,
        'excerpt': content[s:e],
        'full_length': len(content),
    }


def _ensure_dict(v):
    if isinstance(v, dict):
        return v
    if isinstance(v, str):
        try:
            return json.loads(v)
        except (json.JSONDecodeError, TypeError):
            return {}
    if v is None:
        return {}
    return {}


def get_chapter_extraction(chapter_id, user_id):
    try:
        db = get_db()
        result = db.table('chapter_extractions').select(
            'id, chapter_id, user_id, novel_id, extraction_json, updated_at'
        ).eq('chapter_id', chapter_id).eq('user_id', user_id).execute()
        if not result.data:
            return None
        row = result.data[0]
        row['extraction_json'] = _ensure_dict(row.get('extraction_json'))
        return row
    except Exception:
        traceback.print_exc()
        return None


def get_saved_chapter_extraction(chapter_id, user_id):
    try:
        return get_chapter_extraction(chapter_id, user_id)
    except Exception:
        traceback.print_exc()
        return None


def save_chapter_extraction(chapter_id, user_id, novel_id, extraction_json):
    db = get_db()
    now = datetime.now().isoformat()
    existing = get_chapter_extraction(chapter_id, user_id)
    if existing:
        db.table('chapter_extractions').update({
            'extraction_json': extraction_json,
            'updated_at': now,
        }).eq('id', existing['id']).execute()
        return existing['id']
    result = db.table('chapter_extractions').insert({
        'chapter_id': chapter_id,
        'user_id': user_id,
        'novel_id': novel_id,
        'extraction_json': extraction_json,
        'updated_at': now,
    }).execute()
    return result.data[0]['id']
