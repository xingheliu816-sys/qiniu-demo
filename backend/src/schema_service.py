import json
from src.db import get_db
from datetime import datetime


def validate_content(content, content_format):
    if content_format == 'yaml':
        import yaml
        try:
            yaml.safe_load(content)
        except yaml.YAMLError as e:
            return False, f'YAML 格式解析失败：{str(e)}'
    elif content_format == 'json':
        try:
            json.loads(content)
        except json.JSONDecodeError as e:
            return False, f'JSON 格式解析失败：{str(e)}'
    return True, None


def get_schemas(user_id):
    db = get_db()
    system = db.table('yaml_schemas').select('*').eq('is_system', 1).eq('status', 'active').order('created_at').execute()
    user = db.table('yaml_schemas').select('*').eq('user_id', user_id).eq('status', 'active').order('created_at', desc=True).execute()
    preferences = db.table('user_schema_preferences').select('default_schema_id').eq('user_id', user_id).execute()
    default_id = preferences.data[0]['default_schema_id'] if preferences.data else None
    return {
        'system_schemas': system.data,
        'user_schemas': user.data,
        'default_schema_id': default_id,
    }


def get_schema_detail(schema_id, user_id):
    db = get_db()
    result = db.table('yaml_schemas').select('*').eq('id', schema_id).execute()
    if not result.data:
        return None
    schema = result.data[0]
    if schema['is_system']:
        return schema
    if schema['user_id'] != user_id:
        return None
    return schema


def create_schema(user_id, name, description, schema_type, content_format, content, source_type='manual'):
    valid, err = validate_content(content, content_format)
    if not valid:
        return None, err

    db = get_db()
    now = datetime.now().isoformat()
    result = db.table('yaml_schemas').insert({
        'user_id': user_id,
        'name': name or '未命名 Schema',
        'description': description or '',
        'schema_type': schema_type or 'custom',
        'content_format': content_format,
        'content': content,
        'is_default': 0,
        'is_system': 0,
        'status': 'active',
        'source_type': source_type,
        'created_at': now,
        'updated_at': now,
    }).execute()
    return result.data[0]['id'], None


def update_schema(schema_id, user_id, name=None, description=None, schema_type=None, content_format=None, content=None):
    db = get_db()
    existing = db.table('yaml_schemas').select('*').eq('id', schema_id).execute()
    if not existing.data:
        return False, 'Schema 不存在'
    schema = existing.data[0]
    if schema['is_system']:
        return False, '系统默认 Schema 不允许编辑'
    if schema['user_id'] != user_id:
        return False, '无权编辑此 Schema'

    if content is not None and content_format is not None:
        valid, err = validate_content(content, content_format)
        if not valid:
            return False, err

    now = datetime.now().isoformat()
    update_data = {'updated_at': now}
    if name is not None:
        update_data['name'] = name
    if description is not None:
        update_data['description'] = description
    if schema_type is not None:
        update_data['schema_type'] = schema_type
    if content_format is not None:
        update_data['content_format'] = content_format
    if content is not None:
        update_data['content'] = content

    db.table('yaml_schemas').update(update_data).eq('id', schema_id).execute()
    return True, None


def delete_schema(schema_id, user_id):
    db = get_db()
    existing = db.table('yaml_schemas').select('*').eq('id', schema_id).execute()
    if not existing.data:
        return False, 'Schema 不存在'
    schema = existing.data[0]
    if schema['is_system']:
        return False, '系统默认 Schema 不允许删除'
    if schema['user_id'] != user_id:
        return False, '无权删除此 Schema'

    db.table('user_schema_preferences').update({'default_schema_id': None}).eq('default_schema_id', schema_id).execute()
    db.table('yaml_schemas').delete().eq('id', schema_id).execute()
    return True, None


def copy_schema(schema_id, user_id):
    db = get_db()
    existing = db.table('yaml_schemas').select('*').eq('id', schema_id).execute()
    if not existing.data:
        return None, 'Schema 不存在'
    src = existing.data[0]
    if not src['is_system'] and src['user_id'] != user_id:
        return None, '无权复制此 Schema'

    now = datetime.now().isoformat()
    new_name = f"{src['name']} - 副本"
    result = db.table('yaml_schemas').insert({
        'user_id': user_id,
        'name': new_name,
        'description': src['description'] or '',
        'schema_type': src['schema_type'] or 'custom',
        'content_format': src['content_format'],
        'content': src['content'],
        'is_default': 0,
        'is_system': 0,
        'status': 'active',
        'source_type': 'copy_system' if src['is_system'] else 'copy_user',
        'created_at': now,
        'updated_at': now,
    }).execute()
    return result.data[0]['id'], None


def set_default_schema(schema_id, user_id):
    db = get_db()
    if schema_id is not None:
        existing = db.table('yaml_schemas').select('*').eq('id', schema_id).execute()
        if not existing.data:
            return False, 'Schema 不存在'
        schema = existing.data[0]
        if not schema['is_system'] and schema['user_id'] != user_id:
            return False, '无权将此 Schema 设为默认'

    prefs = db.table('user_schema_preferences').select('id').eq('user_id', user_id).execute()
    now = datetime.now().isoformat()
    if prefs.data:
        db.table('user_schema_preferences').update({'default_schema_id': schema_id, 'updated_at': now}).eq('user_id', user_id).execute()
    else:
        db.table('user_schema_preferences').insert({'user_id': user_id, 'default_schema_id': schema_id, 'updated_at': now}).execute()
    return True, None
