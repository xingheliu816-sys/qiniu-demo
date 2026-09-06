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


def _strip_internal_keys(user_result):
    """清洗 user_result_json，剥离 _chapter_overrides 等内部存储键后返回干净副本。"""
    if isinstance(user_result, dict):
        cleaned = {k: v for k, v in user_result.items() if not k.startswith('_')}
        return cleaned if cleaned else None
    return user_result


def upsert_extraction(novel_id, user_id, status, ai_result_json=None, user_result_json=None, error_message=None, clear_user_result=False):
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
    elif clear_user_result:
        # 重新提炼时清掉用户上次的编辑版，避免旧 user 数据盖住新 ai 数据
        payload['user_result_json'] = None

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
            f"### 第{ch['chapter_index']}章 | id={ch['id']} | {ch['title']}\n{ch['content']}"
        )
    chapter_text = "\n\n".join(chapter_blocks)

    fields = list(EMPTY_RESULT.keys())
    field_list = "\n".join(f"- {k}" for k in fields)

    return f"""你是资深小说改编顾问。请阅读下面的小说全文，输出一个合法的 JSON 对象（不要围栏/解释），用于后续生成 YAML 剧本。

# 输出规范

顶层必须包含这 {len(fields)} 个字段，缺字段给空对象/空数组：
{field_list}

字段速查（只列关键字段，其余可为空）：
- core_story: protagonist, goal, obstacle, cost, irreversible_change, summary
- story_overview: summary (100-200字)
- chapter_summaries: 数组，每项必须含 chapter_id(int,用下面给出的id)、chapter_index(int)、title(原章节标题)、summary(100-200字)、characters(字符串数组,本章出场角色名)、key_events(数组,每项含name/summary/chapter_id/characters)、locations(字符串数组)
- characters: 数组，每项含 name, identity(身份定位), story_function, surface_goal, deep_need, fatal_flaw, arc
- relationships: 数组，每项含 from, to, type(朋友/师徒/情侣/父子/仇敌/同盟/利用/救赎)
- locations: 数组，每项含 name, description
- key_events: 数组，每项必须含 chapter_id(int), name, summary, characters, cause, effect, impact_on_main
- dramatic_conflicts: 数组，每项含 parties, desire_collision, loss_if_choose
- foreshadowing: 数组，每项含 setup_chapter(int), payoff_chapter(int), content
- world_rules: 数组，每项含 rule, scope
- uncertain_items: 数组，每项含 type, content, reason
- 其余字段(high_value_scenes/timeline/causal_chain等)按空数组/空对象即可，不强求

# 硬性要求

1. **必须输出合法 JSON**，不含 Markdown 围栏。中文引号/转义必须正确。
2. **必须不编造**：没有依据的字段给空对象/空数组。不确定的内容放进 `uncertain_items`。
3. **不可漏章**：以下 {len(chapters)} 个章节都必须在 chapter_summaries 里各有一条，chapter_id 用给出的 id。
4. **每个 chapter_summary 要内嵌**：key_events(至少1条)、characters(本章出场角色名数组)、locations(本章地点名数组)。
5. **每个 key_event 要标注 chapter_id**。
6. **characters 收录**所有出场 2 次以上的角色。
7. **全部中文输出**。

# 小说: 《{novel_title}》

{chapter_text}"""


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
            return _merge_with_empty(data)
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
                return _merge_with_empty(data)
        except json.JSONDecodeError:
            pass

    fallback = empty_result()
    fallback["story_overview"] = {"summary": cleaned[:2000]}
    return fallback


def _merge_with_empty(data):
    """合并 AI 返回与空模板；如果完全没有非空字段，把原文摘要塞进 story_overview 兜底。"""
    merged = empty_result()
    merged.update(data)
    non_empty = [k for k, v in merged.items() if v not in (None, '', {}, [])]
    if not non_empty:
        merged["story_overview"] = {"summary": "AI 返回为空，请重试或检查章节内容是否过短。"}
    return merged


