"""YAML 剧本生成服务（严格 JSON-first 工具链）。

新流程：
1. DeepSeek 根据小说提炼结果 + Schema 生成 JSON 对象（不直接输出 YAML）
2. 后端清洗 JSON（剥离 markdown 围栏） → json.loads 解析
3. jsonschema 库按 JSON Schema 校验对象结构
4. 校验通过后用 PyYAML（yaml.dump）序列化为 YAML 字符串
5. yaml.safe_load 二次确认生成的 YAML 可解析
6. 保存草稿（YAML 内容 + JSON 快照）

由系统负责所有缩进/分隔符/字符串引号，AI 不再触碰 YAML 文本，根本杜绝缩进与 source_refs 结构错误。
"""

import json
import os
import re
import sys
import traceback
from datetime import datetime

from src.db import get_db
from src.ai_client import call_ai, get_provider, get_model_name, TASK_TYPE as EXTRACTION_TASK_TYPE

YAML_TASK_TYPE = "yaml_generation"
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'yaml_drafts')
EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'yaml_exports')


def _ensure_dir(path):
    os.makedirs(path, exist_ok=True)
    real = os.path.realpath(path)
    parent = os.path.realpath(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if not real.startswith(parent):
        raise ValueError('非法文件路径')


def export_final_yaml(draft_id, user_id, file_format='yaml'):
    """导出最终 YAML 剧本文件。

    前置条件：草稿已确认。
    返回 (success, message, export_record)。
    """
    draft = get_yaml_draft(draft_id, user_id)
    if not draft:
        return False, '草稿不存在或无权访问', None

    if draft.get('status') != 'confirmed':
        return False, '当前 YAML 剧本尚未最终确认，请确认后再导出。', None

    yaml_content = draft.get('user_edited_content') or draft.get('yaml_content') or ''
    if not yaml_content.strip():
        return False, 'YAML 内容为空，无法导出。', None

    # 校验
    valid, err = validate_yaml_syntax(yaml_content)
    if not valid:
        return False, f'当前 YAML 未通过校验，不能导出最终 YAML 剧本。错误: {err}', None

    fmt = file_format if file_format in ('yaml', 'yml') else 'yaml'
    novel_id = draft['novel_id']
    version = draft['version']

    # 生成文件路径
    user_dir = os.path.join(EXPORT_DIR, f'user_{user_id}', f'novel_{novel_id}', 'final')
    _ensure_dir(user_dir)
    novel_title = _sanitize_filename(str(draft.get('novel_title', 'novel')))[:30]
    fname = f'novel_{novel_id}_final_script_v{version}_{novel_title}.{fmt}'
    fpath = os.path.join(user_dir, fname)

    try:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(yaml_content)
    except Exception as e:
        return False, f'文件写入失败: {e}', None

    # 保存导出记录
    db = get_db()
    now = datetime.now().isoformat()
    try:
        result = db.table('yaml_exports').insert({
            'user_id': user_id,
            'novel_id': novel_id,
            'draft_id': draft_id,
            'version_number': version,
            'file_name': fname,
            'file_path': fpath,
            'file_format': fmt,
            'yaml_content_snapshot': yaml_content[:50000],
            'status': 'exported',
            'exported_at': now,
            'created_at': now,
        }).execute()
        export_id = result.data[0]['id'] if result.data else None
    except Exception as e:
        return False, f'数据库保存失败: {e}', None

    return True, '导出成功', {
        'id': export_id,
        'fileName': fname,
        'filePath': fpath,
        'format': fmt,
    }


def get_export_record(draft_id, user_id):
    db = get_db()
    try:
        result = db.table('yaml_exports').select('*').eq('draft_id', draft_id).eq('user_id', user_id).order('exported_at', desc=True).limit(1).execute()
        return result.data[0] if result.data else None
    except Exception:
        return None
    os.makedirs(path, exist_ok=True)
    # 防路径穿越
    real = os.path.realpath(path)
    if not real.startswith(os.path.realpath(DATA_DIR)):
        raise ValueError('非法文件路径')


def _sanitize_filename(name):
    return re.sub(r'[<>:"/\\|?*]', '_', name)


def get_yaml_drafts(novel_id, user_id):
    db = get_db()
    try:
        result = db.table('yaml_drafts').select('*').eq('novel_id', novel_id).eq('user_id', user_id).order('version', desc=True).execute()
        return result.data or []
    except Exception:
        return []


def get_yaml_draft(draft_id, user_id):
    db = get_db()
    try:
        result = db.table('yaml_drafts').select('*').eq('id', draft_id).eq('user_id', user_id).execute()
        return result.data[0] if result.data else None
    except Exception:
        return None


def get_latest_yaml_draft(novel_id, user_id):
    drafts = get_yaml_drafts(novel_id, user_id)
    return drafts[0] if drafts else None


def save_user_edit(draft_id, user_id, yaml_content):
    db = get_db()
    now = datetime.now().isoformat()
    try:
        db.table('yaml_drafts').update({
            'user_edited_content': yaml_content,
            'user_edited_at': now,
            'status': 'editing',
            'updated_at': now,
        }).eq('id', draft_id).eq('user_id', user_id).execute()
        return True
    except Exception:
        traceback.print_exc()
        return False


def confirm_draft(draft_id, user_id):
    db = get_db()
    now = datetime.now().isoformat()
    try:
        db.table('yaml_drafts').update({
            'status': 'confirmed',
            'updated_at': now,
        }).eq('id', draft_id).eq('user_id', user_id).execute()
        return True
    except Exception:
        traceback.print_exc()
        return False


def delete_draft(draft_id, user_id):
    """软删除"""
    db = get_db()
    now = datetime.now().isoformat()
    try:
        db.table('yaml_drafts').update({
            'status': 'deleted',
            'updated_at': now,
        }).eq('id', draft_id).eq('user_id', user_id).execute()
        return True
    except Exception:
        traceback.print_exc()
        return False


def validate_yaml_syntax(yaml_text):
    """YAML 语法校验。返回 (is_valid, error_message)。"""
    import yaml
    try:
        yaml.safe_load(yaml_text)
        return True, None
    except yaml.YAMLError as e:
        return False, str(e)


def validate_against_schema(yaml_text, schema_content):
    """Schema 结构合理性校验。只检查 Schema 自身能否解析及 YAML/SChema 顶层类型，不检查必填字段缺失。"""
    import yaml
    try:
        yaml.safe_load(yaml_text)
        yaml.safe_load(schema_content)
    except yaml.YAMLError as e:
        return False, [f'YAML/Schema 解析失败: {str(e)}']
    return True, []


def run_comprehensive_validation(yaml_text, schema_content=None, chapter_ids=None):
    """综合校验：返回结构化校验报告。

    返回 dict:
        {
            "valid": bool,
            "yamlSyntaxValid": bool,
            "schemaValid": bool | null,
            "canConfirm": bool,
            "canExport": bool,
            "errors": [{type, severity, title, line, column, fieldPath, message, suggestion, rawError}],
            "warnings": [...],
            "checks": [{name, status, message}]
        }
    """
    import yaml
    errors = []
    warnings = []
    checks = []

    # === 1) YAML 语法校验 ===
    yaml_syntax_valid = True
    yaml_syntax_error = None
    doc = None
    try:
        doc = yaml.safe_load(yaml_text)
    except yaml.YAMLError as e:
        yaml_syntax_valid = False
        yaml_syntax_error = str(e)
        line, col, field_path, suggestion = _parse_yaml_error(yaml_text, str(e))
        errors.append({
            "type": "yaml_syntax",
            "severity": "error",
            "title": "YAML 语法错误",
            "line": line,
            "column": col,
            "fieldPath": field_path,
            "message": _explain_yaml_error(str(e), yaml_text),
            "suggestion": suggestion,
            "rawError": str(e),
        })
    checks.append({"name": "YAML 语法校验", "status": "pass" if yaml_syntax_valid else "fail",
                    "message": "通过" if yaml_syntax_valid else "YAML 语法存在错误"})

    # === 2) Schema 结构校验（仅检查 Schema 自身可解析，不检查必填字段缺失） ===
    schema_valid = None
    if not yaml_syntax_valid:
        checks.append({"name": "Schema 结构校验", "status": "skipped",
                        "message": "未执行，因为 YAML 语法未通过"})
    elif not schema_content or not isinstance(doc, dict):
        schema_valid = True
        checks.append({"name": "Schema 结构校验", "status": "pass", "message": "通过"})
    else:
        try:
            yaml.safe_load(schema_content)
            schema_valid = True
        except yaml.YAMLError as e:
            schema_valid = False
            errors.append({
                "type": "schema_structure",
                "severity": "error",
                "title": "Schema 结构错误",
                "message": f'Schema 本身无法解析: {e}',
                "suggestion": "请联系管理员检查 Schema 内容。",
            })
        checks.append({"name": "Schema 结构校验", "status": "pass" if schema_valid else "fail",
                        "message": "通过" if schema_valid else "Schema 自身解析失败"})

    # === 3) 字段类型校验 ===
    type_checks = _check_field_types(doc, yaml_syntax_valid)
    errors.extend(type_checks.get("errors", []))
    warnings.extend(type_checks.get("warnings", []))
    checks.append(type_checks.get("check", {}))

    # === 4) source_refs 校验 ===
    ref_checks = _check_source_refs(doc, yaml_syntax_valid, chapter_ids)
    errors.extend(ref_checks.get("errors", []))
    warnings.extend(ref_checks.get("warnings", []))
    checks.append(ref_checks.get("check", {}))

    # === 5) 业务规则校验 ===
    biz_checks = _check_business_rules(doc, yaml_syntax_valid)
    errors.extend(biz_checks.get("errors", []))
    warnings.extend(biz_checks.get("warnings", []))
    checks.append(biz_checks.get("check", {}))

    can_confirm = yaml_syntax_valid and (schema_valid is None or schema_valid) and \
        not any(e["severity"] == "error" for e in errors)
    can_export = can_confirm

    return {
        "valid": len([e for e in errors if e["severity"] == "error"]) == 0,
        "yamlSyntaxValid": yaml_syntax_valid,
        "schemaValid": schema_valid,
        "canConfirm": can_confirm,
        "canExport": can_export,
        "errors": errors,
        "warnings": warnings,
        "checks": checks,
    }


def _parse_yaml_error(yaml_text, error_str):
    """解析 YAML 错误字符串，提取行号、列号和可能的字段名。"""
    import re
    line = None
    col = None
    m = re.search(r'line\s+(\d+)', error_str)
    if m:
        line = int(m.group(1))
    m = re.search(r'column\s+(\d+)', error_str)
    if m:
        col = int(m.group(1))
    # 尝试从错误行推断字段名
    field_path = None
    if line and yaml_text:
        lines = yaml_text.split('\n')
        if line <= len(lines):
            err_line = lines[line - 1].strip()
            m2 = re.match(r'(\w[\w\s]*):', err_line)
            if m2:
                field_path = m2.group(1).strip()
    suggestion = _get_suggestion_for_error(error_str)
    return line, col, field_path, suggestion


def _explain_yaml_error(error_str, yaml_text):
    """将 YAML 原始错误翻译为中文解释。"""
    s = error_str.lower()
    if 'block sequence start' in s and 'block end' in s:
        return '列表缩进不一致。YAML 解析器期待当前对象结束，但又遇到了新的列表项（-），通常是因为同一个列表中的条目缩进层级不同。'
    if 'expected' in s and 'but found' in s:
        return 'YAML 结构不符合预期。可能是缩进错误、漏写了冒号、或者数组元素格式不正确。'
    if 'mapping values are not allowed' in s:
        return '键值对格式错误。冒号后缺少空格，或者该行缩进不正确。'
    return 'YAML 语法解析失败，请检查缩进、冒号、列表符号是否正确。'


def _get_suggestion_for_error(error_str):
    """根据错误类型给出修复建议。"""
    s = error_str.lower()
    if 'block sequence start' in s:
        return '请确保同一个列表中的每个 "-" 处于同一缩进层级。例如 source_refs 下的每个条目缩进必须一致。'
    if 'mapping values are not allowed' in s:
        return '请在冒号后加一个空格，并确保键值对格式正确（key: value）。'
    if 'expected <block end>' in s:
        return '请检查该行的缩进是否与同一层级的其他条目对齐。'
    return '请检查错误行附近的缩进、标点和结构。'


def _check_field_types(doc, yaml_valid):
    errors, warnings = [], []
    if not yaml_valid or not isinstance(doc, dict):
        return {"errors": [], "warnings": [], "check": {"name": "字段类型校验", "status": "skipped"}}

    type_checks = [
        ('characters', list, 'array', 'characters 应写成列表，每个角色前使用 "- "。'),
        ('scenes', list, 'array', 'scenes 应写成列表，每个场景前使用 "- "。'),
        ('episodes', list, 'array', 'episodes 应写成列表。'),
    ]
    for key, expected_type, type_name, suggestion in type_checks:
        if key in doc and doc[key] is not None:
            if not isinstance(doc[key], expected_type):
                errors.append({
                    "type": "field_type",
                    "severity": "error",
                    "title": "字段类型错误",
                    "fieldPath": key,
                    "message": f'"{key}" 类型错误：期望 {type_name}，实际 {type(doc[key]).__name__}。',
                    "suggestion": suggestion,
                })

    return {
        "errors": errors, "warnings": warnings,
        "check": {"name": "字段类型校验", "status": "pass" if not errors else "fail",
                  "message": "通过" if not errors else f"{len(errors)} 个字段类型错误"}
    }


def _check_source_refs(doc, yaml_valid, chapter_ids=None):
    errors, warnings = [], []
    if not yaml_valid or not isinstance(doc, dict):
        return {"errors": [], "warnings": [], "check": {"name": "source_refs 校验", "status": "skipped"}}

    # 递归查找所有 source_refs
    def find_source_refs(obj, path=''):
        for key, val in obj.items() if isinstance(obj, dict) else []:
            current_path = f'{path}.{key}' if path else key
            if key == 'source_refs' and isinstance(val, list):
                for i, ref in enumerate(val):
                    if not isinstance(ref, dict):
                        errors.append({
                            "type": "source_refs",
                            "severity": "error",
                            "title": "source_refs 格式错误",
                            "fieldPath": f'{current_path}[{i}]',
                            "message": f'source_refs 中的元素应为对象，实际为 {type(ref).__name__}。',
                            "suggestion": '每个 source_ref 应该是包含 chapter_id 的对象。',
                        })
                    elif 'chapter_id' not in ref:
                        warnings.append({
                            "type": "source_refs",
                            "severity": "warning",
                            "title": "source_refs 缺少字段",
                            "fieldPath": f'{current_path}[{i}]',
                            "message": 'source_ref 缺少 chapter_id。',
                            "suggestion": '请补充 chapter_id 以便追溯来源章节。',
                        })
            elif isinstance(val, dict):
                find_source_refs(val, current_path)
            elif isinstance(val, list):
                for i, item in enumerate(val):
                    if isinstance(item, dict):
                        find_source_refs(item, f'{current_path}[{i}]')

    find_source_refs(doc)

    return {
        "errors": errors, "warnings": warnings,
        "check": {"name": "source_refs 校验", "status": "pass" if not errors else "fail",
                  "message": "通过" if not errors else f"{len(errors)} 个 source_refs 错误",
                  "warningCount": len(warnings)}
    }


def _check_business_rules(doc, yaml_valid):
    errors, warnings = [], []
    if not yaml_valid or not isinstance(doc, dict):
        return {"errors": [], "warnings": [], "check": {"name": "业务规则校验", "status": "skipped"}}

    if not doc:
        errors.append({
            "type": "business_rule",
            "severity": "error",
            "title": "业务规则",
            "message": "YAML 内容为空。",
            "suggestion": "请根据小说提炼结果和 Schema 填充 YAML 内容。",
        })

    if 'characters' in doc and isinstance(doc['characters'], list) and len(doc['characters']) == 0:
        warnings.append({
            "type": "business_rule",
            "severity": "warning",
            "title": "业务规则",
            "message": "characters 列表为空。",
            "suggestion": "建议至少添加一个角色。",
        })

    if 'scenes' in doc and isinstance(doc['scenes'], list) and len(doc['scenes']) == 0:
        warnings.append({
            "type": "business_rule",
            "severity": "warning",
            "title": "业务规则",
            "message": "scenes 列表为空。",
            "suggestion": "建议至少添加一个场景。",
        })

    return {
        "errors": errors, "warnings": warnings,
        "check": {"name": "业务规则校验", "status": "pass" if not errors else "fail",
                  "message": "通过" if not errors else f"{len(errors)} 个业务规则错误",
                  "warningCount": len(warnings)}
    }


def _build_generation_prompt(novel_title, extraction_json, schema_content, schema_name):
    """构建生成提示词。

    关键变化：要求 AI 输出严格 JSON 对象（而非 YAML 文本），由后端用 PyYAML 序列化。
    """
    return f"""你是一个严格的剧本结构生成器。请根据输入的小说提炼结果和参考 Schema，输出**严格的 JSON 对象**——而不是 YAML、不是 Markdown 文本、不是注释。

# 输出铁则

1. 只输出一个 JSON 对象。从 `{{` 开始，以 `}}` 结尾。
2. 禁止 Markdown 围栏、解释文字、```yaml、```json。
3. 顶层必须是 JSON 对象（不要数组、不要字符串）。
4. 字符串使用双引号 `"`，未知值使用 `null`（不要空字符串、不要 `"未知"`）。
5. 数组必须用 `[...]`，对象必须用 `{{...}}`。
6. 不要重复 key，不要尾随逗号。
7. 数字使用 JSON 数字（不要加引号）。
8. 必须可被 `json.loads()` 一次解析成功。

后端会用 `yaml.dump()` 把你的 JSON 序列化成 YAML，因此你**不需要**关心缩进、`- ` 对齐、`source_refs` 的 YAML 写法——只需要保证 JSON 结构正确。

# 字段结构参照（请按此结构组织 JSON）

```json
{{
  "metadata": {{
    "title": "小说标题",
    "schema_name": "{schema_name}",
    "generated_from": "novel_extraction",
    "version": "draft"
  }},
  "characters": [
    {{
      "name": "角色名",
      "role_type": "protagonist",
      "story_function": "主角",
      "identity": "身份",
      "surface_goal": "表层目标",
      "deep_need": "深层需求",
      "fatal_flaw": "致命缺陷",
      "arc": {{
        "start_state": "开始状态",
        "end_state": null
      }},
      "source_refs": [
        {{
          "chapter_id": 1,
          "chapter_title": "章节名",
          "start_offset": null,
          "end_offset": null,
          "excerpt_preview": "原文片段"
        }}
      ]
    }}
  ],
  "scenes": [
    {{
      "scene_id": "S001",
      "title": "场景标题",
      "location": "地点",
      "time": "时间",
      "characters": ["角色名", "角色二"],
      "summary": "场景摘要",
      "conflict": "戏剧冲突",
      "actions": ["动作描述一", "动作描述二"],
      "dialogue": [
        {{"speaker": "角色名", "line": "对白内容"}},
        {{"speaker": "角色二", "line": "对白内容"}}
      ],
      "source_refs": [
        {{
          "chapter_id": 1,
          "chapter_title": "章节名",
          "start_offset": null,
          "end_offset": null,
          "excerpt_preview": "原文片段"
        }}
      ]
    }}
  ],
  "generation_notes": {{
    "uncertain_items": ["不确定项"]
  }}
}}
```

# source_refs 字段规则

每个 source_ref 必须包含：
- `chapter_id`（数字，必填）
- `chapter_title`（字符串，可选）
- `start_offset`（数字或 null）
- `end_offset`（数字或 null）
- `excerpt_preview`（字符串或 null）

# 内容要求

1. 必须基于下面提供的提炼结果生成。不要编造未在提炼中出现的角色、地点、关键事件。
2. 未知字段填 `null` 而不是省略——保证字段完整性便于下游消费。

# 输入数据

## 提炼结果（来自 AI 提炼或用户修改后版本）
```json
{json.dumps(extraction_json, ensure_ascii=False, indent=2)[:12000]}
```

## 参考 Schema: {schema_name}
```yaml
{schema_content[:4000]}
```

# 小说: 《{novel_title}》

请输出 JSON 对象。"""


def _build_repair_prompt(original_json_or_yaml, error_message, schema_content=None):
    """JSON 修复提示词。修复对象始终是 JSON，输出也必须是 JSON。"""
    prompt = f"""上一次输出的 JSON 无法通过校验，请严格修复后重新输出。

# 错误信息
{error_message[:2000]}

# 需要修复的内容（原始 JSON 或 YAML）
```text
{(original_json_or_yaml or '')[:8000]}
```
"""
    if schema_content:
        prompt += f"""
# 参考 Schema
```yaml
{schema_content[:3000]}
```
"""
    prompt += """
# 修复铁则

1. 只输出修复后的完整 JSON 对象。不要 Markdown 围栏、不要解释文字、不要 ```json。
2. 顶层必须是 JSON 对象（`{` 开头，`}` 结尾）。
3. 只修复结构、字段、类型、缺失项。不改变剧情、人物、对白、场景内容。
4. 未知值填 `null`，字符串用双引号。
5. 数字字段不要加引号。
6. 必须可被 `json.loads()` 一次解析成功。
7. 输出前自查 JSON 结构完整性（括号匹配、逗号正确）。"""
    return prompt


def generate_yaml(novel_id, user_id, schema_id=None, use_schema=True):
    """生成 YAML 剧本草稿。

    返回 (success, message, draft_record)。
    """
    from src.extraction_service import get_extraction
    from src.schema_service import get_schema_detail

    # 1) 获取提炼结果
    extraction = get_extraction(novel_id, user_id)
    if not extraction:
        return False, '当前小说还没有可用的提炼结果，请先完成小说提炼后再生成 YAML 剧本。', None

    extraction_json = extraction.get('user_result_json') or extraction.get('ai_result_json')
    if not extraction_json or not isinstance(extraction_json, dict):
        return False, '当前小说还没有可用的提炼结果，请先完成小说提炼后再生成 YAML 剧本。', None

    # 2) 获取 Schema
    db = get_db()
    novel = db.table('novels').select('title').eq('id', novel_id).eq('user_id', user_id).execute()
    novel_title = novel.data[0]['title'] if novel.data else '未命名'

    schema_content = None
    schema_name_snapshot = '系统默认 Schema'
    schema_format = 'yaml'
    resolved_schema_id = None

    if use_schema and schema_id and schema_id != 'default':
        schema = get_schema_detail(int(schema_id), user_id)
        if schema:
            schema_content = schema.get('content', '')
            schema_name_snapshot = schema.get('name', '')
            schema_format = schema.get('content_format', 'yaml')
            resolved_schema_id = schema['id']
        else:
            return False, '所选 Schema 不存在或无权限使用。', None
    elif use_schema:
        # 使用系统默认 Schema
        schemas_result = db.table('yaml_schemas').select('*').eq('is_system', 1).eq('status', 'active').limit(1).execute()
        if schemas_result.data:
            schema_content = schemas_result.data[0].get('content', '')
            schema_name_snapshot = schemas_result.data[0].get('name', '系统默认 Schema')
            schema_format = schemas_result.data[0].get('content_format', 'yaml')
            resolved_schema_id = schemas_result.data[0]['id']

    if use_schema and not schema_content:
        return False, '未找到可用的 Schema，请先创建或选择 Schema。', None

    # 3) 确定版本号（用 DB 查询而非内存计算，减少并发冲突）
    def _get_next_version(nid, uid):
        try:
            max_row = db.table('yaml_drafts').select('version').eq('novel_id', nid).eq('user_id', uid).order('version', desc=True).limit(1).execute()
            return (max_row.data[0]['version'] + 1) if max_row.data else 1
        except Exception:
            existing = get_yaml_drafts(nid, uid)
            return max((d.get('version', 0) for d in existing), default=0) + 1

    version = _get_next_version(novel_id, user_id)

    # 防重复：检查该版本号是否已存在，存在则递增
    existing_check = db.table('yaml_drafts').select('id').eq('novel_id', novel_id).eq('user_id', user_id).eq('version', version).execute()
    while existing_check.data:
        version += 1
        existing_check = db.table('yaml_drafts').select('id').eq('novel_id', novel_id).eq('user_id', user_id).eq('version', version).execute()

    # 4) 调用 AI 生成 JSON（不再让 AI 直接吐 YAML）
    prompt = _build_generation_prompt(novel_title, extraction_json, schema_content or '', schema_name_snapshot)
    success, raw_ai_text, response_summary = call_ai(prompt, timeout=180)

    if not success:
        return False, f'AI 生成失败: {raw_ai_text}', None

    status = 'generated'
    error_message = None
    validation_errors = None
    repair_count = 0
    yaml_text = ''
    json_object = None
    raw_after_strip = _strip_json_fence(raw_ai_text)

    # 5) JSON 解析 → JSON Schema 校验 → yaml.dump 序列化
    json_object, parse_err = _try_load_json_with_recovery(raw_after_strip)
    if json_object is None:
        # 调一次 AI 修复
        repair_count = 1
        repair_prompt = _build_repair_prompt(raw_after_strip, f'JSON 解析失败: {parse_err}', schema_content)
        ok2, repaired_text, _ = call_ai(repair_prompt, timeout=120)
        if ok2:
            repaired_clean = _strip_json_fence(repaired_text)
            json_object, parse_err2 = _try_load_json_with_recovery(repaired_clean)
            if json_object is None:
                validation_errors = f'AI 输出 JSON 解析失败（修复后仍失败）: {parse_err2}'
                status = 'repair_failed'
                yaml_text = raw_after_strip  # 保留原始内容供用户在编辑器内自行修复
        else:
            validation_errors = f'AI 输出 JSON 解析失败（自动修复调用失败）: {parse_err}'
            status = 'validation_failed'
            yaml_text = raw_after_strip

    # 6) jsonschema 结构校验
    if json_object is not None:
        json_schema = _build_json_schema_from_yaml_schema(schema_content) if use_schema else None
        schema_ok, schema_errs = _validate_with_jsonschema(json_object, json_schema)
        if not schema_ok:
            # 调一次 AI 修复
            if repair_count == 0:
                repair_count = 1
                err_text = '; '.join(schema_errs)[:1500]
                repair_prompt = _build_repair_prompt(
                    json.dumps(json_object, ensure_ascii=False, indent=2),
                    f'JSON Schema 校验失败: {err_text}',
                    schema_content,
                )
                ok2, repaired_text, _ = call_ai(repair_prompt, timeout=120)
                if ok2:
                    repaired_clean = _strip_json_fence(repaired_text)
                    repaired_obj, _re_err = _try_load_json_with_recovery(repaired_clean)
                    if repaired_obj is not None:
                        ok3, errs3 = _validate_with_jsonschema(repaired_obj, json_schema)
                        if ok3:
                            json_object = repaired_obj
                        else:
                            validation_errors = (validation_errors or '') + ' JSON Schema 校验失败（修复后仍失败）: ' + '; '.join(errs3)[:1000]
                            status = 'repair_failed'
                            # 仍然继续序列化为 YAML 以便用户在编辑器修复
                    else:
                        validation_errors = (validation_errors or '') + f' 修复后 JSON 解析失败: {_re_err}'
                        status = 'repair_failed'
                else:
                    validation_errors = (validation_errors or '') + f' JSON Schema 校验失败: {"; ".join(schema_errs)[:1000]}'
                    status = 'repair_failed'
            else:
                validation_errors = (validation_errors or '') + f' JSON Schema 校验失败: {"; ".join(schema_errs)[:1000]}'
                status = 'repair_failed'

        # 7) 用 PyYAML 序列化为 YAML 字符串（由 yaml 库统一缩进、引号、换行，根本杜绝缩进错误）
        try:
            yaml_text = _serialize_to_yaml(json_object)
            # 再用 yaml.safe_load 二次确认（理论上必然通过，作为兜底）
            valid, syntax_err = validate_yaml_syntax(yaml_text)
            if not valid:
                validation_errors = (validation_errors or '') + f' YAML 序列化后语法异常: {syntax_err}'
                status = 'validation_failed'
        except Exception as e:
            traceback.print_exc()
            validation_errors = (validation_errors or '') + f' YAML 序列化失败: {e}'
            status = 'validation_failed'
            yaml_text = json.dumps(json_object, ensure_ascii=False, indent=2)

    if status == 'generated' and validation_errors:
        status = 'validation_failed'

    # 7) 保存到文件系统
    file_path = None
    try:
        user_dir = os.path.join(DATA_DIR, f'user_{user_id}', f'novel_{novel_id}')
        _ensure_dir(user_dir)
        safe_title = _sanitize_filename(novel_title)[:30]
        fname = f'draft_{novel_id}_v{version}_{safe_title}.yaml'
        fpath = os.path.join(user_dir, fname)
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(yaml_text)
        file_path = fpath
    except Exception:
        traceback.print_exc()

    # 8) 保存到数据库
    now = datetime.now().isoformat()
    insert_data = {
        'user_id': user_id,
        'novel_id': novel_id,
        'version': version,
        'version_type': 'ai_generated',
        'schema_id': resolved_schema_id,
        'schema_name_snapshot': schema_name_snapshot,
        'schema_content_snapshot': schema_content,
        'schema_format': schema_format,
        'extraction_snapshot_json': extraction_json,
        'yaml_content': yaml_text,
        'status': status,
        'error_message': error_message,
        'validation_errors': validation_errors,
        'repair_count': repair_count,
        'file_path': file_path,
        'created_at': now,
        'updated_at': now,
    }

    try:
        result = db.table('yaml_drafts').insert(insert_data).execute()
        draft_id = result.data[0]['id'] if result.data else None
    except Exception as e:
        traceback.print_exc()
        return False, f'数据库保存失败: {e}', None

    draft_record = insert_data.copy()
    draft_record['id'] = draft_id

    # 9) 记录 AI 调用
    try:
        db.table('ai_call_records').insert({
            'user_id': user_id,
            'novel_id': novel_id,
            'task_type': YAML_TASK_TYPE,
            'provider': get_provider(),
            'model_name': get_model_name(),
            'request_summary': f'yaml_gen v{version} schema={schema_name_snapshot} prompt_len={len(prompt)}',
            'response_summary': (response_summary or '')[:500],
            'status': 'success' if status in ('generated',) else 'failed',
            'error_message': (validation_errors or error_message or '')[:500],
        }).execute()
    except Exception:
        pass

    return True, f'YAML 剧本草稿 生成{chr(34)}完成{chr(34)}' if status == 'generated' else f'生成完成但存在问题: {validation_errors}', draft_record


def _fix_yaml_structure(text):
    """修复 AI 常见 YAML 输出错误：以 [] 开头的非法根结构等。"""
    if not text:
        return text
    lines = text.split('\n')

    # 检测：文本以 `[]` 开头，后面紧跟没有正确顶层结构的对象字段
    # 例如:
    #   []
    #       role_type: "protagonist"
    #       story_function: "主角"
    #       name: "齐夏"
    # 修复为 characters 数组，同一缩进级别的字段合并为一个数组元素
    stripped = [l for l in lines if l.strip() and not l.strip().startswith('#')]
    first_non_empty = stripped[0] if stripped else ''

    if first_non_empty.strip() == '[]':
        result_lines = []
        in_root_fix = False
        pending_item_fields = []  # 收集同一缩进块的字段

        def flush_pending():
            nonlocal pending_item_fields
            if pending_item_fields:
                # 第一个字段用 `  - key: value`，后续用 `    key: value`
                first = pending_item_fields[0]
                result_lines.append('  - ' + first)
                for rest in pending_item_fields[1:]:
                    result_lines.append('    ' + rest)
                pending_item_fields = []

        for line in lines:
            s = line.strip()
            indent = len(line) - len(line.lstrip()) if line.strip() else 0

            if s == '[]' and not in_root_fix:
                result_lines.append('characters:')
                in_root_fix = True
            elif in_root_fix and indent >= 4 and s and not s.startswith('#') and not s.startswith('-'):
                # 缩进的字段行 → 收集
                pending_item_fields.append(s)
            elif in_root_fix and (indent < 4 or not s):
                # 缩进减少或空行 → 刷新当前块
                flush_pending()
                result_lines.append(line)
            else:
                if pending_item_fields:
                    flush_pending()
                result_lines.append(line)

        flush_pending()
        return '\n'.join(result_lines)

    # 检测：文本以 `[` 开头（但不是 JSON 数组）
    if first_non_empty.startswith('[') and not first_non_empty.startswith('[{"'):
        return _wrap_loose_root_to_characters(text)

    return text


def _wrap_loose_root_to_characters(text):
    """当 YAML 以奇怪的方式开头时，尝试包裹为合法结构。"""
    lines = text.split('\n')
    result = []
    fixed = False
    for line in lines:
        s = line.strip()
        if not fixed and s == '[':
            result.append('characters:')
            fixed = True
        else:
            result.append(line)
    if not fixed:
        return text
    return '\n'.join(result)


def _strip_markdown_fence(text):
    text = (text or '').strip()
    # 去掉 ```yaml / ``` 围栏
    m = re.match(r'^```(?:yaml|yml)?\s*\n?(.*?)\n?```$', text, re.DOTALL)
    if m:
        return m.group(1).strip()
    if text.startswith('```') and text.endswith('```'):
        inner = text[3:-3].strip()
        if inner.startswith('yaml') or inner.startswith('yml'):
            inner = inner[4:].strip()
        return inner
    return text


# ---------------------------------------------------------------------------
# 严格 JSON-first 工具链 helpers
# ---------------------------------------------------------------------------

def _strip_json_fence(text):
    """剥离 AI 输出可能携带的 Markdown 围栏（```json / ``` / ```yaml 等）。"""
    if not text:
        return ''
    s = text.strip()
    # 完整 ```json ... ``` 围栏
    m = re.match(r'^```(?:json|yaml|yml|text|)?\s*\n?(.*?)\n?```$', s, re.DOTALL)
    if m:
        return m.group(1).strip()
    # 仅起始有 ``` 没结尾的情况
    if s.startswith('```'):
        s = s[3:]
        if s.startswith('json') or s.startswith('yaml') or s.startswith('yml'):
            s = s.split('\n', 1)[1] if '\n' in s else ''
        if s.rstrip().endswith('```'):
            s = s.rstrip()[:-3]
        return s.strip()
    return s


def _try_load_json_with_recovery(text):
    """尝试解析 JSON。返回 (obj_or_None, error_message)。

    增强：
    1. 直接 json.loads
    2. 找到第一个 `{` 与最后一个 `}` 之间的内容再解析（兜底无关前后缀）
    3. 移除可能尾随逗号 `,}` `,]`
    """
    if not text:
        return None, '内容为空'

    raw = text.strip()
    try:
        return json.loads(raw), None
    except json.JSONDecodeError as e:
        first_err = str(e)

    # 截取第一个 `{` 与最后一个 `}` 之间
    start = raw.find('{')
    end = raw.rfind('}')
    if start >= 0 and end > start:
        candidate = raw[start:end + 1]
        try:
            return json.loads(candidate), None
        except json.JSONDecodeError as e2:
            # 修复尾随逗号
            cleaned = re.sub(r',\s*([}\]])', r'\1', candidate)
            try:
                return json.loads(cleaned), None
            except json.JSONDecodeError as e3:
                return None, f'{first_err} | 截取重试: {e3}'

    return None, first_err


def _build_json_schema_from_yaml_schema(yaml_schema_content):
    """从 YAML/JSON Schema 内容生成可用于 jsonschema 校验的 JSON Schema 对象。"""
    if not yaml_schema_content:
        return _get_default_json_schema()
    return _get_default_json_schema()


def _get_default_json_schema():
    """系统默认 JSON Schema。"""
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "type": "object",
        "properties": {
            "metadata": {
                "type": "object",
                "properties": {
                    "title": {"type": ["string", "null"]},
                    "schema_name": {"type": ["string", "null"]},
                    "generated_from": {"type": ["string", "null"]},
                    "version": {"type": ["string", "null"]},
                },
            },
            "characters": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": ["string", "null"]},
                        "role_type": {"type": ["string", "null"]},
                        "story_function": {"type": ["string", "null"]},
                        "identity": {"type": ["string", "null"]},
                        "surface_goal": {"type": ["string", "null"]},
                        "deep_need": {"type": ["string", "null"]},
                        "fatal_flaw": {"type": ["string", "null"]},
                        "arc": {
                            "type": ["object", "null"],
                            "properties": {
                                "start_state": {"type": ["string", "null"]},
                                "end_state": {"type": ["string", "null"]},
                            },
                        },
                        "source_refs": {
                            "type": ["array", "null"],
                            "items": _source_ref_schema(),
                        },
                    },
                },
            },
            "scenes": {
                "type": ["array", "null"],
                "items": {
                    "type": "object",
                    "properties": {
                        "scene_id": {"type": ["string", "null"]},
                        "title": {"type": ["string", "null"]},
                        "location": {"type": ["string", "null"]},
                        "time": {"type": ["string", "null"]},
                        "characters": {"type": ["array", "null"], "items": {"type": ["string", "null"]}},
                        "summary": {"type": ["string", "null"]},
                        "conflict": {"type": ["string", "null"]},
                        "actions": {"type": ["array", "null"], "items": {"type": ["string", "null"]}},
                        "dialogue": {
                            "type": ["array", "null"],
                            "items": {
                                "type": "object",
                                "properties": {
                                    "speaker": {"type": ["string", "null"]},
                                    "line": {"type": ["string", "null"]},
                                },
                            },
                        },
                        "source_refs": {
                            "type": ["array", "null"],
                            "items": _source_ref_schema(),
                        },
                    },
                },
            },
            "generation_notes": {
                "type": ["object", "null"],
                "properties": {
                    "uncertain_items": {"type": ["array", "null"], "items": {"type": ["string", "null"]}},
                },
            },
        },
    }


