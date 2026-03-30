"""
AgentForge V2 — 多媒体处理器

图片：PaddleOCR 本地 OCR（免费） + base64 编码（供 Vision LLM）
音频：faster-whisper 本地转录（免费）+ 多级降级
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
_AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac", ".aac"}
_MIME_MAP = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
}
_MAX_IMAGE_SIZE = 10 * 1024 * 1024


def is_image(path: Path) -> bool:
    return path.suffix.lower() in _IMAGE_EXTS


def is_audio(path: Path) -> bool:
    return path.suffix.lower() in _AUDIO_EXTS


# ═══════════════════════════════════════════
# 图片处理
# ═══════════════════════════════════════════

_ocr_engine = None
_ocr_available: bool | None = None


def _get_ocr():
    global _ocr_engine, _ocr_available
    if _ocr_available is False:
        return None
    if _ocr_engine is not None:
        return _ocr_engine
    try:
        from paddleocr import PaddleOCR
        _ocr_engine = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
        _ocr_available = True
        logger.info("PaddleOCR 初始化成功")
        return _ocr_engine
    except ImportError:
        logger.info("PaddleOCR 未安装，图片 OCR 不可用")
        _ocr_available = False
        return None
    except Exception as e:
        logger.warning("PaddleOCR 初始化失败: %s", e)
        _ocr_available = False
        return None


def ocr_extract_text(path: Path) -> str:
    """用 PaddleOCR 从图片中提取文字。"""
    ocr = _get_ocr()
    if not ocr:
        return ""
    try:
        result = ocr.ocr(str(path), cls=True)
        if not result or not result[0]:
            return ""
        lines = []
        for line in result[0]:
            text = line[1][0] if line[1] else ""
            score = line[1][1] if line[1] and len(line[1]) > 1 else 0
            if text.strip() and score > 0.5:
                lines.append(text.strip())
        return "\n".join(lines)
    except Exception as e:
        logger.warning("OCR 失败 [%s]: %s", path.name, e)
        return ""


def encode_image_base64(path: Path) -> dict | None:
    """图片 → image_url block（Vision LLM 通用格式）。"""
    if not path.is_file() or path.stat().st_size > _MAX_IMAGE_SIZE:
        return None
    try:
        mime = _MIME_MAP.get(path.suffix.lower(), "image/png")
        data = base64.b64encode(path.read_bytes()).decode("utf-8")
        return {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{data}"}}
    except Exception as e:
        logger.warning("图片编码失败 [%s]: %s", path.name, e)
        return None


def process_image(path: Path) -> dict[str, Any]:
    """统一图片处理入口。"""
    ocr_text = ocr_extract_text(path)
    image_block = encode_image_base64(path)
    size_kb = path.stat().st_size / 1024
    if ocr_text:
        summary = f"[图片 {path.name} ({size_kb:.0f}KB) — OCR 提取到 {len(ocr_text)} 字]"
    else:
        summary = f"[图片 {path.name} ({size_kb:.0f}KB)]"
    return {"ocr_text": ocr_text, "image_block": image_block, "summary": summary}


# ═══════════════════════════════════════════
# 音频处理
# ═══════════════════════════════════════════

_whisper_model = None
_whisper_available: bool | None = None


def _get_whisper():
    global _whisper_model, _whisper_available
    if _whisper_available is False:
        return None
    if _whisper_model is not None:
        return _whisper_model
    try:
        from faster_whisper import WhisperModel
        model_size = os.environ.get("WHISPER_MODEL", "base")
        logger.info("加载 faster-whisper 模型: %s ...", model_size)
        _whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
        _whisper_available = True
        logger.info("faster-whisper 加载完成")
        return _whisper_model
    except ImportError:
        logger.info("faster-whisper 未安装，语音识别不可用")
        _whisper_available = False
        return None
    except Exception as e:
        logger.warning("faster-whisper 加载失败: %s", e)
        _whisper_available = False
        return None


def _whisper_transcribe_sync(model, file_path: str) -> str:
    segments, info = model.transcribe(
        file_path,
        language=os.environ.get("WHISPER_LANGUAGE", "zh"),
        beam_size=5, vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500, speech_pad_ms=300),
    )
    return "\n".join(seg.text.strip() for seg in segments)


async def transcribe_audio(path: Path) -> str:
    """音频 → 文字（字符串版本，供旧代码兼容调用）。"""
    result = await stt_transcribe(path)
    return result["text"] if result["success"] else f"[{result.get('error', '语音识别失败')}]"


async def _dashscope_stt(path: Path, api_key: str) -> str:
    try:
        import openai
        client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
        with open(path, "rb") as f:
            result = await client.audio.transcriptions.create(model="whisper-1", file=f)
        return result.text.strip()
    except Exception as e:
        logger.warning("dashscope whisper API 失败: %s", e)
        return ""


def get_media_capabilities() -> dict:
    """返回当前系统的媒体处理能力。"""
    _get_ocr()
    _get_whisper()
    return {
        "ocr": _ocr_available or False,
        "ocr_engine": "PaddleOCR" if _ocr_available else "不可用",
        "stt": _whisper_available or False,
        "stt_engine": "faster-whisper" if _whisper_available else (
            "dashscope" if os.environ.get("DASHSCOPE_API_KEY") else "不可用"),
    }


# ═══════════════════════════════════════════
# 独立 API 接口（返回 dict，供 media route 使用）
# ═══════════════════════════════════════════

async def ocr_extract(path: Path) -> dict:
    """异步 OCR，返回 {"text", "source", "success", "error?"}。"""
    ocr = _get_ocr()
    if not ocr:
        return {"text": "", "source": "paddleocr", "success": False,
                "error": "PaddleOCR 未安装（pip install paddleocr）"}
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: ocr.ocr(str(path), cls=True))
        if not result or not result[0]:
            return {"text": "", "source": "paddleocr", "success": True, "error": "未检测到文字"}
        lines = []
        for line in result[0]:
            text = line[1][0] if line[1] else ""
            score = line[1][1] if line[1] and len(line[1]) > 1 else 0
            if text.strip() and score > 0.5:
                lines.append(text.strip())
        return {"text": "\n".join(lines), "source": "paddleocr", "success": True}
    except Exception as e:
        return {"text": "", "source": "paddleocr", "success": False, "error": str(e)[:200]}


async def vision_understand(path: Path, prompt: str = "请详细描述这张图片的内容") -> dict:
    """调用 Qwen-VL 看图，返回 {"text", "source", "success", "error?"}。"""
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        return {"text": "", "source": "qwen-vl", "success": False,
                "error": "未配置 DASHSCOPE_API_KEY，AI看图不可用"}
    if not path.is_file() or path.stat().st_size > _MAX_IMAGE_SIZE:
        return {"text": "", "source": "qwen-vl", "success": False, "error": "图片无效或超过 10MB"}
    try:
        mime = _MIME_MAP.get(path.suffix.lower(), "image/png")
        b64 = base64.b64encode(path.read_bytes()).decode("utf-8")
        import openai
        client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
        model = os.environ.get("VISION_MODEL", "qwen-vl-max")
        resp = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                {"type": "text", "text": prompt},
            ]}],
            max_tokens=2000, temperature=0.3,
        )
        text = resp.choices[0].message.content or ""
        return {"text": text.strip(), "source": f"qwen-vl ({model})", "success": True}
    except Exception as e:
        logger.error("Vision 调用失败: %s", e)
        return {"text": "", "source": "qwen-vl", "success": False, "error": str(e)[:200]}


async def _qwen_omni_stt(path: Path, prompt: str = "请将这段音频内容完整转录为文字") -> dict:
    """通过 Qwen3-Omni-Flash 处理音频（STT + 去噪 + 多人对话识别）。"""
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        return {"text": "", "source": "qwen-omni", "success": False,
                "error": "未配置 DASHSCOPE_API_KEY"}
    max_audio_size = 50 * 1024 * 1024
    if not path.is_file() or path.stat().st_size > max_audio_size:
        return {"text": "", "source": "qwen-omni", "success": False,
                "error": f"音频无效或超过 {max_audio_size // 1024 // 1024}MB"}
    try:
        audio_b64 = base64.b64encode(path.read_bytes()).decode("utf-8")
        ext = path.suffix.lower().lstrip(".")
        fmt_map = {"mp3": "mp3", "wav": "wav", "m4a": "m4a", "ogg": "ogg",
                   "webm": "webm", "flac": "flac", "aac": "aac"}
        audio_fmt = fmt_map.get(ext, "mp3")
        import openai
        client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
        model = os.environ.get("OMNI_MODEL", "qwen3-omni-flash")
        resp = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": [
                {"type": "input_audio", "input_audio": {"data": audio_b64, "format": audio_fmt}},
                {"type": "text", "text": prompt},
            ]}],
            max_tokens=4000, temperature=0.3,
            stream=True, modalities=["text"],
            stream_options={"include_usage": True},
        )
        text_parts = []
        async for chunk in resp:
            if chunk.choices:
                delta = chunk.choices[0].delta
                if hasattr(delta, "content") and delta.content:
                    text_parts.append(delta.content)
        text = "".join(text_parts).strip()
        if text:
            logger.info("Qwen-Omni STT 完成: %s → %d 字", path.name, len(text))
            return {"text": text, "source": f"qwen-omni ({model})", "success": True}
        return {"text": "", "source": "qwen-omni", "success": False, "error": "未识别到内容"}
    except Exception as e:
        logger.error("Qwen-Omni 音频处理失败: %s", e)
        return {"text": "", "source": "qwen-omni", "success": False, "error": str(e)[:200]}


async def stt_transcribe(path: Path, prompt: str = "请将这段音频内容完整转录为文字") -> dict:
    """音频转文字。优先 Qwen-Omni → dashscope whisper → 提示配置。"""
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if api_key:
        result = await _qwen_omni_stt(path, prompt)
        if result["success"]:
            return result
        logger.warning("Qwen-Omni STT 失败，尝试降级: %s", result.get("error", ""))
        try:
            text = await _dashscope_stt(path, api_key)
            if text:
                return {"text": text, "source": "dashscope-whisper", "success": True}
        except Exception as e:
            logger.warning("dashscope whisper 降级也失败: %s", e)
    # faster-whisper 入口保留但断开，如需启用取消下面注释：
    # model = _get_whisper()
    # if model:
    #     try:
    #         loop = asyncio.get_event_loop()
    #         text = await asyncio.wait_for(
    #             loop.run_in_executor(None, _whisper_transcribe_sync, model, str(path)), timeout=300)
    #         return {"text": text, "source": "faster-whisper", "success": True}
    #     except Exception as e:
    #         logger.warning("本地 STT 失败: %s", e)
    return {"text": "", "source": "none", "success": False,
            "error": "请配置 DASHSCOPE_API_KEY 以启用语音识别"}


def get_capabilities() -> dict:
    """供前端判断按钮是否可点。"""
    has_key = bool(os.environ.get("DASHSCOPE_API_KEY"))
    return {
        "ocr": _get_ocr() is not None,
        "vision": has_key,
        "stt": has_key,
        "stt_engine": "qwen-omni" if has_key else "不可用",
        "vision_engine": "qwen-vl" if has_key else "不可用",
    }