def run_chapter_extraction(novel_id, user_id, chapter_id):
    """单章 AI 提炼：只对该章节调 AI，保存到 chapter_extractions。

    返回 (success, message, extraction_json)。
    """
    db = get_db()
    ch_row = db.table('chapters').select(
        'id, novel_id, chapter_index, title, content'
    ).eq('id', chapter_id).eq('user_id', user_id).execute()
    if not ch_row.data:
        return False, '章节不存在或无权访问', None
    chapter = ch_row.data[0]
    if chapter['novel_id'] != novel_id:
        return False, '章节不属于该小说', None

    novel = fetch_novel_meta(novel_id, user_id)
    if not novel:
        return False, '小说项目不存在或无权访问', None

    content = chapter.get('content') or ''
    if not content.strip():
        return False, '章节正文为空，无法提炼', None

    prompt = _build_chapter_extraction_prompt(novel['title'], chapter)
    request_summary = (
        f'chapter_extract chapter_id={chapter_id} chapter_index={chapter.get("chapter_index")} '
        f'prompt_len={len(prompt)}'
    )

    success, text_or_err, response_summary = call_ai(prompt, timeout=180)
    log_ai_call(user_id, novel_id, status='success' if success else 'failed',
                request_summary=request_summary,
                response_summary=response_summary,
                error_message=None if success else text_or_err)
    if not success:
        return False, text_or_err, None

    extraction_json = parse_ai_response(text_or_err)
    # 标记来源
    if isinstance(extraction_json, dict):
        extraction_json = dict(extraction_json)
        extraction_json['_source'] = 'chapter_ai_extraction'
        extraction_json['chapter_id'] = chapter_id
        extraction_json['chapter_index'] = chapter.get('chapter_index')
        extraction_json['title'] = chapter.get('title')

    # 保存到 chapter_extractions 表（如果存在）
    try:
        save_chapter_extraction(chapter_id, user_id, novel_id, extraction_json)
    except Exception:
        traceback.print_exc()

    return True, '章节提炼完成', extraction_json


def _build_chapter_extraction_prompt(novel_title, chapter):
    """单章提炼 prompt，精简且强调 chapter_id 标注。"""
    fields = list(EMPTY_RESULT.keys())
    field_list = '\n'.join(f'- {k}' for k in fields)
    return f"""你是资深小说改编顾问。请阅读下面的单章内容，输出一个合法的 JSON 对象（不要 Markdown 围栏/解释）。

# 必须输出的 {len(fields)} 个字段

{field_list}

# 字段简述（重点填以下，其余为空）

- core_story: protagonist, goal, obstacle, cost, irreversible_change, summary（基于本章推断即可）
- story_overview: summary (100-200字)
- chapter_summaries: 只放一项 {{ "chapter_id": {chapter['id']}, "chapter_index": {chapter.get('chapter_index')}, "title": "{chapter.get('title','').replace('"','\\"')}", "summary": "100-200字摘要", "characters": ["本章出场角色"], "key_events": [{{"name":"","summary":"","chapter_id":{chapter['id']},"characters":[]}}], "locations": ["本章地点"] }}
- characters: 数组，每项含 name, identity, story_function, surface_goal, deep_need
- key_events: 数组，每项含 chapter_id({chapter['id']}), name, summary, characters, cause, effect
- locations/dramatic_conflicts/foreshadowing/world_rules: 只写本章出现的
- 其余字段给空对象/空数组

# 硬性要求

1. 只输出合法 JSON，不含 Markdown 围栏。
2. **禁止编造**原文没有的情节。不确定的内容放进 uncertain_items 并写 reason。
3. chapter_summaries 只放本章一条，chapter_id={chapter['id']}。
4. 每个 key_event 要标注 chapter_id={chapter['id']}。
5. 全部中文输出。

# 小说: 《{novel_title}》 | 本章: {chapter.get('title','')!r}

{chapter.get('content','')}"""


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

    # 重新提炼时清掉用户上次的编辑版，避免旧 userResult 盖住新 aiResult
    upsert_extraction(novel_id, user_id, status='extracting', error_message=None, clear_user_result=True)

    # 不论几章，统一走单次提炼（deepseek-chat 速度优先）。
    # 之前的两阶段流程虽然质量稍均衡但耗时翻倍，对短篇/中篇没必要。
    prompt = build_extraction_prompt(novel['title'], chapters)
    request_summary = f"title={novel['title']} chapter_count={len(chapters)} prompt_len={len(prompt)}"
    success, text_or_err, response_summary = call_ai(prompt)
    log_ai_call(user_id, novel_id, status='success' if success else 'failed',
                request_summary=request_summary,
                response_summary=response_summary,
                error_message=None if success else text_or_err)
    if not success:
        upsert_extraction(novel_id, user_id, status='failed',
                          error_message=text_or_err, clear_user_result=True)
        return False, text_or_err, None
    ai_result = parse_ai_response(text_or_err)

    upsert_extraction(novel_id, user_id, status='extracted',
                      ai_result_json=ai_result, error_message=None, clear_user_result=True)

    # 提炼成功后，为每章保存独立的章节提炼结果（表存在走 chapter_extractions，否则走 novel_extractions 兜底）
    _persist_chapter_extractions(novel_id, user_id, ai_result, chapters)

    return True, "提炼完成", ai_result


