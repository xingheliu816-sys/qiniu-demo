import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.extraction_service import (
    EMPTY_RESULT,
    empty_result,
    parse_ai_response,
    build_extraction_prompt,
)


class TestEmptyResult(unittest.TestCase):

    def test_empty_result_has_all_25_fields(self):
        keys = set(EMPTY_RESULT.keys())
        assert len(keys) == 25
        for required in [
            'core_story', 'story_overview', 'chapter_summaries', 'characters',
            'relationships', 'locations', 'key_events', 'timeline',
            'causal_chain', 'dramatic_conflicts', 'high_value_scenes',
            'foreshadowing', 'information_reveal', 'inner_externalization',
            'dialogue_candidates', 'visual_motifs', 'theme_questions',
            'structure_outline', 'cut_and_merge_suggestions', 'adaptation_risks',
            'adaptation_strategy', 'narrative_perspective', 'world_rules',
            'factions', 'uncertain_items',
        ]:
            assert required in keys, f"missing field: {required}"

    def test_empty_result_returns_fresh_copy(self):
        a = empty_result()
        a['characters'].append({'name': 'mutated'})
        b = empty_result()
        assert b['characters'] == []


class TestParseAiResponse(unittest.TestCase):

    def test_direct_json(self):
        text = '{"core_story": {"protagonist": "林秋"}, "characters": [{"name": "林秋"}]}'
        r = parse_ai_response(text)
        assert r['core_story']['protagonist'] == '林秋'
        assert r['characters'][0]['name'] == '林秋'
        assert 'uncertain_items' in r

    def test_markdown_fence(self):
        text = '```json\n{"core_story": {"protagonist": "陈远"}}\n```'
        r = parse_ai_response(text)
        assert r['core_story']['protagonist'] == '陈远'

    def test_garbage_prefix_and_suffix(self):
        text = 'Here is the JSON:\n{"core_story": {"protagonist": "王五"}, "characters": []}\nThanks.'
        r = parse_ai_response(text)
        assert r['core_story']['protagonist'] == '王五'

    def test_empty_input_returns_full_skeleton(self):
        r = parse_ai_response('')
        assert r == EMPTY_RESULT
        r['characters'].append({'name': 'x'})
        assert EMPTY_RESULT['characters'] == []

    def test_malformed_falls_back_to_summary(self):
        r = parse_ai_response('this is just text without json')
        assert isinstance(r['story_overview'], dict)
        assert 'summary' in r['story_overview']
        assert 'just text' in r['story_overview']['summary']

    def test_nested_braces_in_strings(self):
        text = '{"core_story": {"summary": "包含 { 和 } 的字符串"}}'
        r = parse_ai_response(text)
        assert r['core_story']['summary'] == '包含 { 和 } 的字符串'

    def test_missing_fields_get_filled_with_defaults(self):
        text = '{"core_story": {"protagonist": "甲"}}'
        r = parse_ai_response(text)
        assert r['characters'] == []
        assert r['uncertain_items'] == []
        assert r['structure_outline'] == {}


class TestBuildExtractionPrompt(unittest.TestCase):

    def test_includes_novel_title_and_chapter_ids(self):
        chapters = [
            {'chapter_index': 1, 'id': 100, 'title': '第一章', 'content': '正文 A'},
            {'chapter_index': 2, 'id': 101, 'title': '第二章', 'content': '正文 B'},
        ]
        prompt = build_extraction_prompt('测试小说', chapters)
        assert '《测试小说》' in prompt
        assert 'id=100' in prompt
        assert 'id=101' in prompt
        assert '正文 A' in prompt

    def test_forbids_confidence_and_requires_uncertain_items(self):
        prompt = build_extraction_prompt('x', [{'chapter_index': 1, 'id': 1, 'title': 't', 'content': 'c'}])
        assert 'confidence' in prompt
        assert 'uncertain_items' in prompt


if __name__ == '__main__':
    unittest.main()
