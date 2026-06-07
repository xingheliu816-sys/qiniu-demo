# 剧本的 YAML Schema 及设计原因

> **Novel2Script AI** — 系统默认 YAML Schema（小说提炼默认 Schema）
>
> 本文档定义项目用于「小说 → 剧本」转化的 YAML Schema 完整字段结构，并解释每个模块的设计原因。

---

## 目录

1. [Schema 全景结构](#schema-全景结构)
2. [设计总原则](#设计总原则)
3. [分层模块设计及原因](#分层模块设计及原因)
   - [第一层：基础元数据（metadata）](#第一层基础元数据metadata)
   - [第二层：来源溯源（source_info）](#第二层来源溯源source_info)
   - [第三层：改编意图（adaptation_intent）](#第三层改编意图adaptation_intent)
   - [第四层：故事内核（core_story + protagonist_goal）](#第四层故事内核core_story--protagonist_goal)
   - [第五层：角色体系（characters + character_arcs）](#第五层角色体系characters--character_arcs)
   - [第六层：戏剧冲突（dramatic_conflict）](#第六层戏剧冲突dramatic_conflict)
   - [第七层：叙事结构（structure_outline）](#第七层叙事结构structure_outline)
   - [第八层：场景工程（scene_extraction + scene_enter_exit_states）](#第八层场景工程scene_extraction--scene_enter_exit_states)
   - [第九层：内心外化（inner_monologue_externalization）](#第九层内心外化inner_monologue_externalization)
   - [第十层：主题（theme）](#第十层主题theme)
   - [第十一层：人物关系（relationships）](#第十一层人物关系relationships)
   - [第十二层：视觉母题（visual_motifs）](#第十二层视觉母题visual_motifs)
   - [第十三层：叙事视角（narrative_perspective）](#第十三层叙事视角narrative_perspective)
   - [第十四层：对白提炼（dialogue_extraction）](#第十四层对白提炼dialogue_extraction)
   - [第十五层：删改策略（cut_and_merge_strategy）](#第十五层删改策略cut_and_merge_strategy)
   - [第十六层：改编定位（adaptation_positioning）](#第十六层改编定位adaptation_positioning)
   - [第十七层：改编自查表（adaptation_table）](#第十七层改编自查表adaptation_table)
   - [第十八层：时间线（timeline）](#第十八层时间线timeline)
   - [第十九层：因果链（causal_chain）](#第十九层因果链causal_chain)
   - [第二十层：伏笔回收（foreshadowing_and_payoff）](#第二十层伏笔回收foreshadowing_and_payoff)
   - [第二十一层：信息差（information_reveal）](#第二十一层信息差information_reveal)
   - [第二十二层：世界观规则（world_rules）](#第二十二层世界观规则world_rules)
   - [第二十三层：阵营（factions）](#第二十三层阵营factions)
   - [第二十四层：改编风险（adaptation_risks）](#第二十四层改编风险adaptation_risks)
   - [第二十五层：不确定项（uncertain_items）](#第二十五层不确定项uncertain_items)
   - [第二十六层：来源索引 + 用户编辑元数据](#第二十六层来源索引--用户编辑元数据)
4. [source_refs 设计：可追溯的原文锚点](#source_refs-设计可追溯的原文锚点)
5. [三层架构：事实层 / 戏剧层 / 改编层](#三层架构事实层--戏剧层--改编层)
6. [与行业通用剧本格式的关系](#与行业通用剧本格式的关系)

---

## Schema 全景结构

系统默认 Schema 按功能域分为 **26 个顶层模块**，覆盖从小说到剧本转化所需的全部结构化信息：

```text
metadata                          → 基础元数据
source_info                       → 来源溯源
adaptation_intent                 → 改编意图
core_story                        → 故事内核
protagonist_goal                  → 主人公目标
characters                        → 角色体系
character_arcs                    → 角色弧光
dramatic_conflict                 → 戏剧冲突
structure_outline                 → 三幕/五幕结构提纲
scene_extraction                  → 场景萃取（高价值 / 可删除）
scene_enter_exit_states           → 场景进出状态
inner_monologue_externalization   → 内心独白外化策略
theme                             → 主题网络
relationships                     → 人物关系矩阵
visual_motifs                     → 视觉母题
narrative_perspective             → 叙事视角
dialogue_extraction               → 对白萃取
cut_and_merge_strategy            → 删改合并策略
adaptation_positioning            → 改编市场定位
adaptation_table                  → 12 问改编自查表
timeline                          → 叙事顺序 / 编年顺序 / 时间跳转
causal_chain                      → 因果链
foreshadowing_and_payoff          → 伏笔与回收
information_reveal                → 信息不对称矩阵
world_rules                       → 世界观规则
factions                          → 阵营体系
adaptation_risks                  → 改编风险
uncertain_items                   → 不确定项
source_refs_index                 → 来源索引
user_editing                      → 用户编辑元数据
```

---

## 设计总原则

### 原则一：三层信息架构

整个 Schema 按「事实层 → 戏剧层 → 改编层」三层组织：

| 层 | 含义 | 谁填写 | 举例 |
|----|------|--------|------|
| **事实层** | 小说中客观存在的信息 | AI 从原文提炼 | core_story、characters、timeline |
| **戏剧层** | 需要编剧判断的戏剧分析 | AI 提炼 + 用户确认 | dramatic_conflict、theme、character_arcs |
| **改编层** | 转化为剧本时的工程决策 | 用户主导填写 | adaptation_intent、cut_and_merge_strategy |

三层分开设计的原因：**改编剧本不是机械转写，而是创造性工程**。事实层保证不偏离原文，戏剧层提供剧本骨架，改编层留给编剧发挥空间。AI 不能越界代替编剧做创作决策。

### 原则二：source_refs 全文可追溯

Schema 中几乎每个关键字段都可以挂载 `source_refs`——一个精确指向原文章节 + 偏移量 + 片段摘要的锚点数组。

设计原因：小说改编剧本最大的信任问题是「这段剧本是 AI 编的还是原文真有？」。`source_refs` 让评委和用户能**一键定位到原文依据**，整个提炼过程可验证、可反驳、可修正。详见[source_refs 设计章节](#source_refs-设计可追溯的原文锚点)。

### 原则三：null 优于空字符串

所有未填写字段默认值为 `null`（而不是 `""` 或 `[]`）。`null` 明确表达「尚未填写」，而空字符串会让人误以为「确认过是空的」。

### 原则四：每个模块都有 notes / uncertain_items 出口

如果 AI 不确定某个字段，不是静默跳过，而是写入 `uncertain_items` 数组（标记 `needs_user_confirmation: true`）。这比「AI 自信满满地填错」更安全。

### 原则五：Schema 是约束建议，不是强制框架

本项目已在后端关闭了 Schema 的 **required 必填字段强校验**。这意味着：用户生成的 YAML 不必覆盖 Schema 的所有 26 个模块——如果小说没有阵营设定，`factions` 可以不出现而不会报错。Schema 提供的是「**建议覆盖的完整清单**」，实际生成时用户按需取舍。

---

## 分层模块设计及原因

### 第一层：基础元数据（metadata）

```yaml
metadata:
  extraction_id: null          # 提炼记录 ID
  novel_id: null               # 小说 ID
  user_id: null                # 用户 ID
  novel_title: null            # 小说标题
  extraction_title: "小说提炼结果"
  version: "1.0"               # Schema 版本
  language: "zh-CN"            # 语言
  created_at: null
  updated_at: null
  status: "draft"              # draft / confirmed / exported
  source_chapter_count: 0      # 来源章节数
  source_word_count: 0         # 来源总字数
  notes: null
```

**设计原因**：

- `novel_id` / `user_id` / `extraction_id` 构成完整溯源链：这份剧本 YAML 从哪部小说、哪个用户、哪次提炼来，任何时候都能回溯
- `source_chapter_count` / `source_word_count` 让评委一眼看出 AI 的信息量基础：基于 3 章 8000 字和基于 30 章 20 万字，提炼质量预期完全不同
- `status` 支持草稿 → 确认 → 导出三级流转，与编辑器端的状态标签联动

### 第二层：来源溯源（source_info）

```yaml
source_info:
  source_type: "novel"         # 来源类型
  input_method: null           # 导入方式（file / link / manual）
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
```

**设计原因**：

- 剧本成品需要标注「基于原作第 X–Y 章改编」——这是影视行业版权标注的通用要求
- `input_method` 记录用户是上传文件、粘贴链接还是手动输入，便于后续排查「为什么第 3 章识别不准」
- 每章独立记录字数 + 摘要，方便后续按章节筛选、比对提炼质量

### 第三层：改编意图（adaptation_intent）

```yaml
adaptation_intent:
  target_format: null          # 目标格式（short_drama / movie / tv_series 等）
  target_genre: null           # 目标类型
  target_audience: null        # 目标受众
  target_length: null          # 目标篇幅
  tone: null                   # 基调
  style_keywords: []           # 风格关键词
  adaptation_priority:
    preserve_original_plot: null
    strengthen_conflict: null
    reduce_inner_monologue: null
    increase_visuality: null
    increase_dialogue: null
  notes: null
```

**设计原因**：

- 同一本小说可以改编为**短剧、电影、广播剧、舞台剧**——不同格式的结构需求完全不同。不写死格式，而是让用户声明意图
- `adaptation_priority` 不是简单的是/否，而是在多个目标之间做权衡：保留原著剧情 vs 加强冲突 vs 增加视觉性——编剧工作的本质就是取舍

### 第四层：故事内核（core_story + protagonist_goal）

```yaml
core_story:
  logline: null                # 一句话梗概
  story_question: null         # 故事核心问题
  protagonist: null            # 主人公
  protagonist_situation: null  # 主人公处境
  protagonist_want: null       # 表层目标
  protagonist_need: null       # 深层需求
  main_obstacle: null          # 主要障碍
  main_cost: null              # 主要代价
  irreversible_change: null    # 不可逆改变
  ending_result: null          # 结局
  one_sentence_summary: null
  expanded_summary: null
  source_refs: []

protagonist_goal:
  character_name: null
  external_goal: null
  internal_need: null
  false_belief_at_start: null  # 起点的错误信念
  belief_at_end: null          # 终点的信念
  main_choice: null            # 关键选择
  final_price: null            # 最终代价
  transformation: null         # 转变
  source_refs: []
```

**设计原因**：

- `want` vs `need` 的区分来自经典编剧理论（《故事》）：want 是表层目标（我想活下来），need 是深层需求（我需要学会信任别人）。**好的剧本 = 主人公在追求 want 的过程中被迫面对 need**
- `false_belief_at_start → belief_at_end` + `main_choice → final_price` 构成完整的人物弧线：不是因为环境变了所以人变了，而是人做了一个选择、付出了代价、信念才变了
- `logline` 单独一个字段而非藏在 description 里：因为「一句话卖点」是影视行业判断剧本价值的最高频操作——给制片人看的第一个东西永远是 logline

### 第五层：角色体系（characters + character_arcs）

```yaml
characters:
  - character_id: null
    name: null
    aliases: []                # 别名
    role_type: null            # protagonist / antagonist / supporting 等
    story_function: null       # 故事功能（导师 / 信使 / 捣乱者 等）
    identity: null             # 身份
    first_appearance_chapter: null
    external_goal: null
    internal_need: null
    fatal_flaw: null           # 致命缺陷
    fear: null                 # 恐惧
    secret: null               # 秘密
    wound: null                # 创伤
    desire: null               # 欲望
    contradiction: null        # 内在矛盾
    arc:
      start_state: null
      middle_state: null
      end_state: null
      does_character_change: null
      change_description: null
      if_no_change_effect: null  # 如果不变，对故事有何影响
    belief:
      believes_at_start: null
      believes_at_end: null
      belief_shift: null
    relationship_to_protagonist: null
    dialogue_style: null
    visual_traits: []
    key_actions: []            # 关键行动
    source_refs: []
    uncertain_notes: null
```

**设计原因**：

- `fatal_flaw` / `fear` / `secret` / `wound` / `desire` / `contradiction` 六个维度来自多种编剧体系的融合：不是每个角色需要填满 6 个，但这些维度提供了**从不同角度理解同一个角色**的工具箱
- `arc` 不是单一的「变了 / 没变」，而是 `start → middle → end` 三态 + `does_character_change` + `if_no_change_effect`。有些角色不变化本身就有戏剧效果（比如反派始终不悔改）
- `dialogue_style` + `visual_traits` 给导演和美术提供具体抓手：这个角色说话是什么风格、外形有什么特征——不是抽象描述，是可直接执行的视觉/听觉指令

### 第六层：戏剧冲突（dramatic_conflict）

```yaml
dramatic_conflict:
  central_conflict: null
  main_opposing_forces:
    - force_a: null
      force_b: null
      conflict_type: null     # 人 vs 人 / 人 vs 环境 / 人 vs 自我
      conflict_description: null
  desire_collisions:          # 欲望碰撞（两人都想要同一东西且不能同时得到）
    - character_a: null
      character_a_want: null
      character_b: null
      character_b_want: null
      why_they_cannot_both_win: null
      source_refs: []
  impossible_choices:         # 不可能选择（二选一必然失去什么）
    - choice: null
      option_a: null
      option_b: null
      loss_if_a: null
      loss_if_b: null
      source_refs: []
  secrets_that_break_relationships:  # 会毁掉关系的秘密
    - secret: null
      holder: null
      affected_characters: []
      consequence_if_revealed: null
      source_refs: []
  quiet_but_tense_dialogues:  # 表面平静实则紧张的对白
    - chapter_id: null
      scene_context: null
      surface_topic: null
      hidden_conflict: null
      source_refs: []
```

**设计原因**：

- 冲突不是笼统的「A 和 B 是对手」——**desire_collisions** 精确到「两个人想要什么、为什么不能同时赢」；**impossible_choices** 精确到「选项 A 和选项 B 各会失去什么」
- **secrets_that_break_relationships** 专门列为一个子模块：秘密是戏剧最强燃料——一旦暴露就会摧毁一段关系、一个联盟、一个谎言
- **quiet_but_tense_dialogues** 来自编剧实践中最高级的冲突形态：两人表面聊天气，底下在争夺主导权。如果 AI 只能识别明显的吵架而识别不出这种静默对峙，剧本就失去了张力

### 第七层：叙事结构（structure_outline）

```yaml
structure_outline:
  structure_type: null         # 三幕 / 五幕 / 剧集分集
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
  rhythm_chain:                # 节奏链（事态如何一步步升级）
    inciting_event: null
    confrontation: null
    escalation: null
    collapse: null
    choice: null
    aftermath: null
  notes: null
```

**设计原因**：

- 采用经典三幕结构作为默认框架——不是因为每部剧都必须三幕，而是因为三幕提供了一个**最通用的检查清单**：你的故事有没有 inciting incident？有没有 midpoint 转折？有没有 irreversible choice？
- `rhythm_chain` 是一个**节奏诊断工具**：inciting → confrontation → escalation → collapse → choice → aftermath 这条链如果缺了某节，故事就会有节奏问题
- `act_two` 特意列出了 `failures` / `relationship_deterioration` / `secrets_deepen` / `rising_costs`——第二幕最容易「拖戏」，这些维度强迫编剧去挖掘冲突升级的具体手段

### 第八层：场景工程（scene_extraction + scene_enter_exit_states）

```yaml
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
      dramatic_function: null   # 这个场景在故事中起什么作用
      why_keep_this_scene: null
      what_changes_after_scene: null  # 场景结束后核心变化是什么
      if_deleted_story_damage: null   # 如果删掉会有什么损失
      visual_strength: null     # 视觉表现力评分
      theme_relevance: null     # 与主题关联系数
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
    entering_state:             # 进入场景时的角色状态
      characters:
        - name: null
          goal_entering_scene: null
          emotional_state: null
          information_state: null
    conflict_inside_scene: null
    exit_state:                 # 离开场景时的角色状态
      characters:
        - name: null
          goal_after_scene: null
          emotional_change: null
          information_change: null
          relationship_change: null
    source_refs: []
```

**设计原因**：

- **高价值场景 + 可删除场景**的双列表来自改编工程的务实需求：一本 500 章网文不可能全部拍成剧本。哪个场景必须留、哪个可以砍、哪个能合并——这是改编第一步
- `what_changes_after_scene` 是好莱坞编剧的黄金准则：**每个场景结束时，至少有一个东西必须变了**。如果什么都没变，这个场景就没有存在价值
- `scene_enter_exit_states` 来自 David Mamet 的编剧理论：不要写场景的中间过程，写**进入状态 + 冲突 + 退出状态**。三个数据点足以定义任何场景的戏剧弧线

### 第九层：内心外化（inner_monologue_externalization）

```yaml
inner_monologue_externalization:
  - original_inner_state: null      # 原著中的内心状态
    source_chapter_id: null
    source_excerpt_preview: null
    externalized_action: null       # 外化为动作
    externalized_object: null       # 外化为物件
    externalized_choice: null       # 外化为选择
    externalized_visual_moment: null  # 外化为视觉时刻
    suggested_scene_usage: null
    source_refs: []
```

**设计原因**：

- 小说可以写「他感到一阵深深的绝望」，剧本不能拍「感到」——**必须拍出绝望的行为**。这个模块就是把所有「内心状态」翻译成「镜头前可拍的动作 / 物件 / 选择 / 视觉时刻」
- 外化对象不是单一的——同一种内心状态可以通过**动作**（他撕掉了照片）、**物件**（他一直盯着那扇门）、**选择**（他选择把最后一瓶水给对手）、**视觉时刻**（他站在雨里不动）四种方式实现。编剧可以选择最适合当下语境的方式

### 第十层：主题（theme）

```yaml
theme:
  theme_question: null             # 主题问题（故事真正在追问什么）
  theme_statement_optional: null   # 主题声明（可选）
  related_questions: []            # 相关子问题
  character_answers:               # 每个角色如何回答主题问题
    - character_name: null
      how_character_answers_theme: null
      representative_action: null
      source_refs: []
  theme_through_conflict: null     # 通过冲突呈现的主题
  theme_through_ending: null       # 通过结局呈现的主题
  theme_symbols: []                # 主题象征物
  notes: null
```

**设计原因**：

- 主题不是「这个故事的寓意是 XXX」——那是小学作文。**主题是一个开放问题**，不同角色用不同行动给出不同回答。`character_answers` 数组让每个角色成为主题的一个**论据**
- `theme_through_conflict` 和 `theme_through_ending` 让主题不是贴在故事表面的标签，而是**嵌入冲突和结局**的有机成分

### 第十一层：人物关系（relationships）

```yaml
relationships:
  - relationship_id: null
    character_a: null
    character_b: null
    relationship_type: null
    start_state: null
    middle_state: null
    end_state: null
    relationship_change: null
    dramatic_debt:              # 戏剧债务（谁欠了谁）
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
```

**设计原因**：

- 人物关系是**动态的**——不是「A 是 B 的朋友」，而是「A 和 B 从 distrust → tentative alliance → betrayal → forgiveness」
- **dramatic_debt（戏剧债务）**是本 Schema 的原创设计：好的戏剧里，人物之间往往有未结清的账——谁欠了谁的命、谁对谁撒了谎、谁救了谁、谁无法原谅谁。这些「债务」是冲突升级的燃料储备

### 第十二层：视觉母题（visual_motifs）

```yaml
visual_motifs:
  - motif_id: null
    motif_name: null
    motif_type: null            # object / color / weather / gesture / sound
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
```

**设计原因**：

- 视觉母题是电影语言的基石：同一扇门反复出现（每次情绪不同）、同一首歌反复响起（每次含义不同）、同一件红色衣服反复出现（每次代表的人物不同）
- `first_appearance → repeated_appearances → final_payoff` 构成完整的母题弧线：引入 → 反复强化 → 最终回收。好的导演不需要解释母题，观众潜意识能感受到

### 第十三层：叙事视角（narrative_perspective）

```yaml
narrative_perspective:
  original_perspective: null       # 原著视角
  original_voice: null             # 原著语调
  narration_style: null            # 叙述风格
  recommended_screen_perspective: null  # 推荐的影视视角
  should_keep_voiceover: null      # 是否保留旁白
  voiceover_purpose: null
  flashback_usage: null
  multi_timeline_usage: null
  audience_information_strategy:
    audience_knows_more_than_protagonist: null
    protagonist_knows_more_than_audience: null
    audience_discovers_with_protagonist: null
  notes: null
```

**设计原因**：

- 小说常用第一人称 / 上帝视角，剧本必须转成**镜头视角**。`recommended_screen_perspective` 是把文学叙事策略翻译为视听叙事策略的关键决策
- `audience_information_strategy` 三种模式（观众知道更多 / 主角知道更多 / 观众与主角同步发现）定义了悬念、反转、情感张力的基础。希区柯克的「bomb under the table」理论就是「观众知道炸弹在桌子下但角色不知道」→ 紧张感来自信息差

### 第十四层：对白提炼（dialogue_extraction）

```yaml
dialogue_extraction:
  dialogue_principle: "人物不是在说信息，而是在争夺、遮掩、试探或攻击。"
  dialogue_candidates:
    - dialogue_id: null
      source_chapter_id: null
      characters: []
      original_line_or_context: null
      what_character_really_wants_to_say: null   # 潜台词
      why_cannot_say_directly: null
      disguise_strategy: null
      subtext: null
      power_shift_after_dialogue: null
      adapted_dialogue_suggestion: null
      source_refs: []
  dialogue_style_by_character:
    - character_name: null
      speech_style: null
      forbidden_style: null      # 这个角色绝不会说的话
      typical_phrases: []
      emotional_leakage: null    # 情绪泄露（嘴上不说但身体/用词暴露了）
      notes: null
```

**设计原因**：

- `dialogue_principle` 是整个模块的指导思想：好对白不是信息交换，而是**权力博弈**。人物说出来的话可能是掩饰、试探、攻击——潜台词比台词重要
- `what_character_really_wants_to_say` vs `disguise_strategy`：不是「把这句话改成剧本对白」，而是**先挖掘潜台词，再重构对白**
- `power_shift_after_dialogue`：一场对白结束后，两人的**权力关系是否改变了**——这是判断对白是否有用的硬指标
- `forbidden_style`：每个角色有自己绝不会说的话（一个粗人不会说「我认为此事有待商榷」）。这是塑造角色声音差异化的最有效方式

### 第十五层：删改策略（cut_and_merge_strategy）

```yaml
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
```

**设计原因**：

- 改编不是全量翻译——500 章网文压缩成 12 集短剧，砍掉 80% 是常态。这个模块是**做减法的结构化工具**
- `must_keep + can_cut + can_merge + compress + convert` 五个类别覆盖了所有改编编辑操作：留、删、合、压、转

### 第十六层：改编定位（adaptation_positioning）

```yaml
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
```

**设计原因**：

- `possible_formats` 数组 + `suitability`：同一本小说可能适合短剧和电影两种格式，但要说明**为什么适合、适不适合的程度**。这是给制片人的决策辅助
- `commercial_or_artistic_orientation`：商业片和文艺片的节奏 / 对白密度 / 冲突烈度完全不同。这个选择决定了后续所有编剧决策的方向

### 第十七层：改编自查表（adaptation_table）

12 个关键问题，每个问题**用一句话回答**：

| # | 问题 | 含义 |
|---|------|------|
| 1 | 这到底是谁的故事？ | 主角确认 |
| 2 | 主人公想要什么？ | 外部目标 |
| 3 | 主人公最后变了吗？ | 角色弧线 |
| 4 | 最大的对抗是什么？ | 核心冲突 |
| 5 | 故事真正追问什么？ | 主题 |
| 6 | 哪几组关系最有戏？ | 关系筛选 |
| 7 | 哪些场景必须保留？ | 场景筛选 |
| 8 | 哪些支线可以砍掉？ | 删减决策 |
| 9 | 心理活动如何变成动作？ | 内心外化 |
| 10 | 哪些物件 / 场景 / 动作能反复出现？ | 视觉母题 |
| 11 | 三幕、五幕还是剧集分集？ | 结构决策 |
| 12 | 冷峻 / 荒诞 / 浪漫 / 悬疑还是现实主义？ | 风格确认 |

**设计原因**：

- 这 12 问是从几十个 Schema 字段中提取的**最小决策集**：如果一个编剧只愿意回答 12 个问题，这些答案也足以支撑改编方向
- 问题形式比字段标签更直观——编剧看到「这到底是谁的故事？」比看到 `story_core.answer` 更容易产生思考

### 第十八层：时间线（timeline）

```yaml
timeline:
  narrative_order:           # 叙事顺序（故事怎么讲的）
    - order_index: null
      chapter_id: null
      event: null
      time_label: null
      source_refs: []
  chronological_order:       # 编年顺序（事情实际发生的顺序）
    - order_index: null
      event: null
      actual_time_label: null
      related_chapter_ids: []
      source_refs: []
  time_jumps:                # 时间跳转
    - jump_type: null        # flashback / flashforward / parallel
      from_time: null
      to_time: null
      purpose: null
      source_refs: []
```

**设计原因**：

- `narrative_order` vs `chronological_order` 双列表：很多小说用倒叙 / 插叙，剧本改编时需要先**还原编年顺序**，再**重新设计叙事顺序**。两个列表并存让这个决策透明化
- `time_jumps` 单独记录跳转的目的：好的时间跳转不是为了炫技，是有叙事目的——揭示因果、制造悬念、对比处境

### 第十九层：因果链（causal_chain）

```yaml
causal_chain:
  - step_index: null
    cause: null
    effect: null
    consequence: null
    forced_next_action: null
    source_refs: []
```

**设计原因**：

- 小说可以用大段心理描写连接事件，剧本只能靠**因果关系**推进：A 发生所以 B 发生，B 发生所以 C 必须做。`causal_chain` 就是验证这个链条是否完整
- `forced_next_action`：事件结束后，角色被**逼迫**必须做的下一件事是什么。如果答案是「什么都没做」，说明这个事件没有真正推进故事

### 第二十层：伏笔回收（foreshadowing_and_payoff）

```yaml
foreshadowing_and_payoff:
  - foreshadowing_id: null
    setup: null               # 伏笔埋设
    setup_chapter_id: null
    payoff: null              # 回收
    payoff_chapter_id: null
    dramatic_effect: null
    should_keep_in_script: null  # 是否应在剧本中保留
    source_refs: []
```

**设计原因**：

- `setup → payoff` 成对记录：改编时最容易被遗漏的就是伏笔——删了一个章节可能连带删除了后续回收。成对记录让砍章节时一眼能看到「这个 setup 还在等 payoff」
- `should_keep_in_script` 让编剧决定：这条伏笔是原样的、还是可以砍掉的、还是需要替换为更视觉化的方式

### 第二十一层：信息差（information_reveal）

```yaml
information_reveal:
  protagonist_knows: [...]    # 主角知道什么
  audience_knows: [...]       # 观众知道什么
  antagonist_knows: [...]     # 反派知道什么
  hidden_information:         # 隐藏信息 + 揭露时机
    - information: null
      hidden_from: []
      reveal_timing: null
      reveal_effect: null
      source_refs: []
  reveal_strategy:
    early_reveal: []
    delayed_reveal: []
    twist_reveal: []
```

**设计原因**：

- 信息不对称是叙事驱动力的来源：主角不知道的、观众知道的 → 紧张感；主角知道的、观众不知道的 → 揭秘感；反派知道的、双方都不知道的 → 压倒感
- `reveal_strategy` 三种揭露策略：early（早早告诉观众）、delayed（憋到最后）、twist（反转）各有不同的情绪效果

### 第二十二层：世界观规则（world_rules）

```yaml
world_rules:
  setting_time: null
  setting_place: null
  social_rules: []
  power_structure: []
  special_rules: []
  technology_or_magic_rules: []
  family_or_organization_rules: []
  rules_that_cannot_be_broken: []   # 绝对不能打破的规则
  source_refs: []
```

**设计原因**：

- `rules_that_cannot_be_broken` 是这个世界观规则的**锚点**：奇幻世界里「魔法必须以生命为代价」不能打破，社会写实里「这个体制里底层无法反抗」不能打破——一旦打破，观众会感觉「剧情崩了」
- 好的世界观不是堆设定，而是用规则限制角色的行动空间。规则越多、越明确，角色破局的那一刻越精彩

### 第二十三层：阵营（factions）

```yaml
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
```

**设计原因**：

- 阵营不是「好人 vs 坏人」——可以有 3 个以上阵营：主角阵营、反派阵营、中立摇摆阵营、暗中操控阵营。多阵营是复杂叙事的标配
- `relationship_with_other_factions` 让阵营间的互动关系可追踪：A 阵营利用 B 阵营、B 阵营表面顺从实则反叛——这些多边关系才是戏剧的富矿

### 第二十四层：改编风险（adaptation_risks）

```yaml
adaptation_risks:
  - risk_id: null
    risk_type: null          # 敏感内容 / 篇幅过长 / 角色过多 / 结构松散 等
    description: null
    affected_chapters: []
    severity: null           # high / medium / low
    suggested_solution: null
    source_refs: []
```

**设计原因**：

- 提前识别改编风险比事后修补成本低得多：比如「第 15-30 章是作者水字数」→ severity = high → 建议直接压缩为 3 个场景
- `suggested_solution` 不给唯一方案，给**建议**，最终由编剧决定

### 第二十五层：不确定项（uncertain_items）

```yaml
uncertain_items:
  - item_id: null
    type: null
    content: null
    reason: null
    needs_user_confirmation: true
    source_refs: []
```

**设计原因**：

- 所有 AI 不确定的内容都**显式输出**到这个数组，而不是静默猜测。AI 承认「我不知道」比 AI 自信猜错更有价值
- `needs_user_confirmation: true` 是给人看的信号：这个条目需要你确认一下

### 第二十六层：来源索引 + 用户编辑元数据

```yaml
source_refs_index:
  - ref_id: null
    chapter_id: null
    chapter_title: null
    start_offset: null
    end_offset: null
    excerpt_preview: null
    jump_target: null       # 跳转目标（编辑器内行号或锚点）

user_editing:
  editable: true
  last_editor: null
  last_edited_at: null
  edit_notes: null
  confirmed_by_user: false
  confirmed_at: null
```

**设计原因**：

- `source_refs_index` 是**全 Schema 的去重索引**：同一章节被多处引用时，只在这里存一份完整信息，其他地方挂 `ref_id` 引用。减少冗余同时保证一致性
- `user_editing` 记录**谁在什么时间确认了什么**：`ai_result_json` 保留 AI 原版，`user_result_json` 存用户修改版，`confirmed_by_user` 标志区分两者。这是人机协作的审计日志

---

## source_refs 设计：可追溯的原文锚点

### 为什么 source_refs 是核心设计

小说改编剧本的**信任危机**是：AI 说这段剧本基于原文，但评委和用户无法验证。

`source_refs` 解决这个问题——每个关键字段后面都可以挂：

```yaml
source_refs:
  - chapter_id: 4                    # 哪一章
    chapter_title: "空屋"           # 章节名
    start_offset: 142                # 原文起始偏移
    end_offset: 256                  # 原文结束偏移
    excerpt_preview: "齐夏推开那扇门..." # 原文片段预览
```

有了这四个值，点击「查看依据」就能在原文中找到精确对应。

### 为什么使用 offset 而非行号

行号在不同编辑器、不同文件格式下会变化（换行符不一致、中英文宽度不同等）。**字符偏移（offset）**是唯一跨平台稳定的定位方式。系统在导入章节时自动计算 offset 并存储。

### source_refs 的层级

source_refs 可以出现在任何层级：
- **顶层模块级**：这个模块的总体来源
- **数组元素级**：这条角色 / 这条场景 / 这段对白的来源
- **内嵌对象级**：角色弧光中某个转折点的来源

层级越深，追溯越精准。

---

## 三层架构：事实层 / 戏剧层 / 改编层

整个 Schema 可以按信息性质分为三层，对应改编流程的不同阶段：

### 事实层（AI 主导）

原文中客观存在、可直接提取的信息：

| 模块 | 理由 |
|------|------|
| metadata | 来源归属 |
| source_info | 章节来源 |
| characters（基本字段） | 姓名、身份、出场章节 |
| timeline | 叙事顺序 / 编年顺序 |
| world_rules | 世界设定 |
| factions | 阵营信息 |
| foreshadowing_and_payoff | 伏笔原文 |

### 戏剧层（AI + 用户协同）

需要编剧分析判断的信息，AI 给出初稿，用户确认或修改：

| 模块 | 理由 |
|------|------|
| core_story | logline 可以有争议 |
| protagonist_goal | want vs need 的判断 |
| characters（深层字段） | fatal_flaw / wound / desire 等 |
| character_arcs | 角色变化轨迹 |
| dramatic_conflict | 冲突分析 |
| theme | 主题解读 |
| relationships | 关系判断 |
| visual_motifs | 母题识别 |
| information_reveal | 信息差判断 |
| causal_chain | 因果分析 |

### 改编层（用户主导）

编剧的创作决策，AI 可以提供建议但不能代替决策：

| 模块 | 理由 |
|------|------|
| adaptation_intent | 目标格式 / 受众 / 风格 |
| structure_outline | 选择三幕还是五幕 |
| scene_extraction | 哪些场景留 / 砍 / 合并 |
| inner_monologue_externalization | 如何外化 |
| cut_and_merge_strategy | 删改决策 |
| dialogue_extraction | 对白改写 |
| adaptation_positioning | 市场定位 |
| adaptation_table | 12 问决策 |
| adaptation_risks | 风险评估 |
| uncertain_items | 标记所有不确定项 |

---

## 与行业通用剧本格式的关系

本 Schema 设计时参考了以下行业实践：

| 参考来源 | 汲取了 | 改造了 |
|----------|--------|--------|
| **Final Draft**（影视剧本行业标准） | 场景编号（scene_id）、角色表（characters）、对白格式（dialogue） | 增加 AI 可解析的结构化 JSON/YAML 格式 |
| **罗伯特·麦基《故事》** | 三幕结构、want vs need、人物弧线、inciting incident | 转化为可校验的字段，不依赖自然语言描述 |
| **悉德·菲尔德《电影剧本写作基础》** | 情节点（turning points）、幕结构 | 增加 act_one/act_two/act_three 的字段级结构 |
| **大卫·马梅特编剧理论** | 场景进出状态（enter/exit states） | 加入 emotional_change / information_change / relationship_change 三维度 |
| **Christopher Vogler《作家之旅》** | 原型角色（story_function）、角色旅程 | 加入 protagonist_goal 独立模块 |
| **中国网文改编实践** | 长篇幅删改策略、章节溯源、敏感内容风险 | 加入 cut_and_merge_strategy / adaptation_risks / source_refs 多层追溯 |
| **希区柯克悬念理论** | audience_information_strategy（观众信息差） | 分为三种模式、每种可关联具体场景 |

本 Schema 的定位**不是替代** Final Draft / 编剧软件，而是作为**编剧入稿前的结构化中间层**——把小说原文转成可编辑、可追溯、可校验的结构化数据，再由编剧在专业工具中创作最终剧本。

---

> **文档版本**：v1.0
> **项目**：Novel2Script AI — https://github.com/xingheliu816-sys/qiniu-demo
> **Schema 在项目中的位置**：
> - 系统默认内容：`backend/src/schema_service.py` 的 `SYSTEM_SCHEMA_CONTENT` 常量
> - 数据库初始化：`backend/sql/init_system_schema.sql`
> - 用户可通过 `/schemas` 页面查看、复制、自定义修改此 Schema