def _persist_chapter_extractions(novel_id, user_id, ai_result, chapters):
    """从 AI 提炼结果中提取每章的章节级数据并保存（表存在走 chapter_extractions，否则走 novel_extractions 兜底）。"""
    chapter_map = _build_chapter_extraction_map(ai_result, chapters)
    save_chapter_extractions_batch(novel_id, user_id, chapter_map)


def _build_chapter_extraction_map(ai_result, chapters):
    """从 AI 结果构建 {chapter_id: extraction_json} 映射。"""
    chapter_map = {}
    chapter_summaries = ai_result.get('chapter_summaries') or []
    key_events = ai_result.get('key_events') or []
    characters = ai_result.get('characters') or []
    locations = ai_result.get('locations') or []
    world_rules = ai_result.get('world_rules') or []
    foreshadowing = ai_result.get('foreshadowing') or []

    for ch in chapters:
        ch_id = ch['id']
        summary = next((s for s in chapter_summaries if s.get('chapter_id') == ch_id), {})
        ch_events = [e for e in key_events if e.get('chapter_id') == ch_id]
        ch_locations = [l for l in locations if ch_id in (l.get('appears_in_chapters') or [])]
        ch_chars = [c.get('name') for c in characters if c.get('first_appear_chapter') == ch_id]
        ch_foreshadowing = [f for f in foreshadowing if f.get('setup_chapter') == ch_id or f.get('payoff_chapter') == ch_id]
        ch_rules = [r for r in world_rules if any(
            ref.get('chapter_id') == ch_id for ref in (r.get('source_refs') or [])
        )]

        chapter_map[ch_id] = {
            'chapter_index': ch.get('chapter_index'),
            'title': ch.get('title'),
            'summary': summary,
            'key_events': ch_events,
            'characters': ch_chars,
            'locations': ch_locations,
            'world_rules': ch_rules,
            'foreshadowing': ch_foreshadowing,
        }
    return chapter_map


def _per_chapter_pass(novel_title, chapters, user_id, novel_id):
    """阶段1：逐章扫描，提取每章的角色、事件、地点、摘要。"""

    chapter_blocks = []
    for ch in chapters:
        chapter_blocks.append(
            f"### 章节 {ch['chapter_index']} | id={ch['id']} | 标题: {ch['title']}\n{ch['content']}"
        )
    chapter_text = "\n\n".join(chapter_blocks)

    prompt = f"""你是一位资深小说编辑。请逐章阅读以下小说，提取每章的详细信息。

# 输出要求
只输出一个合法的 JSON 对象，不要 Markdown 围栏。

# 提取内容
对以下 {len(chapters)} 个章节，**每一章都必须有独立条目**，不可合并、不可遗漏任何一章：

```json
{{
  "chapter_summaries": [
    {{
      "chapter_index": 章节序号(int),
      "chapter_id": 章节id(int),
      "title": "章节标题",
      "summary": "本章完整摘要（至少 100 字，必须包含：本章发生了什么事、谁做了什么、在什么地方、结果是什么）",
      "key_events": [
        {{ "name": "事件名", "summary": "详细描述（至少 50 字）", "chapter_id": 章节id(int), "characters": ["涉及人物"], "cause": "原因", "effect": "结果" }}
      ],
      "characters": ["本章新出场或重点描写的角色名"],
      "locations": ["本章出现的地点"]
    }}
  ],
  "all_characters": [
    {{ "name": "角色名", "identity": "身份/定位", "first_appear_chapter": 首次出场章节id(int), "arc_hint": "从本章能看到的角色弧光线索" }}
  ],
  "world_rules": [
    {{ "rule": "规则", "scope": "适用范围", "source_refs": [{{"chapter_id": 章节id(int), "excerpt_preview": "原文关键句"}}] }}
  ]
}}
```

# 硬性要求
1. **绝对不能漏章**：下面列出了 {len(chapters)} 个章节，你必须在 chapter_summaries 里对应输出 {len(chapters)} 条，每条 chapter_id 必须对得上。
2. 每章的 summary **至少 100 字**。
3. 每章 key_events **至少 2 条**（如果该章确实有事件发生）。事件 ID 不能全是第一章。
4. all_characters 必须包含在 **任意一章出场 2 次以上** 的所有角色。
5. world_rules 必须包含小说中提到的任何特殊规则（游戏规则、世界观设定等）。

# 小说标题
《{novel_title}》

# 小说全文（{len(chapters)} 章）
{chapter_text}

请直接输出 JSON："""

    success, text_or_err, response_summary = call_ai(prompt, timeout=180)
    log_ai_call(user_id, novel_id, status='success' if success else 'failed',
                request_summary=f'per_chapter_pass chapter_count={len(chapters)} prompt_len={len(prompt)}',
                response_summary=response_summary,
                error_message=None if success else text_or_err)
    if not success:
        return None
    result = parse_ai_response(text_or_err)
    summaries = result.get('chapter_summaries') or []
    if len(summaries) < len(chapters):
        # AI 漏章了——不致命但记录一下
        result['_per_chapter_warning'] = f'AI only returned {len(summaries)}/{len(chapters)} chapter summaries'
    return result


