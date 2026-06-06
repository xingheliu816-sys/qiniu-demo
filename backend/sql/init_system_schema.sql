-- 系统默认 Schema
INSERT INTO yaml_schemas (user_id, name, description, schema_type, content_format, content, is_default, is_system, status, source_type)
SELECT NULL, '小说提炼默认 Schema', '用于生成 YAML 剧本草稿的系统默认模板。', 'custom', 'yaml',
'metadata:
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

dramatic_conflict:
  central_conflict: null
  main_opposing_forces: []
  desire_collisions: []
  impossible_choices: []
  secrets_that_break_relationships: []
  quiet_but_tense_dialogues: []

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

scene_extraction:
  high_value_scenes: []
  low_value_or_removable_scenes: []

theme:
  theme_question: null
  theme_statement_optional: null
  related_questions: []
  notes: null

relationships:
  - relationship_id: null
    character_a: null
    character_b: null
    relationship_type: null
    start_state: null
    middle_state: null
    end_state: null

dialogue_extraction:
  dialogue_principle: "人物不是在说信息，而是在争夺、遮掩、试探或攻击。"
  dialogue_candidates: []
  dialogue_style_by_character: []

cut_and_merge_strategy:
  must_keep: []
  can_cut: []
  can_merge: []

adaptation_positioning:
  target_script_type: null
  possible_formats: []
  recommended_format: null
  genre_direction: null
  tone_direction: null
  pacing_strategy: null

timeline:
  narrative_order: []
  chronological_order: []
  time_jumps: []

factions: []
adaptation_risks: []
uncertain_items: []
source_refs_index: []

user_editing:
  editable: true
  last_editor: null
  last_edited_at: null
  edit_notes: null
  confirmed_by_user: false
  confirmed_at: null',
0, 1, 'active', 'system_default'
WHERE NOT EXISTS (SELECT 1 FROM yaml_schemas WHERE is_system = 1);
