import json
from src.db import get_db
from datetime import datetime


SYSTEM_SCHEMA_CONTENT = '''metadata:
  extraction_id: null
  novel_id: null
  user_id: null
  novel_title: null
  extraction_title: "小说提炼结果"
  version: "1.0"
  language: "zh-CN"
  created_at: null
  updated_at: null
  status: "draft"
  source_chapter_count: 0
  source_word_count: 0
  notes: null

source_info:
  source_type: "novel"
  input_method: null
  chapter_range:
    start_chapter: null
    end_chapter: null
  chapters:
    - chapter_id: null
      chapter_index: null
      title: null
      word_count: 0
      summary: null
      source_ref:
        start_offset: null
        end_offset: null

adaptation_intent:
  target_format: null
  target_genre: null
  target_audience: null
  target_length: null
  tone: null
  style_keywords: []
  adaptation_priority:
    preserve_original_plot: null
    strengthen_conflict: null
    reduce_inner_monologue: null
    increase_visuality: null
    increase_dialogue: null
  notes: null

core_story:
  logline: null
  story_question: null
  protagonist: null
  protagonist_situation: null
  protagonist_want: null
  protagonist_need: null
  main_obstacle: null
  main_cost: null
  irreversible_change: null
  ending_result: null
  one_sentence_summary: null
  expanded_summary: null
  source_refs: []

protagonist_goal:
  character_name: null
  external_goal: null
  internal_need: null
  false_belief_at_start: null
  belief_at_end: null
  main_choice: null
  final_price: null
  transformation: null
  source_refs: []

characters:
  - character_id: null
    name: null
    aliases: []
    role_type: null
    story_function: null
    identity: null
    first_appearance_chapter: null
    external_goal: null
    internal_need: null
    fatal_flaw: null
    fear: null
    secret: null
    wound: null
    desire: null
    contradiction: null
    arc:
      start_state: null
      middle_state: null
      end_state: null
      does_character_change: null
      change_description: null
      if_no_change_effect: null
    belief:
      believes_at_start: null
      believes_at_end: null
      belief_shift: null
    relationship_to_protagonist: null
    dialogue_style: null
    visual_traits: []
    key_actions: []
    source_refs: []
    uncertain_notes: null

character_arcs:
  - character_name: null
    surface_goal: null
    deep_need: null
    fatal_flaw: null
    start_belief: null
    end_belief: null
    key_turning_points:
      - chapter_id: null
        event: null
        change: null
        source_refs: []
    final_change: null
    source_refs: []

dramatic_conflict:
  central_conflict: null
  main_opposing_forces:
    - force_a: null
      force_b: null
      conflict_type: null
      conflict_description: null
  desire_collisions:
    - character_a: null
      character_a_want: null
      character_b: null
      character_b_want: null
      why_they_cannot_both_win: null
      source_refs: []
  impossible_choices:
    - choice: null
      option_a: null
      option_b: null
      loss_if_a: null
      loss_if_b: null
      source_refs: []
  secrets_that_break_relationships:
    - secret: null
      holder: null
      affected_characters: []
      consequence_if_revealed: null
      source_refs: []
  quiet_but_tense_dialogues:
    - chapter_id: null
      scene_context: null
      surface_topic: null
      hidden_conflict: null
      source_refs: []

structure_outline:
  structure_type: null
  overall_pattern: null
  act_one:
    function: "建立世界与问题"
    protagonist_daily_state: null
    world_setup: null
    inciting_incident: null
    first_turning_point: null
    source_refs: []
  act_two:
    function: "冲突升级"
    protagonist_actions: []
    failures: []
    relationship_deterioration: []
    secrets_deepen: []
    rising_costs: []
    midpoint: null
    second_turning_point: null
    source_refs: []
  act_three:
    function: "最终选择"
    core_dilemma: null
    final_choice: null
    climax: null
    irreversible_result: null
    aftermath: null
    source_refs: []
  rhythm_chain:
    inciting_event: null
    confrontation: null
    escalation: null
    collapse: null
    choice: null
    aftermath: null
  notes: null

scene_extraction:
  high_value_scenes:
    - scene_candidate_id: null
      title: null
      source_chapter_id: null
      source_chapter_title: null
      location: null
      time: null
      involved_characters: []
      scene_summary: null
      dramatic_function: null
      why_keep_this_scene: null
      what_changes_after_scene: null
      if_deleted_story_damage: null
      visual_strength: null
      theme_relevance: null
      source_refs: []
  low_value_or_removable_scenes:
    - source_chapter_id: null
      content_summary: null
      reason_to_cut: null
      possible_merge_target: null
      source_refs: []

scene_enter_exit_states:
  - scene_candidate_id: null
    scene_title: null
    entering_state:
      characters:
        - name: null
          goal_entering_scene: null
          emotional_state: null
          information_state: null
    conflict_inside_scene: null
    exit_state:
      characters:
        - name: null
          goal_after_scene: null
          emotional_change: null
          information_change: null
          relationship_change: null
    source_refs: []

inner_monologue_externalization:
  - original_inner_state: null
    source_chapter_id: null
    source_excerpt_preview: null
    externalized_action: null
    externalized_object: null
    externalized_choice: null
    externalized_visual_moment: null
    suggested_scene_usage: null
    source_refs: []

theme:
  theme_question: null
  theme_statement_optional: null
  related_questions: []
  character_answers:
    - character_name: null
      how_character_answers_theme: null
      representative_action: null
      source_refs: []
  theme_through_conflict: null
  theme_through_ending: null
  theme_symbols: []
  notes: null

relationships:
  - relationship_id: null
    character_a: null
    character_b: null
    relationship_type: null
    start_state: null
    middle_state: null
    end_state: null
    relationship_change: null
    dramatic_debt:
      who_owes_whom: null
      who_lied_to_whom: null
      who_saved_whom: null
      who_cannot_forgive_whom: null
      who_loves_but_cannot_say: null
      who_hates_but_cannot_leave: null
    key_relationship_scenes:
      - source_chapter_id: null
        scene_summary: null
        relationship_change: null
        source_refs: []
    source_refs: []

visual_motifs:
  - motif_id: null
    motif_name: null
    motif_type: null
    first_appearance: null
    repeated_appearances:
      - chapter_id: null
        context: null
        source_refs: []
    emotional_meaning: null
    thematic_meaning: null
    possible_screen_usage: null
    final_payoff: null
    source_refs: []

narrative_perspective:
  original_perspective: null
  original_voice: null
  narration_style: null
  recommended_screen_perspective: null
  should_keep_voiceover: null
  voiceover_purpose: null
  flashback_usage: null
  multi_timeline_usage: null
  audience_information_strategy:
    audience_knows_more_than_protagonist: null
    protagonist_knows_more_than_audience: null
    audience_discovers_with_protagonist: null
  notes: null

dialogue_extraction:
  dialogue_principle: "人物不是在说信息，而是在争夺、遮掩、试探或攻击。"
  dialogue_candidates:
    - dialogue_id: null
      source_chapter_id: null
      characters: []
      original_line_or_context: null
      what_character_really_wants_to_say: null
      why_cannot_say_directly: null
      disguise_strategy: null
      subtext: null
      power_shift_after_dialogue: null
      adapted_dialogue_suggestion: null
      source_refs: []
  dialogue_style_by_character:
    - character_name: null
      speech_style: null
      forbidden_style: null
      typical_phrases: []
      emotional_leakage: null
      notes: null

cut_and_merge_strategy:
  must_keep:
    - item: null
      reason: null
      source_refs: []
  can_cut:
    - item: null
      reason: null
      effect_after_cut: null
      source_refs: []
  can_merge:
    - original_items: []
      merged_into: null
      reason: null
      source_refs: []
  background_to_compress:
    - content: null
      compression_method: null
      source_refs: []
  inner_thoughts_to_convert:
    - content: null
      conversion_method: null
      source_refs: []

adaptation_positioning:
  target_script_type: null
  possible_formats:
    - format_name: null
      suitability: null
      reason: null
  recommended_format: null
  genre_direction: null
  tone_direction: null
  pacing_strategy: null
  commercial_or_artistic_orientation: null
  episode_or_runtime_suggestion:
    total_episodes: null
    episode_length_minutes: null
    film_runtime_minutes: null
  audience_positioning: null
  notes: null

adaptation_table:
  story_core:
    question: "这到底是谁的故事？"
    answer: null
  protagonist_goal:
    question: "主人公想要什么？"
    answer: null
  character_arc:
    question: "主人公最后变了吗？"
    answer: null
  central_conflict:
    question: "最大的对抗是什么？"
    answer: null
  theme:
    question: "故事真正追问什么？"
    answer: null
  key_relationships:
    question: "哪几组关系最有戏？"
    answer: []
  highlight_scenes:
    question: "哪些场景必须保留？"
    answer: []
  removable_content:
    question: "哪些支线可以砍掉？"
    answer: []
  inner_externalization:
    question: "心理活动如何变成动作？"
    answer: []
  visual_motifs:
    question: "哪些物件、场景、动作能反复出现？"
    answer: []
  structure:
    question: "三幕、五幕，还是剧集分集？"
    answer: null
  style:
    question: "冷峻、荒诞、浪漫、悬疑，还是现实主义？"
    answer: null

timeline:
  narrative_order:
    - order_index: null
      chapter_id: null
      event: null
      time_label: null
      source_refs: []
  chronological_order:
    - order_index: null
      event: null
      actual_time_label: null
      related_chapter_ids: []
      source_refs: []
  time_jumps:
    - jump_type: null
      from_time: null
      to_time: null
      purpose: null
      source_refs: []

causal_chain:
  - step_index: null
    cause: null
    effect: null
    consequence: null
    forced_next_action: null
    source_refs: []

foreshadowing_and_payoff:
  - foreshadowing_id: null
    setup: null
    setup_chapter_id: null
    payoff: null
    payoff_chapter_id: null
    dramatic_effect: null
    should_keep_in_script: null
    source_refs: []

information_reveal:
  protagonist_knows:
    - information: null
      when_known: null
      source_refs: []
  audience_knows:
    - information: null
      when_known: null
      source_refs: []
  antagonist_knows:
    - information: null
      when_known: null
      source_refs: []
  hidden_information:
    - information: null
      hidden_from: []
      reveal_timing: null
      reveal_effect: null
      source_refs: []
  reveal_strategy:
    early_reveal: []
    delayed_reveal: []
    twist_reveal: []

world_rules:
  setting_time: null
  setting_place: null
  social_rules: []
  power_structure: []
  special_rules: []
  technology_or_magic_rules: []
  family_or_organization_rules: []
  rules_that_cannot_be_broken: []
  source_refs: []

factions:
  - faction_id: null
    name: null
    type: null
    goal: null
    leader_or_core_member: null
    members: []
    relationship_with_protagonist: null
    relationship_with_other_factions:
      - target_faction: null
        relation_type: null
        description: null
    source_refs: []

adaptation_risks:
  - risk_id: null
    risk_type: null
    description: null
    affected_chapters: []
    severity: null
    suggested_solution: null
    source_refs: []

uncertain_items:
  - item_id: null
    type: null
    content: null
    reason: null
    needs_user_confirmation: true
    source_refs: []

source_refs_index:
  - ref_id: null
    chapter_id: null
    chapter_title: null
    start_offset: null
    end_offset: null
    excerpt_preview: null
    jump_target: null

user_editing:
  editable: true
  last_editor: null
  last_edited_at: null
  edit_notes: null
  confirmed_by_user: false
  confirmed_at: null'''