def _global_synthesis_pass(novel_title, chapters, per_chapter_result, user_id, novel_id):
    """阶段2：基于逐章明细，合成全局故事骨干 25 字段。"""

    chapter_summaries = per_chapter_result.get('chapter_summaries') or []
    summaries_text = []
    for s in chapter_summaries:
        events_text = '；'.join(e.get('summary', '') for e in (s.get('key_events') or []))
        chars_text = '、'.join(s.get('characters') or [])
        locs_text = '、'.join(s.get('locations') or [])
        summaries_text.append(
            f"第{s.get('chapter_index')}章 | id={s.get('chapter_id')} | {s.get('title')}\n"
            f"  摘要: {s.get('summary')}\n"
            f"  事件: {events_text}\n"
            f"  角色: {chars_text}\n"
            f"  地点: {locs_text}"
        )
    all_chars = per_chapter_result.get('all_characters') or []
    chars_text = '\n'.join(
        f"- {c.get('name')}: {c.get('identity')} (首次出场章id={c.get('first_appear_chapter')})"
        for c in all_chars
    )
    world_rules = per_chapter_result.get('world_rules') or []
    rules_text = '\n'.join(f"- {r.get('rule')}: {r.get('scope')}" for r in world_rules)

    prompt = f"""你是一位资深的小说改编顾问。你的团队已经完成了逐章扫描，现在请你基于这些扫描结果，合成一份完整的「故事骨干 JSON 中间层」，用于后续生成 YAML 剧本草稿。

# 已知信息（逐章扫描结果）

## 章节摘要
{chr(10).join(summaries_text)}

## 全部角色
{chars_text}

## 世界观规则
{rules_text}

# 你需要输出的 25 字段 JSON（必须全部包含）

只输出一个合法 JSON 对象，不要 Markdown 围栏。

每个字段语义：
- core_story: {{ "protagonist": "", "goal": "", "obstacle": "", "cost": "", "irreversible_change": "", "summary": "" }}
- story_overview: {{ "summary": "" }} — 对全书的整体概括（至少 150 字）
- chapter_summaries: 数组 — **直接复用已知信息中的章节摘要**，不要重写
- characters: 数组 — **基于已知信息中的全部角色，为每个角色补充以下字段**：story_function（在故事中的作用）、surface_goal（表面目标）、deep_need（深层需求）、fatal_flaw（致命缺陷）、arc（角色弧光）、key_relations（与其他角色的关键关系列表）
- relationships: 数组，每项 {{ "from": "", "to": "", "type": "朋友/师徒/情侣/父子/仇敌/同盟/利用/救赎", "evolution": "", "debt_or_secret": "", "source_refs": [] }}
- locations: 数组，每项 {{ "name": "", "description": "", "appears_in_chapters": [], "dramatic_role": "", "suitable_as_scene": true, "source_refs": [] }}
- key_events: 数组 — **直接复用已知信息中每章的事件，为每个事件补充**：impact_on_main（对主线的影响）、suitable_as_scene（是否适合改编为场景）
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
- world_rules: 数组 — **直接复用已知信息中的世界观规则**
- factions: 数组，每项 {{ "name": "", "goal": "", "members": [], "relations_with_others": [] }}
- uncertain_items: 数组，每项 {{ "type": "", "content": "", "reason": "", "source_refs": [] }}

# 硬性要求
1. chapter_summaries / key_events / characters / world_rules **必须基于已知信息**，不要重新生成（否则会丢数据）。
2. 每个角色（all_characters 里列出的）**都必须**在 characters 数组中有完整条目（至少填 name / identity / story_function / surface_goal）。
3. **禁止编造原文没有的情节**。不确定的内容放进 uncertain_items。
4. story_overview 至少 150 字。
5. structure_outline 基于当前已知事件填写，未发生的留空字符串。
6. 全部用中文输出。

# 小说标题
《{novel_title}》

请直接输出 JSON："""

    success, text_or_err, response_summary = call_ai(prompt, timeout=180)
    log_ai_call(user_id, novel_id, status='success' if success else 'failed',
                request_summary=f'global_synthesis chapter_count={len(chapters)} prompt_len={len(prompt)}',
                response_summary=response_summary,
                error_message=None if success else text_or_err)
    if not success:
        return None
    result = parse_ai_response(text_or_err)
    # 把阶段1的逐章明细合并回去，确保不丢数据
    result['chapter_summaries'] = chapter_summaries
    per_chars = per_chapter_result.get('all_characters') or []
    existing_chars = result.get('characters') or []
    existing_names = {c.get('name', '') for c in existing_chars}
    for pc in per_chars:
        if pc.get('name', '') not in existing_names:
            existing_chars.append({
                'name': pc.get('name', ''),
                'identity': pc.get('identity', ''),
                'story_function': '',
                'surface_goal': '',
                'deep_need': '',
                'fatal_flaw': '',
                'arc': pc.get('arc_hint', ''),
                'key_relations': [],
                'source_refs': [],
            })
    result['characters'] = existing_chars
    per_rules = per_chapter_result.get('world_rules') or []
    if per_rules:
        existing_rules = result.get('world_rules') or []
        rule_texts = {r.get('rule', '') for r in existing_rules}
        for r in per_rules:
            if r.get('rule', '') not in rule_texts:
                existing_rules.append(r)
        result['world_rules'] = existing_rules
    return result


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


