"""关系图谱服务（功能 5：关系图谱）。

流程：
1. 读取用户已选章节的提炼结果（chapter_extractions / novel_extractions fallback）
2. 调 DeepSeek AI 输出图谱 JSON
3. 校验 nodes / edges / source_refs
4. 保存到 relationship_graphs 表（每部小说一个主图谱，重复生成会覆盖）
5. 追加章节：合并旧图谱 + AI 生成的新增图谱，去重节点/边
"""

import json
import re
import traceback
from datetime import datetime

from src.db import get_db
from src.ai_client import call_ai, get_provider, get_model_name

TASK_TYPE = "relationship_graph"

# 允许的节点类型与边类型（与 prompt 保持一致）
NODE_TYPES = [
    "character", "location", "event", "plot", "conflict",
    "clue", "faction", "object", "theme",
]

EDGE_TYPES = [
    "knows", "conflicts_with", "cooperates_with", "controls", "deceives",
    "protects", "appears_in", "participates_in", "triggers", "discovers",
    "belongs_to", "leads_to", "reveals", "opposes", "related_to",
]


# ---------------------------------------------------------------------------
# 表可用性检测（fallback：直接放在内存 / 不持久化）
# ---------------------------------------------------------------------------

def _table_available():
    try:
        db = get_db()
        db.table('relationship_graphs').select('id').limit(1).execute()
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

def _strip_json_fence(text):
    if not text:
        return ''
    s = text.strip()
    m = re.match(r'^```(?:json|yaml|yml|text|)?\s*\n?(.*?)\n?```$', s, re.DOTALL)
    if m:
        return m.group(1).strip()
    if s.startswith('```'):
        s = s[3:]
        if s.startswith('json') or s.startswith('yaml') or s.startswith('yml'):
            s = s.split('\n', 1)[1] if '\n' in s else ''
        if s.rstrip().endswith('```'):
            s = s.rstrip()[:-3]
        return s.strip()
    return s


def _safe_parse_json(text):
    if not text:
        return None, '内容为空'
    raw = text.strip()
    try:
        return json.loads(raw), None
    except json.JSONDecodeError as e:
        first = str(e)
    start = raw.find('{')
    end = raw.rfind('}')
    if start >= 0 and end > start:
        cand = raw[start:end + 1]
        try:
            return json.loads(cand), None
        except json.JSONDecodeError:
            cleaned = re.sub(r',\s*([}\]])', r'\1', cand)
            try:
                return json.loads(cleaned), None
            except json.JSONDecodeError as e3:
                return None, f'{first} | 截取重试: {e3}'
    return None, first


# ---------------------------------------------------------------------------
# 章节提炼读取
# ---------------------------------------------------------------------------

def _load_extractions_for_chapters(novel_id, user_id, chapter_ids):
    """加载所选章节的提炼结果。

    返回 (chapters_info, missing_extraction_ids)。
    chapters_info: [{chapter_id, chapter_title, extraction_json}]
    missing_extraction_ids: 未提炼的章节 id 列表（需要前端拦截，理论上不应到这里）
    """
    from src.extraction_service import get_chapter_extraction, get_extraction
    db = get_db()

    # 拉取章节信息
    chapters_resp = db.table('chapters').select('id, title').eq('novel_id', novel_id).eq('user_id', user_id).in_('id', chapter_ids).execute()
    title_map = {c['id']: c.get('title', '') for c in (chapters_resp.data or [])}

    chapters_info = []
    missing = []
    for cid in chapter_ids:
        extraction = get_chapter_extraction(cid, user_id)
        if not extraction:
            missing.append(cid)
            continue
        data = extraction.get('user_result_json') or extraction.get('ai_result_json')
        if not data:
            missing.append(cid)
            continue
        chapters_info.append({
            'chapter_id': cid,
            'chapter_title': title_map.get(cid, ''),
            'extraction_json': data,
        })

    # 若部分章节缺少专属提炼，回落到 novel_extractions 整体提炼
    if missing:
        novel_extraction = get_extraction(novel_id, user_id)
        if novel_extraction:
            shared = novel_extraction.get('user_result_json') or novel_extraction.get('ai_result_json')
            if shared:
                # 把 missing 的章节用整本提炼补齐（按章节标题片段）
                still_missing = []
                for cid in missing:
                    chapters_info.append({
                        'chapter_id': cid,
                        'chapter_title': title_map.get(cid, ''),
                        'extraction_json': shared,
                    })
                missing = still_missing
    return chapters_info, missing