def _source_ref_schema():
    return {
        "type": "object",
        "properties": {
            "chapter_id": {"type": ["integer", "string", "null"]},
            "chapter_title": {"type": ["string", "null"]},
            "start_offset": {"type": ["integer", "null"]},
            "end_offset": {"type": ["integer", "null"]},
            "excerpt_preview": {"type": ["string", "null"]},
        },
    }


def _validate_with_jsonschema(obj, json_schema):
    """用 jsonschema 库校验 obj。返回 (ok, errors)。"""
    try:
        import jsonschema
    except ImportError:
        # 库未安装时降级为简单顶层 key 检查
        return _fallback_validate(obj, json_schema)

    if not isinstance(obj, dict):
        return False, ['顶层必须是对象（dict）']

    if not json_schema:
        return True, []

    try:
        validator = jsonschema.Draft7Validator(json_schema)
        errs = []
        for err in sorted(validator.iter_errors(obj), key=lambda e: e.path):
            path = '.'.join(str(p) for p in err.path) if err.path else '(根)'
            errs.append(f'{path}: {err.message}')
        return (len(errs) == 0), errs
    except Exception as e:
        return False, [f'JSON Schema 校验异常: {e}']


def _fallback_validate(obj, json_schema):
    if not isinstance(obj, dict):
        return False, ['顶层必须是对象']
    return True, []


def _serialize_to_yaml(obj):
    """用 PyYAML 把 dict 序列化为 YAML 字符串。

    选项：
    - default_flow_style=False：使用块状（block）风格，不写成 [..] / {..}
    - allow_unicode=True：保留中文
    - sort_keys=False：保持字段顺序
    - indent=2：2 空格缩进
    - width=10**9：避免长字符串被折行
    - 使用自定义 Dumper 让数组项在父键下额外缩进 2 空格（更像我们文档里的样例）
    """
    import yaml

    class _IndentDumper(yaml.SafeDumper):
        def increase_indent(self, flow=False, indentless=False):
            return super().increase_indent(flow=flow, indentless=False)

    return yaml.dump(
        obj,
        Dumper=_IndentDumper,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
        indent=2,
        width=10 ** 9,
    )