SYSTEM_SCHEMA_NAME = '小说提炼默认 Schema'
SYSTEM_SCHEMA_DESC = '系统提供的小说提炼结构字段模板，可作为后续 YAML 剧本生成的默认结构参考'


def init_system_schema():
    db = get_db()
    from datetime import datetime as _dt
    existing = db.table('yaml_schemas').select('id', 'description', 'content').eq('is_system', 1).limit(1).execute()
    if existing.data:
        existing_schema = existing.data[0]
        old_desc = '用于生成 YAML 剧本草稿的系统默认模板。'
        if existing_schema.get('description') == old_desc:
            now = _dt.now().isoformat()
            db.table('yaml_schemas').update({
                'description': SYSTEM_SCHEMA_DESC,
                'content': SYSTEM_SCHEMA_CONTENT,
                'updated_at': now,
            }).eq('id', existing_schema['id']).execute()
            print('[Init] 系统默认 Schema 已升级为新模板')
        return
    now = _dt.now().isoformat()
    db.table('yaml_schemas').insert({
        'user_id': None,
        'name': SYSTEM_SCHEMA_NAME,
        'description': SYSTEM_SCHEMA_DESC,
        'schema_type': 'custom',
        'content_format': 'yaml',
        'content': SYSTEM_SCHEMA_CONTENT,
        'is_default': 0,
        'is_system': 1,
        'status': 'active',
        'source_type': 'system_default',
        'created_at': now,
        'updated_at': now,
    }).execute()


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
        return False, '系统默认 Schema 不支持直接编辑。'
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
        return False, '系统默认 Schema 不支持删除。'
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