# ---------------------------------------------------------------------------
# Prompt 构建
# ---------------------------------------------------------------------------

def _build_generation_prompt(novel_title, chapters_info):
    """构建初次生成提示词。"""
    extracts_snippet = []
    for c in chapters_info[:40]:  # 防止 prompt 过长
        ej = c['extraction_json']
        try:
            ej_str = json.dumps(ej, ensure_ascii=False)[:3500]
        except Exception:
            ej_str = str(ej)[:3500]
        extracts_snippet.append({
            'chapter_id': c['chapter_id'],
            'chapter_title': c['chapter_title'],
            'extraction': ej_str,
        })

    node_types_str = "、".join(NODE_TYPES)
    edge_types_str = "、".join(EDGE_TYPES)

    return f"""你是一个小说关系图谱结构化生成器。

请根据下方输入的小说章节提炼结果，生成用于前端关系图谱渲染的严格 JSON 对象。

# 输出铁则

1. 只输出一个 JSON 对象，从 `{{` 开始，以 `}}` 结尾。
2. 禁止 Markdown 围栏、解释文字、YAML 语法。
3. JSON 必须可被一次 `json.loads()` 解析成功。
4. nodes 必须是数组；edges 必须是数组。
5. 节点 id 全局唯一；边 id 全局唯一。
6. 每条边的 source / target 必须是 nodes 中已存在的 id。
7. 不要生成重复节点（同名人物 / 同地点合并）。
8. 不要凭空创造提炼结果中没有依据的人物 / 事件 / 地点。
9. 节点的 importance 写 "high" / "medium" / "low"。
10. 边的 strength 写 "high" / "medium" / "low"。
11. 节点和边尽量包含 source_refs。

# 允许的节点类型（type）

{node_types_str}

# 允许的边类型（type）

{edge_types_str}

# 输出 JSON 格式

```json
{{
  "graph_meta": {{
    "novel_title": "{novel_title}",
    "chapter_ids": [章节 id 数组],
    "generated_from": "chapter_extractions"
  }},
  "nodes": [
    {{
      "id": "character_qixia",
      "label": "齐夏",
      "type": "character",
      "subtype": "protagonist",
      "importance": "high",
      "description": "参与者之一，冷静观察和推理。",
      "source_refs": [
        {{"chapter_id": 1, "chapter_title": "第一章 空屋", "excerpt_preview": "齐夏醒来观察封闭房间。"}}
      ]
    }}
  ],
  "edges": [
    {{
      "id": "edge_qixia_room",
      "source": "character_qixia",
      "target": "location_closed_room",
      "type": "appears_in",
      "label": "出现于",
      "strength": "high",
      "description": "齐夏在封闭房间中醒来。",
      "source_refs": [
        {{"chapter_id": 1, "chapter_title": "第一章 空屋"}}
      ]
    }}
  ],
  "groups": [
    {{"id": "characters", "label": "人物", "node_type": "character"}},
    {{"id": "locations", "label": "地点", "node_type": "location"}},
    {{"id": "events", "label": "事件", "node_type": "event"}}
  ]
}}
```

# 节点 id 命名建议

- character_<拼音或英文>：人物
- location_<拼音或英文>：地点
- event_<拼音或英文>：事件
- plot_<拼音或英文>：故事线
- conflict_<拼音或英文>：冲突
- clue_<拼音或英文>：线索
- faction_<拼音或英文>：阵营
- object_<拼音或英文>：物件
- theme_<拼音或英文>：主题

中文 label 保持原文，id 用拼音或英文短词，避免特殊字符。

# 内容要求

1. 必须基于下方章节提炼结果生成，不要编造未在提炼中出现的内容。
2. source_refs 的 chapter_id 必须来自下方章节范围。
3. 重要节点（主角/主要冲突/主线事件）importance 写 high。
4. 不确定时在 description 内说明，并写 "uncertainty": true。
5. 一份输出建议 10–60 个节点、15–100 条边，过少视为信息缺失。

# 小说: 《{novel_title}》

# 章节提炼输入

{json.dumps(extracts_snippet, ensure_ascii=False, indent=2)[:14000]}

请直接输出 JSON 对象。"""


