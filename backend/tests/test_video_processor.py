"""Unit tests for video_processor's pure helpers — no ffmpeg/network involved."""
import video_processor as vp


class TestComputeKeepSegments:
    def test_no_silences_keeps_whole_clip(self):
        assert vp.compute_keep_segments(10.0, []) == [(0.0, 10.0)]

    def test_silence_in_middle_splits_into_two_keeps(self):
        keeps = vp.compute_keep_segments(10.0, [(4.0, 6.0)])
        assert keeps == [(0.0, 4.0), (6.0, 10.0)]

    def test_leading_silence_is_dropped(self):
        keeps = vp.compute_keep_segments(10.0, [(0.0, 2.0)])
        assert keeps == [(2.0, 10.0)]

    def test_trailing_silence_is_dropped(self):
        keeps = vp.compute_keep_segments(10.0, [(8.0, 10.0)])
        assert keeps == [(0.0, 8.0)]

    def test_silence_spanning_whole_clip_falls_back_to_full_clip(self):
        keeps = vp.compute_keep_segments(10.0, [(0.0, 10.0)])
        assert keeps == [(0.0, 10.0)]

    def test_tiny_gaps_under_threshold_are_ignored(self):
        # gaps <= 0.05s between cursor and next silence start don't produce a keep segment
        keeps = vp.compute_keep_segments(10.0, [(0.02, 5.0), (5.0, 10.0)])
        assert keeps == [(0.0, 10.0)]


class TestSynthCaptions:
    def test_zero_duration_returns_empty(self):
        assert vp.synth_captions(0) == []

    def test_negative_duration_returns_empty(self):
        assert vp.synth_captions(-5) == []

    def test_covers_full_duration_with_windows(self):
        caps = vp.synth_captions(5.0)
        assert len(caps) == 3  # int(5.0 / 1.6) windows
        assert caps[0]["start"] == 0.0
        assert caps[-1]["end"] <= 5.0

    def test_captions_have_word_level_timings(self):
        caps = vp.synth_captions(1.6)
        assert len(caps) == 1
        cap = caps[0]
        assert cap["words"], "expected word-level timings for the fallback phrase"
        assert cap["words"][0]["start"] == cap["start"]
        assert all(w["end"] > w["start"] for w in cap["words"])


class TestGroupWords:
    def test_groups_by_max_words(self):
        # MAX_WORDS groups (default 4-6); each word 0.3s apart keeps duration well under MAX_DUR
        words = [(i * 0.3, i * 0.3 + 0.25, f"w{i}") for i in range(10)]
        caps = vp._group_words(words)
        assert sum(len(c["words"]) for c in caps) == 10
        assert all(len(c["words"]) <= vp.MAX_WORDS for c in caps)

    def test_empty_input_returns_empty(self):
        assert vp._group_words([]) == []

    def test_caption_text_joins_words(self):
        words = [(0.0, 0.3, "hello"), (0.3, 0.6, "world")]
        caps = vp._group_words(words)
        assert len(caps) == 1
        assert caps[0]["text"] == "hello world"

    def test_known_emoji_word_appends_emoji(self):
        words = [(0.0, 0.3, "that"), (0.3, 0.6, "was"), (0.6, 0.9, "fire")]
        caps = vp._group_words(words)
        assert "🔥" in caps[0]["text"]
        assert caps[0]["words"][-1]["word"] == "🔥"


class TestSrtAndAssTime:
    def test_srt_time_formats_hh_mm_ss_ms(self):
        assert vp._srt_time(0) == "00:00:00,000"
        assert vp._srt_time(61.234) == "00:01:01,234"
        assert vp._srt_time(3661.5) == "01:01:01,500"

    def test_ass_time_formats_h_mm_ss_cs(self):
        assert vp._ass_time(0) == "0:00:00.00"
        assert vp._ass_time(61.23) == "0:01:01.23"


class TestHexToAssBgr:
    def test_converts_rrggbb_to_bbggrr(self):
        assert vp._hex_to_ass_bgr("#FF0000") == "&H000000FF"  # red -> BGR
        assert vp._hex_to_ass_bgr("#00FF00") == "&H0000FF00"  # green
        assert vp._hex_to_ass_bgr("#0000FF") == "&H00FF0000"  # blue

    def test_invalid_hex_falls_back_to_white(self):
        assert vp._hex_to_ass_bgr("#ABC") == "&H00FFFFFF"
        assert vp._hex_to_ass_bgr("not-a-color") == "&H00FFFFFF"