def _chapter_extractions_table_available():
    """检测 chapter_extractions 表是否存在。不存在时静默回退。"""
    try:
        db = get_db()
        db.table('chapter_extractions').select('id', count='exact').limit(0).execute()
        return True
    except Exception:
        return False


def _summary_text_overlap(event_text, summary_text, min_words=3):
    """检查事件描述与章节摘要文本是否有显著重合（用于无 chapter_id 字段的兜底匹配）。

    匹配策略：从 event_text 中取 2-3 个核心 token（人名/物体名），如果都在 summary_text 中出现，
    则认为该事件属于本章。token 是长度 >= 2 的连续汉字。
    """
    if not event_text or not summary_text:
        return False
    if not isinstance(event_text, str) or not isinstance(summary_text, str):
        return False
    import re as _re
    # 抽取所有连续汉字片段
    tokens = _re.findall(r'[一-鿿]{2,}', event_text)
    if len(tokens) < min_words:
        return False
    # 去重 + 限长
    tokens = list(dict.fromkeys(tokens))[:20]
    hits = sum(1 for t in tokens if len(t) >= 2 and t in summary_text)
    # 命中率 >= 30% 且至少 3 个 token 命中 → 认为匹配
    return hits >= max(min_words, int(len(tokens) * 0.3))