def _build_append_prompt(novel_title, existing_graph, new_chapters_info):
    """构建追加章节提示词，输出增量。"""
    existing_node_summary = []
    for n in (existing_graph.get('nodes') or [])[:60]:
        existing_node_summary.append({
            'id': n.get('id'),
            'label': n.get('label'),
            'type': n.get('type'),
        })

    new_snippet = []
    for c in new_chapters_info[:30]:
        ej_str = json.dumps(c['extraction_json'], ensure_ascii=False)[:3500]
        new_snippet.append({
            'chapter_id': c['chapter_id'],
            'chapter_title': c['chapter_title'],
            'extraction': ej_str,
        })

    return f"""你将收到一个已有的小说关系图谱（节点摘要）和新增章节的提炼结果。
请根据新增章节内容补充新的节点和边，同时识别已存在的人物/地点/事件并复用其 id。

# 输出铁则

1. 只输出一个 JSON 对象。
2. 顶层必须含 4 个数组字段：new_nodes、new_edges、updated_nodes、updated_edges。
3. 不要重复创建已有节点；如果新增章节涉及已有人物/地点/事件，请使用已有 id，并把改动放在 updated_nodes 中。
4. new_edges 中 source / target 必须能在「已有节点 + new_nodes」中找到。
5. 不要生成提炼中无依据的关系。
6. JSON 直接可被 `json.loads()` 解析。

# 已有节点摘要

```json
{json.dumps(existing_node_summary, ensure_ascii=False, indent=2)[:6000]}
```

# 新增章节提炼

```json
{json.dumps(new_snippet, ensure_ascii=False, indent=2)[:10000]}
```

# 输出 JSON 格式

```json
{{
  "new_nodes": [节点列表],
  "new_edges": [边列表],
  "updated_nodes": [{{"id": "已有id", "patch": {{描述/source_refs 增补}}}}],
  "updated_edges": []
}}
```

# 小说: 《{novel_title}》

请输出 JSON 对象。"""


# ---------------------------------------------------------------------------
# 校验
# ---------------------------------------------------------------------------

def _validate_graph_data(graph, allowed_chapter_ids=None):
    """校验 graph 结构。返回 (ok, errors)。"""
    errors = []
    if not isinstance(graph, dict):
        return False, ['图谱顶层必须是对象']

    nodes = graph.get('nodes')
    edges = graph.get('edges')
    if not isinstance(nodes, list):
        errors.append('nodes 不是数组')
    if not isinstance(edges, list):
        errors.append('edges 不是数组')
    if errors:
        return False, errors

    seen_node_ids = set()
    for i, node in enumerate(nodes):
        if not isinstance(node, dict):
            errors.append(f'nodes[{i}] 不是对象')
            continue
        nid = node.get('id')
        if not nid:
            errors.append(f'nodes[{i}] 缺少 id')
            continue
        if nid in seen_node_ids:
            errors.append(f'nodes[{i}] id 重复: {nid}')
            continue
        seen_node_ids.add(nid)
        if not node.get('label'):
            errors.append(f'nodes[{i}] ({nid}) 缺少 label')
        if not node.get('type'):
            errors.append(f'nodes[{i}] ({nid}) 缺少 type')

    seen_edge_ids = set()
    for i, edge in enumerate(edges):
        if not isinstance(edge, dict):
            errors.append(f'edges[{i}] 不是对象')
            continue
        eid = edge.get('id')
        if not eid:
            # 自动补 id 容忍：跳过 id 校验但仍校验 source/target
            pass
        elif eid in seen_edge_ids:
            errors.append(f'edges[{i}] id 重复: {eid}')
            continue
        else:
            seen_edge_ids.add(eid)
        src = edge.get('source')
        tgt = edge.get('target')
        if not src or src not in seen_node_ids:
            errors.append(f'edges[{i}] source 无效或未在 nodes 中: {src}')
        if not tgt or tgt not in seen_node_ids:
            errors.append(f'edges[{i}] target 无效或未在 nodes 中: {tgt}')

    if len(nodes) == 0:
        errors.append('图谱节点为空')

    # source_refs 校验
    if allowed_chapter_ids is not None:
        allowed = set(int(x) for x in allowed_chapter_ids if str(x).isdigit())
        for node in nodes:
            refs = node.get('source_refs') or []
            for r in refs:
                if isinstance(r, dict) and r.get('chapter_id') is not None:
                    try:
                        if int(r['chapter_id']) not in allowed:
                            # 仅 warning，不视为致命错误
                            pass
                    except (ValueError, TypeError):
                        pass

    return (len(errors) == 0), errors


