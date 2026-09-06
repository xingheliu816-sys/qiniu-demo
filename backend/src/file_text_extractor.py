"""章节文件内容提取。

返回结构统一为 (success, data_or_error)：
    成功: (True, {"text": str, "filename": str, "ext": str, "size": int, "encoding": str})
    失败: (False, {"code": str, "message": str})

调用方根据 success 决定走成功分支还是把 error.code / error.message 返回给前端。
当前支持 .txt / .md / .docx（python-docx）。.pdf / .doc 暂不支持，对中文 PDF 与扫描版
PDF 的文本抽取效果不可靠，统一让用户改用文本转换。
"""

import io
import os
import sys
import logging
import traceback

logger = logging.getLogger(__name__)
if not logger.handlers:
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter(
        '[%(asctime)s][%(name)s][%(levelname)s] %(message)s'
    ))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


MAX_FILE_SIZE = 10 * 1024 * 1024
TEXT_EXTENSIONS = {'.txt', '.md'}
DOCX_EXTENSION = '.docx'
DECODE_ENCODINGS = ('utf-8-sig', 'utf-8', 'gbk', 'gb2312', 'gb18030')


def _error(code, message):
    return False, {'code': code, 'message': message}


def _success(text, filename, ext, size, encoding):
    return True, {
        'text': text,
        'filename': filename,
        'ext': ext,
        'size': size,
        'encoding': encoding,
    }


def extract_text_from_file(file_storage, user_id=None, chapter_id=None):
    """从 FileStorage 中提取纯文本。

    file_storage: Flask 的 request.files[<key>]。
    user_id / chapter_id: 用于日志，便于排查具体用户/章节的失败。
    """
    if file_storage is None:
        logger.warning('[import-file] user=%s chapter=%s 缺少 file 字段', user_id, chapter_id)
        return _error('NO_FILE', '请先选择文件。')

    filename = (file_storage.filename or '').strip()
    if not filename:
        logger.warning('[import-file] user=%s chapter=%s filename 为空', user_id, chapter_id)
        return _error('EMPTY_FILENAME', '文件名为空。')

    ext = os.path.splitext(filename)[1].lower()
    logger.info(
        '[import-file] user=%s chapter=%s filename=%s ext=%s',
        user_id, chapter_id, filename, ext,
    )

    if ext == '.doc':
        return _error('UNSUPPORTED_FILE_TYPE', '暂不支持 .doc 格式，请转换为 .docx 或 .txt 后上传。')
    if ext == '.pdf':
        return _error('UNSUPPORTED_FILE_TYPE', '暂不支持 .pdf 格式（对中文与扫描版 PDF 抽取效果不可靠），请改用 .txt / .md / .docx 或先粘贴文本。')
    if ext not in TEXT_EXTENSIONS and ext != DOCX_EXTENSION:
        return _error('UNSUPPORTED_FILE_TYPE', '暂不支持该文件格式。当前支持 .txt / .md / .docx。')

    try:
        raw = file_storage.read()
    except Exception as e:
        logger.error('[import-file] 读取文件流失败: %s\n%s', e, traceback.format_exc())
        return _error('FILE_PARSE_FAILED', '文件读取失败，请重新上传。')

    size = len(raw or b'')
    logger.info('[import-file] user=%s chapter=%s size=%d bytes', user_id, chapter_id, size)
    if size == 0:
        return _error('EMPTY_FILE_CONTENT', '文件内容为空，请重新上传。')
    if size > MAX_FILE_SIZE:
        return _error('FILE_TOO_LARGE', '文件过大，请上传 10MB 以内的文本文件。')

    try:
        if ext in TEXT_EXTENSIONS:
            text, encoding = _decode_text(raw)
        elif ext == DOCX_EXTENSION:
            text = _extract_docx(raw)
            encoding = 'docx'
        else:
            return _error('UNSUPPORTED_FILE_TYPE', '暂不支持该文件格式。当前支持 .txt / .md / .docx。')
    except _DependencyMissingError as e:
        logger.error('[import-file] 依赖缺失: %s', e)
        return _error('UNSUPPORTED_FILE_TYPE', str(e))
    except _DecodeFailedError as e:
        logger.warning('[import-file] 解码失败: %s', e)
        return _error('DECODE_FAILED', '文件编码无法识别，请另存为 UTF-8 后重试，或改用文本转换。')
    except Exception as e:
        logger.error('[import-file] 解析异常: %s\n%s', e, traceback.format_exc())
        return _error('FILE_PARSE_FAILED', '文件解析失败，请检查文件内容或改用文本转换。')

    text = (text or '').strip()
    if not text:
        return _error('EMPTY_FILE_CONTENT', '文件内容为空，请重新上传。')

    preview = text[:100].replace('\n', '\\n')
    logger.info(
        '[import-file] user=%s chapter=%s 解码成功 encoding=%s 文本长度=%d 预览=%r',
        user_id, chapter_id, encoding, len(text), preview,
    )
    return _success(text, filename, ext, size, encoding)


class _DecodeFailedError(Exception):
    pass


class _DependencyMissingError(Exception):
    pass


def _decode_text(raw):
    """按候选编码逐个尝试解码 bytes。"""
    for encoding in DECODE_ENCODINGS:
        try:
            return raw.decode(encoding), encoding
        except UnicodeDecodeError:
            continue
    raise _DecodeFailedError('所有候选编码均无法解码')


def _extract_docx(raw):
    try:
        from docx import Document
    except ImportError:
        raise _DependencyMissingError('服务器未安装 python-docx，暂不支持 .docx，请改用 .txt / .md 或先粘贴文本。')
    try:
        doc = Document(io.BytesIO(raw))
        parts = [p.text for p in doc.paragraphs if p.text and p.text.strip()]
        return '\n'.join(parts)
    except Exception as e:
        raise RuntimeError(f'docx 解析失败: {e}') from e