def derive_chapter_extraction_from_novel(novel_id, user_id, chapter):
    """从小说整体提炼中拆分出当前章节相关内容。不调用 AI。

    返回 (extraction_json, source_description)：
        extraction_json: 章节级提炼 JSON dict
        source_description: 'from_novel_extraction' 或 None
    如果无法提取则返回 (None, None)。
    """
    novel_ext = get_extraction(novel_id, user_id)
    if not novel_ext:
        return None, None

    # 优先用用户修改版，再回退到 AI 版
    # 但如果 user_result_json 只有 _chapter_overrides 等内部键（没有实际提炼字段），
    # 则跳过它直接用 ai_result_json。
    raw_user = _ensure_dict(novel_ext.get('user_result_json'))
    raw_ai = _ensure_dict(novel_ext.get('ai_result_json'))

    source_json = None
    if isinstance(raw_user, dict):
        real_keys = [k for k in raw_user if not k.startswith('_')]
        if real_keys:
            source_json = raw_user
    if source_json is None and isinstance(raw_ai, dict):
        source_json = raw_ai
    if source_json is None:
        return None, None

    ch_id = chapter['id']
    ch_index = chapter.get('chapter_index')
    ch_title = (chapter.get('title') or '').strip()

    if not ch_title and ch_index is None:
        return None, None

    import re as _re

    # 从章节标题中提取数字：如 "第一章 空屋" → 1、"第三章 有技术的人" → 3
    _ch_num_from_title = None
    if ch_title:
        m = _re.search(r'第\s*([零一二三四五六七八九十百千\d]+)\s*章', ch_title)
        if m:
            try:
                _ch_num_from_title = int(m.group(1))
            except ValueError:
                _cn = {'零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}
                s = m.group(1)
                if s in _cn:
                    _ch_num_from_title = _cn[s]

    def _text_mentions_chapter(text):
        """检查文本是否提到了当前章节。"""
        if not isinstance(text, str) or not text.strip():
            return False
        # 精确匹配章节标题
        if ch_title and ch_title in text:
            return True
        # 匹配 "第N章" 模式
        if ch_index is not None:
            patterns = [
                f'第{ch_index}章', f'第 {ch_index} 章',
                f'第{ch_index}章', f'第 {ch_index} 章',
            ]
            for p in patterns:
                if p in text:
                    return True
        if _ch_num_from_title is not None:
            for p in [f'第{_ch_num_from_title}章', f'第 {_ch_num_from_title} 章']:
                if p in text:
                    return True
        return False

    def _matches_chapter(item):
        """判断一个 item 是否属于当前章节。"""
        if isinstance(item, dict):
            # 直接字段匹配
            for k in ('chapter_id', 'chapterId', 'source_chapter_id', 'sourceChapterId'):
                if item.get(k) == ch_id:
                    return True
            for k in ('chapter_index', 'chapterIndex', 'source_chapter_index'):
                if item.get(k) == ch_index:
                    return True
            for k in ('chapter_title', 'chapterTitle', 'source_chapter_title', 'title'):
                v = (item.get(k) or '').strip()
                if v and ch_title and v == ch_title:
                    return True
            # timestamp / appears_in_chapter 等文本字段
            for k in ('timestamp', 'appears_in_chapter', 'setup_chapter_name', 'payoff_chapter_name'):
                if _text_mentions_chapter(item.get(k) or ''):
                    return True
            # source_refs 匹配
            refs = item.get('source_refs') or []
            for ref in refs:
                if isinstance(ref, dict):
                    if ref.get('chapter_id') == ch_id:
                        return True
                    if (ref.get('chapter_title') or '').strip() == ch_title:
                        return True
                    if _text_mentions_chapter(ref.get('excerpt_preview') or ''):
                        return True
                elif isinstance(ref, str):
                    if _text_mentions_chapter(ref):
                        return True
            # 字符串数组字段
            for k in ('appears_in_chapters', 'setup_chapters', 'payoff_chapters'):
                vals = item.get(k) or []
                for v in vals:
                    if isinstance(v, (int, float)) and int(v) == ch_index:
                        return True
                    if isinstance(v, str) and _text_mentions_chapter(v):
                        return True
        return False

    def _filter_list(items):
        if not isinstance(items, list):
            return []
        return [item for item in items if _matches_chapter(item)]

    # 构建章节级提炼
    chapter_summaries = source_json.get('chapter_summaries') or []
    ch_summary = next((s for s in chapter_summaries if _matches_chapter(s)), None)

    # 从 chapter_summary 内嵌字段提取本章细节
    embedded_key_events = []
    embedded_character_names = []
    embedded_location_names = []
    summary_text_for_content_match = ''
    if isinstance(ch_summary, dict):
        # key_events 内嵌：可能是对象数组（有 name/summary）也可能是字符串数组
        for ev in (ch_summary.get('key_events') or []):
            if isinstance(ev, dict):
                embedded_key_events.append(ev)
            elif isinstance(ev, str):
                embedded_key_events.append({'event': ev})
        # characters 内嵌：通常是字符串数组（角色名）
        for c in (ch_summary.get('characters') or []):
            if isinstance(c, str):
                embedded_character_names.append(c.strip())
            elif isinstance(c, dict) and c.get('name'):
                embedded_character_names.append(c['name'].strip())
        # locations 内嵌
        for loc in (ch_summary.get('locations') or []):
            if isinstance(loc, str):
                embedded_location_names.append(loc.strip())
            elif isinstance(loc, dict) and loc.get('name'):
                embedded_location_names.append(loc['name'].strip())
        # 用于 content-based matching 的本章摘要文本
        summary_text_for_content_match = (ch_summary.get('summary') or '') + ' ' + ch_summary.get('title', '')
        for ev in embedded_key_events:
            if isinstance(ev, dict):
                summary_text_for_content_match += ' ' + (ev.get('event') or '') + ' ' + (ev.get('summary') or '') + ' ' + (ev.get('name') or '')

    def _content_mentions_text(text_to_find):
        """检查本章摘要文本是否提到某个事件/角色名。"""
        if not text_to_find or not summary_text_for_content_match:
            return False
        if isinstance(text_to_find, str) and len(text_to_find.strip()) >= 2:
            return text_to_find.strip() in summary_text_for_content_match
        return False

    # === 顶层数组按规则过滤 ===
    filtered_key_events = _filter_list(source_json.get('key_events'))
    filtered_characters = _filter_list(source_json.get('characters'))
    filtered_locations = _filter_list(source_json.get('locations'))

    # === 内嵌字段合并到对应数组（去重）===

    # 合并 embedded key_events（来自 chapter_summary 的 key_events）
    existing_event_names = {(e.get('event') or e.get('name') or e.get('summary') or '')[:30]
                            for e in filtered_key_events}
    for ev in embedded_key_events:
        if not isinstance(ev, dict):
            continue
        ev_key = (ev.get('event') or ev.get('name') or ev.get('summary') or '')[:30]
        if ev_key and ev_key not in existing_event_names:
            filtered_key_events.append(ev)
            existing_event_names.add(ev_key)

    # === 内容匹配兜底：用顶层 characters/key_events 在本章摘要里搜名字 ===

    # 顶层 characters 没有 source_refs 时，用本章 embedded character names 去匹配
    if embedded_character_names:
        existing_char_names = {(c.get('name') or '').strip() for c in filtered_characters if isinstance(c, dict)}
        for c in (source_json.get('characters') or []):
            if not isinstance(c, dict):
                continue
            name = (c.get('name') or '').strip()
            if not name or name in existing_char_names:
                continue
            if name in embedded_character_names or _content_mentions_text(name):
                filtered_characters.append(c)
                existing_char_names.add(name)
        # 如果 embedded 中有但顶层 characters 没收录的，补字符串条目
        for name in embedded_character_names:
            if name not in existing_char_names:
                filtered_characters.append({'name': name, 'identity': '', 'story_function': '来自本章摘要'})
                existing_char_names.add(name)

    # 顶层 key_events 没有 chapter_id 时，用本章摘要文本搜事件描述
    existing_event_summaries = {(e.get('event') or e.get('summary') or '')[:50]
                                for e in filtered_key_events}
    for ev in (source_json.get('key_events') or []):
        if not isinstance(ev, dict):
            continue
        ev_text = (ev.get('event') or '') + ' ' + (ev.get('summary') or '') + ' ' + (ev.get('name') or '')
        ev_key = (ev.get('event') or ev.get('summary') or '')[:50]
        if ev_key in existing_event_summaries:
            continue
        # 与本章摘要文本有显著重合
        if _summary_text_overlap(ev_text, summary_text_for_content_match):
            filtered_key_events.append(ev)
            existing_event_summaries.add(ev_key)

    # locations 兜底
    if embedded_location_names:
        existing_location_names = {(l.get('name') or '').strip() for l in filtered_locations if isinstance(l, dict)}
        for l in (source_json.get('locations') or []):
            if not isinstance(l, dict):
                continue
            name = (l.get('name') or '').strip()
            if name and name not in existing_location_names and name in embedded_location_names:
                filtered_locations.append(l)
                existing_location_names.add(name)
        for name in embedded_location_names:
            if name and name not in existing_location_names:
                filtered_locations.append({'name': name, 'description': '来自本章摘要'})
                existing_location_names.add(name)

    result = {
        'chapter_index': ch_index,
        'chapter_id': ch_id,
        'title': ch_title,
        'chapter_summary': ch_summary or {},
        'key_events': filtered_key_events,
        'characters': filtered_characters,
        'locations': filtered_locations,
        'dramatic_conflicts': _filter_list(source_json.get('dramatic_conflicts')),
        'high_value_scenes': _filter_list(source_json.get('high_value_scenes')),
        'foreshadowing': _filter_list(source_json.get('foreshadowing')),
        'visual_motifs': _filter_list(source_json.get('visual_motifs')),
        'dialogue_candidates': _filter_list(source_json.get('dialogue_candidates')),
        'inner_externalization': _filter_list(source_json.get('inner_externalization')),
        'world_rules': _filter_list(source_json.get('world_rules')),
        'uncertain_items': _filter_list(source_json.get('uncertain_items')),
        'causal_chain': _filter_list(source_json.get('causal_chain')),
        'information_reveal': _filter_list(source_json.get('information_reveal')),
        'theme_questions': _filter_list(source_json.get('theme_questions')),
        'cut_and_merge_suggestions': _filter_list(source_json.get('cut_and_merge_suggestions')),
        'adaptation_risks': _filter_list(source_json.get('adaptation_risks')),
        'factions': _filter_list(source_json.get('factions')),
        'relationships': _filter_list(source_json.get('relationships')),
        '_source': 'from_novel_extraction',
    }

    # 检查是否有任何非空内容
    has_content = False
    for key, val in result.items():
        if key.startswith('_') or key in ('chapter_index', 'chapter_id', 'title'):
            continue
        if isinstance(val, dict) and val:
            has_content = True
            break
        if isinstance(val, list) and len(val) > 0:
            has_content = True
            break

    if not has_content:
        return None, None

    return result, 'from_novel_extraction'


def get_chapter_extraction(chapter_id, user_id):
    if not _chapter_extractions_table_available():
        # 表不存在时从 novel_extractions.user_result_json._chapter_overrides 读取
        # 需要先查 chapter 所属的 novel_id
        try:
            db = get_db()
            ch = db.table('chapters').select('id, novel_id').eq('id', chapter_id).eq('user_id', user_id).execute()
            if not ch.data:
                return None
            return _read_chapter_from_novel_fallback(chapter_id, user_id, ch.data[0]['novel_id'])
        except Exception:
            traceback.print_exc()
            return None
    try:
        db = get_db()
        result = db.table('chapter_extractions').select(
            'id, chapter_id, user_id, novel_id, extraction_json, status, updated_at'
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
    if not _chapter_extractions_table_available():
        # 表不存在时回退到 novel_extractions.user_result_json._chapter_overrides
        return _save_chapter_to_novel_fallback(chapter_id, user_id, novel_id, extraction_json)
    db = get_db()
    now = datetime.now().isoformat()
    existing = get_chapter_extraction(chapter_id, user_id)
    if existing:
        db.table('chapter_extractions').update({
            'extraction_json': extraction_json,
            'status': 'extracted',
            'updated_at': now,
        }).eq('id', existing['id']).execute()
        return existing['id']
    result = db.table('chapter_extractions').insert({
        'chapter_id': chapter_id,
        'user_id': user_id,
        'novel_id': novel_id,
        'extraction_json': extraction_json,
        'status': 'extracted',
        'updated_at': now,
    }).execute()
    return result.data[0]['id']


def _save_chapter_to_novel_fallback(chapter_id, user_id, novel_id, extraction_json):
    """chapter_extractions 表不存在时，把章节提炼存到 novel_extractions.user_result_json._chapter_overrides 下。"""
    db = get_db()
    novel_ext = get_extraction(novel_id, user_id)
    if not novel_ext:
        # 没有 novel_extractions 行，无处存储
        return None
    user_result = novel_ext.get('user_result_json') or {}
    if isinstance(user_result, str):
        try:
            user_result = json.loads(user_result)
        except Exception:
            user_result = {}
    if not isinstance(user_result, dict):
        user_result = {}
    overrides = user_result.get('_chapter_overrides') or {}
    if not isinstance(overrides, dict):
        overrides = {}
    overrides[str(chapter_id)] = extraction_json
    user_result['_chapter_overrides'] = overrides
    now = datetime.now().isoformat()
    db.table('novel_extractions').update({
        'user_result_json': user_result,
        'updated_at': now,
    }).eq('id', novel_ext['id']).execute()
    return f'fallback:{chapter_id}'


def _read_chapter_from_novel_fallback(chapter_id, user_id, novel_id):
    """从 novel_extractions.user_result_json._chapter_overrides 中读取章节提炼。"""
    novel_ext = get_extraction(novel_id, user_id)
    if not novel_ext:
        return None
    user_result = novel_ext.get('user_result_json') or {}
    if isinstance(user_result, str):
        try:
            user_result = json.loads(user_result)
        except Exception:
            user_result = {}
    if not isinstance(user_result, dict):
        return None
    overrides = user_result.get('_chapter_overrides') or {}
    if not isinstance(overrides, dict):
        return None
    ext_json = overrides.get(str(chapter_id))
    if not ext_json:
        return None
    return {
        'id': f'fallback:{chapter_id}',
        'chapter_id': chapter_id,
        'user_id': user_id,
        'novel_id': novel_id,
        'extraction_json': _ensure_dict(ext_json),
        'status': 'extracted',
        'updated_at': novel_ext.get('updated_at'),
    }


def save_chapter_extractions_batch(novel_id, user_id, chapter_extraction_map):
    """批量保存章节提炼：{chapter_id: extraction_json}。表不存在时落回 novel_extractions 兜底。"""
    for chapter_id, extraction_json in (chapter_extraction_map or {}).items():
        try:
            save_chapter_extraction(chapter_id, user_id, novel_id, extraction_json)
        except Exception:
            traceback.print_exc()