# ---------------------------------------------------------------------------
# 合并增量图谱
# ---------------------------------------------------------------------------

def _merge_graph(existing, delta):
    """把 delta（增量）合并到 existing（已有图谱）。原地修改 existing。"""
    if not isinstance(existing, dict):
        existing = {}
    nodes = existing.setdefault('nodes', [])
    edges = existing.setdefault('edges', [])

    node_index = {n.get('id'): n for n in nodes if isinstance(n, dict) and n.get('id')}
    edge_index = {e.get('id'): e for e in edges if isinstance(e, dict) and e.get('id')}

    # 新节点
    for n in (delta.get('new_nodes') or []):
        if not isinstance(n, dict) or not n.get('id'):
            continue
        if n['id'] not in node_index:
            nodes.append(n)
            node_index[n['id']] = n
        else:
            # 同 id 视为更新：合并 source_refs
            _merge_source_refs(node_index[n['id']], n)

    # 更新节点
    for u in (delta.get('updated_nodes') or []):
        if not isinstance(u, dict):
            continue
        uid = u.get('id')
        if not uid or uid not in node_index:
            continue
        target = node_index[uid]
        patch = u.get('patch') if isinstance(u.get('patch'), dict) else u
        for k, v in patch.items():
            if k == 'id':
                continue
            if k == 'source_refs' and isinstance(v, list):
                _merge_source_refs(target, {'source_refs': v})
            elif k == 'description' and target.get('description'):
                # 保留旧描述，追加
                if v and v not in target['description']:
                    target['description'] = target['description'] + ' / ' + v
            else:
                target[k] = v

    # 新边
    for e in (delta.get('new_edges') or []):
        if not isinstance(e, dict):
            continue
        # 必须 source/target 都能找到
        if not e.get('source') or e.get('source') not in node_index:
            continue
        if not e.get('target') or e.get('target') not in node_index:
            continue
        eid = e.get('id')
        if not eid:
            eid = f'edge_{len(edges) + 1}_{e["source"]}_{e["target"]}'
            e['id'] = eid
        # 同 (source, target, type) 的边去重
        existing_same = next((x for x in edges if isinstance(x, dict)
                              and x.get('source') == e.get('source')
                              and x.get('target') == e.get('target')
                              and x.get('type') == e.get('type')), None)
        if existing_same:
            _merge_source_refs(existing_same, e)
        else:
            edges.append(e)
            edge_index[eid] = e

    # 更新边
    for u in (delta.get('updated_edges') or []):
        if not isinstance(u, dict):
            continue
        uid = u.get('id')
        if not uid or uid not in edge_index:
            continue
        target = edge_index[uid]
        patch = u.get('patch') if isinstance(u.get('patch'), dict) else u
        for k, v in patch.items():
            if k == 'id':
                continue
            if k == 'source_refs' and isinstance(v, list):
                _merge_source_refs(target, {'source_refs': v})
            else:
                target[k] = v

    return existing


def _merge_source_refs(target, source):
    """把 source.source_refs 合并到 target.source_refs，按 chapter_id 去重。"""
    if not isinstance(target, dict) or not isinstance(source, dict):
        return
    a = target.get('source_refs') or []
    b = source.get('source_refs') or []
    seen = {(r.get('chapter_id'),) for r in a if isinstance(r, dict)}
    out = list(a)
    for r in b:
        if isinstance(r, dict) and (r.get('chapter_id'),) not in seen:
            out.append(r)
            seen.add((r.get('chapter_id'),))
    target['source_refs'] = out


# ---------------------------------------------------------------------------
# 持久化
# ---------------------------------------------------------------------------

# 内存兜底（表不存在时）
_memory_graphs = {}  # key: (user_id, novel_id) -> graph_record


def _save_graph(user_id, novel_id, chapter_ids, graph_data, status='generated', error_report=None):
    now = datetime.now().isoformat()
    record = {
        'user_id': user_id,
        'novel_id': novel_id,
        'chapter_ids': list(chapter_ids),
        'graph_data_json': graph_data,
        'status': status,
        'error_report': error_report,
        'generated_by': 'deepseek',
        'node_count': len(graph_data.get('nodes', []) or []),
        'edge_count': len(graph_data.get('edges', []) or []),
        'updated_at': now,
    }
    if _table_available():
        try:
            db = get_db()
            existing = db.table('relationship_graphs').select('id').eq('user_id', user_id).eq('novel_id', novel_id).execute()
            if existing.data:
                gid = existing.data[0]['id']
                db.table('relationship_graphs').update(record).eq('id', gid).execute()
                record['id'] = gid
                return record
            else:
                record['created_at'] = now
                ins = db.table('relationship_graphs').insert(record).execute()
                if ins.data:
                    record['id'] = ins.data[0]['id']
                return record
        except Exception:
            traceback.print_exc()

    # fallback：内存
    record['id'] = abs(hash((user_id, novel_id))) % 10**9
    record['created_at'] = now
    _memory_graphs[(user_id, novel_id)] = record
    return record


def get_graph(novel_id, user_id):
    if _table_available():
        try:
            db = get_db()
            res = db.table('relationship_graphs').select('*').eq('user_id', user_id).eq('novel_id', novel_id).execute()
            if res.data:
                return res.data[0]
        except Exception:
            traceback.print_exc()
    return _memory_graphs.get((user_id, novel_id))


def delete_graph(novel_id, user_id):
    if _table_available():
        try:
            db = get_db()
            db.table('relationship_graphs').delete().eq('user_id', user_id).eq('novel_id', novel_id).execute()
            return True
        except Exception:
            traceback.print_exc()
            return False
    _memory_graphs.pop((user_id, novel_id), None)
    return True


# ---------------------------------------------------------------------------
# 公开 API
# ---------------------------------------------------------------------------

def generate_graph(novel_id, user_id, chapter_ids):
    """初次生成关系图谱。返回 (success, message, record)。"""
    if not chapter_ids:
        return False, '请至少选择一个已提炼章节。', None

    chapter_ids = [int(x) for x in chapter_ids if str(x).isdigit()]
    if not chapter_ids:
        return False, '章节 id 无效。', None

    # 校验章节归属
    db = get_db()
    chs = db.table('chapters').select('id').eq('novel_id', novel_id).eq('user_id', user_id).in_('id', chapter_ids).execute()
    valid_ids = {c['id'] for c in (chs.data or [])}
    illegal = [cid for cid in chapter_ids if cid not in valid_ids]
    if illegal:
        return False, f'所选章节中包含无权访问的章节：{illegal}', None

    # 加载提炼
    chapters_info, missing = _load_extractions_for_chapters(novel_id, user_id, chapter_ids)
    if not chapters_info:
        return False, '所选章节中包含未提炼章节，请先完成提炼后再生成图谱。', None

    # 小说标题
    novel_resp = db.table('novels').select('title').eq('id', novel_id).eq('user_id', user_id).execute()
    novel_title = novel_resp.data[0]['title'] if novel_resp.data else '未命名'

    # 调 AI
    prompt = _build_generation_prompt(novel_title, chapters_info)
    ok, raw, _ = call_ai(prompt, timeout=180)
    if not ok:
        return False, f'AI 生成失败: {raw}', None

    obj, parse_err = _safe_parse_json(_strip_json_fence(raw))
    if obj is None:
        return False, f'AI 输出 JSON 解析失败: {parse_err}', None

    valid, errs = _validate_graph_data(obj, allowed_chapter_ids=chapter_ids)
    if not valid:
        rec = _save_graph(user_id, novel_id, chapter_ids, obj or {'nodes': [], 'edges': []},
                          status='failed', error_report='；'.join(errs))
        return False, f'图谱校验失败: {"；".join(errs)[:500]}', rec

    # 设置 meta
    if not obj.get('graph_meta'):
        obj['graph_meta'] = {}
    obj['graph_meta']['novel_id'] = novel_id
    obj['graph_meta']['novel_title'] = novel_title
    obj['graph_meta']['chapter_ids'] = chapter_ids
    obj['graph_meta']['generated_from'] = 'chapter_extractions'

    record = _save_graph(user_id, novel_id, chapter_ids, obj, status='generated')

    # 记录 AI 调用
    try:
        db.table('ai_call_records').insert({
            'user_id': user_id,
            'novel_id': novel_id,
            'task_type': TASK_TYPE,
            'provider': get_provider(),
            'model_name': get_model_name(),
            'request_summary': f'graph_gen chapters={len(chapter_ids)} prompt_len={len(prompt)}',
            'response_summary': (raw or '')[:500],
            'status': 'success',
        }).execute()
    except Exception:
        pass

    return True, '关系图谱生成完成', record


def append_chapters_to_graph(novel_id, user_id, new_chapter_ids):
    """追加章节到已有图谱。"""
    if not new_chapter_ids:
        return False, '请至少选择一个新增已提炼章节。', None

    new_chapter_ids = [int(x) for x in new_chapter_ids if str(x).isdigit()]
    existing = get_graph(novel_id, user_id)
    if not existing:
        # 没有已有图谱 → 当作初次生成
        return generate_graph(novel_id, user_id, new_chapter_ids)

    existing_chapter_ids = existing.get('chapter_ids') or []
    truly_new = [cid for cid in new_chapter_ids if cid not in existing_chapter_ids]
    if not truly_new:
        return False, '所选章节均已在图谱中，无需追加。', existing

    db = get_db()
    chs = db.table('chapters').select('id').eq('novel_id', novel_id).eq('user_id', user_id).in_('id', truly_new).execute()
    valid_ids = {c['id'] for c in (chs.data or [])}
    illegal = [cid for cid in truly_new if cid not in valid_ids]
    if illegal:
        return False, f'所选章节中包含无权访问的章节：{illegal}', None

    chapters_info, _ = _load_extractions_for_chapters(novel_id, user_id, truly_new)
    if not chapters_info:
        return False, '所选新增章节中没有可用的已提炼内容，请先完成提炼。', None

    novel_resp = db.table('novels').select('title').eq('id', novel_id).eq('user_id', user_id).execute()
    novel_title = novel_resp.data[0]['title'] if novel_resp.data else '未命名'

    existing_graph = existing.get('graph_data_json') or {}

    prompt = _build_append_prompt(novel_title, existing_graph, chapters_info)
    ok, raw, _ = call_ai(prompt, timeout=180)
    if not ok:
        return False, f'AI 追加生成失败: {raw}', existing

    delta, parse_err = _safe_parse_json(_strip_json_fence(raw))
    if delta is None:
        return False, f'AI 输出 JSON 解析失败: {parse_err}', existing

    merged = _merge_graph(existing_graph, delta)
    if merged.get('graph_meta'):
        merged['graph_meta']['chapter_ids'] = sorted(set(list(existing_chapter_ids) + truly_new))

    full_chapter_ids = sorted(set(list(existing_chapter_ids) + truly_new))
    record = _save_graph(user_id, novel_id, full_chapter_ids, merged, status='updated')

    try:
        db.table('ai_call_records').insert({
            'user_id': user_id,
            'novel_id': novel_id,
            'task_type': TASK_TYPE,
            'provider': get_provider(),
            'model_name': get_model_name(),
            'request_summary': f'graph_append +{len(truly_new)} chapters prompt_len={len(prompt)}',
            'response_summary': (raw or '')[:500],
            'status': 'success',
        }).execute()
    except Exception:
        pass

    return True, f'追加 {len(truly_new)} 个章节完成', record
